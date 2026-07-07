import { NextResponse } from 'next/server';

import { fetchKrHeatmap } from '@/lib/sources/naver';

// GET /api/market/kr/heatmap?top=15
// 한국 시장 히트맵(Finviz식 트리맵). top = 업종당 시총 상위 종목 수(기본 15).
// 데이터 소스: 네이버 금융.
export async function GET(request: Request) {
  const topParam = new URL(request.url).searchParams.get('top');
  const top = topParam ? Math.max(1, Math.min(50, Number(topParam) || 15)) : 15;

  try {
    const heatmap = await fetchKrHeatmap(top);
    return NextResponse.json(heatmap);
  } catch (error) {
    console.error('[api/market/kr/heatmap]', error);
    return NextResponse.json({ error: '히트맵 데이터를 불러오지 못했습니다.' }, { status: 502 });
  }
}
