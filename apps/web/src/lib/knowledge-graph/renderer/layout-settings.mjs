const STORAGE_KEY = 'knowledge-graph-layout-settings-v1';
const VERSION_STORAGE_KEY = 'knowledge-graph-version';

function getActiveLayoutId() {
  try {
    const raw = localStorage.getItem(VERSION_STORAGE_KEY);
    let id = raw ? Number(raw) : 1;
    if (id === 4) id = 3;
    return id === 2 || id === 3 ? id : 1;
  } catch {
    return 1;
  }
}

/** 0 = 그래프 전체 (슬라이더 최대) */
export const FORCE_DEPTH_UNLIMITED = 0;
export const FORCE_DEPTH_SLIDER_MAX = 6;

/** @typedef {{ nodeMove: number; responseSpeed: number; centerStrength: number; repulsion: number; linkStrength: number; linkDistance: number; forceDepth: number }} OrganicSettings */
/** @typedef {{ spacingFactor: number; padding: number }} HierarchySettings */
/** @typedef {{ ringScale: number; ringGap: number; fanSpread: number }} RingSettings */

/** Obsidian Center force — 고립 노드는 이 배수만큼 더 강하게 중심으로 끌림 */
export const ORPHAN_CENTER_MULTIPLIER = 2.8;

/** @type {Record<number, { sliders: Array<{ key: string; label: string; hint: string; min: number; max: number; step: number; format: (v: number) => string }>; defaults: Record<string, number> }>} */
export const LAYOUT_SETTING_PROFILES = {
  1: {
    sliders: [
      {
        key: 'nodeMove',
        label: '노드 이동',
        hint: '노드를 끌 때 주변 노드가 함께 움직이기 시작하는 정도입니다.',
        min: 0,
        max: 100,
        step: 5,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'responseSpeed',
        label: '반응속도',
        hint: '시뮬레이션이 움직임에 반응하는 속도입니다.',
        min: 5,
        max: 100,
        step: 5,
        format: (v) => `${Math.round(v)}%`,
      },
      {
        key: 'centerStrength',
        label: '중심 장력',
        hint: '맵 중심으로 끌어당깁니다. 멀수록 당김이 강해집니다.',
        min: 0,
        max: 100,
        step: 0.5,
        format: (v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1)),
      },
      {
        key: 'repulsion',
        label: '반발력',
        hint: '노드끼리 밀어내는 힘입니다.',
        min: 40,
        max: 600,
        step: 10,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'forceDepth',
        label: '영향 깊이',
        hint: '드래그 시 연결 hop 수만큼만 force를 적용합니다. 최대(전체)는 그래프 전 노드입니다.',
        min: 1,
        max: FORCE_DEPTH_SLIDER_MAX,
        step: 1,
        format: (v) => (Math.round(v) <= FORCE_DEPTH_UNLIMITED ? '전체' : String(Math.round(v))),
      },
      {
        key: 'linkStrength',
        label: '링크 장력',
        hint: '연결된 노드를 당기는 스프링 강도입니다.',
        min: 0.05,
        max: 1.2,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'linkDistance',
        label: '링크 거리',
        hint: '연결된 두 노드 사이의 이상적 거리입니다.',
        min: 35,
        max: 220,
        step: 5,
        format: (v) => String(Math.round(v)),
      },
    ],
    defaults: {
      nodeMove: 50,
      responseSpeed: 40,
      centerStrength: 3.0,
      repulsion: 190,
      linkStrength: 0.55,
      linkDistance: 110,
      forceDepth: 2,
    },
  },
  2: {
    sliders: [
      {
        key: 'spacingFactor',
        label: '층 간격',
        hint: '계층 트리의 가로·세로 간격 배율입니다.',
        min: 1,
        max: 3,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'padding',
        label: '여백',
        hint: '그래프 가장자리 패딩입니다.',
        min: 24,
        max: 120,
        step: 2,
        format: (v) => String(Math.round(v)),
      },
    ],
    defaults: {
      spacingFactor: 1.85,
      padding: 54,
    },
  },
  3: {
    sliders: [
      {
        key: 'ringScale',
        label: '링 크기',
        hint: '섹터·엣지·기업·뉴스 동심원 전체 크기 배율입니다.',
        min: 0.5,
        max: 10,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'ringGap',
        label: '링 간격',
        hint: '안쪽·중간·기업·바깥 링 사이 거리 배율입니다.',
        min: 0.7,
        max: 1.5,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'fanSpread',
        label: '펼침 각',
        hint: '같은 섹터에 속한 노드의 각도 펼침 정도입니다.',
        min: 0.5,
        max: 1.8,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
    ],
    defaults: {
      ringScale: 3,
      ringGap: 1,
      fanSpread: 1,
    },
  },
};

