import { searchEdgeSources } from '@/lib/sources/naver-news';
import type { AnalysisDraft } from '@/lib/sources/gpt';
import type { EdgeSource, SignalNewsItem } from '@/lib/types';

type SignalNewsDraftItem = AnalysisDraft['goodSignal']['news'][number];

export async function joinEdgeSources(draft: AnalysisDraft): Promise<EdgeSource[][]> {
  return Promise.all(draft.spreadEdges.map((edge) => searchEdgeSources(edge.searchQuery)));
}

export async function resolveSignalNews(
  items: SignalNewsDraftItem[],
): Promise<SignalNewsItem[]> {
  return Promise.all(
    items.map(async ({ text, source, searchQuery }) => {
      const [top] = await searchEdgeSources(searchQuery, 1);
      return top ? { text, source, url: top.url } : { text, source };
    }),
  );
}
