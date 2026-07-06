export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">로딩 중</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        화면을 준비하고 있습니다
      </h1>
    </main>
  );
}
