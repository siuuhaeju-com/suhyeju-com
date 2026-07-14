'use client';

import { ChartLine, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  buildSpreadNodeMap,
  buildSpreadTierBlocks,
  filterRenderableSpreadEdges,
  formatSpreadParentNames,
  getIncomingSpreadEdges,
} from '@/lib/analysis/spread-graph-view-model';
import { getImpactColor, getImpactStrength, IMPACT_STRENGTH_LABEL } from '@/lib/impact';
import { cn } from '@/lib/utils';
import type { SpreadEdge, SpreadNode, TopStock } from '@/lib/types';

/**
 * 영향력 확산 그래프의 모바일(≤748px) 대체 뷰 — 파급 경로 리스트 (#98).
 * 좌표 기반 그래프는 좁은 폭에서 노드가 겹치므로, 원점 → 1·2·3차 티어 섹션 리스트로
 * 변환하고 hover 툴팁 2종(연결 근거 F-09 · Top5 F-10)을 행 인라인 확장 하나로 통합한다.
 * 연결 관계는 각 행의 "↳ 상위 섹터에서 이어짐" 표기로 보존한다.
 */

function StockChip({
  stock,
  onSelectStock,
}: {
  stock: TopStock;
  onSelectStock: (stock: TopStock) => void;
}) {
  function handleSelectStock() {
    onSelectStock(stock);
  }

  if (!stock.code) {
    return (
      <span className="block rounded-[7px] bg-secondary px-2 py-1 text-[11px] font-semibold text-ink-sub">
        {stock.name}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSelectStock}
      aria-label={`${stock.name} — 주가 추이 차트 보기`}
      className="flex cursor-pointer items-center gap-1 rounded-[7px] bg-secondary px-2 py-1 text-[11px] font-semibold text-ink-sub transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {stock.name}
      {/* 차트 열림 표식 — 색만으로 구분하지 않게 아이콘 병기 */}
      <ChartLine aria-hidden className="size-3 text-muted-foreground" />
    </button>
  );
}

