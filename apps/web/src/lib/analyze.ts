/**
 * 뉴스 분석 오케스트레이션 (analyze 파이프라인 ③단계).
 * 본문 확보 → GPT 분석 → (시세 join) → AnalysisResult 조립.
 */
import { randomUUID } from 'crypto';

import { extractArticle } from '@/lib/extract-article';
import { analyzeNews, type AnalysisDraft } from '@/lib/sources/gpt';
import type { AnalysisResult, HeatmapCell, KnowledgeNode, SpreadNode } from '@/lib/types';

const ENGINE_VERSION = '수혜주.com AI v2.1';

export interface AnalyzeInput {
  url?: string;
  text?: string;
}

/** 뉴스(URL 또는 본문)를 분석해 완성된 AnalysisResult를 반환한다. */
export async function runAnalysis(input: AnalyzeInput): Promise<AnalysisResult> {
  // 1) 본문 확보 — 붙여넣기(text) 우선, 없으면 URL 스크래핑
  let text = input.text?.trim();
  let title = '';
  if (!text && input.url) {
    const article = await extractArticle(input.url);
    if (!article) {
      throw new Error('본문을 추출하지 못했습니다. 본문을 직접 붙여넣어 주세요.');
    }
    text = article.text;
    title = article.title;
  }
  if (!text) throw new Error('분석할 뉴스 본문이 없습니다');

  // 2) GPT 분석 (구조 생성)
  const draft = await analyzeNews(text);

  // 3) 시세 join — TODO(종목마스터): draft의 종목·섹터명에 네이버 실시세를 붙여
  //    changePct를 교체한다. 지금은 GPT 초안값을 그대로 사용.

  // 4) AnalysisResult 조립
  return assemble(draft, { title, originUrl: input.url ?? '' });
}

/** GPT 초안(draft) + 메타 → 완성 AnalysisResult (표현 필드는 여기서 파생) */
function assemble(
  draft: AnalysisDraft,
  meta: { title: string; originUrl: string },
): AnalysisResult {
  // topStocks: 배열 → Record<섹터명, 종목[]>
  const topStocks: Record<string, { name: string; changePct: number }[]> = {};
  for (const group of draft.topStocks) topStocks[group.sector] = group.stocks;

  return {
    id: randomUUID().slice(0, 8),
    sector: draft.sector,
    verdict: draft.verdict,
    title: meta.title || draft.summary.slice(0, 40),
    source: '', // TODO: 스크래핑 메타(발행처)
    publishedAt: '',
    desk: '',
    analyzedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    summary: draft.summary,
    originUrl: meta.originUrl,
    keywords: draft.keywords,
    relatedSectors: draft.relatedSectors,
    reviewedCount: draft.reviewedCount,
    goodSignal: draft.goodSignal,
    warnSignal: draft.warnSignal,
    spreadNodes: deriveRows(draft.spreadNodes),
    spreadEdges: draft.spreadEdges,
    heatmap: deriveHeatmap(draft.heatmap),
    knowledgeNodes: draft.knowledgeNodes.map((n) => ({ ...n, x: 0, y: 0 })), // 좌표는 KnowledgeGraph가 group 기반으로 자체 계산
    knowledgeEdges: draft.knowledgeEdges,
    topStocks,
  };
}

/** 같은 tier 노드들을 세로(0~1)로 균등 배치해 row를 파생한다. */
function deriveRows(nodes: Omit<SpreadNode, 'row'>[]): SpreadNode[] {
  const byTier = new Map<number, Omit<SpreadNode, 'row'>[]>();
  for (const node of nodes) {
    const list = byTier.get(node.tier) ?? [];
    list.push(node);
    byTier.set(node.tier, list);
  }
  const result: SpreadNode[] = [];
  for (const group of byTier.values()) {
    group.forEach((node, i) => {
      const row = group.length === 1 ? 0.5 : i / (group.length - 1);
      result.push({ ...node, row });
    });
  }
  return result;
}

/** area(슬롯 키)·weight(색 농도)를 파생한다. */
function deriveHeatmap(cells: Omit<HeatmapCell, 'area' | 'weight'>[]): HeatmapCell[] {
  const max = Math.max(...cells.map((c) => Math.abs(c.changePct)), 1);
  return cells.map((cell, i) => ({
    ...cell,
    area: `area${i}`,
    weight: Math.min(1, Math.abs(cell.changePct) / max),
  }));
}
