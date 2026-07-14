import { notFound } from 'next/navigation';

import { AnalysisView } from '@/components/analysis/AnalysisView';
import { getAnalysis } from '@/lib/store';

type AnalysisPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * 분석 페이지 (PAGE-3 · #32 · F-16 개편)
 * AI 요약(F-05) → 영향력 확산 그래프(F-07, 히트맵 F-08 역할 통합) →
 * 전망 분석(F-06) → 산업 연결 지식그래프(F-12)
 * 그래프가 이 서비스의 핵심 산출물이라 요약 바로 아래 1순위로 배치한다(#86).
 */
export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;
  const result = await getAnalysis(id);
  if (!result) {
    notFound();
  }

  return <AnalysisView result={result} />;
}
