'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { KnowledgeGraphView } from '@/components/knowledge-graph/KnowledgeGraphView';

/**
 * 산업 지식그래프 전체 보기 (F-15 · #82).
 * ?sector= 쿼리가 있으면 해당 섹터를 초기 하이라이트한다 (#85 선행 연동).
 */
export function KnowledgeGraphFullPage() {
  const searchParams = useSearchParams();
  const sector = searchParams.get('sector')?.trim() || undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            홈
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">산업 지식그래프</span>
        </nav>
        <Link
          href="/"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          분석으로 돌아가기
        </Link>
      </div>

      <KnowledgeGraphView
        centerSector={sector}
        documentSector={sector}
        graphHeightClass="h-[min(72vh,760px)] min-h-[480px]"
        description={
          sector
            ? undefined
            : '전체 산업 네트워크를 탐색합니다. 섹터·기업·뉴스 노드를 클릭하면 연결 관계가 하이라이트됩니다.'
        }
      />
    </div>
  );
}
