type AnalysisPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">분석 페이지</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">분석 결과</h1>
        <p className="text-base leading-7 text-muted-foreground">
          분석 ID <span className="font-medium text-foreground">{id}</span>에 대한 결과 화면
          골격입니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">요약 카드</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            뉴스 요약과 호재/악재 판단 영역입니다.
          </p>
        </div>
        <div className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">파급 경로</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            1차, 2차, 3차 산업 연결 그래프 영역입니다.
          </p>
        </div>
        <div className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">영향도 히트맵</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            긍정은 레드, 부정은 그린으로 표시할 영역입니다.
          </p>
        </div>
      </section>
    </main>
  );
}
