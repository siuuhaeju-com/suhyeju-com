import newsNodes from '../data/pool/news-nodes.json';
import newsEdges from '../data/pool/news-edges.json';
import sectorNodes from '../data/pool/sector-nodes.json';
import sectorEdges from '../data/pool/sector-edges.json';
import edgeNodes from '../data/pool/edge-nodes.json';
import edgeEdges from '../data/pool/edge-edges.json';
import companyNodes from '../data/pool/company-nodes.json';
import companyEdges from '../data/pool/company-edges.json';
import { graphStats } from './graph.js';

const CORE_NODE_COUNT = 6;

/** @type {Map<string, typeof edgeNodes.nodes[0]["props"] & { companyId?: string }>} */
const edgeNodePropsById = new Map(edgeNodes.nodes.map((node) => [node.id, node.props ?? {}]));

/** @type {Map<string, typeof edgeNodes.nodes[number][]>} */
const edgeNodesByCompanyId = new Map();
for (const node of edgeNodes.nodes) {
  const companyId = node.props?.companyId;
  if (!companyId) continue;
  if (!edgeNodesByCompanyId.has(companyId)) edgeNodesByCompanyId.set(companyId, []);
  edgeNodesByCompanyId.get(companyId).push(node);
}

/** 섹터→기업 사이 EdgeNode를 해당 기업 직전에 배치 (슬라이스 시 연결 유지) */
const companyBlockNodes = companyNodes.nodes.flatMap((company) => [
  ...(edgeNodesByCompanyId.get(company.id) ?? []),
  company,
]);

/** @type {Map<string, string>} */
const nodeTypeById = new Map();

for (const node of [
  ...newsNodes.nodes,
  ...sectorNodes.nodes,
  ...edgeNodes.nodes,
  ...companyNodes.nodes,
]) {
  nodeTypeById.set(node.id, node.label);
}

/**
 * @param {string | undefined} type
 */
function isEdgeNodeType(type) {
  return type === 'EdgeNode';
}

/**
 * 엣지 분류 — EdgeNode는 섹터↔기업 브릿지, 기업→섹터는 기업 엣지.
 * @param {{ source: string; target: string }} edge
 * @returns {"news" | "sector" | "company" | "edge"}
 */
export function classifyPoolEdge(edge) {
  const sourceType = nodeTypeById.get(edge.source);
  const targetType = nodeTypeById.get(edge.target);
  if (!sourceType || !targetType) {
    throw new Error(`Unknown node in edge ${edge.source} → ${edge.target}`);
  }
  if (sourceType === 'News' || targetType === 'News') return 'news';
  if (isEdgeNodeType(sourceType) || isEdgeNodeType(targetType)) {
    if (sourceType === 'Company' || targetType === 'Company') return 'edge';
    return 'sector';
  }
  if (sourceType === 'Company' && targetType === 'Company') return 'company';
  if (sourceType === 'Company' && targetType === 'Sector') return 'company';
  if (sourceType === 'Sector' && targetType === 'Sector') return 'sector';
  throw new Error(
    `Unclassified edge ${edge.source}(${sourceType}) → ${edge.target}(${targetType})`,
  );
}

/** @type {{ nodes: typeof newsNodes.nodes; edges: Array<Record<string, unknown>> }} */
const pool = {
  nodes: [...newsNodes.nodes, ...sectorNodes.nodes, ...companyBlockNodes],
  edges: [...newsEdges.edges, ...sectorEdges.edges, ...edgeEdges.edges, ...companyEdges.edges],
};

export const POOL_LAYERS = {
  news: { nodes: newsNodes.nodes, edges: newsEdges.edges },
  sector: { nodes: sectorNodes.nodes, edges: sectorEdges.edges },
  edge: { nodes: edgeNodes.nodes, edges: edgeEdges.edges },
  company: { nodes: companyNodes.nodes, edges: companyEdges.edges },
};

export { edgeNodePropsById, edgeNodesByCompanyId };

/**
 * @param {number} count
 * @returns {{ nodes: typeof pool.nodes; edges: typeof pool.edges }}
 */
export function buildGraphSlice(count) {
  const max = pool.nodes.length;
  const n = Math.min(max, Math.max(CORE_NODE_COUNT, Math.round(Number(count)) || CORE_NODE_COUNT));
  const nodeIds = new Set(pool.nodes.slice(0, n).map((node) => node.id));
  const nodes = pool.nodes.slice(0, n);
  const edges = pool.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  return { nodes, edges };
}

export function getMaxNodeCount() {
  return pool.nodes.length;
}

export function getMinNodeCount() {
  return CORE_NODE_COUNT;
}

export function getPoolStats(count) {
  return graphStats(buildGraphSlice(count));
}

export function getFullPool() {
  return pool;
}
