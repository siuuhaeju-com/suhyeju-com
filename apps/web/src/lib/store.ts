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
 * ⚠️ dev(Turbopack)에서는 Route Handler와 Server Component가 이 모듈을 서로 다른
 *    번들 컨텍스트로 컴파일해 모듈 스코프 변수가 인스턴스별로 갈라질 수 있다(POST로
 *    저장한 결과를 페이지에서 못 찾는 404 현상) — globalThis에 고정해 항상 같은
 *    인스턴스를 공유하게 한다.
 */
import { createHash } from 'crypto';

import type { AnalysisResult, RecentAnalysis } from '@/lib/types';

const RECENT_KEY = 'analyses:recent';
const RECENT_MAX = 50;
const keyOf = (id: string) => `analysis:${id}`;
const originKeyOf = (originUrl: string) =>
  `analysis:origin:${createHash('sha256').update(originUrl).digest('hex').slice(0, 32)}`;

function normalizeOriginUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const normalized = new URL(trimmed);
    normalized.hash = '';
    return normalized.toString();
  } catch {
    return trimmed;
  }
}

// KV 사용 여부 — 키가 모두 있으면 영속화, 아니면 인메모리 폴백.
const useKv = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// ── 인메모리 폴백(개발·로컬 데모) — globalThis에 고정(위 dev 번들 분리 이슈 회피) ──
const globalForStore = globalThis as unknown as {
  __analysisMemStore?: Map<string, AnalysisResult>;
  __analysisRecentIds?: string[];
  __analysisOriginIndex?: Map<string, string>;
};
const memStore = globalForStore.__analysisMemStore ?? new Map<string, AnalysisResult>();
globalForStore.__analysisMemStore = memStore;
const memRecentIds = globalForStore.__analysisRecentIds ?? [];
globalForStore.__analysisRecentIds = memRecentIds;
const memOriginIndex = globalForStore.__analysisOriginIndex ?? new Map<string, string>();
globalForStore.__analysisOriginIndex = memOriginIndex;

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
  const originUrl = normalizeOriginUrl(result.originUrl);

  if (useKv) {
    const kv = await getRedis();
    await kv.set(keyOf(result.id), result);

    // 최근 내역은 같은 기사 URL이 여러 번 쌓이지 않게 기존 항목을 먼저 제거한다.
    const ids = await kv.lrange(RECENT_KEY, 0, RECENT_MAX - 1);
    if (ids.length > 0) {
      const results = await kv.mget<AnalysisResult[]>(...ids.map(keyOf));
      const duplicateIds = results
        .filter(
          (item): item is AnalysisResult =>
            item !== null &&
            item !== undefined &&
            item.id !== result.id &&
            originUrl !== null &&
            normalizeOriginUrl(item.originUrl) === originUrl,
        )
        .map((item) => item.id);

      await Promise.all([
        kv.lrem(RECENT_KEY, 0, result.id),
        ...duplicateIds.map((id) => kv.lrem(RECENT_KEY, 0, id)),
      ]);
    }

    if (originUrl) {
      await kv.set(originKeyOf(originUrl), result.id);
    }
    await kv.lpush(RECENT_KEY, result.id);
    await kv.ltrim(RECENT_KEY, 0, RECENT_MAX - 1);
    return;
  }

  for (let i = memRecentIds.length - 1; i >= 0; i -= 1) {
    const existing = memStore.get(memRecentIds[i]);
    const isSameId = memRecentIds[i] === result.id;
    const isSameOrigin =
      originUrl !== null &&
      existing !== undefined &&
      normalizeOriginUrl(existing.originUrl) === originUrl;

    if (isSameId || isSameOrigin) {
      memRecentIds.splice(i, 1);
    }
  }

  memStore.set(result.id, result);
  if (originUrl) {
    memOriginIndex.set(originUrl, result.id);
  }
  memRecentIds.unshift(result.id);
  memRecentIds.splice(RECENT_MAX);
}

export async function getAnalysis(id: string): Promise<AnalysisResult | undefined> {
  if (useKv) {
    const kv = await getRedis();
    return (await kv.get<AnalysisResult>(keyOf(id))) ?? undefined;
  }
  return memStore.get(id);
}

export async function getAnalysisByOriginUrl(url: string): Promise<AnalysisResult | undefined> {
  const originUrl = normalizeOriginUrl(url);
  if (!originUrl) return undefined;

  if (useKv) {
    const kv = await getRedis();
    const indexedId = await kv.get<string>(originKeyOf(originUrl));
    if (indexedId) {
      const indexedResult = await getAnalysis(indexedId);
      if (indexedResult && normalizeOriginUrl(indexedResult.originUrl) === originUrl) {
        return indexedResult;
      }
    }

    // 이전 버전에서 저장된 결과는 origin index가 없을 수 있으므로 최근 목록을 한 번 훑는다.
    const ids = await kv.lrange(RECENT_KEY, 0, RECENT_MAX - 1);
    if (ids.length === 0) return undefined;

    const results = await kv.mget<AnalysisResult[]>(...ids.map(keyOf));
    const match = results.find(
      (item): item is AnalysisResult =>
        item !== null && item !== undefined && normalizeOriginUrl(item.originUrl) === originUrl,
    );
    if (match) {
      await kv.set(originKeyOf(originUrl), match.id);
    }
    return match;
  }

  const indexedId = memOriginIndex.get(originUrl);
  if (indexedId) {
    const indexedResult = memStore.get(indexedId);
    if (indexedResult && normalizeOriginUrl(indexedResult.originUrl) === originUrl) {
      return indexedResult;
    }
  }

  const match = memRecentIds
    .map((id) => memStore.get(id))
    .find(
      (item): item is AnalysisResult =>
        item !== null && item !== undefined && normalizeOriginUrl(item.originUrl) === originUrl,
    );
  if (match) {
    memOriginIndex.set(originUrl, match.id);
  }
  return match;
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
      .map((r) => ({
        id: r.id,
        title: r.title,
        analyzedAt: r.analyzedAt,
        originUrl: r.originUrl,
      }));
  }
  return memRecentIds
    .map((id) => memStore.get(id))
    .filter((r): r is AnalysisResult => Boolean(r))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      title: r.title,
      analyzedAt: r.analyzedAt,
      originUrl: r.originUrl,
    }));
}
