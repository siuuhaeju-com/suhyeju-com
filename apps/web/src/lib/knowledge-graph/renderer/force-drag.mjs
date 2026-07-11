import { forceLink, forceManyBody, forceSimulation } from 'd3-force';
import {
  getForceSettings,
  getDragThresholds,
  getResponseSpeed,
  getForceDepth,
  ORPHAN_CENTER_MULTIPLIER,
} from './force-settings.mjs';
import { isOrganicLayout } from './layouts/layout-mode.mjs';
import { getMapCenter } from './layout-utils.mjs';

const DRAG_THRESHOLD_PX = 5;
/** centerStrength × mix × 거리 에 곱하는 스케일 (F ∝ r) */
const DISTANCE_GATHER_K = 0.024;
const BASE_VELOCITY_DECAY = 0.4;
const DRAG_ALPHA_MAX = 0.32;
const SETTLE_ALPHA = 0.48;

/**
 * Cytoscape renderer와 동일한 client → model 변환.
 * (padding/border/CSS scale 반영 — 수동 rect 계산과 불일치 시 순간이동 원인)
 * @param {import("cytoscape").Core} cy
 * @param {PointerEvent} sourceEvent
 */
function pointerToModel(cy, sourceEvent) {
  const [x, y] = cy.renderer().projectIntoViewport(sourceEvent.clientX, sourceEvent.clientY);
  return { x, y };
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {PointerEvent} sourceEvent
 * @returns {import("cytoscape").NodeSingular | null}
 */
function nodeAtPointer(cy, sourceEvent) {
  const [x, y] = cy.renderer().projectIntoViewport(sourceEvent.clientX, sourceEvent.clientY);
  const hit = cy.renderer().findNearestElement(x, y, true, false);
  return hit && hit.isNode() ? hit : null;
}

/**
 * @param {ReturnType<typeof buildSimulation>["nodes"]} nodes
 */
function syncAllDatumsFromCy(nodes) {
  nodes.forEach((d) => {
    const p = d.cyNode.position();
    d.x = p.x;
    d.y = p.y;
  });
}

/**
 * 중심축 기준 당김 — 맵 중심으로, 멀수록 힘이 커짐 (F ∝ r).
 * @param {{ getMapCenter: () => { x: number; y: number }; settings: import("./force-settings.mjs").ForceSettings; mix: number }} params
 */
function createDistanceGatherForce(params) {
  /** @type {Array<{ x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null; degree?: number }>} */
  let nodes = [];

  function force(alpha) {
    const { getMapCenter, settings, mix } = params;
    if (mix <= 0.15 || settings.centerStrength <= 0) return;

    const centerPos = getMapCenter();
    const k = settings.centerStrength * mix * DISTANCE_GATHER_K;

    for (const d of nodes) {
      if (d.fx != null || d.fy != null) continue;

      const dx = centerPos.x - d.x;
      const dy = centerPos.y - d.y;
      const mult = (d.degree ?? 0) === 0 ? ORPHAN_CENTER_MULTIPLIER : 1;

      d.vx = (d.vx ?? 0) + dx * k * mult * alpha;
      d.vy = (d.vy ?? 0) + dy * k * mult * alpha;
    }
  }

  force.initialize = (_nodes) => {
    nodes = _nodes;
  };

  return force;
}

function clearGatherForces(simulation) {
  simulation.force('distanceGather', null);
}

/**
 * 맵 중심축 당김 + 링크/반발 파라미터 적용.
 * @param {import("d3-force").Simulation} simulation
 * @param {number} mix
 * @param {{ getMapCenter: () => { x: number; y: number }; settings: import("./force-settings.mjs").ForceSettings; mix: number; _force?: ReturnType<typeof createDistanceGatherForce> } | null} [gatherParams]
 */
function applyForceParams(simulation, mix, gatherParams) {
  const settings = getForceSettings();
  const link = simulation.force('link');
  const charge = simulation.force('charge');
  if (link) {
    link.strength(settings.linkStrength * mix).distance(settings.linkDistance);
  }
  if (charge) {
    charge.strength(-settings.repulsion * mix);
  }
  if (gatherParams) {
    gatherParams.settings = settings;
    gatherParams.mix = mix;
  }
  if (mix > 0.15 && settings.centerStrength > 0 && gatherParams?._force) {
    simulation.force('distanceGather', gatherParams._force);
  } else {
    clearGatherForces(simulation);
  }
}

/**
 * @param {ReturnType<typeof buildSimulation>["nodes"]} nodes
 * @param {ReturnType<typeof buildSimulation>["links"]} links
 */
function annotateDegrees(nodes, links) {
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const link of links) {
    degree.set(link.source.id, (degree.get(link.source.id) ?? 0) + 1);
    degree.set(link.target.id, (degree.get(link.target.id) ?? 0) + 1);
  }
  nodes.forEach((d) => {
    d.degree = degree.get(d.id) ?? 0;
  });
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {string} rootId
 * @param {number} maxDepth
 * @returns {Map<string, number>}
 */
function collectNodeDepths(cy, rootId, maxDepth) {
  const unlimited = !Number.isFinite(maxDepth) || maxDepth <= 0;
  /** @type {Map<string, number>} */
  const depths = new Map([[rootId, 0]]);
  /** @type {string[]} */
  const queue = [rootId];

  while (queue.length) {
    const id = queue.shift();
    const d = depths.get(id) ?? 0;
    if (!unlimited && d >= maxDepth) continue;

    cy.getElementById(id)
      .connectedEdges()
      .forEach((edge) => {
        const other = edge.source().id() === id ? edge.target() : edge.source();
        const oid = other.id();
        if (!depths.has(oid)) {
          depths.set(oid, d + 1);
          queue.push(oid);
        }
      });
  }

  return depths;
}

/**
 * @param {import("cytoscape").NodeSingular} cyNode
 */
function datumFromCyNode(cyNode) {
  const p = cyNode.position();
  return { id: cyNode.id(), x: p.x, y: p.y, cyNode };
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {{ rootId: string; maxDepth?: number }} opts
 */
function buildSimulation(cy, opts) {
  const { rootId } = opts;
  const maxDepth = opts.maxDepth ?? getForceDepth();
  const depthMap = collectNodeDepths(cy, rootId, maxDepth);
  const nodeIds = [...depthMap.keys()];

  /** @type {{ id: string; x: number; y: number; depth: number; degree?: number; fx?: number | null; fy?: number | null; cyNode: import("cytoscape").NodeSingular }[]} */
  const nodes = nodeIds.map((id) => {
    const cyNode = cy.getElementById(id);
    const p = cyNode.position();
    return {
      id,
      x: p.x,
      y: p.y,
      depth: depthMap.get(id) ?? 0,
      cyNode,
    };
  });

  const byId = new Map(nodes.map((d) => [d.id, d]));
  const idSet = new Set(nodeIds);
  const links = cy
    .edges()
    .filter((e) => idSet.has(e.source().id()) && idSet.has(e.target().id()))
    .map((e) => ({
      source: byId.get(e.source().id()),
      target: byId.get(e.target().id()),
    }))
    .filter((l) => l.source && l.target);

  for (const d of nodes) {
    if (Number.isFinite(maxDepth) && maxDepth > 0 && d.depth === maxDepth && d.id !== rootId) {
      d.fx = d.x;
      d.fy = d.y;
    }
  }

  annotateDegrees(nodes, links);
  const settings = getForceSettings();
  const motionSpeed = getResponseSpeed(settings);

  const gatherParams = {
    getMapCenter: () => getMapCenter(cy),
    settings,
    mix: 1,
    _force: null,
  };
  gatherParams._force = createDistanceGatherForce(gatherParams);

  const simulation = forceSimulation(nodes)
    .velocityDecay(BASE_VELOCITY_DECAY + (1 - motionSpeed) * 0.25)
    .force(
      'link',
      forceLink(links)
        .id((d) => d.id)
        .distance(settings.linkDistance)
        .strength(settings.linkStrength),
    )
    .force('charge', forceManyBody().strength(-settings.repulsion))
    .force('distanceGather', gatherParams._force)
    .alpha(0)
    .alphaDecay(0.08 * motionSpeed)
    .on('tick', () => {
      for (const d of nodes) {
        d.cyNode.position({ x: d.x, y: d.y });
      }
    });

  applyForceParams(simulation, 1, gatherParams);

  return { simulation, nodes, links, gatherParams, rootId, maxDepth };
}

/**
 * @param {ReturnType<typeof buildSimulation>["nodes"]} nodes
 * @param {string} [exceptId]
 */
function releaseAllPins(nodes, exceptId) {
  nodes.forEach((d) => {
    if (exceptId && d.id === exceptId) return;
    d.fx = null;
    d.fy = null;
  });
}

/**
 * @param {ReturnType<typeof buildSimulation>["nodes"]} nodes
 * @param {string} draggedId
 */
function releaseDragPin(nodes, draggedId) {
  const d = nodes.find((n) => n.id === draggedId);
  if (d) {
    d.fx = null;
    d.fy = null;
  }
}

function forceMixFromDragPx(dragPx, settings = getForceSettings()) {
  const { engage, ramp } = getDragThresholds(settings);
  if (dragPx < engage) return 0;
  return Math.min(1, (dragPx - engage) / (ramp - engage));
}

function applyDragForces(simulation, mix, gatherParams) {
  applyForceParams(simulation, mix, gatherParams);
}

function settleSimulation(simulation, gatherParams, onComplete) {
  const motionSpeed = getResponseSpeed();
  applyForceParams(simulation, 1, gatherParams);
  simulation.on('end', null);
  simulation.alphaTarget(0);
  simulation.alpha(SETTLE_ALPHA * motionSpeed).restart();
  simulation.on('end', () => {
    simulation.stop();
    simulation.on('end', null);
    onComplete?.();
  });
}

function stopSimulationState(state) {
  state?.simulation?.stop();
  state?.simulation?.on('end', null);
}

/**
 * Pointer capture 기반 force drag.
 * @param {import("cytoscape").Core} cy
 * @param {{ onTap?: (node: import("cytoscape").NodeSingular) => void; onDragStart?: () => void; onDragEnd?: () => void }} [hooks]
 */
export function bindForceDrag(cy, hooks = {}) {
  if (cy._kgForceDragBound) return;
  cy._kgForceDragBound = true;

  /** @type {ReturnType<typeof buildSimulation> | null} */
  let simState = null;
  const container = cy.container();
  container.style.touchAction = 'none';

  /** @type {{
   *   pointerId: number;
   *   datum: ReturnType<typeof datumFromCyNode>;
   *   startClient: { x: number; y: number };
   *   grabOffset: { x: number; y: number };
   *   dragging: boolean;
   *   forceActive: boolean;
   *   lastDragPx: number;
   *   savedPan: boolean;
   *   savedZoom: boolean;
   * } | null} */
  let dragState = null;

  function clearSimulation() {
    stopSimulationState(simState);
    simState = null;
  }

  function startDragSimulation(rootId) {
    stopSimulationState(simState);
    simState = buildSimulation(cy, { rootId, maxDepth: getForceDepth() });
    return simState.nodes.find((d) => d.id === rootId) ?? null;
  }

  function rebuild() {
    const wasDragging = Boolean(dragState?.dragging);
    const rootId = dragState?.datum.id;
    if (dragState) finishDrag(false);
    clearSimulation();
    if (!isOrganicLayout(cy) || wasDragging || !rootId) return;
  }

  function applyLiveForceSettings() {
    if (!simState) return;

    const motionSpeed = getResponseSpeed();
    simState.simulation.velocityDecay(BASE_VELOCITY_DECAY + (1 - motionSpeed) * 0.25);
    simState.simulation.alphaDecay(0.08 * motionSpeed);

    if (dragState?.dragging) {
      const rootId = dragState.datum.id;
      stopSimulationState(simState);
      simState = buildSimulation(cy, { rootId, maxDepth: getForceDepth() });
      const datum = simState.nodes.find((d) => d.id === rootId);
      if (datum) {
        dragState.datum = datum;
        datum.fx = datum.x;
        datum.fy = datum.y;
      }
      syncAllDatumsFromCy(simState.nodes);
      const mix = forceMixFromDragPx(dragState.lastDragPx ?? 0);
      if (mix > 0) {
        applyForceParams(simState.simulation, mix, simState.gatherParams);
        simState.simulation.alphaTarget(DRAG_ALPHA_MAX * motionSpeed * mix);
        if (simState.simulation.alpha() < 0.05) {
          simState.simulation.alpha(0.1 * mix).restart();
        }
      }
    }
  }

  cy._kgForceDragRebuild = rebuild;
  cy._kgApplyForceSettings = applyLiveForceSettings;

  function finishDrag(openTap) {
    if (!dragState) return;

    const { datum, dragging, savedPan, savedZoom, pointerId } = dragState;

    try {
      if (container.hasPointerCapture(pointerId)) {
        container.releasePointerCapture(pointerId);
      }
    } catch {
      /* ignore */
    }

    if (simState) {
      releaseDragPin(simState.nodes, datum.id);
      simState.simulation.alphaTarget(0);
    }

    if (dragging) {
      cy.userPanningEnabled(savedPan);
      cy.zoomingEnabled(savedZoom);
      datum.cyNode.unselect();
      if (simState) {
        syncAllDatumsFromCy(simState.nodes);
        if (isOrganicLayout(cy)) {
          const state = simState;
          settleSimulation(state.simulation, state.gatherParams, () => {
            releaseAllPins(state.nodes);
            if (simState === state) clearSimulation();
          });
        } else {
          clearSimulation();
        }
      }
      hooks.onDragEnd?.();
    } else if (openTap) {
      clearSimulation();
      hooks.onTap?.(datum.cyNode);
    } else {
      clearSimulation();
    }

    dragState = null;
  }

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;

    const cyNode = nodeAtPointer(cy, event);
    if (!cyNode) return;

    finishDrag(false);
    event.preventDefault();
    event.stopPropagation();
    container.setPointerCapture(event.pointerId);

    const datum = datumFromCyNode(cyNode);
    const pointerModel = pointerToModel(cy, event);
    dragState = {
      pointerId: event.pointerId,
      datum,
      startClient: { x: event.clientX, y: event.clientY },
      grabOffset: {
        x: datum.x - pointerModel.x,
        y: datum.y - pointerModel.y,
      },
      dragging: false,
      forceActive: false,
      lastDragPx: 0,
      savedPan: cy.userPanningEnabled(),
      savedZoom: cy.zoomingEnabled(),
    };
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    if ((event.buttons & 1) === 0) {
      finishDrag(false);
      return;
    }

    const dist = Math.hypot(
      event.clientX - dragState.startClient.x,
      event.clientY - dragState.startClient.y,
    );
    dragState.lastDragPx = dist;

    if (!dragState.dragging) {
      if (dist < DRAG_THRESHOLD_PX) return;
      if (!isOrganicLayout(cy)) return;

      dragState.dragging = true;
      cy.stop(true, false);
      cy.userPanningEnabled(false);
      cy.zoomingEnabled(false);
      clearSimulation();

      const dragged = startDragSimulation(dragState.datum.id);
      if (dragged) {
        dragState.datum = dragged;
        dragged.fx = dragged.x;
        dragged.fy = dragged.y;
      }

      dragState.datum.cyNode.unselect();
      hooks.onDragStart?.();
    }

    const pointerModel = pointerToModel(cy, event);
    const model = {
      x: pointerModel.x + dragState.grabOffset.x,
      y: pointerModel.y + dragState.grabOffset.y,
    };
    const { datum } = dragState;
    datum.fx = model.x;
    datum.fy = model.y;
    datum.x = model.x;
    datum.y = model.y;
    datum.cyNode.position(model);

    const forceMix = forceMixFromDragPx(dist);
    const motionSpeed = getResponseSpeed();
    if (forceMix > 0 && simState) {
      dragState.forceActive = true;
      applyDragForces(simState.simulation, forceMix, simState.gatherParams);
      simState.simulation.alphaTarget(DRAG_ALPHA_MAX * motionSpeed * forceMix);
      if (simState.simulation.alpha() < 0.02) {
        simState.simulation.alpha(0.06 * forceMix).restart();
      }
    } else if (dragState.forceActive && simState) {
      dragState.forceActive = false;
      simState.simulation.alphaTarget(0);
      simState.simulation.stop();
      clearGatherForces(simState.simulation);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const openTap = !dragState.dragging;
    finishDrag(openTap);
    event.preventDefault();
    event.stopPropagation();
  }

  /** @param {PointerEvent} event */
  function onPointerCancel(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    finishDrag(false);
  }

  function onWindowBlur() {
    finishDrag(false);
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', onWindowBlur);

  cy._kgForceDragTeardown = () => {
    finishDrag(false);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onWindowBlur);
    cy._kgForceDragBound = false;
  };

  cy.nodes().ungrabify().unpanify().unselectify();
}

/** @param {import("cytoscape").Core} cy */
export function syncForceSimulation(cy) {
  if (typeof cy._kgApplyForceSettings === 'function') {
    cy._kgApplyForceSettings();
    return;
  }
  if (typeof cy._kgForceDragRebuild === 'function') {
    cy._kgForceDragRebuild();
  }
}

/** @param {import("cytoscape").Core} cy */
export function refreshNodeDraggability(cy) {
  cy.nodes().ungrabify().unpanify().unselectify();
  syncForceSimulation(cy);
}
