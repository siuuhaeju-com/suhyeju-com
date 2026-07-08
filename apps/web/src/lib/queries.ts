import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api';
import type { SectorChange } from '@/lib/types';

/**
 * 주요 섹터 현황 (#16, 메인 화면에서 사용) — GICS 11개 대분류 등락률
 * (GET /api/market/kr/major-sectors). 헤더 "실시간" 문구가 진짜가 되도록 60초 폴링.
 */
export function useKrMajorSectors() {
  return useQuery({
    queryKey: ['market', 'kr', 'major-sectors'],
    queryFn: () => apiGet<SectorChange[]>('/api/market/kr/major-sectors'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
