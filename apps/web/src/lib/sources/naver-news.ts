/**
 * 네이버 검색 API 어댑터 — 인기 뉴스(#33).
 * 검색어로 최신 뉴스 5개를 받아 화면용 NewsItem[]으로 변환한다.
 * 키(NAVER_CLIENT_ID/SECRET)는 서버에서만 읽는다.
 */
import type { NewsItem } from '@/lib/types';

// 네이버 뉴스 검색 응답의 각 항목
interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

// 네이버가 제목·본문에 넣어주는 HTML 태그(<b>)와 엔티티를 제거한다.
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

// RFC822 날짜(pubDate) → "3시간 전" 같은 상대 시각 텍스트
function toRelativeTime(pubDate: string): string {
  const diffMin = Math.floor((Date.now() - new Date(pubDate).getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

// 원문 링크에서 발행처 도메인만 뽑는다 (예: n.news.naver.com)
function extractSource(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '뉴스';
  }
}

/**
 * 인기 뉴스 5개를 검색해 NewsItem[]으로 반환한다.
 * 키 미설정·네이버 오류 시 Error를 던진다(호출측 route가 상태코드로 변환).
 */
export async function fetchPopularNews(query: string): Promise<NewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NAVER API 키가 설정되지 않았습니다. apps/web/.env.local 을 확인하세요.');
  }

  const naverUrl = new URL('https://openapi.naver.com/v1/search/news.json');
  naverUrl.searchParams.set('query', query);
  naverUrl.searchParams.set('display', '5'); // 5개
  naverUrl.searchParams.set('sort', 'date'); // 최신순

  const response = await fetch(naverUrl, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    next: { revalidate: 600 }, // 10분 캐시 — 크레딧/호출량 절약
  });

  if (!response.ok) {
    throw new Error(`네이버 API 응답 오류 (${response.status})`);
  }

  const data = (await response.json()) as { items: NaverNewsItem[] };

  return data.items.map((item, index) => ({
    id: `news-${index}`,
    sector: query, // 데모용: 검색어를 섹터로. 추후 분류 로직으로 개선
    sectorTone: 'teal',
    source: extractSource(item.originallink || item.link),
    publishedAt: toRelativeTime(item.pubDate),
    title: stripHtml(item.title),
    summary: stripHtml(item.description),
  }));
}
