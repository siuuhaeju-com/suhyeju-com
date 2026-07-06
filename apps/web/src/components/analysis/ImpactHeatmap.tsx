'use client';

import { useState } from 'react';

import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Card } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import type { HeatmapCell, TopStock } from '@/lib/types';

/**
 * 섹터별 영향도 히트맵 (F-08) — 트리맵: 면적=영향도, 긍정=레드/부정=그린(진하기=크기).
 * 셀 hover 시 Top5 종목 툴팁(F-10).
 * 배치는 목업 비율의 고정 트리맵 — FE 연동 시 weight 기반 d3-treemap 등으로 대체 가능.
 */

// 목업 비율 레이아웃: [행높이%, 셀들[area, 너비%]]
const LAYOUT: Array<{ height: number; cells: Array<{ area: string; width: number }> }> = [
  {
    height: 55,
    cells: [
      { area: 'semi', width: 40 },
      { area: 'material', width: 30 },
      { area: 'machine', width: 30 },
    ],
  },
  {
    height: 45,
    cells: [
      { area: 'it', width: 40 },
      { area: 'electric', width: 24 },
      { area: 'chemical', width: 18 },
      { area: 'stack', width: 18 }, // 운송+유틸리티 세로 스택
    ],
  },
];

function getCellBackground(cell: HeatmapCell): string {
  const base = cell.changePct >= 0 ? 'var(--positive)' : 'var(--negative)';
  const strength = Math.round(16 + cell.weight * 58);
  return `color-mix(in oklab, ${base} ${strength}%, var(--card))`;
}

function HeatCell({
  cell,
  stocks,
  className,
}: {
  cell: HeatmapCell;
  stocks?: TopStock[];
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className={`relative flex h-full w-full cursor-default flex-col justify-between overflow-visible rounded-md p-4 text-left transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/60 ${className ?? ''}`}
      style={{ background: getCellBackground(cell) }}
      aria-label={`${cell.sector} ${formatPct(cell.changePct)} — Top5 종목 보기`}
    >
      <span className="text-[15px] leading-tight font-bold text-white">{cell.sector}</span>
      <span className="text-[15px] font-extrabold text-white">{formatPct(cell.changePct)}</span>
      {isHovered && stocks && (
        <span className="pointer-events-none absolute top-2 left-2 z-10">
          <StockTooltip sector={cell.sector} stocks={stocks} />
        </span>
      )}
    </button>
  );
}

export function ImpactHeatmap({
  cells,
  topStocks,
}: {
  cells: HeatmapCell[];
  topStocks: Record<string, TopStock[]>;
}) {
  const byArea = Object.fromEntries(cells.map((cell) => [cell.area, cell]));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">섹터별 영향도 히트맵</h2>
          <p className="mt-1 text-xs text-muted-foreground">KRX 섹터 기준 · 면적 = 영향도 크기</p>
        </div>
        {/* 의미색 범례 — 필수 병기 (DESIGN.md) */}
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-positive" /> 긍정적 영향
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-negative" /> 부정적 영향
          </li>
        </ul>
      </div>

      <div className="mt-6 flex h-[520px] flex-col gap-1.5">
        {LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} className="flex min-h-0 gap-1.5" style={{ height: `${row.height}%` }}>
            {row.cells.map(({ area, width }) => {
              if (area === 'stack') {
                const transport = byArea.transport;
                const utility = byArea.utility;
                return (
                  <div
                    key={area}
                    className="flex min-w-0 flex-col gap-1.5"
                    style={{ width: `${width}%` }}
                  >
                    <div className="h-[55%]">
                      <HeatCell cell={transport} stocks={topStocks[transport.sector]} />
                    </div>
                    <div className="h-[45%]">
                      <HeatCell cell={utility} stocks={topStocks[utility.sector]} />
                    </div>
                  </div>
                );
              }
              const cell = byArea[area];
              return (
                <div key={area} className="min-w-0" style={{ width: `${width}%` }}>
                  <HeatCell cell={cell} stocks={topStocks[cell.sector]} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
