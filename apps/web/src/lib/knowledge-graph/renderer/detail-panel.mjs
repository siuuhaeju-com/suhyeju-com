const STORAGE_KEY = 'knowledge-graph-detail-mode';

/** @typedef {"popup" | "sidebar"} DetailMode */

/** @returns {DetailMode} */
export function getDetailMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'sidebar' ? 'sidebar' : 'popup';
  } catch {
    return 'popup';
  }
}

/** @param {DetailMode} mode */
export function setDetailMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  applyDetailMode(mode);
}

/** @param {DetailMode} [mode] */
export function applyDetailMode(mode = getDetailMode()) {
  document.body.classList.toggle('detail-mode-sidebar', mode === 'sidebar');
  document.body.classList.toggle('detail-mode-popup', mode !== 'sidebar');
  window.dispatchEvent(new CustomEvent('detailmodechange', { detail: { mode } }));
}

/**
 * 상세 패널 상단 — 보기 방식 전환.
 * @param {DetailMode} [mode]
 */
export function renderDetailToolbar(mode = getDetailMode()) {
  const isSidebar = mode === 'sidebar';
  const modeLabel = isSidebar ? '팝업으로 보기' : '사이드바로 보기';
  const modeTarget = isSidebar ? 'popup' : 'sidebar';
  const modeIcon = isSidebar ? '⧉' : '▥';

  return `
    <header class="detail-toolbar">
      <button
        type="button"
        class="detail-mode-btn"
        data-detail-mode="${modeTarget}"
        aria-label="${modeLabel}"
      >
        <span class="detail-mode-btn-icon" aria-hidden="true">${modeIcon}</span>
        <span class="detail-mode-btn-label">${modeLabel}</span>
      </button>
      <button type="button" class="detail-close-btn" aria-label="닫기">×</button>
    </header>
  `;
}

/**
 * @param {HTMLElement} detailRoot
 * @param {{ onModeChange?: (mode: DetailMode) => void; onClose?: () => void }} handlers
 */
export function bindDetailToolbar(detailRoot, handlers = {}) {
  detailRoot._kgDetailHandlers = handlers;

  const modeBtn = detailRoot.querySelector('.detail-mode-btn');
  const closeBtn = detailRoot.querySelector('.detail-close-btn');

  modeBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    const target = modeBtn.getAttribute('data-detail-mode');
    if (target !== 'popup' && target !== 'sidebar') return;
    setDetailMode(target);
    handlers.onModeChange?.(target);
    refreshDetailToolbar(detailRoot);
  });

  closeBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onClose?.();
  });
}

/** @param {HTMLElement} detailRoot */
function refreshDetailToolbar(detailRoot) {
  const toolbar = detailRoot.querySelector('.detail-toolbar');
  if (!toolbar) return;
  const next = renderDetailToolbar(getDetailMode());
  const parsed = new DOMParser().parseFromString(next, 'text/html');
  const fresh = parsed.body.firstElementChild;
  if (fresh) toolbar.replaceWith(fresh);
  bindDetailToolbar(detailRoot, detailRoot._kgDetailHandlers ?? {});
}

/** DOM 준비 전 플래시 방지 */
export function initDetailMode() {
  applyDetailMode(getDetailMode());
}
