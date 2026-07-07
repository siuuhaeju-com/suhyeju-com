/**
 * 네이버 금융 비공식 API 어댑터.
 *
 * 시세·업종 데이터를 가져오는 "단일 창구"다. 섹터·히트맵·종목마스터 API가
 * 모두 이 파일을 공유한다. 네이버 모바일 금융 API는 인증(키)이 필요 없지만,
 * 정상 브라우저처럼 보이도록 User-Agent를 붙인다.
 */
import type { SectorChange, MarketHeatmap, MarketHeatmapSector } from '@/lib/types';

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
 * 한국 업종별 등락률(79개 WICS)을 SectorChange[] 형태로 반환한다.
 * changeRate 부호: 상승 +, 하락 − (화면 색은 한국 관례로 상승=빨강, FE에서 처리).
 */
export async function fetchKrSectors(): Promise<SectorChange[]> {
  const res = await fetch(`${NAVER_STOCK_BASE}/industry?page=1&pageSize=${PAGE_SIZE}`, {
    headers: NAVER_HEADERS,
    next: { revalidate: 60 }, // 60초 캐시 — 같은 데이터 반복 요청 방지
  });

  if (!res.ok) {
    throw new Error(`네이버 업종 API 응답 오류 (${res.status})`);
  }

  const data = (await res.json()) as NaverIndustryResponse;

  return data.groups.map((group) => ({
    name: group.name,
    changePct: Number(group.changeRate), // "2.40"(문자열) → 2.4(숫자)
  }));
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

/**
 * 한국 시장 히트맵(Finviz식 트리맵) 데이터를 반환한다.
 * 업종별로 시총 상위 종목을 묶고, 각 종목은 시가총액(크기)·등락률(색)을 갖는다.
 */
export async function fetchKrHeatmap(topPerSector = 15): Promise<MarketHeatmap> {
  // 1) 업종 목록(79개 no + totalCount) 조회
  const indRes = await fetch(`${NAVER_STOCK_BASE}/industry?page=1&pageSize=${PAGE_SIZE}`, {
    headers: NAVER_HEADERS,
    next: { revalidate: 60 },
  });
  if (!indRes.ok) {
    throw new Error(`네이버 업종 API 응답 오류 (${indRes.status})`);
  }
  const indData = (await indRes.json()) as NaverIndustryResponse;

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
