import { fmtPct, pctToneClass } from '@/lib/format';
import type { TopStock } from '@/lib/types';

/**
 * 섹터 Top5 종목 현황 툴팁 (F-10)
 * 확산 그래프 노드·히트맵 셀 hover 시 공용으로 사용한다.
 */
export function StockTooltip({ sector, stocks }: { sector: string; stocks: TopStock[] }) {
  return (
    <div
      role="tooltip"
      className="w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
    >
      <p className="text-xs font-bold">{sector} · Top5 종목</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {stocks.map((stock) => (
          <li key={stock.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-ink-sub">{stock.name}</span>
            <span className={`font-bold ${pctToneClass(stock.changePct)}`}>
              {fmtPct(stock.changePct)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-border pt-1.5 text-[10.5px] text-muted-foreground">
        긍정=레드 · 부정=그린 (전일대비)
      </p>
    </div>
  );
}
