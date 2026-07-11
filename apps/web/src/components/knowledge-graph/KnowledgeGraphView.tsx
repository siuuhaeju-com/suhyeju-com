'use client';

import { useMemo, useRef, useState } from 'react';

import {
  KnowledgeGraphCanvas,
  type KnowledgeGraphCanvasHandle,
} from '@/components/analysis/KnowledgeGraphCanvas';
import { KnowledgeGraphSectorSidebar } from '@/components/analysis/KnowledgeGraphSectorSidebar';
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

type KnowledgeGraphViewProps = {
  /** 초기 하이라이트·사이드바 기준 섹터 (없으면 전체 그래프만 표시) */
  centerSector?: string;
  /** 사이드바 "이 분석 핵심" 배지 기준 (분석 페이지용) */
  documentSector?: string;
  /** full: 79섹터 링 배치 · analysis: 중심 섹터 이웃만 유기 배치 */
  mode?: 'full' | 'analysis';
  graphHeightClass?: string;
  headerExtra?: React.ReactNode;
  description?: string;
  /** 섹션 해설 한 문단 (F-16, 분석 임베드용) — 헤더와 그래프 사이에 표시 */
  note?: string;
};

/**
 * 산업 지식그래프 공통 뷰 — 분석 임베드·전체 보기 페이지에서 재사용.
 */
export function KnowledgeGraphView({
  centerSector,
  documentSector = '',
  mode = 'full',
  graphHeightClass = 'h-[520px]',
  headerExtra,
  description,
  note,
}: KnowledgeGraphViewProps) {
  const sectorCount = getPoolSectorCount();
  const nodeCount = mode === 'analysis' ? undefined : getPoolMaxNodeCount();

  const initialInfo = useMemo(
    () =>
      centerSector ? getSectorSidebarFromPool(centerSector, documentSector || centerSector) : null,
    [centerSector, documentSector],
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

  const defaultDescription =
    mode === 'analysis' && centerSector
      ? `‘${centerSector}’ 산업과 직접 연결된 기업·뉴스 네트워크 · 드래그하여 노드를 이동하고 스크롤로 확대·축소할 수 있습니다`
      : centerSector
        ? `금융시장 ${sectorCount}개 산업 네트워크 · 중심 산업 ‘${centerSector}’ 기준 · 드래그하여 노드를 이동하고 스크롤로 확대·축소할 수 있습니다`
        : `금융시장 ${sectorCount}개 산업 네트워크 · 노드를 클릭해 연결 관계를 탐색하고 드래그·스크롤로 확대·축소할 수 있습니다`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">산업 연결 지식그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description ?? defaultDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ul className="flex items-center gap-4 text-xs text-muted-foreground">
            {GROUP_LEGEND.map(({ label, color }) => (
              <li key={label} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
                {label}
              </li>
            ))}
          </ul>
          {headerExtra}
        </div>
      </div>

      {/* 섹션 해설 (F-16) — 이 지식그래프가 말하는 것 한 문단 */}
      {note && (
        <p className="mt-4 rounded-md bg-secondary/40 px-4 py-3 text-[13px] leading-relaxed text-ink-sub">
          {note}
        </p>
      )}

      <div
        className={`relative mt-4 overflow-hidden rounded-md border border-border bg-card lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] ${graphHeightClass}`}
      >
        <KnowledgeGraphCanvas
          ref={canvasRef}
          nodeCount={nodeCount}
          highlightSector={centerSector}
          mode={mode}
          onSectorInfoChange={handleSectorInfoChange}
          className={`${graphHeightClass} w-full cursor-grab touch-none active:cursor-grabbing`}
        />
        <KnowledgeGraphSectorSidebar
          info={sectorInfo}
          documentSector={documentSector || centerSector || ''}
          selectedCompanyId={selectedCompanyId}
          onCompanyClick={handleCompanyClick}
        />
      </div>
    </>
  );
}
