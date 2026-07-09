import { nodeColor } from '../graph.js';
import { DEFAULT_NODE_SIZE, EDGE_NODE_SIZE } from '../graph-settings.mjs';
import { runLayoutWithFinish } from '../layout-utils.mjs';
import { buildThemedGraphStyle, getThemeId } from '../themes/index.mjs';
import { applyRingLayout, clearRingLayout, isRingLayoutVersion } from '../layouts/ring-layout.mjs';
import {
  applyHierarchyLayout,
  clearHierarchyLayout,
  isHierarchyLayoutVersion,
} from '../layouts/hierarchy-layout.mjs';
import { LAYOUT_KIND, setLayoutKind } from '../layouts/layout-mode.mjs';

export const UNIFORM_NODE_SIZE = DEFAULT_NODE_SIZE;

/**
 * @param {ReturnType<import("../themes.mjs").getGraphThemeVars>} vars
 * @param {object} overrides
 */
function baseNodeStyle(vars, overrides = {}) {
  return {
    label: 'data(label)',
    'text-valign': 'bottom',
    'text-halign': 'center',
    'text-margin-y': 8,
    'font-size': 11,
    'text-max-width': 88,
    'text-wrap': 'wrap',
    'text-overflow-wrap': 'anywhere',
    color: vars.text,
    'background-color': (ele) => nodeColor(ele.data('type'), vars),
    'border-color': vars.nodeBorder,
    width: UNIFORM_NODE_SIZE,
    height: UNIFORM_NODE_SIZE,
    'border-width': 2,
    ...overrides,
  };
}

/**
 * @param {ReturnType<import("../themes.mjs").getGraphThemeVars>} vars
 * @param {object} overrides
 */
function baseEdgeStyle(vars, overrides = {}) {
  return {
    width: (ele) => 1 + (ele.data('weight') ?? 1) * 2,
    'line-color': vars.edge,
    'target-arrow-color': vars.edge,
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier',
    label: 'data(relation)',
    'font-size': 7,
    'text-opacity': 0.72,
    color: vars.edgeLabel,
    'text-rotation': 'autorotate',
    'text-margin-y': -10,
    ...overrides,
  };
}

/**
 * @param {ReturnType<import("../themes.mjs").getGraphThemeVars>} vars
 * @param {{ node?: object; edge?: object; extra?: object[] }} shape
 */
export function buildStyle(vars, shape = {}) {
  return [
    {
      selector: 'node',
      style: baseNodeStyle(vars, shape.node),
    },
    {
      selector: 'node[type = "EdgeNode"]',
      style: baseNodeStyle(vars, {
        width: EDGE_NODE_SIZE,
        height: EDGE_NODE_SIZE,
        'font-size': 9,
        'text-max-width': 64,
        'text-margin-y': 6,
        'border-width': 1.5,
        ...(shape.edgeNode ?? {}),
      }),
    },
    {
      selector: 'edge[relation = "includes"]',
      style: {
        label: '',
        'text-opacity': 0,
      },
    },
    {
      selector: 'edge',
      style: baseEdgeStyle(vars, shape.edge),
    },
    {
      selector: ':selected',
      style: {
        'border-color': vars.selected,
        'border-width': 3,
      },
    },
    {
      selector: '.dim',
      style: { opacity: 0.15 },
    },
    {
      selector: '.highlight',
      style: { opacity: 1 },
    },
    {
      selector: 'node.sector-origin',
      style: {
        'border-width': 4,
        'border-color': vars.selected,
        'background-blacken': -0.12,
      },
    },
    {
      selector: '.wave',
      style: {
        'border-width': 4,
        'border-color': vars.selected,
      },
    },
    ...(shape.extra ?? []),
  ];
}

