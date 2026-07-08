/**
 * 네이버 금융 비공식 API 어댑터.
 *
 * 시세·업종 데이터를 가져오는 "단일 창구"다. 섹터·히트맵·종목마스터 API가
 * 모두 이 파일을 공유한다. 네이버 모바일 금융 API는 인증(키)이 필요 없지만,
 * 정상 브라우저처럼 보이도록 User-Agent를 붙인다.
 */
import type { SectorChange, MarketHeatmap, MarketHeatmapSector } from '@/lib/types';
import { WICS_TO_GICS_SECTOR } from '@/lib/gics-sectors';

// 브라우저인 척하는 User-Agent (비공식 API라 형식상 붙여둔다)
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NAVER_HEADERS = { 'User-Agent': BROWSER_UA } as const;

const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100; // 네이버 pageSize 상한

// 네이버 업종(WICS) 목록의 각 항목
interface NaverIndustryGroup {
  no: number; // 업종 고유번호 (구성종목 조회 시 사용)
  name: string; // 업종명 (예: 반도체와반도체장비)
  changeRate: string; // 전일대비 등락률, 문자열 (예: "2.40")
  totalCount: number; // 소속 종목 수
}

interface NaverIndustryResponse {
  groups: NaverIndustryGroup[];
  totalCount: number;
  marketStatus: 'OPEN' | 'CLOSE';
}

// 업종 상세(구성종목) 응답의 각 종목
interface NaverStockItem {
  itemCode: string; // 종목코드 (예: 005930)
  stockName: string; // 종목명 (예: 삼성전자)
  marketValueRaw: number | string; // 시가총액 (원 단위 숫자)
  fluctuationsRatio: string; // 등락률, 문자열
}

interface NaverIndustryDetail {
  stocks: NaverStockItem[];
  marketStatus: 'OPEN' | 'CLOSE';
}

/**
 * 네이버 업종(WICS 79개) 목록을 가져온다 — fetchKrSectors·fetchKrMajorSectors·
 * fetchKrHeatmap이 전부 같은 원본 데이터를 쓰므로 fetch·에러 처리를 여기 하나로 모은다.
 */
async function fetchIndustryResponse(): Promise<NaverIndustryResponse> {
  const res = await fetch(`${NAVER_STOCK_BASE}/industry?page=1&pageSize=${PAGE_SIZE}`, {
    headers: NAVER_HEADERS,
    next: { revalidate: 60 }, // 60초 캐시 — 같은 데이터 반복 요청 방지
  });

  if (!res.ok) {
    throw new Error(`네이버 업종 API 응답 오류 (${res.status})`);
  }

  return res.json() as Promise<NaverIndustryResponse>;
}

/**
 * 한국 업종별 등락률(79개 WICS)을 SectorChange[] 형태로 반환한다.
 * changeRate 부호: 상승 +, 하락 − (화면 색은 한국 관례로 상승=빨강, FE에서 처리).
 */
export async function fetchKrSectors(): Promise<SectorChange[]> {
  const data = await fetchIndustryResponse();

  return data.groups.map((group) => ({
    name: group.name,
    changePct: Number(group.changeRate), // "2.40"(문자열) → 2.4(숫자)
  }));
}

/**
 * 주요 섹터 현황(#16)에 실제로 쓰는 API — WICS 업종 79개를 GICS 11개 대분류로
 * 묶어 SectorChange[] 형태로 반환한다. 값은 대분류에 속한 업종들의 종목 수
 * 가중평균(추가 API 호출 없이 totalCount로 계산). 등락률 내림차순으로 정렬해서
 * 반환하며, 상위 몇 개만 보여줄지는 FE에서 자른다(BE는 자르지 않음).
 * fetchKrSectors(WICS 업종 79개 그대로, 별도 용도)는 그대로 둔다.
 */
export async function fetchKrMajorSectors(): Promise<SectorChange[]> {
  const data = await fetchIndustryResponse();

  const totals = new Map<string, { weightedSum: number; weight: number }>();

  for (const group of data.groups) {
    const sector = WICS_TO_GICS_SECTOR[group.name];
    if (!sector) continue; // GICS에 대응되지 않는 업종(예: 기타)은 제외

    const weight = group.totalCount;
    const entry = totals.get(sector) ?? { weightedSum: 0, weight: 0 };
    entry.weightedSum += Number(group.changeRate) * weight;
    entry.weight += weight;
    totals.set(sector, entry);
  }

  return [...totals.entries()]
    .map(([name, { weightedSum, weight }]) => ({
      name,
      changePct: weight > 0 ? weightedSum / weight : 0,
    }))
    .sort((a, b) => b.changePct - a.changePct);
}

/**
 * 한 업종의 구성종목 전체를 페이지네이션으로 받아온다.
 * 네이버는 등락률순 정렬 + pageSize 상한 100이라, 종목이 100개를 넘는 업종은
 * 여러 페이지를 받아야 시총 큰 대형주(등락률순에선 뒤로 밀린)를 놓치지 않는다.
 */
