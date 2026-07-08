import { NextResponse } from 'next/server';

import { classifyNewsSector, getSectorTone } from '@/lib/gics-sectors';
import { fetchStockNameToSectorInfo, type StockSectorInfo } from '@/lib/sources/naver';
import type { NewsItem } from '@/lib/types';

// 최신 뉴스 API (#33) — 네이버 검색 API로 최신 뉴스를 가져와 화면용 형태로 변환한다.
// 응답 형태는 lib/types.ts 의 NewsItem 과 맞춘다.

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

// 제목·요약에 실제 종목명이 언급됐는지로 섹터를 찾는다 (키워드 매칭보다 정확도 높음).
// 종목명이 서로 부분 문자열일 수 있어(예: "SK"·"SK하이닉스") 긴 이름부터 검사한다.
function classifyByStockNames(
  text: string,
  sortedNames: readonly string[],
  nameToSector: ReadonlyMap<string, StockSectorInfo>,
): StockSectorInfo | null {
  for (const name of sortedNames) {
    if (text.includes(name)) return nameToSector.get(name) ?? null;
  }
  return null;
}

export async function GET(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER API 키가 설정되지 않았습니다. apps/web/.env.local 을 확인하세요.' },
      { status: 500 },
    );
  }

  // ?query=반도체 처럼 검색어를 바꿀 수 있고, 없으면 '증시' 기본값
  const query = new URL(request.url).searchParams.get('query') ?? '증시';

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
    return NextResponse.json(
      { error: `네이버 API 응답 오류 (${response.status})` },
      { status: 502 },
    );
  }

  const data = (await response.json()) as { items: NaverNewsItem[] };

  // 종목명 매칭을 우선으로 섹터를 추정한다. 실패해도 뉴스 자체는 보여줘야 하므로
  // 종목 데이터 조회 실패는 무시하고 빈 맵(→ 키워드/검색어 폴백)으로 넘어간다.
  const stockNameToSector = await fetchStockNameToSectorInfo().catch(
    () => new Map<string, StockSectorInfo>(),
  );
  const sortedStockNames = [...stockNameToSector.keys()].sort((a, b) => b.length - a.length);

  const news: NewsItem[] = data.items.map((item, index) => {
    const title = stripHtml(item.title);
    const summary = stripHtml(item.description);
    const text = `${title} ${summary}`;

    // 1) 실제 종목명 언급 → 2) 주제 키워드 → 3) 검색어(증시) 순으로 섹터 추정.
    // subTag(보조 태그)는 종목명 매칭 시 WICS 소분류, 키워드 매칭 시 그 키워드 자체.
    const stockMatch = classifyByStockNames(text, sortedStockNames, stockNameToSector);
    const keywordMatch = stockMatch ? null : classifyNewsSector(text);
    const sector = stockMatch?.gicsSector ?? keywordMatch?.sector ?? query;

    return {
      id: `news-${index}`,
      sector,
      subTag: stockMatch?.wicsSector ?? keywordMatch?.keyword,
      sectorTone: getSectorTone(sector),
      source: extractSource(item.originallink || item.link),
      publishedAt: toRelativeTime(item.pubDate),
      title,
      summary,
    };
  });

  return NextResponse.json(news);
}
