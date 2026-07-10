import type { Metadata } from 'next';
import { Suspense } from 'react';

import { KnowledgeGraphFullPage } from '@/components/knowledge-graph/KnowledgeGraphFullPage';

export const metadata: Metadata = {
  title: '산업 지식그래프 — 수혜주.com',
  description: '금융시장 산업 네트워크 전체를 탐색하고 섹터·기업·뉴스 연결 관계를 확인하세요.',
};

export default function KnowledgeGraphPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[50vh] max-w-[1400px] items-center justify-center px-6 text-sm text-muted-foreground">
          그래프를 불러오는 중…
        </div>
      }
    >
      <KnowledgeGraphFullPage />
    </Suspense>
  );
}
