/**
 * 네이버 금융 비공식 API — 종목명 → 코드 → 실시세(등락률).
 * analyze 시세 join(③단계)용. 종목마스터 캐시 없이 온디맨드 2콜(자동완성+basic).
 *
 * 한국(KOSPI/KOSDAQ)·미국(NASDAQ/NYSE 등) 종목 모두 지원한다.
 *   - 자동완성은 한글명("엔비디아")으로도 미국 종목을 찾아준다.
 *   - 시세 키·엔드포인트가 시장별로 다르다:
 *       한국 → m.stock.naver.com/api/stock/{code}/basic       (code = 6자리)
 *       미국 → api.stock.naver.com/stock/{reutersCode}/basic  (NVDA.O·AFL·APLE.K 등 접미사 가변)
 * 개명·별칭 종목(예: 두산중공업→두산에너빌리티)은 alias로 보정하고,
 * 매칭 실패 시 null을 돌려 호출측이 GPT 초안값을 유지하게 한다(오조인 금지).
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

interface AcItem {
  code: string;
  name: string;
  typeCode: string; // KOSPI | KOSDAQ | NASDAQ | NYSE | ...
  nationCode: string; // KOR | USA | ...
  reutersCode: string; // 시세 조회 키 (미국은 NVDA.O·AFL·APLE.K 등 접미사 가변)
}

interface ResolvedStock {
  key: string; // 시세 조회 키 (한국=종목코드, 미국=reutersCode)
  market: 'KR' | 'US';
}

/** 종목명 정규화 — 공백 제거 후 비교 */
function normalize(name: string): string {
  return name.replace(/\s+/g, '');
}

// 개명·별칭 종목 → 현재 상장명 (자동완성이 옛 이름을 못 찾는 케이스 보정)
const STOCK_ALIASES: Record<string, string> = {
  두산중공업: '두산에너빌리티',
  대우조선해양: '한화오션',
  현대중공업: 'HD현대중공업',
  한국조선해양: 'HD한국조선해양',
  LG상사: 'LX인터내셔널',
};

/** 별칭이면 현재 상장명으로 바꾼다(아니면 그대로). */
function canonicalName(name: string): string {
  return STOCK_ALIASES[normalize(name)] ?? name;
}

/** 종목명 → {시세키, 시장}. 자동완성 정규화 exact match(한국·미국 주식만). */
async function resolveStock(name: string): Promise<ResolvedStock | null> {
  const canonical = canonicalName(name);
  const url = `https://ac.stock.naver.com/ac?target=stock&q=${encodeURIComponent(canonical)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 3600 }, // 종목명↔코드는 잘 안 바뀜 → 1시간 캐시
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { items?: AcItem[] };
  const target = normalize(canonical);
  const hit = data.items?.find(
    (i) => normalize(i.name) === target && (i.nationCode === 'KOR' || i.nationCode === 'USA'),
  );
  if (!hit) return null;

  return hit.nationCode === 'KOR'
    ? { key: hit.code, market: 'KR' }
    : { key: hit.reutersCode, market: 'US' };
}

/** {시세키, 시장} → 전일대비 등락률(%). 실패 시 null */
async function fetchChangePct(stock: ResolvedStock): Promise<number | null> {
  const url =
    stock.market === 'KR'
      ? `https://m.stock.naver.com/api/stock/${stock.key}/basic`
      : `https://api.stock.naver.com/stock/${stock.key}/basic`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 60 }, // 시세는 60초 캐시
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { fluctuationsRatio?: string };
  const pct = Number.parseFloat(data.fluctuationsRatio ?? '');
  return Number.isFinite(pct) ? pct : null;
}

/** 종목 시세 결과 — 코드·시장은 매칭되면 채워지고, 시세 조회만 실패하면 changePct=null (#49) */
export interface StockQuote {
  code: string; // 한국=6자리 종목코드(예: 005930), 미국=reutersCode(예: NVDA.O)
  market: 'KR' | 'US';
  changePct: number | null;
}

/** 종목명 → {코드, 시장, 실시세}. 종목 매칭 실패 시 null(코드도 없음). */
export async function fetchStockQuote(name: string): Promise<StockQuote | null> {
  const stock = await resolveStock(name);
  if (!stock) return null;
  const changePct = await fetchChangePct(stock);
  return { code: stock.key, market: stock.market, changePct };
}

/** 여러 종목명을 병렬 조회 → Map<종목명, StockQuote|null> (중복 제거) */
export async function fetchStockQuotes(names: string[]): Promise<Map<string, StockQuote | null>> {
  const unique = [...new Set(names)];
  const entries = await Promise.all(
    unique.map(async (name) => [name, await fetchStockQuote(name)] as const),
  );
  return new Map(entries);
}
