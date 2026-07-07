import { NextResponse } from 'next/server';

import { fetchKrSectors } from '@/lib/sources/naver';

// GET /api/market/kr/sectors
// 한국 업종별 등락률(주요 섹터 현황, 이슈 #34). 데이터 소스: 네이버 금융.
export async function GET() {
  try {
    const sectors = await fetchKrSectors();
    return NextResponse.json(sectors);
  } catch (error) {
    console.error('[api/market/kr/sectors]', error);
    return NextResponse.json({ error: '섹터 시세를 불러오지 못했습니다.' }, { status: 502 });
  }
}
