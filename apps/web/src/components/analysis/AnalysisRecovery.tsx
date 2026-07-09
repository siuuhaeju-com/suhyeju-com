'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { isValidNewsLink } from '@/lib/link';
import { useLocalAnalyses } from '@/lib/local-analyses';

function getAnalysisIdFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.at(-1) ?? '';
}

export function AnalysisRecovery() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useMemo(() => getAnalysisIdFromPath(pathname), [pathname]);
  const { items, isLoaded } = useLocalAnalyses();
  const localAnalysis = useMemo(() => items.find((item) => item.id === id) ?? null, [id, items]);
  const canRecover = Boolean(
    isLoaded && localAnalysis?.originUrl && isValidNewsLink(localAnalysis.originUrl),
  );

  useEffect(() => {
    if (canRecover && localAnalysis) {
      router.replace(`/analyzing?url=${encodeURIComponent(localAnalysis.originUrl)}`);
    }
  }, [canRecover, localAnalysis, router]);

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
        <p className="text-sm text-muted-foreground">저장된 원문 링크로 분석을 다시 시작합니다.</p>
        <Button
          nativeButton={false}
          render={<Link href={`/analyzing?url=${encodeURIComponent(localAnalysis.originUrl)}`} />}
        >
          다시 분석하기
        </Button>
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
