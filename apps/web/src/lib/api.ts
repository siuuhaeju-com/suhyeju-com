/** BE가 같은 오리진의 Next.js Route Handler이므로 상대경로(`/api/...`)로 바로 호출한다. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error ?? `요청에 실패했습니다 (${response.status})`);
  }

  return response.json();
}

/**
 * NDJSON 스트림 응답을 POST하고, 도착하는 줄마다 파싱해 yield한다
 * (예: /api/analyze의 진행 이벤트). 요청 자체가 실패하면(4xx/5xx) ApiError를 던지고,
 * 스트림 도중의 실패는 그 스트림이 보내는 이벤트 형태(T)로 소비자가 직접 처리한다.
 */
export async function* apiPostStream<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errBody?.error ?? `요청에 실패했습니다 (${response.status})`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      yield JSON.parse(line) as T;
    }
  }
}
