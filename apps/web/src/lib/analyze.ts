/** 뉴스 분석 오케스트레이션: 본문 확보 → GPT 초안 → 계약 검증 → 시세/근거 join → 응답 조립. */
import { assembleAnalysisResult } from '@/lib/analysis/assemble';
import { assertValidAnalysisDraft } from '@/lib/analysis/contracts';
import { joinDraftQuotes } from '@/lib/analysis/quote-join';
import { joinEdgeSources, resolveSignalNews } from '@/lib/analysis/source-join';
import { extractArticle } from '@/lib/extract-article';
import { analyzeNews } from '@/lib/sources/gpt';
import type { AnalysisResult } from '@/lib/types';

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
  assertValidAnalysisDraft(draft);
  const tJoin = performance.now();

  // 3) 시세 join + 근거 뉴스 검색 — 서로 다른 필드를 채우므로 병렬로 돌려 지연을 숨긴다.
  //    시세: topStocks 실시세 교체 + 섹터 평균 파생. 근거: edge 검색어로 실제 기사 매핑.
  onProgress?.({ step: 'quote', label: '실시간 시세·근거 뉴스 확인 중' });
  const [{ draft: quotedDraft, quotes }, edgeSources, goodNews, warnNews] = await Promise.all([
    joinDraftQuotes(draft),
    joinEdgeSources(draft),
    resolveSignalNews(draft.goodSignal.news),
    resolveSignalNews(draft.warnSignal.news),
  ]);
  console.log(
    `[analyze] GPT ${Math.round(tJoin - tGpt)}ms · join ${Math.round(performance.now() - tJoin)}ms`,
  );

  // 4) AnalysisResult 조립
  return assembleAnalysisResult(
    quotedDraft,
    quotes,
    edgeSources,
    { goodNews, warnNews },
    { title, originUrl: input.url ?? '', source, publishedAt },
  );
}
