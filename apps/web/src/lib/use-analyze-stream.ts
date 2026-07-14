'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiPostStream, ApiError } from '@/lib/api';
import { isValidNewsLink } from '@/lib/link';
import { saveLocalAnalysis } from '@/lib/local-analyses';

export const ANALYZE_STEP_LABELS = [
  '뉴스 읽는 중',
  '핵심 이슈 및 키워드 추출 중',
  '호재/악재 의견 비교 중',
  '수혜 산업 그래프 생성 중',
  '섹터별 영향도·근거 정리 중',
] as const;

const TIMER_INTERVAL_MS = 4000;
const TIMER_CAP = 3;
const DONE_NAVIGATE_DELAY_MS = 400;

type AnalyzeEvent =
  | { step: 'extract' | 'analyze' | 'quote'; label: string }
  | { step: 'done'; id: string; title: string; analyzedAt: string; originUrl: string }
  | { step: 'error'; message: string };

export function useAnalyzeStream(url: string | null) {
  const router = useRouter();
  const [completed, setCompleted] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!url || !isValidNewsLink(url)) {
      router.replace('/');
      return;
    }

    setCompleted(0);
    setErrorMessage(null);

    const analysisUrl = url;
    const controller = new AbortController();

    function clearProgressTimer() {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    function clearNavigateTimer() {
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = null;
      }
    }

    function clearTimers() {
      clearProgressTimer();
      clearNavigateTimer();
    }

    // 부작용(다음 tick 예약)을 setState updater 밖, 평범한 클로저 변수로 관리한다.
    // Strict Mode가 updater 함수를 이중 호출해도 타이머가 두 번 걸리지 않도록 한다.
    let ticks = 0;
    function scheduleTick() {
      progressTimerRef.current = setTimeout(() => {
        ticks += 1;
        setCompleted(ticks);
        if (ticks < TIMER_CAP) {
          scheduleTick();
        }
      }, TIMER_INTERVAL_MS);
    }

    async function run() {
      try {
        const stream = apiPostStream<AnalyzeEvent>(
          '/api/analyze',
          { url: analysisUrl },
          controller.signal,
        );

        for await (const event of stream) {
          if (event.step === 'analyze') {
            clearProgressTimer();
            ticks = 1;
            setCompleted(1);
            scheduleTick();
          } else if (event.step === 'quote') {
            clearProgressTimer();
            ticks = TIMER_CAP;
            setCompleted(4);
          } else if (event.step === 'done') {
            clearTimers();
            setCompleted(ANALYZE_STEP_LABELS.length);
            saveLocalAnalysis({
              id: event.id,
              title: event.title,
              analyzedAt: event.analyzedAt,
              originUrl: event.originUrl || analysisUrl,
            });
            navigateTimerRef.current = setTimeout(
              () => router.replace(`/analysis/${event.id}`),
              DONE_NAVIGATE_DELAY_MS,
            );
            return;
          } else if (event.step === 'error') {
            clearTimers();
            setErrorMessage(event.message);
            return;
          }
        }

        clearTimers();
        setErrorMessage('분석 서버 연결이 끊겼습니다. 처음 화면에서 다시 시작해주세요.');
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        clearTimers();
        console.error('[analyzing]', err);
        setErrorMessage(
          err instanceof ApiError ? err.message : '네트워크 오류로 분석에 실패했습니다',
        );
      }
    }

    run();

    return () => {
      clearTimers();
      controller.abort();
    };
  }, [url, router]);

  return { completed, errorMessage };
}
