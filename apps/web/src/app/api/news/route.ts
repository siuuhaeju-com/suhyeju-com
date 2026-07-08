import { NextResponse } from 'next/server';

import { fetchRankNews } from '@/lib/sources/naver-news';

// 인기 뉴스 API (#53) — 네이버 증권 '많이 본 뉴스'(ranknews) 5개.
// 기존 검색 API(최신순)에서 실제 조회수 랭킹으로 교체 → API 키 불필요.
// 응답 형태는 lib/types.ts 의 NewsItem 과 맞춘다.
export async function GET() {
  try {
    const news = await fetchRankNews(5);
    return NextResponse.json(news);
  } catch (error) {
    console.error('[api/news]', error);
    return NextResponse.json({ error: '인기 뉴스를 불러오지 못했습니다.' }, { status: 502 });
  }
}
