import { getGlobalGraphStyleOverrides } from '../graph-display-settings.mjs';

const STORAGE_KEY = 'knowledge-graph-theme';
const DEFAULT_THEME = 'blueprint';

/** @typedef {"legacy" | "new"} ThemeGroup */

/**
 * @typedef {object} ThemeMeta
 * @property {string} id
 * @property {string} label
 * @property {ThemeGroup} group
 * @property {string} uiClass
 * @property {string} [description]
 */

/** @type {Record<string, string>} */
const LEGACY_THEME_IDS = {
  dark: 'midnight',
  paper: 'blueprint',
  neon: 'cyber',
  slate: 'midnight',
  hotpink: 'cyber',
  light: 'blueprint',
  forest: 'blueprint',
  sunset: 'blueprint',
  mono: 'blueprint',
  ocean: 'blueprint',
  hud: 'blueprint',
  synthwave: 'blueprint',
  schematic: 'blueprint',
  drafting: 'blueprint',
};

/** @type {ThemeMeta[]} */
export const THEMES = [
  {
    id: 'midnight',
    label: 'Midnight',
    group: 'legacy',
    uiClass: 'theme-ui-midnight',
    description: 'Dark rounded cards with soft shadows',
  },
  {
    id: 'cyber',
    label: 'Cyber',
    group: 'legacy',
    uiClass: 'theme-ui-cyber',
    description: 'Neon void — angular tabs, scanlines, glow',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    group: 'legacy',
    uiClass: 'theme-ui-blueprint',
    description: 'Technical drawing — dot grid, dashed borders, monospace',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    group: 'legacy',
    uiClass: 'theme-ui-terminal',
    description: 'CRT phosphor — green-on-black, scanlines, prompt prefix',
  },
  {
    id: 'whitepaper',
    label: 'Whitepaper',
    group: 'new',
    uiClass: 'theme-ui-whitepaper',
    description: 'Engineering document — ruled margins, serif headings, formal borders',
  },
  {
    id: 'cartography',
    label: 'Cartography',
    group: 'new',
    uiClass: 'theme-ui-cartography',
    description: 'Topographic map — contour lines, coordinate grid, survey labels',
  },
  {
    id: 'starfield',
    label: 'Starfield',
    group: 'new',
    uiClass: 'theme-ui-starfield',
    description: 'Observatory chart — star dots, orbital curves, celestial coordinates',
  },
  {
    id: 'gazette',
    label: 'Gazette',
    group: 'new',
    uiClass: 'theme-ui-gazette',
    description: 'Editorial print — newsprint texture, column rules, masthead tabs',
  },
];

const UI_CLASSES = THEMES.map((t) => t.uiClass);

