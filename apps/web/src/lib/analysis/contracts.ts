import type { AnalysisDraft } from '@/lib/sources/gpt';
import type { AnalysisResult, KnowledgeNode, SpreadNode, TopStock } from '@/lib/types';
import { AnalysisContractError } from '@/lib/analysis/errors';

type DraftSpreadNode = AnalysisDraft['spreadNodes'][number];
type DraftTopStockGroup = AnalysisDraft['topStocks'][number];

function findDuplicates<T>(items: T[], getKey: (item: T) => string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }

  return [...duplicates];
}

function formatList(values: string[]): string {
  return values.length > 4
    ? `${values.slice(0, 4).join(', ')} 외 ${values.length - 4}개`
    : values.join(', ');
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
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

function validateImpact(node: Pick<SpreadNode, 'id' | 'name' | 'tier' | 'impact'>): string | null {
  if (node.impact == null) {
    return `impact 누락: ${node.name}(${node.id})`;
  }

  if (!isFiniteNumber(node.impact) || Math.abs(node.impact) > 100) {
    return `impact 범위 오류: ${node.name}(${node.id})=${node.impact}`;
  }

  if (node.tier === 0 && node.impact !== 0) {
    return `tier 0 impact는 0이어야 함: ${node.name}(${node.id})=${node.impact}`;
  }

  return null;
}

function validateTopStockGroup(group: DraftTopStockGroup): string[] {
  const errors: string[] = [];

  if (group.stocks.length !== 5) {
    errors.push(`${group.sector} Top5 종목 수는 정확히 5개여야 함: 현재 ${group.stocks.length}개`);
  }

  const duplicateStocks = findDuplicates(group.stocks, (stock) => stock.name);
  if (duplicateStocks.length > 0) {
    errors.push(`${group.sector} Top5 종목명 중복: ${formatList(duplicateStocks)}`);
  }

  const invalidChangePct = group.stocks.filter((stock) => !isFiniteNumber(stock.changePct));
  if (invalidChangePct.length > 0) {
    errors.push(
      `${group.sector} Top5 등락률 오류: ${formatList(invalidChangePct.map((stock) => stock.name))}`,
    );
  }

  return errors;
}

export function validateAnalysisDraft(draft: AnalysisDraft): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(draft.spreadNodes.map((node) => node.id));
  const nodesById = new Map(draft.spreadNodes.map((node) => [node.id, node]));
  const knowledgeNodeIds = new Set(draft.knowledgeNodes.map((node) => node.id));
  const topStockSectors = new Set(draft.topStocks.map((group) => group.sector));

  const duplicateNodeIds = findDuplicates(draft.spreadNodes, (node) => node.id);
  if (duplicateNodeIds.length > 0) {
    errors.push(`spreadNodes id 중복: ${formatList(duplicateNodeIds)}`);
  }

  const duplicateKnowledgeIds = findDuplicates(draft.knowledgeNodes, (node) => node.id);
  if (duplicateKnowledgeIds.length > 0) {
    errors.push(`knowledgeNodes id 중복: ${formatList(duplicateKnowledgeIds)}`);
  }

  const originNodes = draft.spreadNodes.filter((node) => node.tier === 0);
  if (originNodes.length !== 1) {
    errors.push(`tier 0 뉴스 원점은 정확히 1개여야 함: 현재 ${originNodes.length}개`);
  }

  const missingTiers = ([1, 2, 3] as const).filter(
    (tier) => !draft.spreadNodes.some((node) => node.tier === tier),
  );
  if (missingTiers.length > 0) {
    errors.push(`누락된 파급 tier: ${missingTiers.join(', ')}`);
  }

  const invalidImpacts = draft.spreadNodes
    .map(validateImpact)
    .filter((error): error is string => error !== null);
  errors.push(...invalidImpacts);

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

  const invalidTierEdges = draft.spreadEdges.filter((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    return from && to && to.tier !== from.tier + 1;
  });
  if (invalidTierEdges.length > 0) {
    errors.push(
      `spreadEdges tier 흐름 오류: ${formatList(
        invalidTierEdges.map((edge) => `${edge.from}->${edge.to}`),
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

  for (const group of draft.topStocks) {
    errors.push(...validateTopStockGroup(group));
  }

  const invalidRelatedSectorPcts = draft.relatedSectors.filter(
    (sector) => !isFiniteNumber(sector.changePct),
  );
  if (invalidRelatedSectorPcts.length > 0) {
    errors.push(
      `relatedSectors 등락률 오류: ${formatList(invalidRelatedSectorPcts.map((sector) => sector.name))}`,
    );
  }

  if (!isFiniteNumber(draft.goodSignal.ratio) || !isFiniteNumber(draft.warnSignal.ratio)) {
    errors.push('goodSignal/warnSignal ratio는 숫자여야 함');
  }

  return errors;
}

export function assertValidAnalysisDraft(draft: AnalysisDraft): void {
  const errors = validateAnalysisDraft(draft);
  if (errors.length > 0) {
    throw new AnalysisContractError('draft', errors);
  }
}

function validateResultNodes(nodes: SpreadNode[]): string[] {
  const errors: string[] = [];
  const duplicateNodeIds = findDuplicates(nodes, (node) => node.id);

  if (duplicateNodeIds.length > 0) {
    errors.push(`spreadNodes id 중복: ${formatList(duplicateNodeIds)}`);
  }

  const originNodes = nodes.filter((node) => node.tier === 0);
  if (originNodes.length !== 1) {
    errors.push(`tier 0 뉴스 원점은 정확히 1개여야 함: 현재 ${originNodes.length}개`);
  }

  const invalidRows = nodes.filter(
    (node) => !isFiniteNumber(node.row) || node.row < 0 || node.row > 1,
  );
  if (invalidRows.length > 0) {
    errors.push(`spreadNodes.row 범위 오류: ${formatList(invalidRows.map((node) => node.id))}`);
  }

  const invalidImpacts = nodes
    .filter((node) => node.impact != null)
    .map(validateImpact)
    .filter((error): error is string => error !== null);
  errors.push(...invalidImpacts);

  return errors;
}

function validateKnowledgeNodes(nodes: KnowledgeNode[]): string[] {
  const duplicateNodeIds = findDuplicates(nodes, (node) => node.id);
  if (duplicateNodeIds.length === 0) {
    return [];
  }
  return [`knowledgeNodes id 중복: ${formatList(duplicateNodeIds)}`];
}

function validateTopStocksRecord(
  topStocks: Record<string, TopStock[]>,
  sectorNames: Set<string>,
): string[] {
  const errors: string[] = [];

  for (const [sector, stocks] of Object.entries(topStocks)) {
    if (!sectorNames.has(sector)) {
      errors.push(`spreadNodes와 일치하지 않는 topStocks 섹터: ${sector}`);
    }

    if (stocks.length !== 5) {
      errors.push(`${sector} Top5 종목 수는 정확히 5개여야 함: 현재 ${stocks.length}개`);
    }

    const duplicateStocks = findDuplicates(stocks, (stock) => stock.name);
    if (duplicateStocks.length > 0) {
      errors.push(`${sector} Top5 종목명 중복: ${formatList(duplicateStocks)}`);
    }
  }

  return errors;
}

export function validateAnalysisResult(result: AnalysisResult): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(result.spreadNodes.map((node) => node.id));
  const knowledgeNodeIds = new Set(result.knowledgeNodes.map((node) => node.id));
  const nonOriginSectorNames = new Set(
    result.spreadNodes.filter((node) => node.tier > 0).map((node) => node.name),
  );

  if (!result.id || !result.title || !result.summary || !result.engineVersion) {
    errors.push('필수 메타 필드(id/title/summary/engineVersion) 누락');
  }

  if (Number.isNaN(Date.parse(result.analyzedAt))) {
    errors.push(`analyzedAt 날짜 형식 오류: ${result.analyzedAt}`);
  }

  errors.push(...validateResultNodes(result.spreadNodes));
  errors.push(...validateKnowledgeNodes(result.knowledgeNodes));

  const invalidSpreadEdges = result.spreadEdges.filter(
    (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
  );
  if (invalidSpreadEdges.length > 0) {
    errors.push(
      `spreadEdges가 없는 노드를 참조: ${formatList(
        invalidSpreadEdges.map((edge) => `${edge.from}->${edge.to}`),
      )}`,
    );
  }

  const invalidKnowledgeEdges = result.knowledgeEdges.filter(
    (edge) => !knowledgeNodeIds.has(edge.from) || !knowledgeNodeIds.has(edge.to),
  );
  if (invalidKnowledgeEdges.length > 0) {
    errors.push(
      `knowledgeEdges가 없는 노드를 참조: ${formatList(
        invalidKnowledgeEdges.map((edge) => `${edge.from}->${edge.to}`),
      )}`,
    );
  }

  errors.push(...validateTopStocksRecord(result.topStocks, nonOriginSectorNames));

  return errors;
}

export function assertValidAnalysisResult(result: AnalysisResult): void {
  const errors = validateAnalysisResult(result);
  if (errors.length > 0) {
    throw new AnalysisContractError('result', errors);
  }
}
