'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SpreadPathList } from '@/components/analysis/SpreadPathList';
import { StockHistoryDialog } from '@/components/analysis/StockHistoryDialog';
import { StockTooltip } from '@/components/analysis/StockTooltip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildSpreadNodeMap,
  filterRenderableSpreadEdges,
  getSpreadNodePosition,
  SPREAD_COLUMN_LABELS,
  SPREAD_TIER_COLOR,
  SPREAD_TIER_X,
  SPREAD_VIEWBOX,
} from '@/lib/analysis/spread-graph-view-model';
import { getImpactColor, getImpactStrength, IMPACT_STRENGTH_LABEL } from '@/lib/impact';
import { cn } from '@/lib/utils';
import type { SpreadEdge, SpreadNode, TopStock } from '@/lib/types';

/**
 * 영향력 확산 그래프 (F-07) — 연결선 근거 툴팁(F-09) + 노드 hover Top5(F-10).
 * F-16: 노드에 등락률 대신 영향도 라벨(강한/보통/약한 영향 × 긍정=레드/부정=블루, 채도=강도)을
 * 표시하고(구 히트맵 F-08의 역할 통합), 툴팁 종목 클릭 시 뉴스 발행일 기준 주가 추이 차트를 연다.
 * #98: 좌표 그래프는 좁은 폭에서 노드가 겹치므로 ≤748px에서는 SpreadPathList(티어 리스트)로 대체.
 */

// 그래프 요소 hover 후 툴팁으로 마우스가 이동할 유예 시간(ms) — 이 안에 툴팁에 들어오면 유지된다
const TOOLTIP_GRACE_MS = 1000;

