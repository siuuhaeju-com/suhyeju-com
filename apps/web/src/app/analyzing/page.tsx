const ANALYSIS_STEPS = [
  '뉴스를 읽고 있어요',
  '핵심 이슈를 파악하는 중이에요',
  '호재와 악재 의견을 비교하고 있어요',
  '섹터 영향 그래프를 준비하고 있어요',
];

export default function AnalyzingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">로딩 페이지</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          분석을 준비하고 있습니다
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          입력한 뉴스의 산업 파급 경로를 단계별로 분석하는 화면입니다.
        </p>
      </section>

      <ol className="flex flex-col gap-3">
        {ANALYSIS_STEPS.map((step, index) => (
          <li
            className="rounded-md border bg-background px-4 py-3 text-sm text-foreground"
            key={step}
          >
            {index + 1}. {step}
          </li>
        ))}
      </ol>
    </main>
  );
}
