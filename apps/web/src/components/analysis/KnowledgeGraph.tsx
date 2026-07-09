'use client';

import { useMemo, useRef, useState } from 'react';

import {
  KnowledgeGraphCanvas,
  type KnowledgeGraphCanvasHandle,
} from '@/components/analysis/KnowledgeGraphCanvas';
import { KnowledgeGraphSectorSidebar } from '@/components/analysis/KnowledgeGraphSectorSidebar';
import { Card } from '@/components/ui/card';
import { getPoolMaxNodeCount, getPoolSectorCount } from '@/lib/knowledge-graph/pool-stats';
import {
  getSectorSidebarFromPool,
  type SectorSidebarInfo,
} from '@/lib/knowledge-graph/sector-info';

const GROUP_LEGEND = [
  { label: '뉴스', color: '#6ea0ff' },
  { label: '섹터', color: '#8b7bff' },
  { label: '연결', color: '#2fb3c9' },
  { label: '기업', color: '#f2a65a' },
] as const;

/**
 * 산업 연결 지식그래프 (F-12) — 그래프 + 섹터 정보 사이드바.
 */
export function KnowledgeGraph({ centerSector }: { centerSector: string }) {
  const sectorCount = getPoolSectorCount();
  const nodeCount = getPoolMaxNodeCount();

  const initialInfo = useMemo(
    () => getSectorSidebarFromPool(centerSector, centerSector),
    [centerSector],
  );

  const [sectorInfo, setSectorInfo] = useState<SectorSidebarInfo | null>(initialInfo);
  const canvasRef = useRef<KnowledgeGraphCanvasHandle>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const handleCompanyClick = (companyId: string, companyName: string) => {
    canvasRef.current?.highlightCompany(companyId, companyName);
    setSelectedCompanyId(companyId || companyName);
  };

  const handleSectorInfoChange = (info: SectorSidebarInfo | null) => {
    setSectorInfo(info);
    setSelectedCompanyId(null);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">산업 연결 지식그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            금융시장 {sectorCount}개 산업 네트워크 · 중심 산업 &lsquo;{centerSector}&rsquo; 기준 ·
            드래그하여 노드를 이동하고 스크롤로 확대·축소할 수 있습니다
          </p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          {GROUP_LEGEND.map(({ label, color }) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-4 h-[520px] overflow-hidden rounded-md border border-border bg-card lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
        <KnowledgeGraphCanvas
          ref={canvasRef}
          nodeCount={nodeCount}
          highlightSector={centerSector}
          onSectorInfoChange={handleSectorInfoChange}
          className="h-[520px] w-full cursor-grab touch-none active:cursor-grabbing"
        />
        <KnowledgeGraphSectorSidebar
          info={sectorInfo}
          documentSector={centerSector}
          selectedCompanyId={selectedCompanyId}
          onCompanyClick={handleCompanyClick}
        />
      </div>
    </Card>
  );
}
