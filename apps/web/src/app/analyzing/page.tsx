'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NetworkSphere } from '@/components/loading/network-sphere';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { analysisResult, analysisSteps, floatingChips } from '@/lib/mock-data';

const STEP_INTERVAL_MS = 1300;

/**
 * 로딩 페이지 (PAGE-2 · #31, F-04)
 * 좌: 섹터 추출 연출(구체 + 부유 키워드 칩) / 우: 단계별 진행 체크리스트.
 * 단계가 모두 끝나면 분석 페이지로 자동 이동한다.
 * FE 연동 지점: 타이머 대신 분석 상태 폴링(GET /api/analysis/:id/status)으로 교체.
 */
export default function AnalyzingPage() {
  const router = useRouter();
  // 완료된 단계 수 (0 ~ steps.length)
  const [done, setDone] = useState(1);
  const total = analysisSteps.length;

  useEffect(() => {
    if (done >= total) {
      const timeout = setTimeout(() => router.push(`/analysis/${analysisResult.id}`), 700);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setDone((d) => d + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [done, total, router]);

  const progress = Math.min((done / total) * 100, 100);

  return (
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 items-center gap-16 px-6 py-12 lg:grid-cols-2">
      {/* 좌: 구체 + 부유 칩 */}
      <div className="relative hidden lg:block">
        <NetworkSphere />
        {floatingChips.map((chip) => (
          <span
            key={chip.label}
            aria-hidden
            className="animate-float-y absolute"
            style={{ left: `${chip.x}%`, top: `${chip.y}%`, animationDelay: `${chip.delay}s` }}
          >
            <Badge
              tone={chip.tone === 'neutral' ? 'neutral' : chip.tone}
              className="px-3 py-1.5 text-[13px]"
            >
              {chip.label}
            </Badge>
          </span>
        ))}
      </div>

      {/* 우: 진행 상태 */}
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-bright uppercase">
          AI Analysis Engine
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">아티클 생성 중…</h1>
        <p className="mt-2 truncate text-sm text-muted-foreground">{analysisResult.title}</p>

        <Progress value={progress} className="mt-6" aria-label="분석 진행률" />

        <ol className="mt-6 flex flex-col gap-3">
          {analysisSteps.map((step, index) => {
            const state = index < done ? 'done' : index === done ? 'active' : 'pending';
            return (
              <li
                key={step.label}
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
                      className="flex size-6 items-center justify-center rounded-full border border-negative/50 bg-negative/10 text-xs text-[#7fd8a8]"
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
                    {step.label}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-bold',
                    state === 'done' && 'text-[#7fd8a8]',
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
