import Link from 'next/link';
import { notFound } from 'next/navigation';

import { KnowledgeGraph } from '@/components/analysis/KnowledgeGraph';
import { SignalSection } from '@/components/analysis/SignalSection';
import { SpreadGraph } from '@/components/analysis/SpreadGraph';
import { SummarySection } from '@/components/analysis/SummarySection';
import { formatDateTime } from '@/lib/format';
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

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 pt-6 pb-24">
      {/* 상단 바 — 새 분석으로 돌아가기 + 분석 메타 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden>←</span> 새 분석
        </Link>
        {/* analyzedAt은 실데이터에서 ISO로 오므로 표시 형식으로 변환 */}
        <p className="text-xs text-muted-foreground">
          분석 완료 · {formatDateTime(result.analyzedAt)} · {result.engineVersion}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-12">
        <SummarySection result={result} />
        <SpreadGraph
          nodes={result.spreadNodes}
          edges={result.spreadEdges}
          topStocks={result.topStocks}
          sectionNote={result.sectionNotes?.spread}
          publishedAt={result.publishedAt}
          analyzedAt={result.analyzedAt}
        />
        <SignalSection result={result} />
        <KnowledgeGraph centerSector={result.sector} sectionNote={result.sectionNotes?.knowledge} />
      </div>
    </main>
  );
}
