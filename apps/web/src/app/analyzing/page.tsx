'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { NetworkSphere } from '@/components/loading/NetworkSphere';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { floatingChips } from '@/lib/mock-data';

const STEP_LABELS = [
  '뉴스 읽는 중',
  '핵심 이슈 및 키워드 추출 중',
  '호재/악재 의견 비교 중',
  '수혜 산업 그래프 생성 중',
  '산업 영향도 히트맵 생성 중',
] as const;

// analyze 수신 후 ②→③→④까지만 타이머로 채우고 멈춘다(④는 quote 이벤트로만 완료 처리).
const TIMER_INTERVAL_MS = 1300;
const TIMER_CAP = 3;

type AnalyzeEvent =
  | { step: 'extract' | 'analyze' | 'quote'; label: string }
  | { step: 'done'; id: string }
  | { step: 'error'; message: string };

/**
 * 로딩 페이지 (PAGE-2 · #31, F-04)
 * POST /api/analyze의 NDJSON 스트림을 직접 구독해 단계를 실시간으로 채운다.
 * - extract 수신 → ①(기본 상태이므로 별도 처리 없음)
 * - analyze 수신 → ① 완료, ② 진행 중 시작 + 타이머로 ②→③→④ 순차 진행(④에서 대기)
 * - quote 수신 → ②③④ 즉시 완료 처리(타이머 캐치업 점프) + ⑤ 진행 중
 * - done 수신 → /analysis/[id]로 라우팅 (오직 이 이벤트로만 트리거, 타이머로는 넘어가지 않음)
 * - error 수신 → 고정 문구 + 재시도 버튼
 */
export default function AnalyzingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get('url');

  const [completed, setCompleted] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // React Strict Mode(dev)가 effect를 두 번 실행하는데, 매번 fetch를 새로 시작하면
  // 서버에서 분석이 중복 실행되어 서로 다른 id가 생기고 무엇이 저장됐는지 꼬인다.
  // (url, retryKey) 조합당 실제 요청은 정확히 한 번만 시작하도록 ref로 막는다.
  const startedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      router.replace('/');
      return;
    }

    const key = `${url}:${retryKey}`;
    if (startedKeyRef.current === key) {
      return;
    }
    startedKeyRef.current = key;

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function tick() {
      setCompleted((prev) => {
        if (prev >= TIMER_CAP) return prev;
        const next = prev + 1;
        if (next < TIMER_CAP) {
          timerRef.current = setTimeout(tick, TIMER_INTERVAL_MS);
        }
        return next;
      });
    }

    async function run() {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!response.ok || !response.body) {
          throw new Error('요청에 실패했습니다');
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
            const event = JSON.parse(line) as AnalyzeEvent;
            if (event.step === 'analyze') {
              clearTimer();
              setCompleted(1);
              timerRef.current = setTimeout(tick, TIMER_INTERVAL_MS);
            } else if (event.step === 'quote') {
              clearTimer();
              setCompleted(4);
            } else if (event.step === 'done') {
              clearTimer();
              router.push(`/analysis/${event.id}`);
              return;
            } else if (event.step === 'error') {
              clearTimer();
              setHasError(true);
              return;
            }
          }
        }
      } catch {
        clearTimer();
        setHasError(true);
      }
    }

    run();

    return () => {
      clearTimer();
    };
  }, [url, router, retryKey]);

  if (hasError) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-muted-foreground">분석 중 오류가 발생했습니다</p>
        <Button
          onClick={() => {
            setCompleted(0);
            setHasError(false);
            setRetryKey((key) => key + 1);
          }}
        >
          다시 시도
        </Button>
      </main>
    );
  }

  const total = STEP_LABELS.length;
  const progress = Math.min((completed / total) * 100, 100);

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
        <p className="mt-2 truncate text-sm text-muted-foreground">{url}</p>

        <Progress value={progress} className="mt-6" aria-label="분석 진행률" />

        <ol className="mt-6 flex flex-col gap-3">
          {STEP_LABELS.map((label, index) => {
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
