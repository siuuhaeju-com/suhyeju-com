import type { TopStock } from '@/lib/types';

export const queryKeys = {
  news: {
    popular: ['news', 'popular'] as const,
  },
  market: {
    krMajorSectors: ['market', 'kr', 'major-sectors'] as const,
  },
  analysis: {
    recent: ['analysis', 'recent'] as const,
  },
  stockHistory: (
    code: string | undefined,
    market: NonNullable<TopStock['market']>,
    start: string,
    end: string,
  ) => ['stock-history', code ?? '', market, start, end] as const,
};
