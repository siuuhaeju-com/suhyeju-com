/**
 * 뉴스 분석 오케스트레이션 (analyze 파이프라인 ③단계).
 * 본문 확보 → GPT 분석 → (시세 join) → AnalysisResult 조립.
 */
import { randomUUID } from 'crypto';

import { extractArticle } from '@/lib/extract-article';
import { analyzeNews, type AnalysisDraft } from '@/lib/sources/gpt';
import { fetchStockChangePcts } from '@/lib/sources/naver-stock';
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

  // 3) 시세 join — topStocks 종목에 네이버 실시세를 붙이고,
  //    섹터(spreadNodes/heatmap/relatedSectors)는 그 섹터 종목들의 실시세 평균으로 파생.
  await joinQuotes(draft);

  // 4) AnalysisResult 조립
  return assemble(draft, { title, originUrl: input.url ?? '' });
}

/**
 * draft에 네이버 실시세를 join한다(in-place).
 * - topStocks 종목: 종목명→실시세로 changePct 교체(매칭 실패 시 GPT 초안 유지).
 * - spreadNodes/heatmap/relatedSectors: 이름이 topStocks의 섹터와 맞으면
 *   그 섹터 종목들의 실시세 평균으로 changePct 교체.
 * 네이버가 막히거나 종목이 매칭 안 되면 조용히 GPT 초안값을 유지한다(분석 자체는 성공).
 */
async function joinQuotes(draft: AnalysisDraft): Promise<void> {
  const names = draft.topStocks.flatMap((g) => g.stocks.map((s) => s.name));
  if (names.length === 0) return;

  let quotes: Map<string, number | null>;
  try {
    quotes = await fetchStockChangePcts(names);
  } catch {
    return; // 시세 소스 장애 시 GPT 초안 유지
  }

  // 종목 changePct 교체 + 섹터별 실시세 평균 계산
  const sectorAvg = new Map<string, number>();
  for (const group of draft.topStocks) {
    const matched: number[] = [];
    for (const stock of group.stocks) {
      const pct = quotes.get(stock.name);
      if (pct != null) {
        stock.changePct = pct;
        matched.push(pct);
      }
    }
    if (matched.length) {
      sectorAvg.set(group.sector, matched.reduce((a, b) => a + b, 0) / matched.length);
    }
  }

  // 섹터명이 topStocks 섹터와 일치하면 평균값으로 교체(원점 등 미매칭은 GPT 초안 유지)
  for (const node of draft.spreadNodes) {
    const avg = sectorAvg.get(node.name);
    if (avg != null) node.changePct = avg;
  }
  for (const cell of draft.heatmap) {
    const avg = sectorAvg.get(cell.sector);
    if (avg != null) cell.changePct = avg;
  }
  for (const related of draft.relatedSectors) {
    const avg = sectorAvg.get(related.name);
    if (avg != null) related.changePct = avg;
  }
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
