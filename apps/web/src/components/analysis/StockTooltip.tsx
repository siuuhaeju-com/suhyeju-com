import { ChartLine, X } from 'lucide-react';

import type { TopStock } from '@/lib/types';

/**
 * 섹터 Top5 종목 현황 툴팁 (F-10) — 확산 그래프 노드에서 사용.
 * 부모가 hover/grace 상태와 pointer-events를 제어한다.
 * 전일대비 등락률은 표시하지 않는다(F-16) — 대신 종목 클릭 시 주가 추이 차트
 * (StockHistoryDialog)를 연다. 시세 매칭 실패(code 없음) 종목은 이름만 보여준다.
 */
export function StockTooltip({
  sector,
  stocks,
  onSelectStock,
  onClose,
}: {
  sector: string;
  stocks: TopStock[];
  /** 종목 클릭 → 주가 추이 차트 열기 (code 있는 종목만 클릭 가능) */
  onSelectStock?: (stock: TopStock) => void;
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
            {stock.code && onSelectStock ? (
              <button
                type="button"
                onClick={() => onSelectStock(stock)}
                aria-label={`${stock.name} — 주가 추이 차트 보기`}
                className="group flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="truncate text-[12.5px] font-semibold text-ink-sub transition-colors group-hover:text-foreground group-hover:underline">
                  {stock.name}
                </span>
                {/* 차트 열림 표식 — 색만으로 구분하지 않게 아이콘 병기 */}
                <ChartLine aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              // 시세 매칭 실패 종목은 차트를 열 수 없다 — 이름만 (오조인 방지)
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-sub">
                {stock.name}
              </span>
            )}
          </li>
        ))}
      </ul>
      {onSelectStock && (
        <p className="mt-2.5 border-t border-border pt-2 text-[10.5px] text-muted-foreground">
          종목을 클릭하면 주가 추이 차트가 열립니다
        </p>
      )}
    </div>
  );
}
