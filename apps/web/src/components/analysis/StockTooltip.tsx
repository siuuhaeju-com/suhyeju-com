import { X } from 'lucide-react';

import { formatPct, getPctToneClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TopStock } from '@/lib/types';

/**
 * 섹터 Top5 종목 현황 툴팁 (F-10)
 * 확산 그래프 노드·히트맵 셀에서 공용 — hover 미리보기 + 클릭 고정(pin).
 * 종목에 url(네이버페이 증권)이 있으면 새 탭 링크로 렌더한다. 링크 클릭은
 * 고정 상태(onClose 제공 = 부모가 pointer-events를 살린 상태)에서만 가능하다.
 */
export function StockTooltip({
  sector,
  stocks,
  onClose,
}: {
  sector: string;
  stocks: TopStock[];
  /** 고정(pin) 모드일 때만 전달 — 닫기 버튼이 생기고 role이 dialog가 된다 */
  onClose?: () => void;
}) {
  const isPinned = onClose != null;
  return (
    <div
      role={isPinned ? 'dialog' : 'tooltip'}
      aria-label={`${sector} Top5 종목`}
      className="w-[260px] rounded-md border bg-popover p-3.5 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-tight">{sector}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground">
            TOP 5 종목
          </span>
          {isPinned && (
            <button
              type="button"
              onClick={onClose}
              aria-label="종목 툴팁 닫기"
              className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {stocks.map((stock, index) => (
          <li key={stock.name} className="flex items-center gap-2.5">
            <span className="w-3.5 flex-none text-[11px] font-extrabold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            {stock.url ? (
              <a
                href={stock.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-sub transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {stock.name} {/* 외부 링크 표식 — 종목명과 구분되게 무채색 유지 */}
                <span aria-hidden className="text-muted-foreground">
                  ↗
                </span>
              </a>
            ) : (
              // 시세 매칭 실패 종목은 링크 없이 이름만 (오조인 방지)
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-sub">
                {stock.name}
              </span>
            )}
            <span
              className={cn(
                'flex-none text-[12.5px] font-extrabold tabular-nums',
                getPctToneClass(stock.changePct),
              )}
            >
              {formatPct(stock.changePct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
