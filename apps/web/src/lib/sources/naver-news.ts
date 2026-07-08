/**
 * 네이버 증권 '많이 본 뉴스'(ranknews) — 인기 뉴스 소스(#53).
 *
 * 시세에 쓰는 비공식 naver API 계열(api.stock.naver.com)로, 실제 조회수 랭킹을
 * 돌려준다. 기존 검색 API 방식과 달리 (1) 진짜 '인기'순이고 (2) NAVER 검색 API
 * 키가 필요 없다. 응답은 화면용 NewsItem[]으로 변환한다.
 */
import type { NewsItem } from '@/lib/types';

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
