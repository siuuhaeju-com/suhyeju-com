/**
 * 계층 구조 — News → Sector → EdgeNode → Company (좌→우 컬럼).
 */
import { getLayoutSettings } from '../layout-settings.mjs';

/** @type {Record<string, number>} */
const TYPE_COLUMN = {
  News: 0,
  Sector: 1,
  EdgeNode: 2,
  Company: 3,
};

/**
 * @param {import("cytoscape").Core} cy
 */
export function computeHierarchyLayout(cy) {
  const { spacingFactor, padding } = getLayoutSettings(2);

  const colStep = 155 * spacingFactor;
  const rowStep = 62 * spacingFactor;
  const centerX = 0;
  const centerY = 0;

  /** @type {Map<number, import("cytoscape").NodeSingular[]>} */
  const byColumn = new Map();
  cy.nodes().forEach((node) => {
    const type = node.data('type');
    const col = TYPE_COLUMN[type];
    if (col == null) return;
    if (!byColumn.has(col)) byColumn.set(col, []);
    byColumn.get(col).push(node);
  });

  /** @type {Map<string, { x: number; y: number }>} */
  const positions = new Map();

  for (const [col, group] of byColumn) {
    group.sort((a, b) => a.data('label').localeCompare(b.data('label'), 'ko'));
    const count = group.length;
    const x = centerX + (col - 1.5) * colStep;
    group.forEach((node, i) => {
      const y = centerY + (i - (count - 1) / 2) * rowStep;
      positions.set(node.id(), { x, y });
    });
  }

  return { positions, padding };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function applyHierarchyPositions(cy) {
  const { positions } = computeHierarchyLayout(cy);
  positions.forEach((pos, id) => {
    const node = cy.getElementById(id);
    if (!node.empty()) node.position(pos);
  });
}