async function fetchIndustryStocks(no: number, totalCount: number): Promise<NaverStockItem[]> {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetch(`${NAVER_STOCK_BASE}/industry/${no}?page=${i + 1}&pageSize=${PAGE_SIZE}`, {
        headers: NAVER_HEADERS,
        next: { revalidate: 60 },
      })
        .then((r) => (r.ok ? (r.json() as Promise<NaverIndustryDetail>) : null))
        .catch(() => null),
    ),
  );

  return results.filter((d): d is NaverIndustryDetail => d !== null).flatMap((d) => d.stocks);
}

/** 종목명 하나가 속한 섹터 정보 — GICS 11개 대분류 + WICS 79개 소분류(업종명) */
export interface StockSectorInfo {
  gicsSector: string;
  wicsSector: string;
}

// 종목명→섹터는 "분류"(어느 업종 소속인지)라서 등락률과 달리 초 단위로 안 바뀐다.
// 유일한 사용처인 뉴스 분류(GET /api/news)도 ranknews 자체가 10분(600s) 캐시라, 그보다
// 자주 다시 만들 이유가 없다 — fetchIndustryStocks의 60초 캐시(가격용)를 그대로 빌려 쓰지 않는다.
const STOCK_NAME_TO_SECTOR_TTL_MS = 600_000;

// fetchStockNameToSectorInfo()가 매 호출마다 79개 업종을 다시 훑지 않도록 하는 인메모리 캐시.
// 개별 fetch 자체는 이미 revalidate:60으로 캐시되지만, 79개를 순회하며 Map을 다시 만드는
// JS 연산은 그때마다 반복되므로 결과물(Map)을 통째로 캐시한다.
let stockNameToSectorCache: { data: Map<string, StockSectorInfo>; expiresAt: number } | null = null;

/**
 * 종목명(예: "삼성전자") → 섹터 정보 매핑을 반환한다 (뉴스 섹터 분류용, #15).
 * 79개 업종 전체 구성종목을 훑어서 만들며, 개별 fetch는 fetchIndustryStocks의
 * 60초 캐시(next.revalidate)를 그대로 타므로 반복 호출해도 실네트워크 요청은 늘지 않는다.
 */
export async function fetchStockNameToSectorInfo(): Promise<Map<string, StockSectorInfo>> {
  if (stockNameToSectorCache && stockNameToSectorCache.expiresAt > Date.now()) {
    return stockNameToSectorCache.data;
  }

  const data = await fetchIndustryResponse();

  const perGroup = await Promise.all(
    data.groups.map(async (group) => {
      const gicsSector = WICS_TO_GICS_SECTOR[group.name];
      if (!gicsSector) return [];

      const stocks = await fetchIndustryStocks(group.no, group.totalCount);
      return stocks.map(
        (stock) => [stock.stockName, { gicsSector, wicsSector: group.name }] as const,
      );
    }),
  );

  const result = new Map(perGroup.flat());
  stockNameToSectorCache = { data: result, expiresAt: Date.now() + STOCK_NAME_TO_SECTOR_TTL_MS };
  return result;
}

/**
 * 텍스트에 실제 종목명이 언급됐는지로 섹터를 찾는다 (뉴스 섹터 분류용, #15 — 키워드
 * 매칭보다 정확도 높음). 종목명이 서로 부분 문자열일 수 있어(예: "SK"·"SK하이닉스")
 * 긴 이름부터 검사해야 하므로, 호출 측이 `sortedNames`를 길이 내림차순으로 정렬해 넘긴다.
 */
export function classifyByStockNames(
  text: string,
  sortedNames: readonly string[],
  nameToSector: ReadonlyMap<string, StockSectorInfo>,
): StockSectorInfo | null {
  for (const name of sortedNames) {
    if (text.includes(name)) return nameToSector.get(name) ?? null;
  }
  return null;
}

/**
 * 한국 시장 히트맵(Finviz식 트리맵) 데이터를 반환한다.
 * 업종별로 시총 상위 종목을 묶고, 각 종목은 시가총액(크기)·등락률(색)을 갖는다.
 */
export async function fetchKrHeatmap(topPerSector = 15): Promise<MarketHeatmap> {
  // 1) 업종 목록(79개 no + totalCount) 조회
  const indData = await fetchIndustryResponse();

  // 2) 각 업종의 전체 종목을 병렬 조회 → 시총순 정렬 → 상위 topPerSector개
  const sectors = await Promise.all(
    indData.groups.map(async (group): Promise<MarketHeatmapSector | null> => {
      const items = await fetchIndustryStocks(group.no, group.totalCount);
      if (items.length === 0) return null; // 일부 업종 실패해도 전체는 살린다

      const stocks = items
        .map((s) => ({
          name: s.stockName,
          code: s.itemCode,
          marketCap: Number(s.marketValueRaw) || 0,
          changePct: Number(s.fluctuationsRatio) || 0,
        }))
        .sort((a, b) => b.marketCap - a.marketCap) // 시총 큰 순
        .slice(0, topPerSector);

      return {
        name: group.name,
        changePct: Number(group.changeRate),
        stocks,
      };
    }),
  );

  return {
    market: 'KR',
    asOf: new Date().toISOString(),
    status: indData.marketStatus ?? 'CLOSE',
    sectors: sectors.filter((s): s is MarketHeatmapSector => s !== null),
  };
}
