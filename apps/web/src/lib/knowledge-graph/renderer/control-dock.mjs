/**
 * 왼쪽 하단 플로팅 옵션 드롭박스.
 * @param {HTMLElement} rootEl
 */
export function initControlDock(rootEl) {
  if (!rootEl || rootEl.dataset.bound === 'true') return;
  rootEl.dataset.bound = 'true';

  const trigger = rootEl.querySelector('.control-dock-trigger');
  const panel = rootEl.querySelector('.control-dock-panel');
  if (!trigger || !panel) return;

  const close = () => {
    rootEl.classList.remove('is-open');
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    rootEl.classList.add('is-open');
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (rootEl.classList.contains('is-open')) close();
    else open();
  });

  document.addEventListener('click', (event) => {
    if (!rootEl.classList.contains('is-open')) return;
    if (!rootEl.contains(/** @type {Node} */ (event.target))) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
