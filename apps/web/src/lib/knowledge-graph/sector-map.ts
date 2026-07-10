import sectorNodes from '@/lib/knowledge-graph/data/pool/sector-nodes.json';

/**
 * 메인 주요 섹터 현황(GICS 11대분류) → 지식그래프 풀 섹터명 매핑.
 * GICS 이름이 풀과 1:1이 아닐 때 대표 섹터로 연결한다.
 */
const GICS_TO_KNOWLEDGE_GRAPH_SECTOR: Readonly<Record<string, string>> = {
  정보기술: '반도체',
  산업재: '방산',
  경기소비재: '자동차',
  에너지: '에너지',
  건강관리: '제약·헬스케어',
  금융: '금융',
  커뮤니케이션서비스: '게임',
  소재: '화학·신소재',
  필수소비재: '소매·유통',
  유틸리티: '신재생에너지',
  부동산: '금융',
};

function scoreSectorMatch(poolName: string, query: string): number {
  if (poolName === query) return 100;
  if (poolName.includes(query) || query.includes(poolName)) {
    return 50 + Math.min(poolName.length, query.length);
  }
  return 0;
}

/** GICS·일반 섹터명 → 지식그래프 풀에 존재하는 섹터명 (없으면 null) */
export function resolveKnowledgeGraphSectorName(sectorName: string): string | null {
  const query = sectorName.trim();
  if (!query) return null;

  const mapped = GICS_TO_KNOWLEDGE_GRAPH_SECTOR[query];
  const candidates = [query, mapped].filter(Boolean) as string[];

  let bestName: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    for (const node of sectorNodes.nodes) {
      const score = scoreSectorMatch(node.name, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestName = node.name;
      }
    }
  }

  return bestScore > 0 ? bestName : null;
}

export function knowledgeGraphSectorHref(sectorName: string): string {
  const resolved = resolveKnowledgeGraphSectorName(sectorName);
  if (!resolved) return '/knowledge-graph';
  return `/knowledge-graph?sector=${encodeURIComponent(resolved)}`;
}
