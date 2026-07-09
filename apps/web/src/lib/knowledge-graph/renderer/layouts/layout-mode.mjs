export const LAYOUT_KIND = {
  ORGANIC: 'organic',
  HIERARCHY: 'hierarchy',
  RING: 'ring',
};

/** @param {import("cytoscape").Core} cy */
export function isOrganicLayout(cy) {
  return !isFixedLayout(cy);
}

/** @param {import("cytoscape").Core} cy */
export function isFixedLayout(cy) {
  const kind = cy?._kgLayoutKind;
  return kind === LAYOUT_KIND.HIERARCHY || kind === LAYOUT_KIND.RING;
}

/** @param {import("cytoscape").Core} cy @param {string} kind */
export function setLayoutKind(cy, kind) {
  cy._kgLayoutKind = kind;
}
