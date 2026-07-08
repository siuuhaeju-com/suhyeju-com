/**
 * 분석 결과 저장소 (analyze 파이프라인 ④단계).
 *
 * 저장 위치는 환경변수로 자동 전환한다(GPT mock 폴백과 동일한 패턴):
 *   - UPSTASH_REDIS_REST_URL(+TOKEN) 있음 → Upstash Redis(KV)에 영속 저장.
 *       배포(서버리스)에서도 인스턴스 간 공유되고, 재배포·재시작에도 안 날아감.
 *   - 없음 → 인메모리 Map 폴백. 개발·로컬 데모에는 충분하지만 프로세스별 휘발.
 *
 * ⚠️ 서버리스(Vercel 등)는 인스턴스마다 메모리가 달라서, 인메모리로 배포하면
 *    analyze한 인스턴스와 조회하는 인스턴스가 달라 404가 날 수 있다 → 배포 시 KV 필수.
 */
import type { AnalysisResult, RecentAnalysis } from '@/lib/types';

const RECENT_KEY = 'analyses:recent';
const RECENT_MAX = 50;
const keyOf = (id: string) => `analysis:${id}`;

// KV 사용 여부 — 키가 모두 있으면 영속화, 아니면 인메모리 폴백.
const useKv = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// ── 인메모리 폴백(개발·로컬 데모) ──
const memStore = new Map<string, AnalysisResult>();

// ── KV 클라이언트(지연 초기화 — 키 없으면 아예 만들지 않는다) ──
let redis: import('@upstash/redis').Redis | null = null;
async function getRedis() {
  if (!redis) {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  if (useKv) {
    const kv = await getRedis();
    await kv.set(keyOf(result.id), result);
    // 최근 내역: 최신이 앞(lpush) + 상한 유지(ltrim).
    await kv.lpush(RECENT_KEY, result.id);
    await kv.ltrim(RECENT_KEY, 0, RECENT_MAX - 1);
    return;
  }
  memStore.set(result.id, result);
}

export async function getAnalysis(id: string): Promise<AnalysisResult | undefined> {
  if (useKv) {
    const kv = await getRedis();
    return (await kv.get<AnalysisResult>(keyOf(id))) ?? undefined;
  }
  return memStore.get(id);
}

/** 최근 분석 내역 (최신순) */
export async function recentAnalyses(limit = 10): Promise<RecentAnalysis[]> {
  if (useKv) {
    const kv = await getRedis();
    const ids = await kv.lrange(RECENT_KEY, 0, limit - 1);
    if (ids.length === 0) return [];
    const results = await kv.mget<AnalysisResult[]>(...ids.map(keyOf));
    return results
      .filter((r): r is AnalysisResult => Boolean(r))
      .map((r) => ({ id: r.id, title: r.title, analyzedAt: r.analyzedAt }));
  }
  return [...memStore.values()]
    .slice(-limit)
    .reverse()
    .map((r) => ({ id: r.id, title: r.title, analyzedAt: r.analyzedAt }));
}