export function SpreadPathList({
  nodes,
  edges,
  topStocks,
  onSelectStock,
  className,
}: {
  nodes: SpreadNode[];
  edges: SpreadEdge[];
  topStocks: Record<string, TopStock[]>;
  /** 종목 탭 → 주가 추이 차트 열기 — 모달 상태는 부모(SpreadGraph)가 소유 */
  onSelectStock: (stock: TopStock) => void;
  className?: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const nodesById = useMemo(() => buildSpreadNodeMap(nodes), [nodes]);
  const renderableEdges = useMemo(
    () => filterRenderableSpreadEdges(edges, nodesById),
    [edges, nodesById],
  );
  const origin = nodes.find((node) => node.tier === 0);
  const tierBlocks = useMemo(() => buildSpreadTierBlocks(nodes), [nodes]);
  function handleToggleNode(event: MouseEvent<HTMLButtonElement>) {
    const id = event.currentTarget.dataset.nodeId;
    if (!id) return;
    setOpenId((current) => (current === id ? null : id));
  }
  function handleAnalyzeSource(event: MouseEvent<HTMLButtonElement>) {
    const url = event.currentTarget.dataset.url;
    if (url) {
      router.push(`/analyzing?url=${encodeURIComponent(url)}`);
    }
  }

  return (
    <ol className={cn('flex flex-col', className)}>
      {origin && (
        <li className="relative pb-4 pl-7">
          <TierRail color="var(--primary)" isLast={tierBlocks.length === 0} />
          <p className="pt-0.5 text-[11px] font-bold text-muted-foreground">뉴스 원점</p>
          <div className="mt-2 rounded-[10px] border border-primary/60 bg-primary/10 px-3 py-2.5">
            <p className="text-[12.5px] leading-snug font-bold break-keep">{origin.name}</p>
          </div>
        </li>
      )}

      {tierBlocks.map(({ tier, label, color, nodes: tierNodes }, blockIndex) => (
        <li key={tier} className="relative pb-4 pl-7 last:pb-0">
          <TierRail color={color} isLast={blockIndex === tierBlocks.length - 1} />
          <p className="flex items-center gap-1.5 pt-0.5 text-[11px] font-bold" style={{ color }}>
            {label}
            <span className="rounded-full bg-secondary px-2 py-px text-[10px] font-semibold text-muted-foreground">
              {tierNodes.length}개 섹터
            </span>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {tierNodes.map((node) => {
              // 이 노드로 들어오는 연결 — 계보 표기와 확장 패널의 근거 블록 재료
              const incoming = getIncomingSpreadEdges(node.id, renderableEdges);
              const evidences = incoming.filter((edge) => edge.reason || edge.sources.length > 0);
              const stocks = topStocks[node.name];
              const expandable = evidences.length > 0 || !!stocks;
              const isOpen = expandable && openId === node.id;
              const strength = node.impact != null ? getImpactStrength(node.impact) : null;
              const parentNames = formatSpreadParentNames(incoming, nodesById);

              const rowContent = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold break-keep">{node.name}</span>
                    {parentNames && (
                      <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                        ↳ {parentNames}에서 이어짐
                      </span>
                    )}
                  </span>
                  {strength && (
                    // 방향은 의미색+화살표 병기, 강도는 라벨 문구+채도 — 데스크톱 노드와 동일 규칙
                    <span
                      className="text-[11px] font-bold whitespace-nowrap"
                      style={{ color: getImpactColor(node.impact ?? 0) }}
                    >
                      {(node.impact ?? 0) >= 0 ? '↗' : '↘'} {IMPACT_STRENGTH_LABEL[strength]}
                    </span>
                  )}
                </>
              );

              return (
                <li
                  key={node.id}
                  className={cn(
                    'rounded-[10px] border',
                    isOpen
                      ? 'border-blue-bright/25 bg-secondary/60'
                      : 'border-border bg-white/[0.02]',
                  )}
                >
                  {expandable ? (
                    <button
                      type="button"
                      data-node-id={node.id}
                      aria-expanded={isOpen}
                      onClick={handleToggleNode}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {rowContent}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'size-3.5 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  ) : (
                    // 구 데이터(근거·종목 없음)는 펼칠 내용이 없다 — 정적 행
                    <div className="flex items-center gap-2.5 px-3 py-2.5">{rowContent}</div>
                  )}

                  {isOpen && (
                    <div className="border-t border-border px-3 pt-2.5 pb-3">
                      {evidences.map((edge, index) => (
                        <div key={edge.from} className={cn(index > 0 && 'mt-3')}>
                          <p className="text-[10.5px] font-extrabold tracking-wide text-blue-bright">
                            연결 근거 · {nodesById.get(edge.from)?.name} → {node.name}
                          </p>
                          {edge.reason && (
                            <p className="mt-1 text-[12.5px] leading-relaxed font-medium text-ink-sub">
                              {edge.reason}
                            </p>
                          )}
                          {edge.sources.length > 0 && (
                            <ul className="mt-1.5 flex flex-col gap-1.5">
                              {edge.sources.map((source) => (
                                <li key={source.url} className="flex items-center gap-2">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 flex-1 truncate text-xs leading-snug font-semibold text-ink-sub transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                                  >
                                    {source.title}{' '}
                                    <span aria-hidden className="text-muted-foreground">
                                      ↗
                                    </span>
                                  </a>
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    data-url={source.url}
                                    className="shrink-0 cursor-pointer border-border"
                                    onClick={handleAnalyzeSource}
                                    aria-label={`${source.title} — 이 뉴스로 새 분석 시작`}
                                  >
                                    분석
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}

                      {stocks && (
                        <div className={cn(evidences.length > 0 && 'mt-3')}>
                          <p className="text-[10.5px] font-bold tracking-wide text-muted-foreground">
                            TOP5 종목 — 탭하면 주가 추이
                          </p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {stocks.map((stock) => (
                              <li key={stock.name}>
                                <StockChip stock={stock} onSelectStock={onSelectStock} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** 왼쪽 확산 레일 — 단계색 점 + 다음 티어로 이어지는 선 */
function TierRail({ color, isLast }: { color: string; isLast: boolean }) {
  return (
    <>
      {!isLast && (
        <span aria-hidden className="absolute top-2 bottom-0 left-[5px] w-px bg-border" />
      )}
      <span
        aria-hidden
        className="absolute top-1 left-0 size-[11px] rounded-full"
        style={{ background: color }}
      />
    </>
  );
}
