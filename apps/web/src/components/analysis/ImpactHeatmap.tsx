'use client';

import { useState } from 'react';

import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Card } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import type { HeatmapCell, TopStock } from '@/lib/types';

/**
 * 섹터별 영향도 히트맵 (F-08) — 트리맵: 면적=영향도, 긍정=레드/부정=그린(진하기=크기).
 * 셀 hover 시 Top5 종목 툴팁(F-10).
 * 배치는 weight 비례 동적 트리맵 — 파이프라인(analyze)이 주는 가변 개수 셀을 그대로 렌더한다.
 * (구 버전은 목업 8칸 고정 슬롯(area 키) 방식이라 실데이터에서 크래시 — area는 이제 사용하지 않는다)
 */

/** 최소 flex 비중 — weight가 아주 작은 셀도 라벨이 보이게 바닥값을 둔다 */
const MIN_GROW = 0.18;

/**
 * 셀들을 weight 내림차순으로 정렬해 두 줄로 나눈다.
 * 첫 줄은 누적 weight가 전체의 절반에 도달할 때까지(최소 1개), 나머지는 둘째 줄.
 * 셀이 3개 이하면 한 줄로 충분하다.
 */
function buildRows(cells: HeatmapCell[]): HeatmapCell[][] {
  const sorted = [...cells].sort((a, b) => b.weight - a.weight);
  if (sorted.length <= 3) return [sorted];

  const total = sorted.reduce((sum, cell) => sum + cell.weight, 0);
  const firstRow: HeatmapCell[] = [];
  let acc = 0;
  for (const cell of sorted) {
    if (firstRow.length > 0 && acc >= total / 2) break;
    firstRow.push(cell);
    acc += cell.weight;
  }
  const secondRow = sorted.slice(firstRow.length);
  return secondRow.length > 0 ? [firstRow, secondRow] : [firstRow];
}

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
  const rows = buildRows(cells);

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

      {cells.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">표시할 섹터 영향도 데이터가 없습니다.</p>
      ) : (
        <div className="mt-6 flex h-[520px] flex-col gap-1.5">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex min-h-0 gap-1.5"
              style={{
                flexGrow: Math.max(
                  row.reduce((s, c) => s + c.weight, 0),
                  MIN_GROW,
                ),
              }}
            >
              {row.map((cell) => (
                <div
                  key={cell.sector}
                  className="min-w-0"
                  style={{ flexGrow: Math.max(cell.weight, MIN_GROW), flexBasis: 0 }}
                >
                  <HeatCell cell={cell} stocks={topStocks[cell.sector]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
