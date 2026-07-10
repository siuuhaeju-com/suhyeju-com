/**
 * 뉴스 분석 오케스트레이션 (analyze 파이프라인 ③단계).
 * 본문 확보 → GPT 분석 → (시세 join) → AnalysisResult 조립.
 */
import { randomUUID } from 'crypto';

import { extractArticle } from '@/lib/extract-article';
import { analyzeNews, type AnalysisDraft } from '@/lib/sources/gpt';
import { searchEdgeSources } from '@/lib/sources/naver-news';
import { fetchStockQuotes, stockPageUrl, type StockQuote } from '@/lib/sources/naver-stock';
import type {
  AnalysisResult,
  EdgeSource,
  HeatmapCell,
  SignalNewsItem,
  SpreadNode,
  TopStock,
} from '@/lib/types';

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
      throw new Error('뉴스 본문을 불러오지 못했습니다.');
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
  const draft = await analyzeNews({ text, title, source });
  const tJoin = performance.now();

  // 3) 시세 join + 근거 뉴스 검색 — 서로 다른 필드를 채우므로 병렬로 돌려 지연을 숨긴다.
  //    시세: topStocks 실시세 교체 + 섹터 평균 파생. 근거: edge 검색어로 실제 기사 매핑.
  onProgress?.({ step: 'quote', label: '실시간 시세·근거 뉴스 확인 중' });
  const [quotes, edgeSources, goodNews, warnNews] = await Promise.all([
    joinQuotes(draft),
    joinSources(draft),
    resolveSignalNews(draft.goodSignal.news),
    resolveSignalNews(draft.warnSignal.news),
  ]);
  console.log(
    `[analyze] GPT ${Math.round(tJoin - tGpt)}ms · join ${Math.round(performance.now() - tJoin)}ms`,
  );

  // 4) AnalysisResult 조립
  return assemble(
    draft,
    quotes,
    edgeSources,
    { goodNews, warnNews },
    { title, originUrl: input.url ?? '', source, publishedAt },
  );
}

/**
 * draft에 네이버 실시세를 join한다(in-place) + 종목명→StockQuote 맵을 반환한다.
 * - topStocks 종목: 종목명→실시세로 changePct 교체(매칭 실패 시 GPT 초안 유지).
 *   코드·시장은 반환 맵으로 넘겨 assemble에서 TopStock에 부여한다(#49).
 * - spreadNodes/relatedSectors: 이름이 topStocks의 섹터와 맞으면
 *   그 섹터 종목들의 실시세 평균으로 changePct 교체.
 * - heatmap: 시세 등락률이 아니라 GPT impact → 서버 share/direction을 쓰므로 join하지 않는다.
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
  // (히트맵은 changePct가 아니라 impact 비중을 쓰므로 시세를 붙이지 않는다)
  for (const node of draft.spreadNodes) {
    const avg = sectorAvg.get(node.name);
    if (avg != null) node.changePct = avg;
  }
  for (const related of draft.relatedSectors) {
    const avg = sectorAvg.get(related.name);
    if (avg != null) related.changePct = avg;
  }

  return quotes;
}

/**
 * 각 edge의 searchQuery로 네이버 뉴스를 검색해 실제 기사(EdgeSource[])를 edge 순서대로
 * 반환한다. 근거 뉴스는 오직 이 검색 결과에서만 나온다(LLM 생성 제목·URL 유입 불가).
 * 키 미설정·검색 실패·결과 없음 → 해당 edge는 빈 배열(툴팁에 근거문만 표시).
 */
async function joinSources(draft: AnalysisDraft): Promise<EdgeSource[][]> {
  return Promise.all(draft.spreadEdges.map((edge) => searchEdgeSources(edge.searchQuery)));
}

