'use client';

import { useState } from 'react';

import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HeatmapCell, TopStock } from '@/lib/types';

/**
 * 섹터별 영향도 히트맵 (F-08) — 트리맵: 면적·%=이슈 영향 비중, 긍정=레드/부정=블루(진하기=비중).
 * 숫자는 등락률이 아니라 "이 이슈가 해당 섹터에 미치는 영향이 히트맵 전체에서 차지하는 비중(%)"이다
 * (전체 합 100%). 등락률은 확산 그래프 노드에만 표시한다.
 * 셀 hover 시 Top5 종목 툴팁이 셀 위에 떠, 마우스를 옮겨 종목 링크를 바로 클릭할 수 있다(F-10).
 * 배치는 share 비례 동적 트리맵 — 파이프라인(analyze deriveHeatmap)이 주는 가변 개수 셀을 그대로 렌더한다.
 */

/** 최소 flex 비중 — share가 아주 작은 셀도 라벨이 보이게 바닥값을 둔다(share 0~100 스케일) */
const MIN_GROW = 6;

type LegacyHeatmapCell = {
  sector?: string;
  share?: number;
  direction?: HeatmapCell['direction'];
  changePct?: number;
  weight?: number;
};

function allocateShares(values: number[]): number[] {
  if (values.length === 0) return [];

  const total = values.reduce((sum, value) => sum + Math.abs(value), 0);
  const rawShares = values.map((value) =>
    total > 0 ? (Math.abs(value) / total) * 100 : 100 / values.length,
  );
  const floors = rawShares.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = rawShares
    .map((raw, index) => ({ index, frac: raw - Math.floor(raw) }))
    .sort((a, b) => b.frac - a.frac);
  const shares = [...floors];

  for (const { index } of order) {
    if (remainder <= 0) break;
    shares[index] += 1;
    remainder -= 1;
  }

  return shares;
}

function normalizeCells(cells: HeatmapCell[]): HeatmapCell[] {
  const candidates = (cells as LegacyHeatmapCell[]).filter(
    (cell) => typeof cell.sector === 'string' && cell.sector.length > 0,
  );

  if (
    candidates.every(
      (cell) =>
        Number.isFinite(cell.share) &&
        (cell.direction === 'positive' || cell.direction === 'negative'),
    )
  ) {
    return candidates.map((cell) => ({
      sector: cell.sector!,
      share: cell.share!,
      direction: cell.direction!,
    }));
  }

  const values = candidates.map((cell) => {
    if (Number.isFinite(cell.changePct)) return cell.changePct!;
    if (Number.isFinite(cell.weight)) return cell.weight!;
    return 1;
  });
  const shares = allocateShares(values);

  return candidates.map((cell, index) => ({
    sector: cell.sector!,
    share: shares[index] ?? 0,
    direction: (cell.changePct ?? 1) >= 0 ? 'positive' : 'negative',
  }));
}

/**
 * 셀들을 share(영향 비중) 내림차순으로 정렬해 두 줄로 나눈다.
 * 첫 줄은 누적 share가 전체의 절반에 도달할 때까지(최소 1개), 나머지는 둘째 줄.
 * 셀이 3개 이하면 한 줄로 충분하다.
 */
function buildRows(cells: HeatmapCell[]): HeatmapCell[][] {
  const sorted = [...cells].sort((a, b) => b.share - a.share);
  if (sorted.length <= 3) return [sorted];

  const total = sorted.reduce((sum, cell) => sum + cell.share, 0);
  const firstRow: HeatmapCell[] = [];
  let acc = 0;
  for (const cell of sorted) {
    if (firstRow.length > 0 && acc >= total / 2) break;
    firstRow.push(cell);
    acc += cell.share;
  }
  const secondRow = sorted.slice(firstRow.length);
  return secondRow.length > 0 ? [firstRow, secondRow] : [firstRow];
}

// 색: 방향(긍정=레드/부정=블루), 진하기: 비중이 클수록(그 히트맵 내 최대 비중 대비) 진하게
function getCellBackground(cell: HeatmapCell, maxShare: number): string {
  const base = cell.direction === 'positive' ? 'var(--positive)' : 'var(--negative)';
  const intensity = maxShare > 0 ? cell.share / maxShare : 0;
  const strength = Math.round(16 + intensity * 58);
  return `color-mix(in oklab, ${base} ${strength}%, var(--card))`;
}

function formatShare(cell: HeatmapCell) {
  return `${cell.direction === 'negative' ? '-' : ''}${cell.share}%`;
}

function HeatCell({
  cell,
  stocks,
  maxShare,
}: {
  cell: HeatmapCell;
  stocks?: TopStock[];
  maxShare: number;
}) {
  const [isActive, setIsActive] = useState(false);
  // hover·focus를 툴팁까지 감싸는 래퍼에서 추적한다 — 셀→툴팁으로 마우스를 옮겨도
  // (툴팁은 래퍼의 자식이라 mouseleave가 안 뜸) 유지되어 종목 링크를 바로 클릭할 수 있다.
  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={(event) => {
        // 포커스가 래퍼(셀·툴팁 링크) 밖으로 나갈 때만 닫는다
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsActive(false);
      }}
    >
      <button
        type="button"
        className={cn(
          'flex h-full w-full flex-col justify-between rounded-md p-3 text-left transition-opacity outline-none',
          'hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/60',
        )}
        style={{ background: getCellBackground(cell, maxShare) }}
        aria-label={`${cell.sector} 영향 비중 ${formatShare(cell)} — Top5 종목 보기`}
      >
        <span className="text-[15px] leading-tight font-bold text-white">{cell.sector}</span>
        {/* 숫자 = 이슈 영향 비중(%), 방향은 색과 부호로 전달 */}
        <span className="text-[15px] font-extrabold text-white">{formatShare(cell)}</span>
      </button>
      {isActive && stocks && (
        // pointer-events-auto — 셀 위에 뜬 툴팁의 종목 링크를 hover 상태 그대로 클릭 가능
        <span className="pointer-events-auto absolute top-2 left-2 z-10">
          <StockTooltip sector={cell.sector} stocks={stocks} />
        </span>
      )}
    </div>
  );
}

export function ImpactHeatmap({
  cells,
  topStocks,
}: {
  cells: HeatmapCell[];
  topStocks: Record<string, TopStock[]>;
}) {
  const normalizedCells = normalizeCells(cells);
  const rows = buildRows(normalizedCells);
  const maxShare = normalizedCells.reduce((m, c) => Math.max(m, c.share), 0);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">섹터별 영향도 히트맵</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            면적·%는 이슈의 섹터별 영향 비중 · 색은 방향(긍정=레드/부정=블루) · 셀에 올리면 Top5
            종목을 볼 수 있습니다
          </p>
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

      {normalizedCells.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">표시할 섹터 영향도 데이터가 없습니다.</p>
      ) : (
        <div className="mt-6 flex h-[260px] flex-col gap-1.5">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex min-h-0 gap-1.5"
              style={{
                flexGrow: Math.max(
                  row.reduce((s, c) => s + c.share, 0),
                  MIN_GROW,
                ),
              }}
            >
              {row.map((cell) => (
                <div
                  key={cell.sector}
                  className="min-w-0"
                  style={{ flexGrow: Math.max(cell.share, MIN_GROW), flexBasis: 0 }}
                >
                  <HeatCell cell={cell} stocks={topStocks[cell.sector]} maxShare={maxShare} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
