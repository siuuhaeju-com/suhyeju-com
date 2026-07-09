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

import type { AnalysisResult, HeatmapCell, RecentAnalysis } from '@/lib/types';

const RECENT_KEY = 'analyses:recent';
const RECENT_MAX = 50;
const keyOf = (id: string) => `analysis:${id}`;
const originKeyOf = (originUrl: string) =>
  `analysis:origin:${createHash('sha256').update(originUrl).digest('hex').slice(0, 32)}`;

type LegacyHeatmapCell = {
  sector: string;
  changePct?: number;
  weight?: number;
};

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

function isHeatmapCell(cell: unknown): cell is HeatmapCell {
  if (!cell || typeof cell !== 'object') return false;
  const candidate = cell as Partial<HeatmapCell>;
  return (
    typeof candidate.sector === 'string' &&
    typeof candidate.share === 'number' &&
    Number.isFinite(candidate.share) &&
    (candidate.direction === 'positive' || candidate.direction === 'negative')
  );
}

function allocatePercentShares(values: number[]): number[] {
  if (values.length === 0) return [];

  const total = values.reduce((sum, value) => sum + Math.abs(value), 0);
  const rawShares = values.map((value) =>
    total > 0 ? (Math.abs(value) / total) * 100 : 100 / values.length,
  );
  const floors = rawShares.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = rawShares
    .map((raw, index) => ({ index, frac: raw - Math.floor(raw) }))
    .sort((a, b) => b.frac - a.frac);
  const shares = [...floors];

  for (const { index } of order) {
    if (remainder <= 0) break;
    shares[index] += 1;
    remainder -= 1;
  }

  return shares;
}

function normalizeHeatmap(cells: unknown[]): HeatmapCell[] {
  if (cells.every(isHeatmapCell)) {
    return cells;
  }

  const legacyCells = cells
    .filter((cell): cell is LegacyHeatmapCell => {
      if (!cell || typeof cell !== 'object') return false;
      return typeof (cell as LegacyHeatmapCell).sector === 'string';
    })
    .map((cell) => ({
      sector: cell.sector,
      changePct: Number.isFinite(cell.changePct) ? Number(cell.changePct) : undefined,
      weight: Number.isFinite(cell.weight) ? Number(cell.weight) : undefined,
    }));

  const values = legacyCells.map((cell) => cell.changePct ?? cell.weight ?? 1);
  const shares = allocatePercentShares(values);

  return legacyCells.map((cell, index) => ({
    sector: cell.sector,
    share: shares[index] ?? 0,
    direction: (cell.changePct ?? 1) >= 0 ? 'positive' : 'negative',
  }));
}

function normalizeStoredAnalysis(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    heatmap: normalizeHeatmap(result.heatmap),
  };
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
  const normalizedResult = normalizeStoredAnalysis(result);
  const originUrl = normalizeOriginUrl(normalizedResult.originUrl);

  if (useKv) {
    const kv = await getRedis();
    await kv.set(keyOf(normalizedResult.id), normalizedResult);

    // 최근 내역은 같은 기사 URL이 여러 번 쌓이지 않게 기존 항목을 먼저 제거한다.
    const ids = await kv.lrange(RECENT_KEY, 0, RECENT_MAX - 1);
    if (ids.length > 0) {
      const results = await kv.mget<AnalysisResult[]>(...ids.map(keyOf));
      const duplicateIds = results
        .filter(
          (item): item is AnalysisResult =>
            item !== null &&
            item !== undefined &&
            item.id !== normalizedResult.id &&
            originUrl !== null &&
            normalizeOriginUrl(item.originUrl) === originUrl,
        )
        .map((item) => item.id);

      await Promise.all([
        kv.lrem(RECENT_KEY, 0, normalizedResult.id),
        ...duplicateIds.map((id) => kv.lrem(RECENT_KEY, 0, id)),
      ]);
    }

    if (originUrl) {
      await kv.set(originKeyOf(originUrl), normalizedResult.id);
    }
    await kv.lpush(RECENT_KEY, normalizedResult.id);
    await kv.ltrim(RECENT_KEY, 0, RECENT_MAX - 1);
    return;
  }

  for (let i = memRecentIds.length - 1; i >= 0; i -= 1) {
    const existing = memStore.get(memRecentIds[i]);
    const isSameId = memRecentIds[i] === normalizedResult.id;
    const isSameOrigin =
      originUrl !== null &&
      existing !== undefined &&
      normalizeOriginUrl(existing.originUrl) === originUrl;

    if (isSameId || isSameOrigin) {
      memRecentIds.splice(i, 1);
    }
  }

  memStore.set(normalizedResult.id, normalizedResult);
  if (originUrl) {
    memOriginIndex.set(originUrl, normalizedResult.id);
  }
  memRecentIds.unshift(normalizedResult.id);
  memRecentIds.splice(RECENT_MAX);
}

export async function getAnalysis(id: string): Promise<AnalysisResult | undefined> {
  if (useKv) {
    const kv = await getRedis();
    const result = (await kv.get<AnalysisResult>(keyOf(id))) ?? undefined;
    return result ? normalizeStoredAnalysis(result) : undefined;
  }
  const result = memStore.get(id);
  return result ? normalizeStoredAnalysis(result) : undefined;
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
        return normalizeStoredAnalysis(indexedResult);
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
    return match ? normalizeStoredAnalysis(match) : undefined;
  }

  const indexedId = memOriginIndex.get(originUrl);
  if (indexedId) {
    const indexedResult = memStore.get(indexedId);
    if (indexedResult && normalizeOriginUrl(indexedResult.originUrl) === originUrl) {
      return normalizeStoredAnalysis(indexedResult);
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
  return match ? normalizeStoredAnalysis(match) : undefined;
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
