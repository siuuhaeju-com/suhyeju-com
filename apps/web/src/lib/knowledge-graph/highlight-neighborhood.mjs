/**
 * 하이라이트 이웃 — Sector/Company는 브릿지 EdgeNode 건너 반대쪽까지,
 * EdgeNode는 연결 기업 노드까지 포함.
 * @param {import("cytoscape").NodeSingular} node
 */
export function getBridgeEdgeNodes(node) {
  const type = node.data('type');
  if (type === 'Sector') {
    return node
      .outgoers('edge')
      .filter(
        (edge) => edge.data('relation') === 'includes' && edge.target().data('type') === 'EdgeNode',
      )
      .map((edge) => edge.target());
  }
  if (type === 'Company') {
    return node
      .incomers('edge')
      .filter(
        (edge) => edge.data('relation') === 'includes' && edge.source().data('type') === 'EdgeNode',
      )
      .map((edge) => edge.source());
  }
  return [];
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {import("cytoscape").NodeSingular} edgeNode
 */
function getCompanyNodesForEdgeNode(cy, edgeNode) {
  /** @type {import("cytoscape").CollectionReturnValue} */
  let companies = cy.collection();

  const companyId = String(edgeNode.data('companyId') ?? '').trim();
  if (companyId) {
    const byId = cy.getElementById(companyId);
    if (!byId.empty() && byId.data('type') === 'Company') {
      companies = companies.union(byId);
    }
  }

  edgeNode.connectedEdges().forEach((edge) => {
    for (const endpoint of [edge.source(), edge.target()]) {
      if (endpoint.id() !== edgeNode.id() && endpoint.data('type') === 'Company') {
        companies = companies.union(endpoint);
      }
    }
  });

  return companies;
}

/**
 * @param {import("cytoscape").Core} cy
 * @param {import("cytoscape").NodeSingular} node
 */
export function buildHighlightNeighborhood(cy, node) {
  let highlight = node.closedNeighborhood();

  for (const bridge of getBridgeEdgeNodes(node)) {
    highlight = highlight.union(bridge.closedNeighborhood());
  }

  if (node.data('type') === 'EdgeNode') {
    getCompanyNodesForEdgeNode(cy, node).forEach((company) => {
      highlight = highlight.union(company.closedNeighborhood());
    });
  }

  return highlight;
}
