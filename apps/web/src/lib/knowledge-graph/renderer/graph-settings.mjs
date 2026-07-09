import { getMaxNodeCount, getMinNodeCount } from './graph-pool.mjs';

const STORAGE_KEY = 'knowledge-graph-node-count';

/** 고정 노드 렌더 크기 (슬라이더 없음) */
export const DEFAULT_NODE_SIZE = 36;
/** Sector↔Company 브릿지 EdgeNode — 기본 노드의 절반 */
export const EDGE_NODE_SIZE = DEFAULT_NODE_SIZE / 2;

export const MIN_NODE_COUNT = getMinNodeCount();
export const MAX_NODE_COUNT = getMaxNodeCount();
export const DEFAULT_NODE_COUNT = Math.min(MAX_NODE_COUNT, MIN_NODE_COUNT + 3);

/**
 * @param {number} count
 */
function clampNodeCount(count) {
  const n = Math.round(Number(count));
  if (!Number.isFinite(n)) return DEFAULT_NODE_COUNT;
  return Math.min(MAX_NODE_COUNT, Math.max(MIN_NODE_COUNT, n));
}

export function getNodeCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_NODE_COUNT;
    return clampNodeCount(Number(raw));
  } catch {
    return DEFAULT_NODE_COUNT;
  }
}

/** @param {number} count */
export function setNodeCount(count) {
  const next = clampNodeCount(count);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * @param {HTMLElement} containerEl
 * @param {(count: number) => void} [onChange]
 */
export function initNodeCountSwitcher(containerEl, onChange) {
  if (!containerEl || containerEl.querySelector('#node-count-range')) return;

  const wrap = document.createElement('div');
  wrap.className = 'control-row control-row--range';
  wrap.innerHTML = `
    <label class="control-label" for="node-count-range">노드</label>
    <div class="control-range-wrap">
      <input
        type="range"
        id="node-count-range"
        class="control-range"
      min="${MIN_NODE_COUNT}"
      max="${MAX_NODE_COUNT}"
      step="1"
      aria-valuemin="${MIN_NODE_COUNT}"
      aria-valuemax="${MAX_NODE_COUNT}"
      aria-label="노드 수"
    />
    <output id="node-count-value" class="control-value" for="node-count-range"></output>
    </div>
  `;
  containerEl.appendChild(wrap);

  const range = wrap.querySelector('#node-count-range');
  const output = wrap.querySelector('#node-count-value');
  const current = getNodeCount();

  range.value = String(current);
  output.textContent = String(current);

  range.addEventListener('input', () => {
    const count = setNodeCount(Number(range.value));
    output.textContent = String(count);
    onChange?.(count);
  });
}
