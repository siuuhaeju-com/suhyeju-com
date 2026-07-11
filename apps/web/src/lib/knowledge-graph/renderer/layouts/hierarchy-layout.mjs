import { finishLayout } from '../layout-utils.mjs';
import { buildThemedGraphStyleFromVars } from '../themes/index.mjs';
import { LAYOUT_KIND, setLayoutKind } from './layout-mode.mjs';
import { applyHierarchyPositions } from './hierarchy-positions.mjs';

export const HIERARCHY_LAYOUT_NAME = 'hierarchy';

/** @param {import("../versions/types.js").GraphVersion} version */
export function isHierarchyLayoutVersion(version) {
  return version.layout?.name === HIERARCHY_LAYOUT_NAME || version.name === 'hierarchy';
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {import("../versions/types.js").GraphVersion} version
 * @param {ReturnType<import("../themes/index.mjs").getGraphThemeVars>} themeVars
 * @param {string} themeId
 */
export function applyHierarchyLayout(cy, version, themeVars, themeId) {
  const styles = buildThemedGraphStyleFromVars(version.style, themeId, themeVars);
  cy.style(styles);

  applyHierarchyPositions(cy);
  setLayoutKind(cy, LAYOUT_KIND.HIERARCHY);
  cy._kgLastLayout = { name: HIERARCHY_LAYOUT_NAME };

  cy.stop(true, false);
  finishLayout(cy, { layoutName: HIERARCHY_LAYOUT_NAME, fit: true });

  if (typeof cy._kgForceDragRebuild === 'function') {
    cy._kgForceDragRebuild();
  }
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function clearHierarchyLayout(cy) {
  if (typeof cy._kgForceDragRebuild === 'function') {
    cy._kgForceDragRebuild();
  }
}