const ORGANIC_SLIDERS = LAYOUT_SETTING_PROFILES[1].sliders;
function profileFor(layoutId) {
  return LAYOUT_SETTING_PROFILES[layoutId] ?? LAYOUT_SETTING_PROFILES[1];
}

/** @param {number} layoutId */
function clampSettings(layoutId, patch = {}) {
  const profile = profileFor(layoutId);
  /** @type {Record<string, number>} */
  const next = { ...profile.defaults };
  for (const spec of profile.sliders) {
    const raw = patch[spec.key];
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    if (spec.key === 'forceDepth') {
      if (n <= FORCE_DEPTH_UNLIMITED || n >= FORCE_DEPTH_SLIDER_MAX) {
        next[spec.key] = FORCE_DEPTH_UNLIMITED;
        continue;
      }
      next[spec.key] = Math.min(FORCE_DEPTH_SLIDER_MAX - 1, Math.max(spec.min, Math.round(n)));
      continue;
    }
    next[spec.key] = Math.min(spec.max, Math.max(spec.min, n));
  }
  return next;
}

/** @returns {Record<string, Record<string, number>>} */
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, Record<string, number>>} store */
function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** @param {number} [layoutId] */
export function getLayoutSettings(layoutId = getActiveLayoutId()) {
  const store = readStore();
  const key = String(layoutId);
  const legacy = layoutId === 3 && store['4'] ? store['4'] : {};
  return clampSettings(layoutId, { ...legacy, ...store[key] });
}

/** @param {number} layoutId @param {Record<string, number>} patch */
export function setLayoutSettings(layoutId, patch) {
  const store = readStore();
  const key = String(layoutId);
  const next = clampSettings(layoutId, { ...store[key], ...patch });
  store[key] = next;
  writeStore(store);
  return next;
}

/** @param {number} [layoutId] */
export function resetLayoutSettings(layoutId = getActiveLayoutId()) {
  const store = readStore();
  delete store[String(layoutId)];
  writeStore(store);
  return { ...profileFor(layoutId).defaults };
}

/** @param {number} layoutId */
export function getLayoutSettingSliders(layoutId) {
  return profileFor(layoutId).sliders;
}

/** 유기 배치용 — force-drag 호환 */
export function getForceSettings() {
  return /** @type {OrganicSettings} */ (getLayoutSettings(1));
}

/** @param {Partial<OrganicSettings>} patch */
export function setForceSettings(patch) {
  return setLayoutSettings(1, patch);
}

export function resetForceSettings() {
  return resetLayoutSettings(1);
}

/** @param {OrganicSettings} [settings] */
export function getResponseSpeed(settings = getForceSettings()) {
  return settings.responseSpeed / 100;
}

/** @param {OrganicSettings} [settings] @returns {number} hop 수 또는 Infinity(전체) */
export function getForceDepth(settings = getForceSettings()) {
  const stored = Math.round(settings.forceDepth ?? 2);
  return stored <= FORCE_DEPTH_UNLIMITED ? Infinity : stored;
}

/** @param {number} stored */
export function forceDepthToSliderValue(stored) {
  const n = Math.round(stored ?? 2);
  return n <= FORCE_DEPTH_UNLIMITED ? FORCE_DEPTH_SLIDER_MAX : n;
}

