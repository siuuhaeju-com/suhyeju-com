const STORAGE_KEY = 'knowledge-graph-edge-opacity';

export const MIN_EDGE_OPACITY = 10;
export const MAX_EDGE_OPACITY = 100;
export const DEFAULT_EDGE_OPACITY = 85;

/**
 * @param {number} slider
 */
function clampEdgeOpacitySlider(slider) {
  const n = Math.round(Number(slider));
  if (!Number.isFinite(n)) return DEFAULT_EDGE_OPACITY;
  return Math.min(MAX_EDGE_OPACITY, Math.max(MIN_EDGE_OPACITY, n));
}

export function getEdgeOpacitySlider() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_EDGE_OPACITY;
    return clampEdgeOpacitySlider(Number(raw));
  } catch {
    return DEFAULT_EDGE_OPACITY;
  }
}

/** @param {number} slider */
export function setEdgeOpacitySlider(slider) {
  const next = clampEdgeOpacitySlider(slider);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** @param {number} [slider] */
export function getEdgeOpacity(slider = getEdgeOpacitySlider()) {
  return clampEdgeOpacitySlider(slider) / 100;
}

/** @param {number} slider */
export function formatEdgeOpacity(slider) {
  return `${clampEdgeOpacitySlider(slider)}%`;
}

/** 모든 레이아웃·테마에 공통 적용되는 Cytoscape style override */
export function getGlobalGraphStyleOverrides() {
  const opacity = getEdgeOpacity();
  return {
    edge: {
      opacity,
      'text-opacity': Math.min(1, opacity * 0.85),
    },
  };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function applyEdgeOpacity(cy) {
  if (!cy) return;
  const opacity = getEdgeOpacity();
  const textOpacity = Math.min(1, opacity * 0.85);

  cy.batch(() => {
    cy.edges().forEach((edge) => {
      if (edge.hasClass('dim')) return;
      edge.style({
        opacity,
        'text-opacity': textOpacity,
      });
    });
  });
}

/**
 * @param {HTMLElement} containerEl
 * @param {() => void} [onChange]
 */
export function initEdgeOpacitySwitcher(containerEl, onChange) {
  if (!containerEl || containerEl.querySelector('#edge-opacity-range')) return;

  const wrap = document.createElement('div');
  wrap.className = 'control-row control-row--range';
  wrap.innerHTML = `
    <label class="control-label" for="edge-opacity-range" title="모든 레이아웃에 공통 적용되는 엣지(연결선) 투명도입니다.">엣지 투명도</label>
    <div class="control-range-wrap">
      <input
        type="range"
        id="edge-opacity-range"
        class="control-range"
        min="${MIN_EDGE_OPACITY}"
        max="${MAX_EDGE_OPACITY}"
        step="5"
        aria-label="엣지 투명도"
      />
      <output id="edge-opacity-value" class="control-value" for="edge-opacity-range"></output>
    </div>
  `;
  containerEl.appendChild(wrap);

  const range = wrap.querySelector('#edge-opacity-range');
  const output = wrap.querySelector('#edge-opacity-value');
  const current = getEdgeOpacitySlider();

  range.value = String(current);
  output.textContent = formatEdgeOpacity(current);

  range.addEventListener('input', () => {
    const value = setEdgeOpacitySlider(Number(range.value));
    output.textContent = formatEdgeOpacity(value);
    onChange?.();
  });
}
