import edgeNodes from '@/lib/knowledge-graph/data/pool/edge-nodes.json';
import edgeEdges from '@/lib/knowledge-graph/data/pool/edge-edges.json';
import newsEdges from '@/lib/knowledge-graph/data/pool/news-edges.json';
import newsNodes from '@/lib/knowledge-graph/data/pool/news-nodes.json';
import sectorNodes from '@/lib/knowledge-graph/data/pool/sector-nodes.json';

export type SectorBridgeCompany = {
  companyId: string;
  companyName: string;
  newsCount: number;
};

export type SectorRelatedNews = {
  id: string;
  title: string;
  publisher?: string;
  url: string;
  date?: string;
};

export type SectorSidebarInfo = {
  name: string;
  market?: string;
  isDocumentSector: boolean;
  bridgeCompanies: SectorBridgeCompany[];
  relatedNews: SectorRelatedNews[];
  companyCount: number;
  newsCount: number;
  edgeNodeCount: number;
  outgoing: string[];
  incoming: string[];
};

function scoreSectorMatch(poolName: string, query: string): number {
  if (poolName === query) return 100;
  if (poolName.includes(query) || query.includes(poolName)) {
    return 50 + Math.min(poolName.length, query.length);
  }
  return 0;
}

function findPoolSector(sectorName: string) {
  const query = sectorName.trim();
  if (!query) return null;

  let best: (typeof sectorNodes.nodes)[number] | null = null;
  let bestScore = 0;

  for (const node of sectorNodes.nodes) {
    const score = scoreSectorMatch(node.name, query);
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return bestScore > 0 ? best : null;
}

function getRelatedNewsFromPool(sectorId: string): SectorRelatedNews[] {
  const newsIds = [
    ...new Set(
      newsEdges.edges
        .filter((edge) => edge.target === sectorId && edge.relation === 'mentions')
        .map((edge) => edge.source),
    ),
  ];

  return newsNodes.nodes
    .filter((node) => newsIds.includes(node.id))
    .map((node) => {
      const links = node.props?.link;
      const url = Array.isArray(links) ? String(links[0] ?? '') : '';
      return {
        id: node.id,
        title: node.name,
        publisher: node.props?.source ? String(node.props.source) : undefined,
        url,
        date: node.props?.date ? String(node.props.date) : undefined,
      };
    })
    .filter((item) => item.title);
}

/** 풀 JSON 기준 섹터 사이드바 데이터 (그래프 마운트 전·폴백용) */
export function getSectorSidebarFromPool(
  sectorName: string,
  documentSector: string,
): SectorSidebarInfo | null {
  const sector = findPoolSector(sectorName);
  if (!sector) return null;

  const edgeNodeIds = edgeEdges.edges
    .filter((edge) => edge.source === sector.id)
    .map((edge) => edge.target);

  const bridges = edgeNodes.nodes.filter((node) => edgeNodeIds.includes(node.id));

  const bridgeCompaniesRaw = bridges.map((bridge) => ({
    companyId: String(bridge.props?.companyId ?? ''),
    companyName: String(bridge.props?.companyName ?? bridge.props?.companyId ?? '—'),
    newsCount: Array.isArray(bridge.props?.newsIds) ? bridge.props.newsIds.length : 0,
  }));

  const bridgeCompanies: SectorBridgeCompany[] = [];
  const seenCompanyKeys = new Set<string>();
  for (const item of bridgeCompaniesRaw) {
    const key = item.companyId || item.companyName;
    if (seenCompanyKeys.has(key)) continue;
    seenCompanyKeys.add(key);
    bridgeCompanies.push(item);
  }

  const companyIds = new Set(bridgeCompanies.map((item) => item.companyId).filter(Boolean));

  const doc = documentSector.trim();
  const isDocumentSector =
    Boolean(doc) && (sector.name === doc || sector.name.includes(doc) || doc.includes(sector.name));

  const relatedNews = getRelatedNewsFromPool(sector.id);

  return {
    name: sector.name,
    market: sector.props?.market ? String(sector.props.market) : undefined,
    isDocumentSector,
    bridgeCompanies,
    relatedNews,
    companyCount: companyIds.size || bridgeCompanies.length,
    newsCount: relatedNews.length,
    edgeNodeCount: bridges.length,
    outgoing: [],
    incoming: [],
  };
}
