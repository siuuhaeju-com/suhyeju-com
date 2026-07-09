'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPct, getPctToneClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SpreadEdge, SpreadNode, TopStock } from '@/lib/types';

/** 영향력 확산 그래프 (F-07) — 연결선 근거 툴팁: hover 미리보기 + 클릭 고정(F-09) + 노드 hover Top5(F-10) */

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
  const router = useRouter();
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const edgeTooltipRef = useRef<HTMLDivElement | null>(null);

  // 툴팁 표시 대상 — 고정(pin)이 hover보다 우선
  const activeEdge = pinnedEdge ?? hoveredEdge;

  useEffect(() => {
    if (pinnedEdge == null) return;
    // 바깥 클릭으로 닫기 — 다른 연결선 클릭 시엔 pointerdown(닫힘) 후 click(재고정) 순서라 자연스럽게 전환된다
    const handlePointerDown = (event: PointerEvent) => {
      if (edgeTooltipRef.current?.contains(event.target as Node)) return;
      setPinnedEdge(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinnedEdge(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pinnedEdge]);

  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">영향력 확산 그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            뉴스에서 시작되는 1·2·3차 파급 경로 · 연결선을 클릭하면 근거가 고정됩니다 (바깥
            클릭·ESC로 닫기)
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
            const isActive = activeEdge === index || hoveredEdge === index;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={isActive ? 'var(--blue-bright)' : 'rgba(110,160,255,0.3)'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className={isActive ? 'animate-dashmove' : undefined}
                />
                {/* 넓은 히트 영역 — hover 미리보기 + 클릭 고정 판정용 */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredEdge(index);
                    setHoveredNode(null);
                  }}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={() => {
                    setPinnedEdge(index);
                    setHoveredNode(null);
                  }}
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
              onMouseEnter={() => {
                setHoveredNode(node.id);
                setHoveredEdge(null);
              }}
              onMouseLeave={() => setHoveredNode(null)}
              onFocus={() => {
                setHoveredNode(node.id);
                setHoveredEdge(null);
              }}
              onBlur={() => setHoveredNode(null)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 cursor-default rounded-md border bg-card px-3.5 py-2 text-left transition-colors outline-none',
                'hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50',
                isOrigin && 'border-primary/60 bg-primary/10',
              )}
              style={{ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` }}
              aria-label={`${node.name}${node.changePct != null ? ` ${formatPct(node.changePct)}` : ''} — Top5 종목 보기`}
            >
              <span
                className={cn(
                  'flex gap-1.5 text-[12.5px] font-bold',
                  // 원점은 뉴스 제목이라 길 수 있음 — 가로 대신 세로(최대 2줄, 초과 시 말줄임)
                  isOrigin ? 'max-w-[130px] items-start' : 'items-center whitespace-nowrap',
                )}
              >
                <span
                  aria-hidden
                  className={cn('size-1.5 shrink-0 rounded-full', isOrigin && 'mt-1.5')}
                  style={{ background: TIER_COLOR[node.tier] }}
                />
                <span className={cn(isOrigin && 'line-clamp-2 break-keep')}>{node.name}</span>
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

        {/* 연결선 근거 툴팁 (F-09) — hover 미리보기, 클릭 시 고정되어 내부 인터랙션 가능 */}
        {activeEdge != null &&
          (() => {
            const edge = edges[activeEdge];
            const isPinned = pinnedEdge != null;
            const from = getNodePos(byId[edge.from]);
            const to = getNodePos(byId[edge.to]);
            const cx = ((from.x + to.x) / 2 / VIEW_W) * 100;
            const cy = ((from.y + to.y) / 2 / VIEW_H) * 100;
            return (
              <div
                ref={edgeTooltipRef}
                role={isPinned ? 'dialog' : 'tooltip'}
                aria-label={`연결 근거: ${byId[edge.from].name} → ${byId[edge.to].name}`}
                className={cn(
                  'absolute z-10 w-80 -translate-x-1/2 rounded-md border bg-popover p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
                  isPinned ? 'pointer-events-auto' : 'pointer-events-none',
                )}
                style={{ left: `${cx}%`, top: `${cy}%` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-extrabold tracking-wide text-blue-bright">
                    연결 근거 · {byId[edge.from].name} → {byId[edge.to].name}
                  </p>
                  {isPinned && (
                    <button
                      type="button"
                      onClick={() => setPinnedEdge(null)}
                      aria-label="근거 툴팁 닫기"
                      className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed font-semibold text-foreground">
                  {edge.reason}
                </p>
                {/* 검색 매핑이 비면(키 미설정·결과 없음) 근거문만 남기고 블록 생략 */}
                {edge.sources.length > 0 && (
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    <p className="text-[10.5px] font-bold tracking-wide text-muted-foreground">
                      근거 뉴스
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {edge.sources.map((source) => (
                        <li key={source.url} className="flex gap-2">
                          <span aria-hidden className="text-[11px] leading-relaxed text-primary">
                            ▪
                          </span>
                          <span className="min-w-0 flex-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs leading-snug font-semibold text-ink-sub transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {source.title}{' '}
                              {/* 외부 링크 표식 — 제목과 구분되게 무채색(회색) 유지 */}
                              <span aria-hidden className="text-muted-foreground">
                                ↗
                              </span>
                            </a>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {source.meta}
                            </span>
                          </span>
                          <Button
                            size="xs"
                            variant="secondary"
                            // 연한 보더로 버튼임을 드러낸다 — DESIGN.md 서피스+1px 보더 규칙(border 토큰)
                            className="shrink-0 cursor-pointer self-center border-border"
                            onClick={() =>
                              router.push(`/analyzing?url=${encodeURIComponent(source.url)}`)
                            }
                            aria-label={`${source.title} — 이 뉴스로 새 분석 시작`}
                          >
                            분석
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
