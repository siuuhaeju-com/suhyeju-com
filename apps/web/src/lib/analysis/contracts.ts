import type { AnalysisDraft } from '@/lib/sources/gpt';

type DraftSpreadNode = AnalysisDraft['spreadNodes'][number];

function findDuplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  return [...duplicates];
}

function formatList(values: string[]): string {
  return values.length > 4 ? `${values.slice(0, 4).join(', ')} 외 ${values.length - 4}개` : values.join(', ');
}

function hasIncomingFromPreviousTier(
  node: DraftSpreadNode,
  nodesById: Map<string, DraftSpreadNode>,
  draft: AnalysisDraft,
): boolean {
  return draft.spreadEdges.some((edge) => {
    const from = nodesById.get(edge.from);
    return edge.to === node.id && from?.tier === node.tier - 1;
  });
}

export function validateAnalysisDraft(draft: AnalysisDraft): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(draft.spreadNodes.map((node) => node.id));
  const nodesById = new Map(draft.spreadNodes.map((node) => [node.id, node]));
  const knowledgeNodeIds = new Set(draft.knowledgeNodes.map((node) => node.id));
  const topStockSectors = new Set(draft.topStocks.map((group) => group.sector));

  const duplicateNodeIds = findDuplicateIds(draft.spreadNodes);
  if (duplicateNodeIds.length > 0) {
    errors.push(`spreadNodes id 중복: ${formatList(duplicateNodeIds)}`);
  }

  const duplicateKnowledgeIds = findDuplicateIds(draft.knowledgeNodes);
  if (duplicateKnowledgeIds.length > 0) {
    errors.push(`knowledgeNodes id 중복: ${formatList(duplicateKnowledgeIds)}`);
  }

  const originNodes = draft.spreadNodes.filter((node) => node.tier === 0);
  if (originNodes.length !== 1) {
    errors.push(`tier 0 뉴스 원점은 정확히 1개여야 함: 현재 ${originNodes.length}개`);
  }

  const invalidSpreadEdges = draft.spreadEdges.filter(
    (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
  );
  if (invalidSpreadEdges.length > 0) {
    errors.push(
      `spreadEdges가 없는 노드를 참조: ${formatList(
        invalidSpreadEdges.map((edge) => `${edge.from}->${edge.to}`),
      )}`,
    );
  }

  const invalidKnowledgeEdges = draft.knowledgeEdges.filter(
    (edge) => !knowledgeNodeIds.has(edge.from) || !knowledgeNodeIds.has(edge.to),
  );
  if (invalidKnowledgeEdges.length > 0) {
    errors.push(
      `knowledgeEdges가 없는 노드를 참조: ${formatList(
        invalidKnowledgeEdges.map((edge) => `${edge.from}->${edge.to}`),
      )}`,
    );
  }

  const orphanSpreadNodes = draft.spreadNodes.filter(
    (node) => node.tier > 0 && !hasIncomingFromPreviousTier(node, nodesById, draft),
  );
  if (orphanSpreadNodes.length > 0) {
    errors.push(
      `이전 tier에서 들어오는 edge가 없는 spreadNodes: ${formatList(
        orphanSpreadNodes.map((node) => `${node.name}(${node.id})`),
      )}`,
    );
  }

  const nonOriginSectorNames = draft.spreadNodes
    .filter((node) => node.tier > 0)
    .map((node) => node.name);
  const missingTopStocks = nonOriginSectorNames.filter((name) => !topStockSectors.has(name));
  if (missingTopStocks.length > 0) {
    errors.push(`topStocks 누락 섹터: ${formatList(missingTopStocks)}`);
  }

  const unknownTopStockSectors = draft.topStocks
    .map((group) => group.sector)
    .filter((sector) => !nonOriginSectorNames.includes(sector));
  if (unknownTopStockSectors.length > 0) {
    errors.push(`spreadNodes와 일치하지 않는 topStocks 섹터: ${formatList(unknownTopStockSectors)}`);
  }

  return errors;
}

export function assertValidAnalysisDraft(draft: AnalysisDraft): void {
  const errors = validateAnalysisDraft(draft);
  if (errors.length > 0) {
    throw new Error(`GPT 분석 결과 계약 위반: ${errors.join(' / ')}`);
  }
}
