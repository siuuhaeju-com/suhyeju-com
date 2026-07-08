/**
 * 분석 결과 저장소 (analyze 파이프라인 ④단계).
 *
 * MVP는 인메모리(Map)로 둔다. 서버리스라 인스턴스별로 휘발되지만
 * 데모/개발에는 충분하다. 운영 전환 시 Vercel KV(Upstash)로 교체한다.
 */
import type { AnalysisResult, RecentAnalysis } from '@/lib/types';

const store = new Map<string, AnalysisResult>();

export function saveAnalysis(result: AnalysisResult): void {
  store.set(result.id, result);
}

export function getAnalysis(id: string): AnalysisResult | undefined {
  return store.get(id);
}

/** 최근 분석 내역 (최신순) */
export function recentAnalyses(limit = 10): RecentAnalysis[] {
  return [...store.values()]
    .slice(-limit)
    .reverse()
    .map((r) => ({ id: r.id, title: r.title, analyzedAt: r.analyzedAt }));
}
