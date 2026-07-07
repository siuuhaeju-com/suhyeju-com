'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidNewsLink } from '@/lib/link';

// 본문 수집 연출 지연 (SETUP-05 연동 전 임시)
const MOCK_FETCH_DELAY_MS = 600;

/**
 * 뉴스 링크 입력 폼 (F-01 · F-02)
 * 제출(버튼 클릭 / Enter) 시 분석을 시작하고 로딩 화면으로 이동한다.
 * FE 연동 지점: POST /api/analysis(SETUP-05) 호출 후 반환된 id로 /analyzing?id=... 이동.
 * 현재는 API 미연동 상태라 지연으로 "본문 가져오는 중" 상태만 재현한다.
 */
export function AnalyzeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      inputRef.current?.focus();
      return;
    }
    if (!isValidNewsLink(value)) {
      setErrorMessage('http(s)://로 시작하는 올바른 링크를 입력해주세요');
      inputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    window.setTimeout(() => router.push('/analyzing'), MOCK_FETCH_DELAY_MS);
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
            placeholder="뉴스·블로그 등 웹 링크를 붙여넣으세요"
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