/** @param {OrganicSettings} [settings] */
export function getDragThresholds(settings = getForceSettings()) {
  const n = settings.nodeMove;
  const engage = Math.round(85 - n * 0.86);
  const ramp = Math.max(Math.round(140 - n), engage + 25);
  return { engage, ramp };
}

/** @deprecated */
export const FORCE_SLIDERS = ORGANIC_SLIDERS;
/** @deprecated */
export const DEFAULT_FORCE_SETTINGS = LAYOUT_SETTING_PROFILES[1].defaults;

let settingsUiRoot = null;
/** @type {(() => void) | null} */
let settingsOnChange = null;

/**
 * @param {HTMLElement} containerEl
 * @param {() => void} [onChange]
 */
export function initLayoutSettingsSwitcher(containerEl, onChange) {
  if (!containerEl || containerEl.querySelector('.control-layout-settings-section')) return;

  settingsOnChange = onChange ?? null;

  const section = document.createElement('section');
  section.className = 'control-section control-layout-settings-section';
  section.innerHTML = `
    <div class="control-section-head">
      <h3 class="control-section-title">레이아웃 설정</h3>
      <button type="button" class="control-reset-btn" data-layout-settings-reset>기본값</button>
    </div>
    <p class="control-layout-settings-hint"></p>
    <div class="control-layout-settings-sliders"></div>
  `;
  containerEl.appendChild(section);
  settingsUiRoot = section;

  section.querySelector('[data-layout-settings-reset]')?.addEventListener('click', () => {
    const next = resetLayoutSettings(getActiveLayoutId());
    renderLayoutSettingsUi(getActiveLayoutId(), next);
    settingsOnChange?.();
  });

  renderLayoutSettingsUi(getActiveLayoutId(), getLayoutSettings());
}

/**
 * @param {number} layoutId
 * @param {Record<string, number>} settings
 */
export function renderLayoutSettingsUi(layoutId, settings = getLayoutSettings(layoutId)) {
  if (!settingsUiRoot) return;

  const sliders = getLayoutSettingSliders(layoutId);
  const hintEl = settingsUiRoot.querySelector('.control-layout-settings-hint');
  const slidersEl = settingsUiRoot.querySelector('.control-layout-settings-sliders');
  if (!slidersEl) return;

  const hints = {
    1: '유기 배치 — 드래그·포스 시뮬레이션 파라미터',
    2: '계층 구조 — 컬럼 간격·여백',
    3: '원형배치 — 섹터·엣지·기업·뉴스 동심원',
  };
  if (hintEl) hintEl.textContent = hints[layoutId] ?? '';

  slidersEl.innerHTML = '';

  for (const spec of sliders) {
    const block = document.createElement('div');
    block.className = 'control-force-row';
    const storedValue = settings[spec.key] ?? spec.min;
    const value = spec.key === 'forceDepth' ? forceDepthToSliderValue(storedValue) : storedValue;
    block.innerHTML = `
      <label class="control-label" for="layout-${layoutId}-${spec.key}" title="${spec.hint}">${spec.label}</label>
      <output class="control-value" for="layout-${layoutId}-${spec.key}">${spec.format(storedValue)}</output>
      <input
        type="range"
        id="layout-${layoutId}-${spec.key}"
        class="control-range"
        data-key="${spec.key}"
        min="${spec.min}"
        max="${spec.max}"
        step="${spec.step}"
        value="${value}"
        aria-label="${spec.label}"
      />
    `;
    slidersEl.appendChild(block);

    const range = block.querySelector('input');
    const output = block.querySelector('output');
    range?.addEventListener('input', () => {
      const num = Number(range.value);
      const next = setLayoutSettings(layoutId, { [spec.key]: num });
      if (output) output.textContent = spec.format(next[spec.key]);
      settingsOnChange?.();
    });
  }
}

/** @param {number} layoutId */
export function syncLayoutSettingsUi(layoutId = getActiveLayoutId()) {
  renderLayoutSettingsUi(layoutId, getLayoutSettings(layoutId));
}

/** @deprecated */
export const initForceSettingsSwitcher = initLayoutSettingsSwitcher;
