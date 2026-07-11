import { finishLayout } from '../layout-utils.mjs';
import { buildThemedGraphStyleFromVars } from '../themes/index.mjs';
import { LAYOUT_KIND, setLayoutKind } from './layout-mode.mjs';
import { applyRingPositions } from './ring-positions.mjs';
import { mountRingGuides, unmountRingGuides } from './ring-guides.mjs';

export const RING_LAYOUT_NAME = 'ring';

/** @param {import("../versions/types.js").GraphVersion} version */
export function isRingLayoutVersion(version) {
  return version.layout?.name === RING_LAYOUT_NAME || version.name === 'ring';
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function resetRingVisibility(cy) {
  cy.elements().forEach((el) => {
    el.removeStyle('display');
  });
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {import("../versions/types.js").GraphVersion} version
 * @param {ReturnType<import("../themes/index.mjs").getGraphThemeVars>} themeVars
 * @param {string} themeId
 */
export function applyRingLayout(cy, version, themeVars, themeId) {
  const styles = buildThemedGraphStyleFromVars(version.style, themeId, themeVars);
  cy.style(styles);

  applyRingPositions(cy);

  setLayoutKind(cy, LAYOUT_KIND.RING);
  cy._kgLastLayout = { name: RING_LAYOUT_NAME };

  cy.stop(true, false);
  finishLayout(cy, { layoutName: RING_LAYOUT_NAME, fit: true });
  mountRingGuides(cy);

  if (typeof cy._kgForceDragRebuild === 'function') {
    cy._kgForceDragRebuild();
  }
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function clearRingLayout(cy) {
  unmountRingGuides(cy);
  cy._kgRingRadii = null;
  resetRingVisibility(cy);

  if (typeof cy._kgForceDragRebuild === 'function') {
    cy._kgForceDragRebuild();
  }
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function syncRingLayerVisibility(cy) {
  if (cy._kgLayoutKind !== LAYOUT_KIND.RING) return;
}

/** @param {import("cytoscape").Core} cy */
export function isRingLayoutActive(cy) {
  return cy?._kgLayoutKind === LAYOUT_KIND.RING;
}
