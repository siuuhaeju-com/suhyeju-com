/**
 * Cytoscape Sector 노드 → 사이드바 표시용 데이터.
 * @param {import("cytoscape").NodeSingular} node
 * @param {string} [documentSector]
 */
export function extractSectorSidebarFromNode(node, documentSector = '') {
  if (!node || node.empty() || node.data('type') !== 'Sector') return null;

  const name = String(node.data('label') ?? '');
  const bridges = node
    .outgoers('edge')
    .filter(
      (edge) => edge.data('relation') === 'includes' && edge.target().data('type') === 'EdgeNode',
    )
    .map((edge) => edge.target());

  const bridgeCompanies = bridges.map((bridge) => ({
    companyId: String(bridge.data('companyId') ?? ''),
    companyName: String(bridge.data('companyName') ?? bridge.data('companyId') ?? '—'),
    newsCount: Array.isArray(bridge.data('newsIds')) ? bridge.data('newsIds').length : 0,
  }));

  const neighborhood = node.closedNeighborhood();

  const outgoing = node
    .outgoers('edge')
    .filter((edge) => edge.target().data('type') !== 'EdgeNode')
    .map((edge) => `${edge.data('relation')} → ${edge.target().data('label')}`);

  const incoming = node
    .incomers('edge')
    .filter((edge) => edge.source().data('type') !== 'EdgeNode')
    .map((edge) => `${edge.source().data('label')} → ${edge.data('relation')}`);

  const doc = documentSector.trim();
  const isDocumentSector =
    Boolean(doc) && (name === doc || name.includes(doc) || doc.includes(name));

  const relatedNews = neighborhood
    .nodes('[type = "News"]')
    .map((newsNode) => {
      /** @type {string} */
      let url = '';
      try {
        const refs = JSON.parse(newsNode.data('refsJson') || '[]');
        if (Array.isArray(refs) && refs[0]?.url) url = String(refs[0].url);
      } catch {
        /* ignore */
      }
      return {
        id: newsNode.id(),
        title: String(newsNode.data('label') ?? ''),
        publisher: newsNode.data('source') ? String(newsNode.data('source')) : undefined,
        url,
        date: newsNode.data('date') ? String(newsNode.data('date')) : undefined,
      };
    })
    .filter((item) => item.title);

  return {
    name,
    market: node.data('market') ? String(node.data('market')) : undefined,
    isDocumentSector,
    bridgeCompanies,
    relatedNews,
    companyCount: neighborhood.nodes('[type = "Company"]').length,
    newsCount: relatedNews.length,
    edgeNodeCount: bridges.length,
    outgoing,
    incoming,
  };
}
