import { randomUUID } from 'crypto';

import type { AnalysisDraft } from '@/lib/sources/gpt';
import { stockPageUrl, type StockQuote } from '@/lib/sources/naver-stock';
import type { AnalysisResult, EdgeSource, SignalNewsItem, SpreadNode, TopStock } from '@/lib/types';

const ENGINE_VERSION = '수혜주.com AI v2.1';

export interface AnalysisMeta {
  title: string;
  originUrl: string;
  source: string;
  publishedAt: string;
}

export interface SignalNewsJoin {
  goodNews: SignalNewsItem[];
  warnNews: SignalNewsItem[];
}

export function assembleAnalysisResult(
  draft: AnalysisDraft,
  quotes: Map<string, StockQuote | null>,
  edgeSources: EdgeSource[][],
  signalNews: SignalNewsJoin,
  meta: AnalysisMeta,
): AnalysisResult {
  return {
    id: randomUUID().slice(0, 8),
    sector: draft.sector,
    verdict: draft.verdict,
    title: meta.title || draft.summary.slice(0, 40),
    source: meta.source,
    publishedAt: meta.publishedAt,
    desk: '',
    analyzedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    summary: draft.summary,
    originUrl: meta.originUrl,
    keywords: draft.keywords,
    relatedSectors: draft.relatedSectors,
    reviewedCount: draft.reviewedCount,
    goodSignal: { ...draft.goodSignal, news: signalNews.goodNews },
    warnSignal: { ...draft.warnSignal, news: signalNews.warnNews },
    spreadNodes: deriveSpreadRows(draft.spreadNodes),
    spreadEdges: draft.spreadEdges.map(({ from, to, reason }, index) => ({
      from,
      to,
      reason,
      sources: edgeSources[index] ?? [],
    })),
    sectionNotes: { spread: draft.spreadNote, knowledge: draft.knowledgeNote },
    knowledgeNodes: draft.knowledgeNodes.map((node) => ({ ...node, x: 0, y: 0 })),
    knowledgeEdges: draft.knowledgeEdges,
    topStocks: buildTopStocksBySector(draft, quotes),
  };
}

export function deriveSpreadRows(nodes: Omit<SpreadNode, 'row'>[]): SpreadNode[] {
  const byTier = new Map<number, Omit<SpreadNode, 'row'>[]>();

  for (const node of nodes) {
    const list = byTier.get(node.tier) ?? [];
    list.push(node);
    byTier.set(node.tier, list);
  }

  const result: SpreadNode[] = [];
  for (const group of byTier.values()) {
    group.forEach((node, index) => {
      const row = group.length === 1 ? 0.5 : index / (group.length - 1);
      result.push({ ...node, row });
    });
  }

  return result;
}

function buildTopStocksBySector(
  draft: AnalysisDraft,
  quotes: Map<string, StockQuote | null>,
): Record<string, TopStock[]> {
  const topStocks: Record<string, TopStock[]> = {};

  for (const group of draft.topStocks) {
    topStocks[group.sector] = group.stocks.map((stock) => {
      const quote = quotes.get(stock.name);
      return quote
        ? {
            ...stock,
            name: quote.name || stock.name,
            code: quote.code,
            market: quote.market,
            url: stockPageUrl(quote.code, quote.market),
          }
        : { ...stock };
    });
  }

  return topStocks;
}
