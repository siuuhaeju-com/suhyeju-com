'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { isValidNewsLink } from '@/lib/link';
import { useLocalAnalyses } from '@/lib/local-analyses';

function getAnalysisIdFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.at(-1) ?? '';
}

/**
 * 분석 결과를 못 찾았을 때(PAGE-3 · #32, 무한 재분석 루프 방지 · #71).
 * 같은 id를 다시 조회하는 재시도는 의미가 없으므로(KV 미설정 시 조회한 인스턴스가
 * 매번 달라 영원히 404) 자동 재분석은 하지 않는다. 원문 링크를 알고 있으면
 * "다시 분석하기"(새 GPT 호출, 사용자가 눌러야만 실행)를, 모르면 "새 분석 시작하기"만 보여준다.
 */
export function AnalysisRecovery() {
  const pathname = usePathname();
  const id = useMemo(() => getAnalysisIdFromPath(pathname), [pathname]);
  const { items, isLoaded } = useLocalAnalyses();
  const localAnalysis = useMemo(() => items.find((item) => item.id === id) ?? null, [id, items]);
  const canRecover = Boolean(
    isLoaded && localAnalysis?.originUrl && isValidNewsLink(localAnalysis.originUrl),
  );

  if (!isLoaded) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-muted-foreground">분석 결과를 확인하고 있습니다.</p>
      </main>
    );
  }

  if (canRecover && localAnalysis) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-muted-foreground">
          분석 결과를 찾을 수 없습니다. 저장된 원문 링크로 다시 분석할 수 있어요.
        </p>
        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/analyzing?url=${encodeURIComponent(localAnalysis.originUrl)}`} />}
          >
            다시 분석하기
          </Button>
          <Button variant="secondary" nativeButton={false} render={<Link href="/" />}>
            새 분석 시작하기
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm text-muted-foreground">
        분석 결과를 찾을 수 없습니다. 링크가 잘못됐거나 결과가 만료됐을 수 있어요.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        새 분석 시작하기
      </Button>
    </main>
  );
}
