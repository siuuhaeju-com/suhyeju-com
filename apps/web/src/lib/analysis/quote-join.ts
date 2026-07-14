import type { AnalysisDraft } from '@/lib/sources/gpt';
import { fetchStockQuotes, type StockQuote } from '@/lib/sources/naver-stock';

export interface QuoteJoinResult {
  draft: AnalysisDraft;
  quotes: Map<string, StockQuote | null>;
}

export async function joinDraftQuotes(draft: AnalysisDraft): Promise<QuoteJoinResult> {
  const names = draft.topStocks.flatMap((group) => group.stocks.map((stock) => stock.name));
  if (names.length === 0) {
    return { draft, quotes: new Map() };
  }

  let quotes: Map<string, StockQuote | null>;
  try {
    quotes = await fetchStockQuotes(names);
  } catch {
    return { draft, quotes: new Map() };
  }

  const sectorAvg = new Map<string, number>();
  const topStocks = draft.topStocks.map((group) => {
    const matched: number[] = [];
    const stocks = group.stocks.map((stock) => {
      const pct = quotes.get(stock.name)?.changePct;
      if (pct == null) {
        return { ...stock };
      }

      matched.push(pct);
      return { ...stock, changePct: pct };
    });

    if (matched.length > 0) {
      sectorAvg.set(group.sector, matched.reduce((sum, pct) => sum + pct, 0) / matched.length);
    }

    return { ...group, stocks };
  });

  const relatedSectors = draft.relatedSectors.map((related) => {
    const avg = sectorAvg.get(related.name);
    return avg == null ? { ...related } : { ...related, changePct: avg };
  });

  return {
    draft: {
      ...draft,
      relatedSectors,
      topStocks,
    },
    quotes,
  };
}
