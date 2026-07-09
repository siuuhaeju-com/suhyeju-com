import cytoscape from 'cytoscape';
import anywherePanning from 'cytoscape-anywhere-panning';
import autopanOnDrag from 'cytoscape-autopan-on-drag';
import BubbleSets from 'cytoscape-bubblesets';
import cytoscapeLayers from 'cytoscape-layers';
import edgeEditing from 'cytoscape-edge-editing';
import edgehandles from 'cytoscape-edgehandles';
import Konva from 'konva';

const STORAGE_KEY = 'knowledge-graph-extensions';

/** @typedef {keyof typeof DEFAULT_EXTENSION_OPTIONS} ExtensionKey */

export const EXTENSION_GROUPS = [
  {
    id: 'pan-drag',
    label: 'Pan & Drag',
    items: [
      { key: 'anywherePanning', label: 'Anywhere panning' },
      { key: 'autopanOnDrag', label: '드래그 시 자동 팬' },
    ],
  },
  {
    id: 'layout-assist',
    label: 'Layout assist',
    items: [{ key: 'bubblesets', label: 'Bubble groups' }],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { key: 'edgeEditing', label: 'Edge bend editing' },
      { key: 'edgehandles', label: 'Create edges (handles)' },
    ],
  },
];

export const DEFAULT_EXTENSION_OPTIONS = {
  anywherePanning: false,
  autopanOnDrag: false,
  bubblesets: false,
  edgeEditing: false,
  edgehandles: false,
};

let extensionsRegistered = false;

/** @type {WeakMap<import('cytoscape').Core, object>} */
const runtimeByCy = new WeakMap();

export function registerExtensions() {
  if (extensionsRegistered) return;
  try {
    cytoscape.use(anywherePanning);
    cytoscape.use(edgehandles);
    cytoscape.use(cytoscapeLayers);
    cytoscape.use(BubbleSets);
    autopanOnDrag(cytoscape);
    edgeEditing(cytoscape, Konva);
    extensionsRegistered = true;
  } catch (err) {
    console.warn('[extensions] register failed:', err);
  }
}

export function getExtensionOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EXTENSION_OPTIONS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_EXTENSION_OPTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_EXTENSION_OPTIONS };
  }
}

