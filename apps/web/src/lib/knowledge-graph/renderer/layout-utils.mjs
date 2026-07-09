/** @typedef {{ id: string; x1: number; y1: number; x2: number; y2: number }} NodeBox */

const DEFAULT_LABEL_PAD = 12;
const LABEL_BOTTOM_EXTRA = 18;

/** 노드 포커스·전체 그래프 기본 뷰포트 (클릭 시 맞춤과 동일) */
export const DEFAULT_VIEW_FIT = {
  padding: 56,
  maxZoom: 1.75,
  duration: 0,
};

/**
 * Cytoscape 맵(컨테이너) 중심의 모델 좌표.
 * 연결 클러스터와 무관 — pan/zoom 기준 화면 가운데가 중심축.
 * @param {import("cytoscape").Core} cy
 */
export function getMapCenter(cy) {
  const zoom = cy.zoom() || 1;
  const pan = cy.pan();
  return {
    x: (cy.width() / 2 - pan.x) / zoom,
    y: (cy.height() / 2 - pan.y) / zoom,
  };
}

/**
 * @param {import("cytoscape").NodeSingular} node
 * @param {number} labelPad
 * @returns {NodeBox}
 */
function nodeBox(node, labelPad) {
  const bb = node.boundingBox();
  const label = node.style('label');
  const bottomExtra = label && label !== '' ? LABEL_BOTTOM_EXTRA : 0;
  return {
    id: node.id(),
    x1: bb.x1 - labelPad,
    y1: bb.y1 - labelPad,
    x2: bb.x2 + labelPad,
    y2: bb.y2 + labelPad + bottomExtra,
  };
}

/**
 * @param {NodeBox} a
 * @param {NodeBox} b
 */
function boxesOverlap(a, b) {
  return !(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1);
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {{ labelPadding?: number }} [opts]
 */
export function measureOverlaps(cy, opts = {}) {
  const labelPad = opts.labelPadding ?? DEFAULT_LABEL_PAD;
  const nodes = cy.nodes();
  /** @type {NodeBox[]} */
  const boxes = nodes.map((n) => nodeBox(n, labelPad));

  let overlapCount = 0;
  /** @type {string[][]} */
  const pairs = [];

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) {
        overlapCount += 1;
        pairs.push([boxes[i].id, boxes[j].id]);
      }
    }
  }

  return { overlapCount, pairs, nodeCount: nodes.length };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function minNodeDistance(cy) {
  const nodes = cy.nodes();
  let min = Infinity;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position();
      const b = nodes[j].position();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < min) min = d;
    }
  }

  return min === Infinity ? 0 : min;
}

/**
 * @param {import("cytoscape").NodeSingular} node
 * @param {number} labelPad
 */
function paddedBounds(node, labelPad) {
  const bb = node.boundingBox();
  const label = node.style('label');
  const bottomExtra = label && label !== '' ? LABEL_BOTTOM_EXTRA : 0;
  return {
    x1: bb.x1 - labelPad,
    y1: bb.y1 - labelPad,
    x2: bb.x2 + labelPad,
    y2: bb.y2 + labelPad + bottomExtra,
  };
}

/**
 * Repulsion pass — same padded bounds as {@link measureOverlaps}.
 * @param {import("cytoscape").Core} cy
 * @param {{ minGap?: number; maxIterations?: number; labelPadding?: number }} [opts]
 */
export function ensureNoOverlap(cy, opts = {}) {
  const labelPad = opts.labelPadding ?? DEFAULT_LABEL_PAD;
  const minGap = opts.minGap ?? 6;
  const maxIterations = opts.maxIterations ?? 300;
  const nodes = cy.nodes().toArray();

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const bbA = paddedBounds(a, labelPad);
        const bbB = paddedBounds(b, labelPad);

        const overlapX = Math.min(bbA.x2, bbB.x2) - Math.max(bbA.x1, bbB.x1);
        const overlapY = Math.min(bbA.y2, bbB.y2) - Math.max(bbA.y1, bbB.y1);

        if (overlapX > -minGap && overlapY > -minGap) {
          const ax = a.position('x');
          const ay = a.position('y');
          const bx = b.position('x');
          const by = b.position('y');
          let dx = bx - ax;
          let dy = by - ay;
          const dist = Math.hypot(dx, dy) || 1;
          const push = (minGap + Math.max(overlapX, overlapY, 0)) * 0.65;
          dx = (dx / dist) * push;
          dy = (dy / dist) * push;
          a.position({ x: ax - dx, y: ay - dy });
          b.position({ x: bx + dx, y: by + dy });
          moved = true;
        }
      }
    }

    if (!moved) break;
    if (measureOverlaps(cy, { labelPadding: labelPad }).overlapCount === 0) break;
  }
}

