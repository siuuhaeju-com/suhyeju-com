import * as fadeStagger from './fade-stagger.mjs';
import * as pulseSelected from './pulse-selected.mjs';
import * as edgeDrawIn from './edge-draw-in.mjs';
import * as layoutEase from './layout-ease.mjs';
import * as zoomFit from './zoom-fit.mjs';
import * as nodePop from './node-pop.mjs';
import * as rippleTap from './ripple-tap.mjs';
import * as autoPan from './auto-pan.mjs';
import * as highlightWave from './highlight-wave.mjs';
import * as bounceEntry from './bounce-entry.mjs';

const STORAGE_KEY = 'knowledge-graph-animation';

/** @type {Array<{ id: string; label: string; hint: string; apply: Function; cleanup: Function }>} */
export const ANIMATIONS = [
  fadeStagger,
  pulseSelected,
  edgeDrawIn,
  layoutEase,
  zoomFit,
  nodePop,
  rippleTap,
  autoPan,
  highlightWave,
  bounceEntry,
].map((mod) => ({
  id: mod.meta.id,
  label: mod.meta.label,
  hint: mod.meta.hint,
  apply: mod.apply,
  cleanup: mod.cleanup,
}));

export function getAnimationId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY) || 'fade-stagger';
    return ANIMATIONS.some((a) => a.id === id) ? id : 'fade-stagger';
  } catch {
    return 'fade-stagger';
  }
}

export function setAnimationId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getAnimation(id = getAnimationId()) {
  return ANIMATIONS.find((a) => a.id === id) || ANIMATIONS[0];
}

export function initAnimationSwitcher(containerEl, { onChange } = {}) {
  if (!containerEl || containerEl.querySelector('.animation-switcher')) return;

  const wrap = document.createElement('div');
  wrap.className = 'control-row';
  wrap.innerHTML = `
    <label class="control-label" for="animation-select">애니메이션</label>
    <select id="animation-select" class="control-select" aria-label="애니메이션">
      ${ANIMATIONS.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}
    </select>
  `;
  containerEl.appendChild(wrap);

  const select = wrap.querySelector('#animation-select');
  select.value = getAnimationId();
  select.addEventListener('change', () => {
    setAnimationId(select.value);
    onChange?.(getAnimation(select.value));
  });
}
