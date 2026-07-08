import { NextResponse } from 'next/server';

import { getAnalysis } from '@/lib/store';

// GET /api/analysis/:id  →  저장된 AnalysisResult
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAnalysis(id);

  if (!result) {
    return NextResponse.json({ error: '분석 결과를 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json(result);
}
