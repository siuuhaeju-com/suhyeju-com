import Link from 'next/link';

import { ImpactHeatmap } from '@/components/analysis/impact-heatmap';
import { KnowledgeGraph } from '@/components/analysis/knowledge-graph';
import { SignalSection } from '@/components/analysis/signal-section';
import { SpreadGraph } from '@/components/analysis/spread-graph';
import { SummarySection } from '@/components/analysis/summary-section';
import { getAnalysis } from '@/lib/mock-data';

type AnalysisPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * 분석 페이지 (PAGE-3 · #32)
 * AI 요약(F-05) → 전망 분석(F-06) → 영향력 확산 그래프(F-07) →
 * 섹터별 영향도 히트맵(F-08) → 산업 연결 지식그래프(F-12)
 * FE 연동 지점: getAnalysis(id) → GET /api/analysis/:id
 */
export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;
  const result = getAnalysis(id);

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
        <p className="text-xs text-muted-foreground">
          분석 완료 · {result.analyzedAt} · {result.engineVersion}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-12">
        <SummarySection result={result} />
        <SignalSection result={result} />
        <SpreadGraph
          nodes={result.spreadNodes}
          edges={result.spreadEdges}
          topStocks={result.topStocks}
        />
        <ImpactHeatmap cells={result.heatmap} topStocks={result.topStocks} />
        <KnowledgeGraph nodes={result.knowledgeNodes} edges={result.knowledgeEdges} />
      </div>
    </main>
  );
}
