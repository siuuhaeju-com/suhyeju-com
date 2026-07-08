import { formatPct, getPctToneClass } from '@/lib/format';
import type { TopStock } from '@/lib/types';

/**
 * 섹터 Top5 종목 현황 툴팁 (F-10)
 * 확산 그래프 노드·히트맵 셀 hover 시 공용으로 사용한다.
 */
export function StockTooltip({ sector, stocks }: { sector: string; stocks: TopStock[] }) {
  return (
    <div
      role="tooltip"
      className="w-[260px] rounded-md border bg-popover p-3.5 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-tight">{sector}</span>
        <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground">
          TOP 5 종목
        </span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {stocks.map((stock, index) => (
          <li key={stock.name} className="flex items-center gap-2.5">
            <span className="w-3.5 flex-none text-[11px] font-extrabold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-sub">
              {stock.name}
            </span>
            <span
              className={`flex-none text-[12.5px] font-extrabold tabular-nums ${getPctToneClass(stock.changePct)}`}
            >
              {formatPct(stock.changePct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
