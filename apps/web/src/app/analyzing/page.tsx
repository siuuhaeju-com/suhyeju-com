import { Suspense } from 'react';

import { AnalyzingContent } from '@/components/loading/AnalyzingContent';

export default function AnalyzingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          분석 화면을 준비하는 중…
        </main>
      }
    >
      <AnalyzingContent />
    </Suspense>
  );
}