/** @type {Record<string, { node?: object; edge?: object; extra?: { selector: string; style: object }[] }>} */
const GRAPH_STYLE_OVERRIDES = {
  blueprint: {
    node: {
      shape: 'rectangle',
      'border-width': 2,
      'border-style': 'solid',
      'font-family': 'ui-monospace, "Cascadia Code", "SF Mono", monospace',
      'font-size': 10,
      'text-margin-y': 6,
      'background-opacity': 0.92,
    },
    edge: {
      'curve-style': 'taxi',
      'taxi-direction': 'auto',
      'line-style': 'dashed',
      'line-dash-pattern': [6, 4],
      width: 1.5,
      'target-arrow-shape': 'vee',
      'font-size': 7,
      'text-opacity': 0.82,
      opacity: 0.9,
    },
  },
  cyber: {
    node: {
      shape: 'diamond',
      'border-width': 2,
      'font-family': 'ui-monospace, "Cascadia Code", "SF Mono", monospace',
      'font-size': 10,
      'text-margin-y': 10,
      'background-opacity': 0.78,
    },
    edge: {
      'curve-style': 'straight',
      'line-style': 'dotted',
      width: 3,
      'target-arrow-shape': 'tee',
      opacity: 0.92,
      'font-size': 7,
      'text-opacity': 0.65,
    },
  },
  terminal: {
    node: {
      shape: 'rectangle',
      'border-width': 2,
      'border-style': 'solid',
      'font-family': 'ui-monospace, "Cascadia Code", "SF Mono", monospace',
      'font-size': 9,
      'text-margin-y': 7,
      'background-opacity': 0.72,
      color: '#33ff33',
    },
    edge: {
      'curve-style': 'straight',
      'line-style': 'dashed',
      'line-dash-pattern': [4, 3],
      width: 1.5,
      'target-arrow-shape': 'vee',
      opacity: 0.85,
      'font-size': 7,
      'text-opacity': 0.7,
    },
  },
  midnight: {
    node: {
      shape: 'ellipse',
      'border-width': 2,
      'border-opacity': 0.95,
      'background-opacity': 1,
      'font-size': 12,
      'text-margin-y': 10,
      'text-max-width': 100,
      'text-outline-width': 2,
      'text-outline-color': '#12151d',
      'text-outline-opacity': 0.92,
    },
    edge: {
      'curve-style': 'unbundled-bezier',
      'control-point-distances': [30, -30],
      'control-point-weights': [0.25, 0.75],
      'line-style': 'solid',
      width: 2,
      opacity: 0.88,
      'font-size': 9,
      'text-opacity': 0.85,
    },
  },
  whitepaper: {
    node: {
      shape: 'round-rectangle',
      'border-width': 1,
      'border-style': 'solid',
      'font-family': 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
      'font-size': 10,
      'text-margin-y': 8,
      'background-opacity': 0.96,
    },
    edge: {
      'curve-style': 'straight',
      'line-style': 'solid',
      width: 1,
      'target-arrow-shape': 'triangle',
      opacity: 0.75,
      'font-size': 7,
      'text-opacity': 0.7,
    },
  },
  cartography: {
    node: {
      shape: 'hexagon',
      'border-width': 1.5,
      'font-family': 'ui-sans-serif, system-ui, sans-serif',
      'font-size': 9,
      'text-margin-y': 10,
      'background-opacity': 0.88,
    },
    edge: {
      'curve-style': 'bezier',
      'line-style': 'dashed',
      'line-dash-pattern': [8, 5],
      width: 1.5,
      'target-arrow-shape': 'vee',
      opacity: 0.8,
      'font-size': 7,
      'text-opacity': 0.78,
    },
  },
  starfield: {
    node: {
      shape: 'ellipse',
      'border-width': 1,
      'border-opacity': 0.6,
      'background-opacity': 0.7,
      'font-size': 9,
      'text-margin-y': 10,
    },
    edge: {
      'curve-style': 'unbundled-bezier',
      'control-point-distances': [50, -50],
      'control-point-weights': [0.35, 0.65],
      'line-style': 'dotted',
      width: 1,
      'target-arrow-shape': 'circle',
      opacity: 0.55,
      'font-size': 7,
      'text-opacity': 0.6,
    },
  },
  gazette: {
    node: {
      shape: 'rectangle',
      'border-width': 0,
      'border-bottom-width': 3,
      'border-style': 'solid',
      'font-family': '"Times New Roman", Times, Georgia, serif',
      'font-size': 10,
      'text-margin-y': 9,
      'background-opacity': 0.94,
    },
    edge: {
      'curve-style': 'taxi',
      'taxi-direction': 'horizontal',
      'line-style': 'solid',
      width: 1.5,
      'target-arrow-shape': 'none',
      opacity: 0.7,
      'font-size': 8,
      'text-opacity': 0.75,
    },
  },
};

export function normalizeThemeId(id) {
  const mapped = LEGACY_THEME_IDS[id] ?? id;
  return THEMES.some((t) => t.id === mapped) ? mapped : DEFAULT_THEME;
}

export function getTheme(id) {
  const themeId = normalizeThemeId(id);
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}

export function getThemeId() {
  try {
    return normalizeThemeId(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

function syncUiClass(themeId) {
  const theme = getTheme(themeId);
  document.body.classList.remove(...UI_CLASSES);
  document.body.classList.add(theme.uiClass);
}

export function applyTheme(id) {
  const themeId = normalizeThemeId(id);
  document.documentElement.setAttribute('data-theme', themeId);
  if (document.body) syncUiClass(themeId);
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeId } }));
  return themeId;
}

