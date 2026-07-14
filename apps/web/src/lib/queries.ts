import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api';
import type { NewsItem, RecentAnalysis, SectorChange } from '@/lib/types';

const RECENT_ANALYSES_FETCH_LIMIT = 10;

/** 인기 뉴스 (F-03a · #15 · GET /api/news) — 10분 캐시(BE route 자체 revalidate)에 맞춰 폴링 없이 재검증만 */
export function usePopularNews() {
  return useQuery({
    queryKey: ['news', 'popular'],
    queryFn: ({ signal }) => apiGet<NewsItem[]>('/api/news', { signal }),
    staleTime: 60_000,
  });
}

/**
 * 주요 섹터 현황 (#16, 메인 화면에서 사용) — GICS 11개 대분류 등락률
 * (GET /api/market/kr/major-sectors). 헤더 "실시간" 문구가 진짜가 되도록 60초 폴링.
 */
export function useKrMajorSectors() {
  return useQuery({
    queryKey: ['market', 'kr', 'major-sectors'],
    queryFn: ({ signal }) => apiGet<SectorChange[]>('/api/market/kr/major-sectors', { signal }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** 최근 분석 내역 (F-03c · GET /api/analyses/recent) — 없으면 메인에서 아무 것도 렌더하지 않는다 */
export function useRecentAnalyses() {
  return useQuery({
    queryKey: ['analysis', 'recent'],
    queryFn: ({ signal }) =>
      apiGet<RecentAnalysis[]>(`/api/analyses/recent?limit=${RECENT_ANALYSES_FETCH_LIMIT}`, {
        signal,
      }),
    staleTime: 10_000,
  });
}
