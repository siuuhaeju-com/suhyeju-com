'use client';

import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { GICS_SECTOR_DESCRIPTIONS } from '@/lib/gics-sectors';
import { knowledgeGraphSectorHref } from '@/lib/knowledge-graph/sector-map';
import { useKrMajorSectors } from '@/lib/queries';
import { formatPct, getPctArrow, getPctToneClass } from '@/lib/format';

const SECTOR_COUNT = 8;

/** 주요 섹터 현황 (F-03b · #16) — GICS 11개 대분류 중 등락률 상위 8개만 표시 (자르는 건 FE 담당) */
export function SectorOverview() {
  const { data, isPending, isError, refetch } = useKrMajorSectors();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: SECTOR_COUNT }).map((_, i) => (
          <Card key={i} className="h-[74px] animate-pulse p-4" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-muted-foreground">섹터 현황을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm font-bold text-primary hover:underline"
        >
          다시 시도
        </button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {data.slice(0, SECTOR_COUNT).map((sector) => (
        <Link
          key={sector.name}
          href={knowledgeGraphSectorHref(sector.name)}
          className="block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${sector.name} 산업 지식그래프에서 보기`}
        >
          <Card className="h-full p-4 transition-colors hover:border-primary/40 hover:bg-surface-raised/60">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold">{sector.name}</span>
              <span
                className={`text-[13px] font-bold whitespace-nowrap ${getPctToneClass(sector.changePct)}`}
              >
                {getPctArrow(sector.changePct)} {formatPct(sector.changePct)}
              </span>
            </div>
            {GICS_SECTOR_DESCRIPTIONS[sector.name] && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {GICS_SECTOR_DESCRIPTIONS[sector.name]}
              </p>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
