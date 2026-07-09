const STORAGE_KEY = 'knowledge-graph-news-reveal-zoom';

/** 슬라이더 0 = 멀리서도 제목 표시, 100 = 매우 가까이 확대해야 제목 표시 */
export const MIN_NEWS_REVEAL_ZOOM = 0.3;
export const MAX_NEWS_REVEAL_ZOOM = 3.0;
export const DEFAULT_NEWS_REVEAL_ZOOM = 1.85;

/**
 * @param {number} zoom
 */
export function zoomThresholdToSlider(zoom) {
  const span = MAX_NEWS_REVEAL_ZOOM - MIN_NEWS_REVEAL_ZOOM;
  const t = (zoom - MIN_NEWS_REVEAL_ZOOM) / span;
  return Math.round(Math.min(100, Math.max(0, t * 100)));
}

export const DEFAULT_NEWS_REVEAL_SLIDER = zoomThresholdToSlider(DEFAULT_NEWS_REVEAL_ZOOM);

/**
 * @param {number} slider
 */
export function sliderToZoomThreshold(slider) {
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return MIN_NEWS_REVEAL_ZOOM + t * (MAX_NEWS_REVEAL_ZOOM - MIN_NEWS_REVEAL_ZOOM);
}

/**
 * @param {number} slider
 */
export function formatNewsRevealZoom(slider) {
  return `≥${sliderToZoomThreshold(slider).toFixed(2)}×`;
}

/**
 * @param {number} value
 */
function clampSlider(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_NEWS_REVEAL_SLIDER;
  return Math.min(100, Math.max(0, n));
}

export function getNewsRevealSlider() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_NEWS_REVEAL_SLIDER;
    return clampSlider(Number(raw));
  } catch {
    return DEFAULT_NEWS_REVEAL_SLIDER;
  }
}

/** @param {number} slider */
export function setNewsRevealSlider(slider) {
  const next = clampSlider(slider);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function applyNewsVisibility(cy) {
  if (!cy) return;

  const zoom = cy.zoom() || 1;
  const threshold = sliderToZoomThreshold(getNewsRevealSlider());
  const showLabels = zoom >= threshold;

  if (cy._kgNewsLabelsVisible === showLabels) return;
  cy._kgNewsLabelsVisible = showLabels;

  const newsNodes = cy.nodes('[type = "News"]');

  cy.batch(() => {
    newsNodes.forEach((node) => {
      node.toggleClass('news-label-hidden', !showLabels);
      if (showLabels) {
        node.removeStyle('text-opacity');
      } else {
        node.style('text-opacity', 0);
      }
    });
  });
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function bindNewsVisibility(cy) {
  if (!cy || cy._kgNewsVisibilityBound) return;
  cy._kgNewsVisibilityBound = true;
  cy._kgNewsLabelsVisible = undefined;

  const refresh = () => applyNewsVisibility(cy);
  cy.on('zoom pan', refresh);
  cy._kgRefreshNewsVisibility = refresh;
  refresh();
}

/** @param {import("cytoscape").Core} cy */
export function syncNewsVisibility(cy) {
  if (!cy) return;
  cy._kgNewsLabelsVisible = undefined;
  if (typeof cy._kgRefreshNewsVisibility === 'function') {
    cy._kgRefreshNewsVisibility();
    return;
  }
  applyNewsVisibility(cy);
}

/**
 * @param {HTMLElement} containerEl
 * @param {() => void} [onChange]
 */
export function initNewsVisibilitySwitcher(containerEl, onChange) {
  if (!containerEl || containerEl.querySelector('#news-reveal-range')) return;

  const section = document.createElement('section');
  section.className = 'control-section control-news-section';
  section.innerHTML = `
    <h3 class="control-section-title">표시</h3>
    <div class="control-row control-row--range">
      <label class="control-label" for="news-reveal-range" title="확대 배율이 이 값 이상일 때 뉴스 제목이 나타납니다. 높일수록 더 가까이 확대해야 제목이 보입니다.">뉴스 제목</label>
      <div class="control-range-wrap">
        <input
          type="range"
          id="news-reveal-range"
          class="control-range"
          min="0"
          max="100"
          step="1"
          aria-label="뉴스 제목 표시 확대 수준"
        />
        <output id="news-reveal-value" class="control-value" for="news-reveal-range"></output>
      </div>
    </div>
  `;
  containerEl.appendChild(section);

  const range = section.querySelector('#news-reveal-range');
  const output = section.querySelector('#news-reveal-value');
  const current = getNewsRevealSlider();

  range.value = String(current);
  output.textContent = formatNewsRevealZoom(current);

  range.addEventListener('input', () => {
    const next = setNewsRevealSlider(Number(range.value));
    output.textContent = formatNewsRevealZoom(next);
    onChange?.();
  });
}