/** @type {import("./types.js").GraphVersion[]} */
export const VERSIONS = [
  {
    id: 1,
    name: 'organic',
    label: '유기 배치',
    hint: '연결 관계를 따라 자연스럽게 퍼지는 기본 배치',
    layout: {
      name: 'cose',
      animate: true,
      fit: false,
      randomize: false,
      padding: 56,
      gravity: 1.4,
      nodeRepulsion: 5200,
      idealEdgeLength: 130,
      nodeOverlap: 0,
    },
    style: (vars) => buildStyle(vars),
  },
  {
    id: 2,
    name: 'hierarchy',
    label: '계층 구조',
    hint: '뉴스 → 섹터 → 엣지노드 → 기업 순서의 고정 계층 배치',
    layout: {
      name: 'hierarchy',
    },
    style: (vars) =>
      buildStyle(vars, {
        edge: { 'curve-style': 'bezier' },
      }),
  },
  {
    id: 3,
    name: 'ring',
    label: '원형배치',
    hint: '섹터(안쪽) · 엣지노드 · 기업 · 뉴스(바깥) 동심원 배치',
    layout: {
      name: 'ring',
    },
    style: (vars) => buildStyle(vars),
  },
];

const VERSION_STORAGE_KEY = 'knowledge-graph-version';

export function getVersionId() {
  try {
    const raw = localStorage.getItem(VERSION_STORAGE_KEY);
    let id = raw ? Number(raw) : VERSIONS[0].id;
    if (id === 4) id = 3;
    return VERSIONS.some((v) => v.id === id) ? id : VERSIONS[0].id;
  } catch {
    return VERSIONS[0].id;
  }
}

export function setVersionId(id) {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export function getVersion(id) {
  const num = typeof id === 'number' ? id : Number(id);
  return VERSIONS.find((v) => v.id === num) ?? VERSIONS[0];
}

/**
 * @param {import("./types.js").GraphVersion} version
 * @param {number} nodeCount
 */
export function resolveLayoutOptions(version) {
  return { ...version.layout };
}

/**
 * Apply a version's style and layout to an existing cytoscape instance.
 * @param {import("cytoscape").Core} cy
 * @param {GraphVersion} version
 * @param {ReturnType<import("../themes/index.mjs").getGraphThemeVars>} themeVars
 */
export function applyVersion(cy, version, themeVars) {
  if (isRingLayoutVersion(version)) {
    clearHierarchyLayout(cy);
    return applyRingLayout(cy, version, themeVars);
  }

  if (isHierarchyLayoutVersion(version)) {
    clearRingLayout(cy);
    return applyHierarchyLayout(cy, version);
  }

  clearRingLayout(cy);
  clearHierarchyLayout(cy);
  setLayoutKind(cy, LAYOUT_KIND.ORGANIC);

  const styles = buildThemedGraphStyle(version.style, getThemeId());
  cy.style(styles);

  if (version.positions) {
    cy.nodes().forEach((node) => {
      const pos = version.positions[node.id()];
      if (pos) node.position(pos);
    });
  }

  cy._kgLastLayout = resolveLayoutOptions(version);
  return runLayoutWithFinish(cy, cy._kgLastLayout);
}

/**
 * @param {HTMLElement} tabsEl
 * @param {HTMLElement} hintEl
 * @param {(id: number) => void} onSwitch
 */
export function initVersionTabs(tabsEl, hintEl, onSwitch) {
  const initial = getVersionId();
  tabsEl.innerHTML = VERSIONS.map(
    (v) =>
      `<button type="button" class="version-tab control-segment${v.id === initial ? ' active' : ''}" data-version="${v.id}" title="${v.hint}">${v.label}</button>`,
  ).join('');

  const version = getVersion(initial);
  if (hintEl) hintEl.textContent = version.hint;

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.version-tab');
    if (!btn) return;
    const id = Number(btn.dataset.version);
    if (id === getVersionId()) return;

    setVersionId(id);
    tabsEl.querySelectorAll('.version-tab').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.version) === id);
    });
    const v = getVersion(id);
    if (hintEl) hintEl.textContent = v.hint;
    onSwitch(id);
  });
}
