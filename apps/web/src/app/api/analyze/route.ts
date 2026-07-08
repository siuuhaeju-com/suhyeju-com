import { runAnalysis } from '@/lib/analyze';
import { saveAnalysis } from '@/lib/store';

// POST /api/analyze  { url?: string, text?: string }
// 분석 진행을 NDJSON 스트림으로 흘린다(로딩 화면 단계 표시용, SSE 방식).
//   각 줄 = JSON 이벤트: { step:'extract'|'analyze'|'quote', label }
//                       … 종료: { step:'done', id } 또는 { step:'error', message }
export async function POST(request: Request) {
  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 요청 형식입니다' }, { status: 400 });
  }

  if (!body.url && !body.text) {
    return Response.json({ error: 'url 또는 text 중 하나가 필요합니다' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        const result = await runAnalysis(body, send);
        await saveAnalysis(result);
        send({ step: 'done', id: result.id });
      } catch (error) {
        console.error('[api/analyze]', error);
        const message = error instanceof Error ? error.message : '분석에 실패했습니다';
        send({ step: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
