/**
 * 네이버 증권 '많이 본 뉴스'(ranknews) — 인기 뉴스 소스(#53).
 *
 * 시세에 쓰는 비공식 naver API 계열(api.stock.naver.com)로, 실제 조회수 랭킹을
 * 돌려준다. 기존 검색 API 방식과 달리 (1) 진짜 '인기'순이고 (2) NAVER 검색 API
 * 키가 필요 없다. 응답은 화면용 NewsItem[]으로 변환한다.
 *
 * + 뉴스 검색(searchEdgeSources) — 파급 그래프 연결 근거를 실제 언론사 기사에서
 *   찾아 EdgeSource(제목·출처·URL)로 매핑한다(#24). NAVER 검색 API 키 필요.
 */
import type { EdgeSource, NewsItem } from '@/lib/types';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const RANKNEWS_URL = 'https://api.stock.naver.com/news/ranknews';

interface RankNewsItem {
  tit: string; // 제목
  subcontent: string; // 요약
  ohnm: string; // 언론사명
  oid: string; // 언론사 id (링크용)
  aid: string; // 기사 id (링크용)
  dt: string; // 발행 시각 yyyyMMddHHmmss
  thumbUrl?: string;
}

/** 네이버가 제목·요약에 넣는 HTML 태그·엔티티 제거 */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/** 발행 시각(yyyyMMddHHmmss) → "3시간 전" 같은 상대 시각 텍스트 */
function toRelativeTime(dt: string): string {
  if (!/^\d{14}$/.test(dt)) return '';
  const y = +dt.slice(0, 4);
  const mo = +dt.slice(4, 6) - 1;
  const d = +dt.slice(6, 8);
  const h = +dt.slice(8, 10);
  const mi = +dt.slice(10, 12);
  const s = +dt.slice(12, 14);
  const diffMin = Math.floor((Date.now() - new Date(y, mo, d, h, mi, s).getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

/** ranknews 원본을 화면용으로 옮긴 것 — 섹터 분류(#15)는 route.ts에서 별도로 붙인다. */
export type RankNewsArticle = Omit<NewsItem, 'sector' | 'subTag' | 'sectorTone'>;

/* ── 뉴스 검색 (openapi.naver.com) — 파급 그래프 근거 뉴스 매핑용 ── */

const SEARCH_URL = 'https://openapi.naver.com/v1/search/news.json';

// 주요 언론사 도메인 → 표시명 (검색 API는 언론사명을 안 주므로 원문 도메인에서 유도)
const PRESS_BY_DOMAIN: Record<string, string> = {
  'hankyung.com': '한국경제',
  'mk.co.kr': '매일경제',
  'sedaily.com': '서울경제',
  'edaily.co.kr': '이데일리',
  'etnews.com': '전자신문',
  'yna.co.kr': '연합뉴스',
  'einfomax.co.kr': '연합인포맥스',
  'mt.co.kr': '머니투데이',
  'fnnews.com': '파이낸셜뉴스',
  'chosun.com': '조선일보',
  'joongang.co.kr': '중앙일보',
  'hani.co.kr': '한겨레',
  'heraldcorp.com': '헤럴드경제',
  'asiae.co.kr': '아시아경제',
  'newsis.com': '뉴시스',
  'news1.kr': '뉴스1',
  'zdnet.co.kr': '지디넷코리아',
  'ddaily.co.kr': '디지털데일리',
  'thebell.co.kr': '더벨',
};

interface SearchNewsItem {
  title: string; // <b> 태그 포함
  originallink: string; // 언론사 원문 링크
  link: string; // 네이버 뉴스 링크(제휴 기사) 또는 원문
  pubDate: string; // RFC822 (예: "Wed, 09 Jul 2026 10:30:00 +0900")
}

/** 원문 링크 도메인 → 언론사 표시명 (매핑 없으면 도메인 그대로) */
function pressLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www|news|biz|m)\./, '');
    return PRESS_BY_DOMAIN[host] ?? host;
  } catch {
    return '';
  }
}

/** pubDate(RFC822) → "MM.DD" */
function toMonthDay(pubDate: string): string {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

/**
 * 검색어로 실제 언론사 기사를 찾아 EdgeSource[]로 반환한다(관련도순 상위 limit개).
 * 근거 뉴스는 반드시 이 검색 결과에서만 나온다 — LLM이 지어낸 제목·URL은 파이프라인에
 * 들어올 수 없다. 키(NAVER_CLIENT_ID/SECRET) 미설정·검색 실패·결과 없음 → 빈 배열.
 */
export async function searchEdgeSources(query: string, limit = 2): Promise<EdgeSource[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const trimmed = query.trim();
  if (!clientId || !clientSecret || !trimmed) return [];

  try {
    const params = new URLSearchParams({ query: trimmed, display: '5', sort: 'sim' });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
      next: { revalidate: 300 }, // 같은 검색어 5분 캐시
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: SearchNewsItem[] };
    const seen = new Set<string>();
    const sources: EdgeSource[] = [];
    for (const item of data.items ?? []) {
      const url = item.originallink || item.link;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const press = pressLabel(url);
      const day = toMonthDay(item.pubDate);
      sources.push({
        title: stripHtml(item.title),
        meta: [press, day].filter(Boolean).join(' · '),
        url,
      });
      if (sources.length >= limit) break;
    }
    return sources;
  } catch {
    return []; // 검색 장애는 분석 실패로 번지지 않게 삼킨다
  }
}

/** 네이버 증권 '많이 본 뉴스' 상위 limit개 → RankNewsArticle[] */
export async function fetchRankNews(limit = 5): Promise<RankNewsArticle[]> {
  const res = await fetch(RANKNEWS_URL, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 600 }, // 10분 캐시
  });
  if (!res.ok) {
    throw new Error(`네이버 증권 인기 뉴스 응답 오류 (${res.status})`);
  }

  const items = (await res.json()) as RankNewsItem[];
  return items.slice(0, limit).map((item) => ({
    // 언론사 id + 기사 id 조합 — ranknews가 주는 유일한 안정 식별자(배열 순서에 안 흔들림)
    id: `${item.oid}-${item.aid}`,
    source: item.ohnm,
    publishedAt: toRelativeTime(item.dt),
    title: stripHtml(item.tit),
    summary: stripHtml(item.subcontent),
    url: `https://n.news.naver.com/article/${item.oid}/${item.aid}`,
  }));
}
