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
