import Link from 'next/link';

/** 전 페이지 공통 헤더 — 좌: 로고(클릭 시 메인 이동), 우: 라이브 상태 (DESIGN.md Components) */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="수혜주.com 홈으로"
        >
          <span className="relative flex size-6 items-center justify-center rounded-full border-2 border-primary">
            <span className="size-2 rounded-full bg-primary" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            수혜주<span className="text-primary">.com</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* 라이브 인디케이터 — 글로우 허용 지점 (DESIGN.md Elevation) */}
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-negative shadow-[0_0_6px_var(--negative)] animate-glow-pulse"
          />
          실시간 뉴스 영향력 분석
        </div>
      </div>
    </header>
  );
}
