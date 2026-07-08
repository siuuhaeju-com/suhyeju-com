import { NextResponse } from 'next/server';

import { fetchKrMajorSectors } from '@/lib/sources/naver';

// GET /api/market/kr/major-sectors
// 주요 섹터 현황(#16) — WICS 업종 79개를 GICS 11개 대분류로 묶어 반환한다.
// 등락률 내림차순 전체(최대 11개)를 반환하며, 상위 몇 개만 보여줄지는 FE에서 자른다.
export async function GET() {
  try {
    const sectors = await fetchKrMajorSectors();
    return NextResponse.json(sectors);
  } catch (error) {
    console.error('[api/market/kr/major-sectors]', error);
    return NextResponse.json({ error: '섹터 시세를 불러오지 못했습니다.' }, { status: 502 });
  }
}
