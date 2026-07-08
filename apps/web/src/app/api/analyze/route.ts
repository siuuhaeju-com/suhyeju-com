import { NextResponse } from 'next/server';

import { runAnalysis } from '@/lib/analyze';
import { saveAnalysis } from '@/lib/store';

// POST /api/analyze  { url?: string, text?: string }
// 뉴스를 분석해 저장하고 id를 반환한다. (심장 — GPT_BASE_URL 필요)
export async function POST(request: Request) {
  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 });
  }

  if (!body.url && !body.text) {
    return NextResponse.json({ error: 'url 또는 text 중 하나가 필요합니다' }, { status: 400 });
  }

  try {
    const result = await runAnalysis(body);
    saveAnalysis(result);
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error('[api/analyze]', error);
    const message = error instanceof Error ? error.message : '분석에 실패했습니다';
    // 본문 추출 실패는 422(붙여넣기 유도), 그 외는 502
    const status = message.includes('본문') ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
