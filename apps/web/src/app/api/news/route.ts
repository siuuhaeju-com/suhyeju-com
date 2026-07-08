import { NextResponse } from 'next/server';

import { fetchPopularNews } from '@/lib/sources/naver-news';

// GET /api/news?query=  — 인기 뉴스 5개 (#33). 데이터 소스: 네이버 검색 API.
export async function GET(request: Request) {
  // ?query=반도체 처럼 검색어를 바꿀 수 있고, 없으면 '증시' 기본값
  const query = new URL(request.url).searchParams.get('query') ?? '증시';

  try {
    const news = await fetchPopularNews(query);
    return NextResponse.json(news);
  } catch (error) {
    console.error('[api/news]', error);
    const message = error instanceof Error ? error.message : '뉴스를 불러오지 못했습니다';
    // 키 미설정은 500, 그 외(네이버 오류 등)는 502
    const status = message.includes('키') ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
