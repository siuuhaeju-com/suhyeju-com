import Link from 'next/link';

import { KnowledgeGraph } from '@/components/analysis/KnowledgeGraph';
import { SignalSection } from '@/components/analysis/SignalSection';
import { SpreadGraph } from '@/components/analysis/SpreadGraph';
import { SummarySection } from '@/components/analysis/SummarySection';
import { formatDateTime } from '@/lib/format';
import type { AnalysisResult } from '@/lib/types';

/**
 * 분석 페이지 화면 조립.
 * 라우트는 데이터 조회와 404 판단만 맡고, 섹션 순서와 화면 구성은 이 컴포넌트가 담당한다.
 */
export function AnalysisView({ result }: { result: AnalysisResult }) {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 pt-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden>←</span> 새 분석
        </Link>
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
