import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">메인 페이지</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">수혜주.com</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          뉴스 링크를 입력하면 산업 파급 경로와 수혜 섹터를 분석하는 프론트엔드 진입 화면입니다.
        </p>
      </section>

      <nav className="flex flex-wrap gap-3">
        <Link href="/analyzing" className={buttonVariants({ variant: 'outline' })}>
          로딩 화면 보기
        </Link>
        <Link href="/analysis/demo" className={buttonVariants()}>
          분석 결과 보기
        </Link>
      </nav>
    </main>
  );
}