/**
 * 전망 분석 관련 뉴스에 실제 기사 링크(url)를 붙인다.
 * 각 뉴스의 searchQuery로 네이버 뉴스를 검색해 최상위 실제 기사 URL을 첨부한다
 * (제목·출처는 GPT 텍스트 유지 — 신호 문구는 그대로 두고 근거 링크만 단다).
 * 검색 키(NAVER_CLIENT_ID/SECRET) 미설정·매칭 실패 시 url 없이 반환(비파괴적) → 링크 없는 기존 동작.
 */
async function resolveSignalNews(
  items: { text: string; source: string; searchQuery: string }[],
): Promise<SignalNewsItem[]> {
  return Promise.all(
    items.map(async ({ text, source, searchQuery }) => {
      const [top] = await searchEdgeSources(searchQuery, 1);
      return top ? { text, source, url: top.url } : { text, source };
    }),
  );
}

/** GPT 초안(draft) + 메타 → 완성 AnalysisResult (표현 필드는 여기서 파생) */
function assemble(
  draft: AnalysisDraft,
  quotes: Map<string, StockQuote | null>,
  edgeSources: EdgeSource[][],
  signalNews: { goodNews: SignalNewsItem[]; warnNews: SignalNewsItem[] },
  meta: { title: string; originUrl: string; source: string; publishedAt: string },
): AnalysisResult {
  // topStocks: 배열 → Record<섹터명, 종목[]> (매칭된 종목엔 코드·시장·네이버증권 링크 부여 #49)
  // 표시명은 네이버 표시명으로 교체 — 티커로 조회한 미국 종목을 한글명(애플 등)으로 보여준다.
  const topStocks: Record<string, TopStock[]> = {};
  for (const group of draft.topStocks) {
    topStocks[group.sector] = group.stocks.map((s) => {
      const q = quotes.get(s.name);
      return q
        ? {
            ...s,
            name: q.name || s.name,
            code: q.code,
            market: q.market,
            url: stockPageUrl(q.code, q.market),
          }
        : { ...s };
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
    goodSignal: { ...draft.goodSignal, news: signalNews.goodNews },
    warnSignal: { ...draft.warnSignal, news: signalNews.warnNews },
    spreadNodes: deriveRows(draft.spreadNodes),
    // searchQuery는 서버 내부용 — 검색으로 매핑된 실제 기사만 sources로 내보낸다
    spreadEdges: draft.spreadEdges.map(({ from, to, reason }, i) => ({
      from,
      to,
      reason,
      sources: edgeSources[i] ?? [],
    })),
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

/**
 * GPT의 heatmap 초안({sector, impact})을 히트맵 셀로 파생한다.
 * - share: 이슈 영향 비중(%) = |impact| / Σ|impact| × 100. 전체 합이 정확히 100이 되도록
 *   최대잔여법(largest-remainder)으로 정수 반올림.
 * - direction: impact 부호(≥0 긍정=레드 / <0 부정=블루).
 * impact의 절대값이 곧 "이슈가 그 섹터에 미치는 영향 강도"이고, 시세(등락률)와는 무관하다.
 */
function deriveHeatmap(cells: { sector: string; impact: number }[]): HeatmapCell[] {
  if (cells.length === 0) return [];

  const total = cells.reduce((sum, c) => sum + Math.abs(c.impact), 0);
  const base = cells.map((c) => ({
    sector: c.sector,
    direction: (c.impact >= 0 ? 'positive' : 'negative') as HeatmapCell['direction'],
    // total이 0이면(모두 impact 0) 균등 분배
    raw: total > 0 ? (Math.abs(c.impact) / total) * 100 : 100 / cells.length,
  }));

  // 최대잔여법: 내림 합을 100에서 뺀 만큼, 소수부가 큰 셀부터 +1
  const floors = base.map((b) => Math.floor(b.raw));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = base
    .map((b, i) => ({ i, frac: b.raw - Math.floor(b.raw) }))
    .sort((a, b) => b.frac - a.frac);
  const shares = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    shares[i] += 1;
    remainder -= 1;
  }

  return base.map((b, i) => ({ sector: b.sector, share: shares[i], direction: b.direction }));
}
