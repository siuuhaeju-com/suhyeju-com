import { getFullPool } from './renderer/graph-pool.mjs';
import { findSectorNodeInPool } from './sector-match.mjs';

/**
 * @param {string} nodeId
 * @param {Array<{ source: string; target: string }>} edges
 */
function getClosedNeighborhoodIds(nodeId, edges) {
  /** @type {Set<string>} */
  const nodeIds = new Set([nodeId]);

  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return nodeIds;
}

/**
 * @param {{ id: string; label: string; props?: Record<string, unknown> }} node
 * @param {Array<{ source: string; target: string; relation?: string }>} edges
 * @param {Map<string, { label: string }>} nodeById
 */
function getBridgeEdgeNodeIds(node, edges, nodeById) {
  const type = node.label;
  const id = node.id;
  /** @type {string[]} */
  const bridges = [];

  if (type === 'Sector') {
    for (const edge of edges) {
      if (edge.source !== id || edge.relation !== 'includes') continue;
      if (nodeById.get(edge.target)?.label === 'EdgeNode') {
        bridges.push(edge.target);
      }
    }
  }

  if (type === 'Company') {
    for (const edge of edges) {
      if (edge.target !== id || edge.relation !== 'includes') continue;
      if (nodeById.get(edge.source)?.label === 'EdgeNode') {
        bridges.push(edge.source);
      }
    }
  }

  return bridges;
}

/**
 * @param {{ id: string; props?: Record<string, unknown> }} node
 * @param {Array<{ source: string; target: string }>} edges
 * @param {Map<string, { label: string }>} nodeById
 */
function getCompanyNodeIdsForEdgeNode(node, edges, nodeById) {
  /** @type {Set<string>} */
  const companies = new Set();

  const companyId = String(node.props?.companyId ?? '').trim();
  if (companyId && nodeById.get(companyId)?.label === 'Company') {
    companies.add(companyId);
  }

  for (const edge of edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue;
    for (const endpointId of [edge.source, edge.target]) {
      if (endpointId !== node.id && nodeById.get(endpointId)?.label === 'Company') {
        companies.add(endpointId);
      }
    }
  }

  return companies;
}

/**
 * highlight-neighborhood.mjs와 동일한 이웃 규칙을 풀 데이터에 적용.
 * @param {string} startNodeId
 * @param {{ nodes: Array<{ id: string; label: string; props?: Record<string, unknown> }>; edges: Array<{ source: string; target: string; relation?: string }> }} pool
 */
export function buildHighlightNeighborhoodIds(startNodeId, pool) {
  const { nodes, edges } = pool;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const startNode = nodeById.get(startNodeId);
  if (!startNode) return new Set();

  /** @type {Set<string>} */
  let highlightIds = getClosedNeighborhoodIds(startNodeId, edges);

  for (const bridgeId of getBridgeEdgeNodeIds(startNode, edges, nodeById)) {
    highlightIds = new Set([...highlightIds, ...getClosedNeighborhoodIds(bridgeId, edges)]);
  }

  if (startNode.label === 'EdgeNode') {
    for (const companyId of getCompanyNodeIdsForEdgeNode(startNode, edges, nodeById)) {
      highlightIds = new Set([...highlightIds, ...getClosedNeighborhoodIds(companyId, edges)]);
    }
  }

  return highlightIds;
}

/**
 * 분석 임베드용 — 중심 섹터와 1-hop 이웃(브릿지 EdgeNode·기업·뉴스)만 추출.
 * @param {string} sectorName
 */
export function buildSectorHighlightSubgraph(sectorName) {
  const pool = getFullPool();
  const sectorNode = findSectorNodeInPool(pool.nodes, sectorName);
  if (!sectorNode) {
    return { nodes: [], edges: [] };
  }

  const nodeIds = buildHighlightNeighborhoodIds(sectorNode.id, pool);
  const nodes = pool.nodes.filter((node) => nodeIds.has(node.id));
  const edges = pool.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return { nodes, edges };
}