/** 레이아웃 알고리즘이 정해진 좌표를 쓰는 경우 — finishLayout에서 겹침 보정·뷰 fit 분기 */
const FIXED_LAYOUTS = new Set([
  'circle',
  'breadthfirst',
  'concentric',
  'grid',
  'preset',
  'ring',
  'hierarchy',
]);

/**
 * 고립 노드를 맵 중심 주변 원에 배치.
 * @param {import("cytoscape").Core} cy
 */
export function gatherOrphanNodes(cy) {
  const orphans = cy.nodes().filter((n) => n.degree(false) === 0);
  if (orphans.length === 0) return;

  const { x: cx, y: centerY } = getMapCenter(cy);
  const total = cy.nodes().length;
  const radius = Math.max(72, Math.sqrt(total) * 36);

  orphans.forEach((node, i) => {
    const angle = (i / orphans.length) * Math.PI * 2 - Math.PI / 2;
    node.position({
      x: cx + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  });
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {{ minGap?: number; labelPadding?: number; layoutName?: string; fit?: boolean }} [opts]
 */
export function finishLayout(cy, opts = {}) {
  const layoutName = opts.layoutName ?? cy._kgLastLayout?.name;
  const isFixedLayout = FIXED_LAYOUTS.has(layoutName);
  const labelPadding = opts.labelPadding ?? DEFAULT_LABEL_PAD;
  const minGap = opts.minGap ?? 18;

  if (!isFixedLayout) {
    gatherOrphanNodes(cy);

    if (measureOverlaps(cy, { labelPadding }).overlapCount > 0) {
      const nodes = cy.nodes().toArray();
      const radius = 140;
      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2;
        node.position({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
    }

    for (let pass = 0; pass < 10; pass++) {
      ensureNoOverlap(cy, { minGap, labelPadding, maxIterations: 400 });
      if (measureOverlaps(cy, { labelPadding }).overlapCount === 0) break;
    }
  }

  cy.nodes().grabify();

  if (opts.fit !== false) {
    fitWithMaxZoom(cy, cy.elements(), {
      ...DEFAULT_VIEW_FIT,
      onComplete: () => {
        cy._kgLayoutIdle = true;
      },
    });
  } else {
    cy._kgLayoutIdle = true;
  }
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {import("cytoscape").LayoutOptions} layoutOpts
 */
export function runLayoutWithFinish(cy, layoutOpts) {
  cy._kgLayoutIdle = false;
  cy.stop(true, false);
  const layout = cy.layout({ ...layoutOpts, fit: false });
  layout.one('layoutstop', () => finishLayout(cy, { layoutName: layoutOpts.name }));
  layout.run();
  return layout;
}

export function fitWithMaxZoom(cy, eles, opts = {}) {
  const padding = opts.padding ?? DEFAULT_VIEW_FIT.padding;
  const maxZoom = opts.maxZoom ?? DEFAULT_VIEW_FIT.maxZoom;
  const duration = opts.duration ?? DEFAULT_VIEW_FIT.duration;

  cy.stop(true, false);
  cy.animate({
    fit: { eles, padding },
    duration,
    complete: () => {
      if (cy.zoom() > maxZoom) {
        cy.zoom(maxZoom);
        cy.center(eles);
      }
      const minZoom = opts.minZoom;
      if (minZoom != null && cy.zoom() < minZoom) {
        cy.zoom(minZoom);
        cy.center(eles);
      }
      opts.onComplete?.();
    },
  });
}
