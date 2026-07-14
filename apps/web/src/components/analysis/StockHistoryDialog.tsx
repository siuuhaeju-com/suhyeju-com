'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { apiGet } from '@/lib/api';
import { formatPct, getPctArrow, getPctToneClass } from '@/lib/format';
import { queryPolicies } from '@/lib/query-policies';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { StockPricePoint, TopStock } from '@/lib/types';

/**
 * 종목 주가 추이 차트 모달 (F-16) — Top5 툴팁에서 종목 클릭 시 열린다.
 * 뉴스 발행일(없으면 분석일)을 고정 기준선(blue-bright 점선)으로 표시해 "발행 이후 실제로
 * 어떻게 움직였나"를 보여주고, 증권사 차트처럼 hover 크로스헤어(회색 실선)로
 * 날짜별 시/고/저/종을 확인할 수 있다. 조회 구간은 기준일 한 달 전 ~ 오늘.
 */

const VIEW_W = 640;
const VIEW_H = 240;
const PAD_TOP = 16;
const PAD_BOTTOM = 22; // x축 날짜 라벨 공간
const PAD_RIGHT = 84; // y축 가격 라벨 공간(단위 포함 7자리 원화까지 안 잘리게)

/** ISO('2026-07-05T…')·점 표기('2026.07.05 14:23') 모두 Date로. 실패 시 null */
function parseDate(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function toParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' → 'YY.MM.DD' (축 라벨용) */
function toAxisLabel(date: string): string {
  return date.slice(2).replaceAll('-', '.');
}

/** 가격 표기(단위 포함) — 한국은 정수 원, 미국은 소수 2자리 달러 */
function formatPrice(value: number, market: TopStock['market']): string {
  return market === 'US'
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${value.toLocaleString('ko-KR')}원`;
}

export function StockHistoryDialog({
  stock,
  publishedAt,
  analyzedAt,
  onClose,
}: {
  stock: TopStock;
  /** 뉴스 발행일 — 기준선 위치·조회 구간 산정에 쓴다. 빈값이면 분석일 폴백 */
  publishedAt: string;
  analyzedAt: string;
  onClose: () => void;
}) {
  // 기준일: 뉴스 발행일 → 없으면 분석일 폴백(기준선 라벨로 구분)
  const { anchorDate, isPublishedAnchor, rangeStart } = useMemo(() => {
    const publishedDate = parseDate(publishedAt);
    const anchor = publishedDate ?? parseDate(analyzedAt) ?? new Date();
    const start = new Date(anchor);
    start.setMonth(start.getMonth() - 1);
    return { anchorDate: anchor, isPublishedAnchor: publishedDate != null, rangeStart: start };
  }, [publishedAt, analyzedAt]);
  const today = new Date();
  const anchorLabel = isPublishedAnchor ? '발행일' : '분석일';

  const market = stock.market ?? 'KR';
  const rangeStartParam = toParam(rangeStart);
  const todayParam = toParam(today);
  const { data: points, isPending } = useQuery({
    queryKey: queryKeys.stockHistory(stock.code, market, rangeStartParam, todayParam),
    queryFn: ({ signal }) =>
      apiGet<StockPricePoint[]>(
        `/api/stocks/${stock.code}/history?market=${market}&start=${rangeStartParam}&end=${todayParam}`,
        { signal },
      ),
    ...queryPolicies.stockHistory,
    enabled: !!stock.code,
  });

  // hover 크로스헤어 — 마우스가 가리키는 일봉 인덱스 (터치 드래그 포함)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // ESC로 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const chart = useMemo(() => {
    if (!points || points.length < 2) return null;

    // 기준선 = 기준일 당일(휴장이면 그다음 거래일)의 일봉 위치
    const pad = (n: number) => String(n).padStart(2, '0');
    const anchorKey = `${anchorDate.getFullYear()}-${pad(anchorDate.getMonth() + 1)}-${pad(anchorDate.getDate())}`;
    let anchorIndex = points.findIndex((p) => p.date >= anchorKey);
    if (anchorIndex < 0) anchorIndex = points.length - 1;

    const closes = points.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || max || 1;
    const innerW = VIEW_W - PAD_RIGHT;
    const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
    const x = (i: number) => (i / (points.length - 1)) * innerW;
    const y = (close: number) => PAD_TOP + (1 - (close - min) / span) * innerH;

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.close).toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${innerW} ${VIEW_H - PAD_BOTTOM} L 0 ${VIEW_H - PAD_BOTTOM} Z`;

    const first = points[0];
    const last = points[points.length - 1];
    const anchor = points[anchorIndex];

    // 발행일 종가를 기준으로, 발행일 이후 실제로 최대 몇 % 오르고 내렸는지(고가/저가 기준).
    // "기간 대비"(구간 첫날 대비)는 기준점이 자의적이라 폐기 — 2026-07-10 피드백.
    const afterAnchor = points.slice(anchorIndex);
    const maxRisePct =
      ((Math.max(...afterAnchor.map((p) => p.high)) - anchor.close) / anchor.close) * 100;
    const maxFallPct =
      ((Math.min(...afterAnchor.map((p) => p.low)) - anchor.close) / anchor.close) * 100;
    // 라인 색 기준 — 발행일 종가 대비 현재(마지막 종가) 방향
    const changeSincePct = ((last.close - anchor.close) / anchor.close) * 100;

    const yTicks = [max, (max + min) / 2, min];
    return {
      first,
      last,
      anchorIndex,
      anchor,
      maxRisePct,
      maxFallPct,
      changeSincePct,
      line,
      area,
      x,
      y,
      yTicks,
      innerW,
      innerH,
    };
  }, [points, anchorDate]);

  const tone = chart == null || chart.changeSincePct >= 0 ? 'positive' : 'negative';
  const hovered = hoverIndex != null && points ? points[hoverIndex] : null;

  /** svg 위 포인터 위치 → 가장 가까운 일봉 인덱스 */
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!chart || !points) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = Math.min(Math.max(viewX / chart.innerW, 0), 1);
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 클릭으로 닫기 */}
      <button
        type="button"
        aria-label="주가 추이 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${stock.name} 주가 추이`}
        className="relative w-full max-w-[600px] rounded-lg border bg-popover p-5 shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold">{stock.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              일봉 차트 · 파란 점선 = 뉴스 {anchorLabel} 기준선 · 차트에 마우스를 올리면 날짜별
              시·고·저·종가가 보입니다
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="주가 추이 닫기"
            className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {isPending ? (
          <div className="mt-4 flex h-[240px] items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
            시세 불러오는 중…
          </div>
        ) : !chart ? (
          <div className="mt-4 flex h-[240px] items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
            표시할 시세 데이터가 없습니다
          </div>
        ) : (
          <>
            {/* 핵심 수치 — 최근 종가 + 발행일 종가 대비 이후 최고/최저 등락(색+부호+화살표 병기).
                "발행일 이후 최고 … 최저 …"는 한 구절로 읽히게 좁은 간격으로 묶는다 */}
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-xl font-extrabold tabular-nums">
                {formatPrice(chart.last.close, market)}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13px]">
                <span className="font-semibold text-muted-foreground">{anchorLabel} 이후</span>
                <span
                  className={cn('font-extrabold tabular-nums', getPctToneClass(chart.maxRisePct))}
                >
                  <span className="font-semibold text-muted-foreground">최고 </span>
                  {getPctArrow(chart.maxRisePct)} {formatPct(chart.maxRisePct)}
                </span>
                <span
                  className={cn('font-extrabold tabular-nums', getPctToneClass(chart.maxFallPct))}
                >
                  <span className="font-semibold text-muted-foreground">최저 </span>
                  {getPctArrow(chart.maxFallPct)} {formatPct(chart.maxFallPct)}
                </span>
              </span>
            </p>

            <div className="relative mt-3">
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="w-full touch-none"
                role="img"
                aria-label={`${stock.name} 종가 추이 — ${toAxisLabel(chart.first.date)}부터 ${toAxisLabel(chart.last.date)}까지, 최근 ${formatPrice(chart.last.close, market)}, ${anchorLabel}(${toAxisLabel(chart.anchor.date)}) 종가 대비 이후 최고 ${formatPct(chart.maxRisePct)} 최저 ${formatPct(chart.maxFallPct)}`}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHoverIndex(null)}
              >
                {/* y축 눈금·가격 라벨 (우측, 단위 포함) */}
                {chart.yTicks.map((tick, tickIndex) => (
                  <g key={tickIndex}>
                    <line
                      x1={0}
                      x2={chart.innerW}
                      y1={chart.y(tick)}
                      y2={chart.y(tick)}
                      stroke="var(--border)"
                      strokeWidth={1}
                    />
                    <text
                      x={chart.innerW + 8}
                      y={chart.y(tick) + 4}
                      fill="var(--muted-foreground)"
                      fontSize={11}
                    >
                      {formatPrice(tick, market)}
                    </text>
                  </g>
                ))}

                {/* 종가 라인 + 은은한 면 채움 — 색은 기간 등락 방향(긍정=레드/부정=블루) */}
                <path
                  d={chart.area}
                  fill={`color-mix(in oklab, var(--${tone}) 14%, transparent)`}
                />
                <path d={chart.line} fill="none" stroke={`var(--${tone})`} strokeWidth={2} />

                {/* 뉴스 발행일 고정 기준선 — 점선 + 종가 점 + 상단 라벨 (hover 크로스헤어와 구분) */}
                <g aria-hidden>
                  <line
                    x1={chart.x(chart.anchorIndex)}
                    x2={chart.x(chart.anchorIndex)}
                    y1={PAD_TOP - 4}
                    y2={VIEW_H - PAD_BOTTOM}
                    stroke="var(--blue-bright)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={chart.x(chart.anchorIndex)}
                    cy={chart.y(chart.anchor.close)}
                    r={4.5}
                    fill="var(--blue-bright)"
                    stroke="var(--popover)"
                    strokeWidth={2.5}
                  />
                  <text
                    x={Math.min(Math.max(chart.x(chart.anchorIndex), 24), chart.innerW - 24)}
                    y={9}
                    fill="var(--blue-bright)"
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {anchorLabel}
                  </text>
                </g>

                {/* hover 크로스헤어 — 회색 실선 + 종가 점 */}
                {hovered && hoverIndex != null && (
                  <g aria-hidden>
                    <line
                      x1={chart.x(hoverIndex)}
                      x2={chart.x(hoverIndex)}
                      y1={PAD_TOP - 6}
                      y2={VIEW_H - PAD_BOTTOM}
                      stroke="var(--muted-foreground)"
                      strokeWidth={1}
                    />
                    <circle
                      cx={chart.x(hoverIndex)}
                      cy={chart.y(hovered.close)}
                      r={4.5}
                      fill="var(--foreground)"
                      stroke="var(--popover)"
                      strokeWidth={2.5}
                    />
                  </g>
                )}

                {/* x축 라벨 — 시작·기준일·끝. 기준일이 양끝에 붙으면 겹치는 쪽 라벨은 숨긴다 */}
                {(() => {
                  const anchorLabelX = Math.min(
                    Math.max(chart.x(chart.anchorIndex), 40),
                    chart.innerW - 40,
                  );
                  return (
                    <>
                      {anchorLabelX > 92 && (
                        <text x={0} y={VIEW_H - 6} fill="var(--muted-foreground)" fontSize={11}>
                          {toAxisLabel(chart.first.date)}
                        </text>
                      )}
                      <text
                        x={anchorLabelX}
                        y={VIEW_H - 6}
                        fill="var(--blue-bright)"
                        fontSize={11}
                        fontWeight={700}
                        textAnchor="middle"
                      >
                        {toAxisLabel(chart.anchor.date)}
                      </text>
                      {anchorLabelX < chart.innerW - 92 && (
                        <text
                          x={chart.innerW}
                          y={VIEW_H - 6}
                          fill="var(--muted-foreground)"
                          fontSize={11}
                          textAnchor="end"
                        >
                          {toAxisLabel(chart.last.date)}
                        </text>
                      )}
                    </>
                  );
                })()}
              </svg>

              {/* hover 상세 — 날짜 + 시/고/저/종 (크로스헤어를 따라다니고, 화면 밖으로 안 나가게 반대편으로 뒤집는다) */}
              {hovered && hoverIndex != null && (
                <div
                  role="status"
                  aria-label={`${hovered.date} 시가 ${formatPrice(hovered.open, market)}, 고가 ${formatPrice(hovered.high, market)}, 저가 ${formatPrice(hovered.low, market)}, 종가 ${formatPrice(hovered.close, market)}`}
                  className="pointer-events-none absolute top-1 rounded-md border bg-popover/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                  style={{
                    left: `${(chart.x(hoverIndex) / VIEW_W) * 100}%`,
                    transform:
                      chart.x(hoverIndex) / chart.innerW > 0.55
                        ? 'translateX(calc(-100% - 10px))'
                        : 'translateX(10px)',
                  }}
                >
                  <p className="text-[11px] font-bold tabular-nums">
                    {hovered.date.replaceAll('-', '.')}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-[11px] leading-snug">
                    {(
                      [
                        ['시가', hovered.open],
                        ['고가', hovered.high],
                        ['저가', hovered.low],
                        ['종가', hovered.close],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right font-semibold tabular-nums">
                          {formatPrice(value, market)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </>
        )}

        {/* 정확한 시세·호가는 네이버증권에서 — 코드 매칭된 종목만 이 모달이 열리므로 url은 대부분 존재 */}
        {stock.url && (
          <p className="mt-3 border-t border-border pt-3 text-right">
            <a
              href={stock.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-bright transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              네이버증권에서 보기 <span aria-hidden>↗</span>
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
