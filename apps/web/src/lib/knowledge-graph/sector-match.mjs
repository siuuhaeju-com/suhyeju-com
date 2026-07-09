/**
 * AnalysisResult.sector(배지 텍스트) → 풀 그래프 Sector 노드 매칭.
 * @param {import("cytoscape").Core} cy
 * @param {string} sectorName
 */
export function findSectorNode(cy, sectorName) {
  const query = sectorName.trim();
  if (!query) return null;

  const sectors = cy.nodes('[type = "Sector"]');
  /** @type {import("cytoscape").NodeSingular | null} */
  let best = null;
  let bestScore = 0;

  sectors.forEach((node) => {
    const name = String(node.data('label') ?? '');
    let score = 0;

    if (name === query) {
      score = 100;
    } else if (name.includes(query) || query.includes(name)) {
      score = 50 + Math.min(name.length, query.length);
    }

    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  });

  return bestScore > 0 ? best : null;
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {{ companyId?: string; companyName?: string }} query
 */
export function findCompanyNode(cy, { companyId = '', companyName = '' } = {}) {
  const id = companyId.trim();
  if (id) {
    const byId = cy.getElementById(id);
    if (!byId.empty() && byId.data('type') === 'Company') return byId;
  }

  const name = companyName.trim();
  if (!name) return null;

  const companies = cy.nodes('[type = "Company"]');
  /** @type {import("cytoscape").NodeSingular | null} */
  let best = null;
  let bestScore = 0;

  companies.forEach((node) => {
    const label = String(node.data('label') ?? '');
    let score = 0;

    if (label === name) {
      score = 100;
    } else if (label.includes(name) || name.includes(label)) {
      score = 50 + Math.min(label.length, name.length);
    }

    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  });

  return bestScore > 0 ? best : null;
}
