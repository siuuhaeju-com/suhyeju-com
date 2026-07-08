/**
 * 뉴스 분석 오케스트레이션 (analyze 파이프라인 ③단계).
 * 본문 확보 → GPT 분석 → (시세 join) → AnalysisResult 조립.
 */
import { randomUUID } from 'crypto';

import { extractArticle } from '@/lib/extract-article';
import { analyzeNews, type AnalysisDraft } from '@/lib/sources/gpt';
import { fetchStockQuotes, type StockQuote } from '@/lib/sources/naver-stock';
import type { AnalysisResult, HeatmapCell, KnowledgeNode, SpreadNode, TopStock } from '@/lib/types';

const ENGINE_VERSION = '수혜주.com AI v2.1';

export interface AnalyzeInput {
  url?: string;
  text?: string;
}

/** 분석 진행 단계 이벤트 (SSE — 로딩 화면 단계 표시용) */
export type ProgressStep = {
  step: 'extract' | 'analyze' | 'quote';
  label: string;
};

/**
 * 뉴스(URL 또는 본문)를 분석해 완성된 AnalysisResult를 반환한다.
 * onProgress가 있으면 각 단계 시작 시 진행 이벤트를 흘린다(SSE용).
 */
export async function runAnalysis(
  input: AnalyzeInput,
  onProgress?: (progress: ProgressStep) => void,
): Promise<AnalysisResult> {
  // 1) 본문 확보 — 붙여넣기(text) 우선, 없으면 URL 스크래핑
  onProgress?.({ step: 'extract', label: '뉴스 본문 읽는 중' });
  let text = input.text?.trim();
  let title = '';
  let source = '';
  let publishedAt = '';
  if (!text && input.url) {
    const article = await extractArticle(input.url);
    if (!article) {
      throw new Error('본문을 추출하지 못했습니다. 본문을 직접 붙여넣어 주세요.');
    }
    text = article.text;
    title = article.title;
    source = article.source;
    publishedAt = article.publishedAt;
  }
  if (!text) throw new Error('분석할 뉴스 본문이 없습니다');

  // 2) GPT 분석 (구조 생성)
  onProgress?.({ step: 'analyze', label: '이슈·파급 분석 중' });
  const tGpt = performance.now();
  const draft = await analyzeNews(text);
  const tJoin = performance.now();

  // 3) 시세 join — topStocks 종목에 네이버 실시세를 붙이고,
  //    섹터(spreadNodes/heatmap/relatedSectors)는 그 섹터 종목들의 실시세 평균으로 파생.
  onProgress?.({ step: 'quote', label: '실시간 시세 확인 중' });
  const quotes = await joinQuotes(draft);
  console.log(
    `[analyze] GPT ${Math.round(tJoin - tGpt)}ms · join ${Math.round(performance.now() - tJoin)}ms`,
  );

  // 4) AnalysisResult 조립
  return assemble(draft, quotes, {
    title,
    originUrl: input.url ?? '',
    source,
    publishedAt,
  });
}

/**
 * draft에 네이버 실시세를 join한다(in-place) + 종목명→StockQuote 맵을 반환한다.
 * - topStocks 종목: 종목명→실시세로 changePct 교체(매칭 실패 시 GPT 초안 유지).
 *   코드·시장은 반환 맵으로 넘겨 assemble에서 TopStock에 부여한다(#49).
 * - spreadNodes/heatmap/relatedSectors: 이름이 topStocks의 섹터와 맞으면
 *   그 섹터 종목들의 실시세 평균으로 changePct 교체.
 * 네이버가 막히거나 종목이 매칭 안 되면 조용히 GPT 초안값을 유지한다(분석 자체는 성공).
 */
async function joinQuotes(draft: AnalysisDraft): Promise<Map<string, StockQuote | null>> {
  const names = draft.topStocks.flatMap((g) => g.stocks.map((s) => s.name));
  if (names.length === 0) return new Map();

  let quotes: Map<string, StockQuote | null>;
  try {
    quotes = await fetchStockQuotes(names);
  } catch {
    return new Map(); // 시세 소스 장애 시 GPT 초안 유지
  }

  // 종목 changePct 교체 + 섹터별 실시세 평균 계산
  const sectorAvg = new Map<string, number>();
  for (const group of draft.topStocks) {
    const matched: number[] = [];
    for (const stock of group.stocks) {
      const pct = quotes.get(stock.name)?.changePct;
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

  return quotes;
}

/** GPT 초안(draft) + 메타 → 완성 AnalysisResult (표현 필드는 여기서 파생) */
function assemble(
  draft: AnalysisDraft,
  quotes: Map<string, StockQuote | null>,
  meta: { title: string; originUrl: string; source: string; publishedAt: string },
): AnalysisResult {
  // topStocks: 배열 → Record<섹터명, 종목[]> (매칭된 종목엔 코드·시장 부여 #49)
  const topStocks: Record<string, TopStock[]> = {};
  for (const group of draft.topStocks) {
    topStocks[group.sector] = group.stocks.map((s) => {
      const q = quotes.get(s.name);
      return q ? { ...s, code: q.code, market: q.market } : { ...s };
    });
  }

  return {
    id: randomUUID().slice(0, 8),
    sector: draft.sector,
    verdict: draft.verdict,
    title: meta.title || draft.summary.slice(0, 40),
    source: meta.source,
    publishedAt: meta.publishedAt,
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
