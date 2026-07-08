import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * 분석 결과를 찾을 수 없을 때 (PAGE-3 · #32)
 * Next.js 기본 404 대신, 왜 없는지 설명하고 새 분석으로 보낸다.
 * id가 잘못 입력됐거나, 인메모리 폴백에서 서버 재시작으로 사라졌거나,
 * KV에 저장되지 않은 오래된 링크일 수 있다 — "페이지가 없다"가 아니라
 * "이 결과를 못 찾았다"는 걸 명확히 한다.
 */
export default function AnalysisNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm text-muted-foreground">
        분석 결과를 찾을 수 없습니다. 링크가 잘못됐거나 결과가 만료됐을 수 있어요.
      </p>
      <Button render={<Link href="/" />}>새 분석 시작하기</Button>
    </main>
  );
}
