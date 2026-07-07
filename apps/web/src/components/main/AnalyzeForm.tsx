'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * 뉴스 링크 입력 폼 (F-01 · F-02)
 * 제출(버튼 클릭 / Enter) 시 분석을 시작하고 로딩 화면으로 이동한다.
 * FE 연동 지점: POST /api/analysis 호출 후 반환된 id로 /analyzing?id=... 이동.
 */
export function AnalyzeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = link.trim();
    if (!value) {
      // 빈 입력 제출 → 입력창으로 포커스 복귀
      inputRef.current?.focus();
      return;
    }
    router.push('/analyzing');
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
            onChange={(event) => setLink(event.target.value)}
            placeholder="뉴스·블로그 등 웹 링크를 붙여넣으세요"
            aria-label="뉴스 링크 입력"
            className="pl-11"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-6 text-sm font-bold">
          분석하기
        </Button>
      </div>
    </form>
  );
}
