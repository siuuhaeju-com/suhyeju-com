'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidNewsLink } from '@/lib/link';

/**
 * 뉴스 링크 입력 폼 (F-01 · F-02)
 * 제출(버튼 클릭 / Enter) 시 형식 검증만 하고 로딩 화면(/analyzing, F-04)으로 넘긴다.
 * POST /api/analyze(SETUP-05)는 NDJSON 스트림으로 진행 단계를 흘려 보내는데,
 * 여기서 스트림을 끝까지 읽어버리면 로딩 화면이 실시간 단계 표시를 할 수 없으므로
 * 실제 분석 요청은 로딩 화면 쪽에서 시작한다 — 이 폼은 입력값만 넘긴다.
 */
export function AnalyzeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // input이 disabled → enabled로 커밋된 뒤에 포커스해야 focus()가 먹히므로 렌더 이후로 미룬다
  useEffect(() => {
    if (errorMessage && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [errorMessage, isSubmitting]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLink(event.target.value);
    if (errorMessage) {
      setErrorMessage('');
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const value = link.trim();
    if (!value) {
      setErrorMessage('링크를 입력해주세요');
      return;
    }
    if (!isValidNewsLink(value)) {
      setErrorMessage('http(s)://로 시작하는 올바른 링크를 입력해주세요');
      return;
    }
    setIsSubmitting(true);
    router.push(`/analyzing?url=${encodeURIComponent(value)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-up mx-auto w-full max-w-3xl rounded-lg border bg-card/70 p-4"
      aria-label="뉴스 링크 분석 폼"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span
            aria-hidden
            className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
          >
            🔗
          </span>
          <Input
            ref={inputRef}
            value={link}
            onChange={handleChange}
            placeholder="뉴스 링크를 붙여넣으세요"
            aria-label="뉴스 링크 입력"
            className="pl-11"
            disabled={isSubmitting}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 px-6 text-sm font-bold"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting && (
            <span
              aria-hidden
              className="size-4 animate-spin-slow rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
            />
          )}
          {isSubmitting ? '분석 중…' : '분석하기'}
        </Button>
      </div>
      {errorMessage && (
        <p className="mt-2 pl-1 text-left text-xs text-muted-foreground">{errorMessage}</p>
      )}
    </form>
  );
}
