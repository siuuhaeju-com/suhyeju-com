import companyNodes from '@/lib/knowledge-graph/data/pool/company-nodes.json';
import edgeNodes from '@/lib/knowledge-graph/data/pool/edge-nodes.json';
import newsNodes from '@/lib/knowledge-graph/data/pool/news-nodes.json';
import sectorNodes from '@/lib/knowledge-graph/data/pool/sector-nodes.json';

const CORE_NODE_COUNT = 6;

/** knowledge-graph 풀의 섹터(산업) 노드 수 */
export function getPoolSectorCount(): number {
  return sectorNodes.nodes.length;
}

/** graph-pool.mjs buildGraphSlice와 동일한 최대 노드 수 */
export function getPoolMaxNodeCount(): number {
  const companyBlockNodes = companyNodes.nodes.flatMap((company) => {
    const bridges = edgeNodes.nodes.filter((node) => node.props?.companyId === company.id);
    return [...bridges, company];
  });
  const poolNodes = [...newsNodes.nodes, ...sectorNodes.nodes, ...companyBlockNodes];
  return poolNodes.length;
}

export function getDefaultEmbedNodeCount(): number {
  return Math.min(getPoolMaxNodeCount(), CORE_NODE_COUNT + 3);
}
