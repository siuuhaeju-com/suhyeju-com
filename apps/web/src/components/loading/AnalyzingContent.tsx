'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { NetworkSphere } from '@/components/loading/NetworkSphere';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useKrMajorSectors } from '@/lib/queries';
import { ANALYZE_STEP_LABELS, useAnalyzeStream } from '@/lib/use-analyze-stream';
import { cn } from '@/lib/utils';

/**
 * 로딩 페이지 (PAGE-2 · #31, F-04)
 * POST /api/analyze의 NDJSON 스트림을 구독해 단계를 실시간으로 채운다.
 * 스트림 제어와 로컬 저장은 useAnalyzeStream에 위임하고, 이 컴포넌트는 화면 상태만 그린다.
 */
export function AnalyzingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get('url');

  const { completed, errorMessage } = useAnalyzeStream(url);
  const { data: sectors } = useKrMajorSectors();

  if (errorMessage) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button onClick={() => router.replace('/')}>메인 화면으로</Button>
      </main>
    );
  }

  const total = ANALYZE_STEP_LABELS.length;
  const progress = Math.min((completed / total) * 100, 100);

  return (
    // -translate-y: items-center는 <main>(헤더 아래 영역) 안에서만 중앙정렬하므로,
    // 위에만 있는 SiteHeader(h-16+border=65px) 때문에 뷰포트 전체 기준으로는 살짝 아래로 치우친다.
    // 헤더 높이의 절반만큼 위로 당겨서 뷰포트 전체 기준 정중앙에 오도록 보정한다.
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 -translate-y-[32.5px] items-center gap-16 px-6 py-12 lg:grid-cols-2">
      {/* 좌: 구체 + 주요 섹터 칩(메인 화면과 같은 실데이터) */}
      <div className="hidden lg:block">
        <NetworkSphere sectors={sectors} />
      </div>

      {/* 우: 진행 상태 */}
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-bright uppercase">
          AI Analysis Engine
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">아티클 생성 중…</h1>
        <p className="mt-2 truncate text-sm text-muted-foreground">{url}</p>

        <Progress value={progress} className="mt-6" aria-label="분석 진행률" />

        <ol className="mt-6 flex flex-col gap-3">
          {ANALYZE_STEP_LABELS.map((label, index) => {
            const state = index < completed ? 'done' : index === completed ? 'active' : 'pending';
            return (
              <li
                key={label}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-md border bg-card px-4 py-3.5 text-sm transition-colors',
                  state === 'active' && 'border-primary/60 bg-surface-raised/70',
                  state === 'pending' && 'opacity-70',
                )}
              >
                <span className="flex items-center gap-3">
                  {state === 'done' && (
                    <span
                      aria-hidden
                      className="flex size-6 items-center justify-center rounded-full border border-success/40 bg-success/10 text-xs text-success"
                    >
                      ✓
                    </span>
                  )}
                  {state === 'active' && (
                    <span
                      aria-hidden
                      className="size-6 animate-spin-slow rounded-full border-2 border-primary/25 border-t-primary"
                    />
                  )}
                  {state === 'pending' && (
                    <span
                      aria-hidden
                      className="flex size-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
                    >
                      {index + 1}
                    </span>
                  )}
                  <span
                    className={cn('font-medium', state === 'pending' && 'text-muted-foreground')}
                  >
                    {label}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-bold',
                    state === 'done' && 'text-success',
                    state === 'active' && 'text-blue-bright',
                    state === 'pending' && 'text-muted-foreground',
                  )}
                >
                  {state === 'done' ? '완료' : state === 'active' ? '진행 중' : '대기'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