export function SpreadGraph({
  nodes,
  edges,
  topStocks,
  sectionNote,
  publishedAt,
  analyzedAt,
}: {
  nodes: SpreadNode[];
  edges: SpreadEdge[];
  topStocks: Record<string, TopStock[]>;
  /** "이 그래프가 말하는 것" 한 문단 해설 (F-16) — 구 저장 데이터에는 없다 */
  sectionNote?: string;
  /** 뉴스 발행일 — 주가 추이 차트의 고정 기준선·조회 구간 기준(빈값이면 분석일 폴백) */
  publishedAt: string;
  analyzedAt: string;
}) {
  const router = useRouter();
  // 연결선 툴팁: hover + 유예시간(grace) — 선에서 떨어져도 잠시 유지, 그 사이 툴팁에 들어오면 계속 열려 링크 클릭 가능
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  // 노드 Top5 툴팁: hover + 유예시간(grace) — 노드에서 떨어져도 잠시 유지, 그 사이 툴팁에 들어오면 링크 클릭 가능
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  // 주가 추이 차트 모달 (F-16) — 툴팁에서 종목 클릭 시 열림
  const [chartStock, setChartStock] = useState<TopStock | null>(null);
  const edgeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeNode = hoveredNode;
  const nodesById = useMemo(() => buildSpreadNodeMap(nodes), [nodes]);
  const renderableEdges = useMemo(
    () => filterRenderableSpreadEdges(edges, nodesById),
    [edges, nodesById],
  );

  const clearEdgeHideTimer = () => {
    if (edgeHideTimer.current) {
      clearTimeout(edgeHideTimer.current);
      edgeHideTimer.current = null;
    }
  };
  // 연결선/툴팁에 들어옴 → 즉시 표시(대기 취소)
  const showEdge = (index: number) => {
    clearEdgeHideTimer();
    clearNodeHideTimer();
    setHoveredEdge(index);
    setHoveredNode(null);
  };
  // 연결선/툴팁에서 나감 → 바로 닫지 않고 grace 후 닫기(그 사이 툴팁 진입 시 위 showEdge가 취소)
  const scheduleHideEdge = () => {
    clearEdgeHideTimer();
    edgeHideTimer.current = setTimeout(() => setHoveredEdge(null), TOOLTIP_GRACE_MS);
  };

  const clearNodeHideTimer = () => {
    if (nodeHideTimer.current) {
      clearTimeout(nodeHideTimer.current);
      nodeHideTimer.current = null;
    }
  };
  const showNode = (id: string) => {
    clearEdgeHideTimer();
    clearNodeHideTimer();
    setHoveredNode(id);
    setHoveredEdge(null);
  };
  const scheduleHideNode = () => {
    clearNodeHideTimer();
    nodeHideTimer.current = setTimeout(() => setHoveredNode(null), TOOLTIP_GRACE_MS);
  };

  useEffect(() => {
    return () => {
      clearEdgeHideTimer();
      clearNodeHideTimer();
    };
  }, []);

  return (
    <Card className="p-4 min-[749px]:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">영향력 확산 그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="max-[748px]:hidden">
              뉴스에서 시작되는 1·2·3차 파급 경로와 섹터별 영향도 · 연결선에 올리면 근거 뉴스,
              노드에 올리면 Top5 종목, 종목을 클릭하면 주가 추이가 뜹니다
            </span>
            {/* 모바일 리스트 뷰(#98)는 hover가 없다 — 탭 안내로 교체 */}
            <span className="min-[749px]:hidden">
              뉴스에서 시작되는 1·2·3차 파급 경로와 섹터별 영향도 · 행을 탭하면 연결 근거와 Top5
              종목이 열립니다
            </span>
          </p>
        </div>
        {/* 범례: 파급 단계(점) + 영향 방향(사각 — 의미색 필수 병기, DESIGN.md) */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {/* 단계 점 범례는 모바일 리스트에선 티어 헤더가 대신한다 — 중복이라 숨김 */}
          {SPREAD_COLUMN_LABELS.slice(1).map(({ tier, label }) => (
            <li key={tier} className="flex items-center gap-1.5 max-[748px]:hidden">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: SPREAD_TIER_COLOR[tier] }}
              />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-positive" /> 긍정 영향
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-negative" /> 부정 영향
          </li>
          <li className="min-[749px]:hidden">채도가 진할수록 강한 영향</li>
        </ul>
      </div>

      {/* 섹션 해설 (F-16) — 이 그래프가 말하는 것 한 문단 */}
      {sectionNote && (
        <p className="mt-4 rounded-md bg-secondary/40 px-4 py-3 text-[13px] leading-relaxed text-ink-sub">
          {sectionNote}
        </p>
      )}

      {/* 데스크톱(>748px) — 좌표 기반 4열 그래프. 고정 좌표계를 %로 축소하는 구조라
          좁은 폭에서는 노드가 겹친다(#98) — 모바일은 아래 SpreadPathList가 대신한다 */}
      <div
        className="relative mt-6 hidden w-full min-[749px]:block"
        style={{ aspectRatio: `${SPREAD_VIEWBOX.width}/${SPREAD_VIEWBOX.height}` }}
      >
        {/* 열 헤더 */}
        {SPREAD_COLUMN_LABELS.map(({ tier, label }) => (
          <span
            key={label}
            className="absolute -translate-x-1/2 text-xs font-bold"
            style={{
              left: `${(SPREAD_TIER_X[tier] / SPREAD_VIEWBOX.width) * 100}%`,
              top: 0,
              color: tier === 0 ? 'var(--muted-foreground)' : SPREAD_TIER_COLOR[tier],
            }}
          >
            {label}
          </span>
        ))}

        {/* 연결선 */}
        <svg
          viewBox={`0 0 ${SPREAD_VIEWBOX.width} ${SPREAD_VIEWBOX.height}`}
          className="absolute inset-0 h-full w-full"
        >
          {renderableEdges.map((edge, index) => {
            const fromNode = nodesById.get(edge.from);
            const toNode = nodesById.get(edge.to);
            if (!fromNode || !toNode) return null;

            const from = getSpreadNodePosition(fromNode);
            const to = getSpreadNodePosition(toNode);
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
                {/* 넓은 히트 영역 — hover로 툴팁 표시, 떠나면 grace 후 닫기 */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onMouseEnter={() => showEdge(index)}
                  onMouseLeave={scheduleHideEdge}
                />
              </g>
            );
          })}
        </svg>

        {/* 노드 — 섹터명 + 영향도 라벨(방향=색·화살표, 강도=문구·채도). 구 데이터(impact 없음)는 이름만 */}
        {nodes.map((node) => {
          const { x, y } = getSpreadNodePosition(node);
          const isOrigin = node.tier === 0;
          const hasStocks = !isOrigin && !!topStocks[node.name];
          const strength = !isOrigin && node.impact != null ? getImpactStrength(node.impact) : null;
          const isImpactPositive = (node.impact ?? 0) >= 0;
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => {
                if (hasStocks) showNode(node.id);
              }}
              onMouseLeave={hasStocks ? scheduleHideNode : undefined}
              onFocus={() => {
                if (hasStocks) showNode(node.id);
              }}
              onBlur={hasStocks ? scheduleHideNode : undefined}
              onClick={() => {
                if (!hasStocks) return;
                showNode(node.id);
              }}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card px-3.5 py-2 text-left transition-colors outline-none',
                hasStocks ? 'cursor-pointer' : 'cursor-default',
                'hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50',
                isOrigin && 'border-primary/60 bg-primary/10',
              )}
              style={{
                left: `${(x / SPREAD_VIEWBOX.width) * 100}%`,
                top: `${(y / SPREAD_VIEWBOX.height) * 100}%`,
              }}
              aria-label={`${node.name}${
                strength
                  ? ` — ${isImpactPositive ? '긍정적으로' : '부정적으로'} ${IMPACT_STRENGTH_LABEL[strength]}`
                  : ''
              } — Top5 종목 보기`}
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
                  style={{ background: SPREAD_TIER_COLOR[node.tier] }}
                />
                <span className={cn(isOrigin && 'line-clamp-2 break-keep')}>{node.name}</span>
              </span>
              {isOrigin ? (
                <span className="mt-0.5 block text-center text-[11px] text-muted-foreground">
                  원점
                </span>
              ) : (
                strength && (
                  // 영향도 — 방향은 의미색+화살표 병기(색만으로 전달 금지),
                  // 강도는 라벨 문구 + 채도(강할수록 원색, 약할수록 잉크 혼합)로 구분
                  <span
                    className="mt-1 block text-center text-[11px] font-bold whitespace-nowrap"
                    style={{ color: getImpactColor(node.impact ?? 0) }}
                  >
                    {isImpactPositive ? '↗' : '↘'} {IMPACT_STRENGTH_LABEL[strength]}
                  </span>
                )
              )}
            </button>
          );
        })}

        {/* 연결선 근거 툴팁 (F-09) — hover로 뜨고, grace 유예 안에 툴팁으로 들어오면 유지되어 링크 클릭 가능 */}
        {hoveredEdge != null &&
          (() => {
            const edge = renderableEdges[hoveredEdge];
            const fromNode = edge ? nodesById.get(edge.from) : undefined;
            const toNode = edge ? nodesById.get(edge.to) : undefined;
            if (!edge || !fromNode || !toNode) return null;

            const from = getSpreadNodePosition(fromNode);
            const to = getSpreadNodePosition(toNode);
            const cx = ((from.x + to.x) / 2 / SPREAD_VIEWBOX.width) * 100;
            const cy = ((from.y + to.y) / 2 / SPREAD_VIEWBOX.height) * 100;
            return (
              <div
                role="tooltip"
                aria-label={`연결 근거: ${fromNode.name} → ${toNode.name}`}
                onMouseEnter={clearEdgeHideTimer}
                onMouseLeave={scheduleHideEdge}
                className="pointer-events-auto absolute z-10 w-80 -translate-x-1/2 rounded-md border bg-popover p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ left: `${cx}%`, top: `${cy}%` }}
              >
                <p className="text-[11px] font-extrabold tracking-wide text-blue-bright">
                  연결 근거 · {fromNode.name} → {toNode.name}
                </p>
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

        {/* 노드 Top5 툴팁 (F-10) — hover로 뜨고, grace 유예 안에 툴팁으로 들어오면 유지되어 링크 클릭 가능 */}
        {activeNode &&
          nodesById.get(activeNode)?.tier !== 0 &&
          topStocks[nodesById.get(activeNode)?.name ?? ''] &&
          (() => {
            const node = nodesById.get(activeNode);
            if (!node) return null;

            const { x, y } = getSpreadNodePosition(node);
            const shouldFlip = node.tier === 3;
            return (
              <div
                className="pointer-events-auto absolute z-10"
                onMouseEnter={clearNodeHideTimer}
                onMouseLeave={scheduleHideNode}
                onFocus={clearNodeHideTimer}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    scheduleHideNode();
                  }
                }}
                style={{
                  left: `${
                    ((x + (shouldFlip ? -80 : 80)) / SPREAD_VIEWBOX.width) * 100
                  }%`,
                  top: `${(y / SPREAD_VIEWBOX.height) * 100}%`,
                  transform: `translateY(-50%)${shouldFlip ? ' translateX(-100%)' : ''}`,
                }}
              >
                <StockTooltip
                  sector={node.name}
                  stocks={topStocks[node.name]}
                  onSelectStock={setChartStock}
                />
              </div>
            );
          })()}
      </div>

      {/* 모바일(≤748px) — 파급 경로 리스트 (#98): 티어 섹션 + 행 인라인 확장 */}
      <SpreadPathList
        nodes={nodes}
        edges={edges}
        topStocks={topStocks}
        onSelectStock={setChartStock}
        className="mt-4 min-[749px]:hidden"
      />

      {/* 주가 추이 차트 모달 (F-16) — 뉴스 발행일 기준점 */}
      {chartStock && (
        <StockHistoryDialog
          stock={chartStock}
          publishedAt={publishedAt}
          analyzedAt={analyzedAt}
          onClose={() => setChartStock(null)}
        />
      )}
    </Card>
  );
}
