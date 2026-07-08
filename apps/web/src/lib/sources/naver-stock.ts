/**
 * 네이버 금융 비공식 API — 종목명 → 코드 → 실시세(등락률).
 * analyze 시세 join(③단계)용. 종목마스터 캐시 없이 온디맨드 2콜(자동완성+basic).
 *
 * 개명·별칭 종목(예: 두산중공업→두산에너빌리티)은 매칭 실패할 수 있고,
 * 그 경우 null을 돌려 호출측이 GPT 초안값을 유지하게 한다(오조인 금지).
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

interface AcItem {
  code: string;
  name: string;
  typeCode: string; // KOSPI | KOSDAQ | ...
  category: string; // stock | ...
}

/** 종목명 정규화 — 공백 제거 후 비교 */
function normalize(name: string): string {
  return name.replace(/\s+/g, '');
}

/** 종목명 → 종목코드 (자동완성에서 정규화 exact match, 국내 주식만) */
async function resolveCode(name: string): Promise<string | null> {
  const url = `https://ac.stock.naver.com/ac?target=stock&q=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 3600 }, // 종목명↔코드는 잘 안 바뀜 → 1시간 캐시
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { items?: AcItem[] };
  const target = normalize(name);
  const hit = data.items?.find(
    (i) => normalize(i.name) === target && (i.typeCode === 'KOSPI' || i.typeCode === 'KOSDAQ'),
  );
  return hit?.code ?? null;
}

/** 종목코드 → 전일대비 등락률(%). 실패 시 null */
async function fetchChangePct(code: string): Promise<number | null> {
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 60 }, // 시세는 60초 캐시
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { fluctuationsRatio?: string };
  const pct = Number.parseFloat(data.fluctuationsRatio ?? '');
  return Number.isFinite(pct) ? pct : null;
}

/** 종목명 → 실시세 등락률(%). 매칭·조회 실패 시 null */
export async function fetchStockChangePct(name: string): Promise<number | null> {
  const code = await resolveCode(name);
  return code ? fetchChangePct(code) : null;
}

/** 여러 종목명을 병렬 조회 → Map<종목명, 등락률|null> (중복 제거) */
export async function fetchStockChangePcts(names: string[]): Promise<Map<string, number | null>> {
  const unique = [...new Set(names)];
  const entries = await Promise.all(
    unique.map(async (name) => [name, await fetchStockChangePct(name)] as const),
  );
  return new Map(entries);
}
