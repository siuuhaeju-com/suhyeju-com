/** 뉴스 분석 유스케이스: 본문 확보 → GPT 초안 → 계약 검증 → 시세/근거 join → 응답 조립. */
import { assembleAnalysisResult } from '@/lib/analysis/assemble';
import { assertValidAnalysisDraft, assertValidAnalysisResult } from '@/lib/analysis/contracts';
import {
  AnalysisAssemblyError,
  AnalysisContractError,
  ArticleExtractionError,
  InvalidAnalysisInputError,
} from '@/lib/analysis/errors';
import { joinDraftQuotes } from '@/lib/analysis/quote-join';
import { joinEdgeSources, resolveSignalNews } from '@/lib/analysis/source-join';
import { extractArticle } from '@/lib/extract-article';
import { analyzeNews } from '@/lib/sources/gpt';
import type { AnalysisResult } from '@/lib/types';

export interface AnalyzeInput {
  url?: string;
  text?: string;
}

export type AnalysisProgressStep = {
  step: 'extract' | 'analyze' | 'quote';
  label: string;
};

type AnalysisArticle = {
  text: string;
  title: string;
  source: string;
  publishedAt: string;
  originUrl: string;
};

async function resolveAnalysisArticle(input: AnalyzeInput): Promise<AnalysisArticle> {
  const pastedText = input.text?.trim();
  if (pastedText) {
    return {
      text: pastedText,
      title: '',
      source: '',
      publishedAt: '',
      originUrl: input.url ?? '',
    };
  }

  if (!input.url) {
    throw new InvalidAnalysisInputError('분석할 뉴스 URL 또는 본문이 필요합니다');
  }

  const article = await extractArticle(input.url);
  if (!article) {
    throw new ArticleExtractionError();
  }

  const text = article.text.trim();
  if (!text) {
    throw new InvalidAnalysisInputError('분석할 뉴스 본문이 없습니다');
  }

  return {
    text,
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    originUrl: input.url,
  };
}

export async function runNewsAnalysis(
  input: AnalyzeInput,
  onProgress?: (progress: AnalysisProgressStep) => void,
): Promise<AnalysisResult> {
  onProgress?.({ step: 'extract', label: '뉴스 본문 읽는 중' });
  const article = await resolveAnalysisArticle(input);

  onProgress?.({ step: 'analyze', label: '이슈·파급 분석 중' });
  const draft = await analyzeNews(article);
  assertValidAnalysisDraft(draft);

  onProgress?.({ step: 'quote', label: '실시간 시세·근거 뉴스 확인 중' });
  const [{ draft: quotedDraft, quotes }, edgeSources, goodNews, warnNews] = await Promise.all([
    joinDraftQuotes(draft),
    joinEdgeSources(draft),
    resolveSignalNews(draft.goodSignal.news),
    resolveSignalNews(draft.warnSignal.news),
  ]);

  try {
    const result = assembleAnalysisResult(
      quotedDraft,
      quotes,
      edgeSources,
      { goodNews, warnNews },
      {
        title: article.title,
        originUrl: article.originUrl,
        source: article.source,
        publishedAt: article.publishedAt,
      },
    );
    assertValidAnalysisResult(result);
    return result;
  } catch (error) {
    if (error instanceof AnalysisContractError) {
      throw error;
    }
    throw new AnalysisAssemblyError(undefined, error);
  }
}