/** @param {Partial<typeof DEFAULT_EXTENSION_OPTIONS>} patch */
export function saveExtensionOptions(patch) {
  const next = { ...getExtensionOptions(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function getRuntime(cy) {
  let runtime = runtimeByCy.get(cy);
  if (!runtime) {
    runtime = {
      bubblesets: null,
      bubblePaths: [],
      autopan: null,
      edgehandles: null,
      edgeEditing: false,
      anywherePanning: false,
    };
    runtimeByCy.set(cy, runtime);
  }
  return runtime;
}

function hexToRgba(hex, alpha) {
  const value = hex.trim();
  if (!value.startsWith('#')) {
    return `rgba(56, 189, 248, ${alpha})`;
  }
  const raw = value.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildBubblePaths(cy, themeVars, runtime) {
  const bb = cy.bubbleSets();
  runtime.bubblesets = bb;
  runtime.bubblePaths = [];

  const colorMap = {
    News: themeVars.nodeNews,
    Sector: themeVars.nodeSector,
    EdgeNode: themeVars.nodeEdgeNode,
    Company: themeVars.nodeCompany,
  };

  for (const [type, color] of Object.entries(colorMap)) {
    const nodes = cy.nodes(`[type = "${type}"]`);
    if (nodes.empty()) continue;

    const internalEdges = cy.edges().filter((edge) => {
      return nodes.contains(edge.source()) && nodes.contains(edge.target());
    });

    const path = bb.addPath(nodes, internalEdges, null, {
      throttle: 80,
      style: {
        fill: hexToRgba(color, 0.08),
        stroke: hexToRgba(color, 0.28),
        strokeWidth: '1px',
      },
    });
    runtime.bubblePaths.push(path);
  }
}

/**
 * @param {import('cytoscape').Core} cy
 * @param {Partial<typeof DEFAULT_EXTENSION_OPTIONS>} [options]
 * @param {{ themeVars?: () => object; onNodeDetail?: (node: import('cytoscape').NodeSingular) => void; onResetLayout?: () => void }} [ctx]
 */
export function initExtensions(cy, options = {}, ctx = {}) {
  cleanupExtensions(cy);

  const opts = { ...DEFAULT_EXTENSION_OPTIONS, ...options };
  const runtime = getRuntime(cy);
  const themeVars = ctx.themeVars?.() ?? {};

  if (opts.anywherePanning) {
    console.warn(
      '[extensions] anywherePanning은 노드 드래그와 충돌합니다. 배경 팬은 기본 pan을 사용하세요.',
    );
  }

  // anywherePanning: 노드 위에서도 panBy → 전체가 끌려오는 것처럼 보임. 사용하지 않음.

  if (opts.autopanOnDrag) {
    try {
      runtime.autopan = cy.autopanOnDrag({
        enabled: true,
        selector: 'node',
        speed: 1,
      });
      runtime.autopan?.enable?.();
    } catch (err) {
      console.warn('[extensions] autopanOnDrag:', err);
    }
  }

  if (opts.bubblesets) {
    try {
      cy.ready(() => buildBubblePaths(cy, themeVars, runtime));
    } catch (err) {
      console.warn('[extensions] bubblesets:', err);
    }
  }

  if (opts.edgeEditing && !runtime.edgeEditing) {
    try {
      cy.edgeEditing({
        addBendMenuItemTitle: false,
        removeBendMenuItemTitle: false,
        addControlMenuItemTitle: false,
        removeControlMenuItemTitle: false,
        removeAllBendMenuItemTitle: false,
        removeAllControlMenuItemTitle: false,
        enableCreateAnchorOnDrag: true,
        handleAnchors: true,
        handleReconnectEdge: true,
        anchorColor: themeVars.accent || accentFromCss(),
      });
      runtime.edgeEditing = true;
    } catch (err) {
      console.warn('[extensions] edgeEditing:', err);
    }
  }

  if (opts.edgehandles) {
    try {
      const eh = cy.edgehandles({
        canConnect(sourceNode, targetNode) {
          return !sourceNode.same(targetNode);
        },
        edgeParams() {
          return {
            data: {
              relation: 'linked',
              label: 'linked',
              weight: 0.5,
            },
          };
        },
        disableBrowserGestures: true,
      });
      eh.enable();
      runtime.edgehandles = eh;
    } catch (err) {
      console.warn('[extensions] edgehandles:', err);
    }
  }
}

function accentFromCss() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#38bdf8'
  );
}

/** @param {import('cytoscape').Core} cy */
export function cleanupExtensions(cy) {
  const runtime = runtimeByCy.get(cy);
  if (!runtime) return;

  if (runtime.bubblesets) {
    try {
      runtime.bubblesets.destroy();
    } catch {
      /* ignore */
    }
    runtime.bubblesets = null;
  }
  runtime.bubblePaths = [];

  if (runtime.autopan) {
    try {
      runtime.autopan.disable();
    } catch {
      /* ignore */
    }
    runtime.autopan = null;
  }

  if (runtime.edgehandles) {
    try {
      runtime.edgehandles.destroy();
    } catch {
      /* ignore */
    }
    runtime.edgehandles = null;
  }
}

/** Refresh bubble colors after theme change. */
export function refreshExtensionTheme(cy, themeVars) {
  const opts = getExtensionOptions();
  if (!opts.bubblesets) return;
  const runtime = runtimeByCy.get(cy);
  if (!runtime?.bubblesets) return;

  try {
    runtime.bubblesets.destroy();
  } catch {
    /* ignore */
  }
  runtime.bubblesets = null;
  runtime.bubblePaths = [];

  try {
    buildBubblePaths(cy, themeVars, runtime);
  } catch (err) {
    console.warn('[extensions] bubblesets theme refresh:', err);
  }
}

/**
 * @param {HTMLElement | null} containerEl
 * @param {{ onChange?: (options: typeof DEFAULT_EXTENSION_OPTIONS) => void }} [handlers]
 */
export function initExtensionSwitcher(containerEl, { onChange } = {}) {
  if (!containerEl || containerEl.querySelector('.control-extensions-section')) return;

  const panel = document.createElement('section');
  panel.className = 'control-section control-extensions-section';
  panel.innerHTML = `
    <h3 class="control-section-title">Extensions</h3>
    <div class="control-extensions-groups"></div>
  `;
  containerEl.appendChild(panel);

  const groupsEl = panel.querySelector('.control-extensions-groups');
  const options = getExtensionOptions();

  for (const group of EXTENSION_GROUPS) {
    const groupEl = document.createElement('fieldset');
    groupEl.className = 'control-extensions-group';
    groupEl.innerHTML = `<legend>${group.label}</legend>`;

    for (const item of group.items) {
      const id = `ext-${item.key}`;
      const label = document.createElement('label');
      label.className = 'extension-toggle';
      label.innerHTML = `
        <input type="checkbox" id="${id}" data-ext="${item.key}" />
        <span>${item.label}</span>
      `;
      const input = label.querySelector('input');
      input.checked = Boolean(options[item.key]);
      input.addEventListener('change', () => {
        const next = saveExtensionOptions({ [item.key]: input.checked });
        onChange?.(next);
      });
      groupEl.appendChild(label);
    }

    groupsEl.appendChild(groupEl);
  }
}