/** Read graph-related CSS variables for Cytoscape styling. */
export function getGraphThemeVars() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return {
    text: v('--graph-text'),
    muted: v('--graph-muted'),
    graphBg: v('--graph-bg'),
    edge: v('--graph-edge'),
    edgeLabel: v('--graph-edge-label'),
    selected: v('--graph-selected'),
    nodeBorder: v('--graph-node-border'),
    nodeNews: v('--node-news'),
    nodeSector: v('--node-sector'),
    nodeEdgeNode: v('--node-edgenode'),
    nodeCompany: v('--node-company'),
    accent: v('--accent'),
  };
}

/**
 * @param {string} [themeId]
 */
export function getGraphStyleOverrides(themeId = getThemeId()) {
  return GRAPH_STYLE_OVERRIDES[normalizeThemeId(themeId)] ?? GRAPH_STYLE_OVERRIDES.blueprint;
}

/**
 * @param {object[]} styles
 * @param {{ node?: object; edge?: object; extra?: { selector: string; style: object }[] }} overrides
 */
export function mergeGraphStyle(styles, overrides) {
  const merged = styles.map((entry) => {
    if (entry.selector === 'node' && overrides.node) {
      return { ...entry, style: { ...entry.style, ...overrides.node } };
    }
    if (entry.selector === 'edge' && overrides.edge) {
      return { ...entry, style: { ...entry.style, ...overrides.edge } };
    }
    return entry;
  });

  for (const patch of overrides.extra ?? []) {
    const idx = merged.findIndex((entry) => entry.selector === patch.selector);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], style: { ...merged[idx].style, ...patch.style } };
    } else {
      merged.push({ selector: patch.selector, style: patch.style });
    }
  }

  return merged;
}

export function buildThemedGraphStyleFromVars(versionStyleFn, themeId, vars) {
  const base = versionStyleFn(vars);
  const withTheme = mergeGraphStyle(base, getGraphStyleOverrides(themeId));
  return mergeGraphStyle(withTheme, getGlobalGraphStyleOverrides());
}

export function buildThemedGraphStyle(versionStyleFn, themeId = getThemeId()) {
  return buildThemedGraphStyleFromVars(versionStyleFn, themeId, getGraphThemeVars());
}

export function initThemeSwitcher(containerEl, onChange) {
  if (!containerEl || containerEl.querySelector('#theme-select')) return;

  const legacy = THEMES.filter((t) => t.group === 'legacy');
  const novel = THEMES.filter((t) => t.group === 'new');

  const wrap = document.createElement('div');
  wrap.className = 'control-row';
  wrap.innerHTML = `
    <label class="control-label" for="theme-select">테마</label>
    <select id="theme-select" class="control-select" aria-label="테마">
      <optgroup label="기존">
        ${legacy.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
      </optgroup>
      <optgroup label="새로운">
        ${novel.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
      </optgroup>
    </select>
  `;
  containerEl.appendChild(wrap);

  const select = wrap.querySelector('#theme-select');
  select.value = getThemeId();
  select.addEventListener('change', () => {
    applyTheme(select.value);
    onChange?.(select.value);
  });
}

/** FOUC prevention — inline in HTML head */
export function themeBootScript() {
  const ids = THEMES.map((t) => t.id).join(',');
  const legacy = Object.entries(LEGACY_THEME_IDS)
    .map(([k, v]) => `${k}:"${v}"`)
    .join(',');
  return `(function(){
    var LEGACY={${legacy}};
  try{
    var t=localStorage.getItem("${STORAGE_KEY}")||"${DEFAULT_THEME}";
    t=LEGACY[t]||t;
    if("${ids}".split(",").indexOf(t)<0)t="${DEFAULT_THEME}";
    document.documentElement.setAttribute("data-theme",t);
    document.addEventListener("DOMContentLoaded",function(){
      document.body.classList.add("theme-ui-"+t);
    });
  }catch(e){}
})();`;
}
