export const QUERY_STALE_TIME = {
  short: 10_000,
  default: 60_000,
  marketSnapshot: 60_000,
  stockHistory: 60 * 60_000,
} as const;

export const QUERY_REFETCH_INTERVAL = {
  marketSnapshot: 60_000,
} as const;

export const queryDefaults = {
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: QUERY_STALE_TIME.default,
} as const;

export const queryPolicies = {
  popularNews: {
    staleTime: QUERY_STALE_TIME.default,
  },
  krMajorSectors: {
    staleTime: QUERY_STALE_TIME.marketSnapshot,
    refetchInterval: QUERY_REFETCH_INTERVAL.marketSnapshot,
  },
  recentAnalyses: {
    staleTime: QUERY_STALE_TIME.short,
  },
  stockHistory: {
    staleTime: QUERY_STALE_TIME.stockHistory,
    retry: false,
  },
} as const;
