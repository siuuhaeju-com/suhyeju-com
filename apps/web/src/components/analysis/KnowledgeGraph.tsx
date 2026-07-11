'use client';

import Link from 'next/link';

import { KnowledgeGraphView } from '@/components/knowledge-graph/KnowledgeGraphView';
import { Card } from '@/components/ui/card';

/**
 * 산업 연결 지식그래프 (F-12) — 분석 페이지 임베드.
 */
export function KnowledgeGraph({
  centerSector,
  sectionNote,
}: {
  centerSector: string;
  /** "이 지식그래프가 말하는 것" 한 문단 해설 (F-16) — 구 저장 데이터에는 없다 */
  sectionNote?: string;
}) {
  return (
    <Card className="p-6">
      <KnowledgeGraphView
        centerSector={centerSector}
        documentSector={centerSector}
        mode="analysis"
        note={sectionNote}
        headerExtra={
          <Link
            href={`/knowledge-graph?sector=${encodeURIComponent(centerSector)}`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            전체 보기 →
          </Link>
        }
      />
    </Card>
  );
}
