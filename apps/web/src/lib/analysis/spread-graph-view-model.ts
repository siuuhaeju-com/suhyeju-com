import type { SpreadEdge, SpreadNode } from '@/lib/types';

export const SPREAD_VIEWBOX = {
  width: 1100,
  height: 560,
} as const;

export const SPREAD_TIER_X: Record<SpreadNode['tier'], number> = {
  0: 100,
  1: 380,
  2: 660,
  3: 940,
};

export const SPREAD_TIER_COLOR: Record<SpreadNode['tier'], string> = {
  0: 'var(--primary)',
  1: 'var(--tier1)',
  2: 'var(--tier2)',
  3: 'var(--tier3)',
};

export const SPREAD_COLUMN_LABELS: Array<{ tier: SpreadNode['tier']; label: string }> = [
  { tier: 0, label: '뉴스 원점' },
  { tier: 1, label: '1차 파급' },
  { tier: 2, label: '2차 파급' },
  { tier: 3, label: '3차 파급' },
];

export const SPREAD_PATH_TIER_META: Array<{
  tier: Exclude<SpreadNode['tier'], 0>;
  label: string;
  color: string;
}> = [
  { tier: 1, label: '1차 파급', color: 'var(--tier1)' },
  { tier: 2, label: '2차 파급', color: 'var(--tier2)' },
  { tier: 3, label: '3차 파급', color: 'var(--tier3)' },
];

export function getSpreadNodePosition(node: Pick<SpreadNode, 'tier' | 'row'>) {
  return {
    x: SPREAD_TIER_X[node.tier],
    y: 90 + node.row * (SPREAD_VIEWBOX.height - 150),
  };
}

export function buildSpreadNodeMap(nodes: SpreadNode[]): Map<string, SpreadNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function filterRenderableSpreadEdges(
  edges: SpreadEdge[],
  nodesById: Map<string, SpreadNode>,
): SpreadEdge[] {
  return edges.filter((edge) => nodesById.has(edge.from) && nodesById.has(edge.to));
}

export function buildSpreadTierBlocks(nodes: SpreadNode[]) {
  return SPREAD_PATH_TIER_META.map((meta) => ({
    ...meta,
    nodes: nodes.filter((node) => node.tier === meta.tier),
  })).filter((block) => block.nodes.length > 0);
}

export function getIncomingSpreadEdges(nodeId: string, edges: SpreadEdge[]): SpreadEdge[] {
  return edges.filter((edge) => edge.to === nodeId);
}

export function formatSpreadParentNames(
  incoming: SpreadEdge[],
  nodesById: Map<string, SpreadNode>,
): string {
  return incoming
    .map((edge) => nodesById.get(edge.from)?.name)
    .filter(Boolean)
    .join(' · ');
}
