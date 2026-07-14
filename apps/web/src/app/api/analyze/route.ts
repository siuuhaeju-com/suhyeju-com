import { getAnalysisErrorMessage } from '@/lib/analysis/errors';
import { runNewsAnalysis } from '@/lib/analysis/usecase';
import { getAnalysisByOriginUrl, saveAnalysis } from '@/lib/store';
import type { AnalysisResult } from '@/lib/types';

function doneEvent(result: AnalysisResult) {
  return {
    step: 'done',
    id: result.id,
    title: result.title,
    analyzedAt: result.analyzedAt,
    originUrl: result.originUrl,
  };
}

// POST /api/analyze  { url?: string, text?: string }
// 분석 진행을 NDJSON 스트림으로 흘린다(로딩 화면 단계 표시용, SSE 방식).
//   각 줄 = JSON 이벤트: { step:'extract'|'analyze'|'quote', label }
//                       … 종료: { step:'done', id, title, analyzedAt, originUrl } 또는 { step:'error', message }
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
        if (body.url) {
          const existing = await getAnalysisByOriginUrl(body.url);
          if (existing) {
            await saveAnalysis(existing);
            send(doneEvent(existing));
            return;
          }
        }

        const result = await runNewsAnalysis(body, send);
        await saveAnalysis(result);
        send(doneEvent(result));
      } catch (error) {
        console.error('[api/analyze]', error);
        send({ step: 'error', message: getAnalysisErrorMessage(error) });
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
