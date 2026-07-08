'use client';

import { useState } from 'react';

import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Card } from '@/components/ui/card';
import { formatPct, getPctToneClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SpreadEdge, SpreadNode, TopStock } from '@/lib/types';

/** 영향력 확산 그래프 (F-07) — 연결선 hover 근거 툴팁(F-09) + 노드 hover Top5(F-10) */

const VIEW_W = 1100;
const VIEW_H = 560;
const TIER_X: Record<number, number> = { 0: 100, 1: 380, 2: 660, 3: 940 };
const TIER_COLOR: Record<number, string> = {
  0: 'var(--primary)',
  1: 'var(--tier1)',
  2: 'var(--tier2)',
  3: 'var(--tier3)',
};
const COLUMN_LABELS: Array<{ tier: 0 | 1 | 2 | 3; label: string }> = [
  { tier: 0, label: '뉴스 원점' },
  { tier: 1, label: '1차 파급' },
  { tier: 2, label: '2차 파급' },
  { tier: 3, label: '3차 파급' },
];

function getNodePos(node: SpreadNode) {
  return { x: TIER_X[node.tier], y: 90 + node.row * (VIEW_H - 150) };
}

export function SpreadGraph({
  nodes,
  edges,
  topStocks,
}: {
  nodes: SpreadNode[];
  edges: SpreadEdge[];
  topStocks: Record<string, TopStock[]>;
}) {
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">영향력 확산 그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            뉴스에서 시작되는 1·2·3차 파급 경로 · 연결선에 마우스를 올리면 근거를 확인할 수 있습니다
          </p>
        </div>
        {/* 파급 단계 범례 */}
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          {COLUMN_LABELS.slice(1).map(({ tier, label }) => (
            <li key={tier} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: TIER_COLOR[tier] }}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-6 w-full" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}>
        {/* 열 헤더 */}
        {COLUMN_LABELS.map(({ tier, label }) => (
          <span
            key={label}
            className="absolute -translate-x-1/2 text-xs font-bold"
            style={{
              left: `${(TIER_X[tier] / VIEW_W) * 100}%`,
              top: 0,
              color: tier === 0 ? 'var(--muted-foreground)' : TIER_COLOR[tier],
            }}
          >
            {label}
          </span>
        ))}

        {/* 연결선 */}
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full">
          {edges.map((edge, index) => {
            const from = getNodePos(byId[edge.from]);
            const to = getNodePos(byId[edge.to]);
            const midX = from.x + (to.x - from.x) / 2;
            const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
            const isActive = hoveredEdge === index;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={isActive ? 'var(--blue-bright)' : 'rgba(110,160,255,0.3)'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className={isActive ? 'animate-dashmove' : undefined}
                />
                {/* 넓은 히트 영역 — hover 판정용 */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredEdge(index)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* 노드 */}
        {nodes.map((node) => {
          const { x, y } = getNodePos(node);
          const isOrigin = node.tier === 0;
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onFocus={() => setHoveredNode(node.id)}
              onBlur={() => setHoveredNode(null)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 cursor-default rounded-md border bg-card px-3.5 py-2 text-left transition-colors outline-none',
                'hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50',
                isOrigin && 'border-primary/60 bg-primary/10',
              )}
              style={{ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` }}
              aria-label={`${node.name}${node.changePct != null ? ` ${formatPct(node.changePct)}` : ''} — Top5 종목 보기`}
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold whitespace-nowrap">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: TIER_COLOR[node.tier] }}
                />
                {node.name}
              </span>
              {isOrigin ? (
                <span className="mt-0.5 block text-center text-[11px] text-muted-foreground">
                  원점
                </span>
              ) : (
                // 등락 색은 부호 기준 — 하락(음수)은 negative 토큰 (색 하드코딩 금지)
                <span
                  className={cn(
                    'mt-0.5 block text-[13px] font-extrabold',
                    getPctToneClass(node.changePct ?? 0),
                  )}
                >
                  {node.changePct != null ? formatPct(node.changePct) : ''}
                </span>
              )}
            </button>
          );
        })}

        {/* 연결선 근거 툴팁 (F-09) */}
        {hoveredEdge != null &&
          (() => {
            const edge = edges[hoveredEdge];
            const from = getNodePos(byId[edge.from]);
            const to = getNodePos(byId[edge.to]);
            const cx = ((from.x + to.x) / 2 / VIEW_W) * 100;
            const cy = ((from.y + to.y) / 2 / VIEW_H) * 100;
            return (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-md border bg-popover p-3 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ left: `${cx}%`, top: `${cy}%` }}
              >
                <p className="text-xs leading-5 font-medium text-foreground">{edge.reason}</p>
                <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                  {edge.sources.map((source) => (
                    <li key={source} className="text-[11px] text-muted-foreground">
                      📰 {source}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

        {/* 노드 Top5 툴팁 (F-10) */}
        {hoveredNode &&
          byId[hoveredNode].tier !== 0 &&
          topStocks[byId[hoveredNode].name] &&
          (() => {
            const node = byId[hoveredNode];
            const { x, y } = getNodePos(node);
            const shouldFlip = node.tier === 3;
            return (
              <div
                className="pointer-events-none absolute z-10"
                style={{
                  left: `${((x + (shouldFlip ? -80 : 80)) / VIEW_W) * 100}%`,
                  top: `${(y / VIEW_H) * 100}%`,
                  transform: `translateY(-50%)${shouldFlip ? ' translateX(-100%)' : ''}`,
                }}
              >
                <StockTooltip sector={node.name} stocks={topStocks[node.name]} />
              </div>
            );
          })()}
      </div>
    </Card>
  );
}
