import { AnalyzeForm } from '@/components/main/AnalyzeForm';
import { MyRecentAnalyses } from '@/components/main/MyRecentAnalyses';
import { PopularNews } from '@/components/main/PopularNews';
import { RecentAnalyses } from '@/components/main/RecentAnalyses';
import { SectorOverview } from '@/components/main/SectorOverview';
import { ParticleField } from '@/components/ParticleField';

/**
 * 메인 페이지 (PAGE-1 · #30)
 * 링크 입력(F-01/F-02) + 인기 뉴스(F-03a) + 주요 섹터 현황(F-03b) + 최근 분석 내역(F-03c)
 */
export default function HomePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pb-24">
      <ParticleField />

      {/* 히어로 + 링크 입력 */}
      <section className="flex flex-col items-center gap-6 pt-24 pb-16 text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-bright uppercase">
          AI News Impact Analysis
        </p>
        <h1 className="animate-fade-up text-4xl leading-snug font-extrabold tracking-tight text-balance md:text-5xl">
          뉴스 한 건이 시장에 만드는
          <br />
          파장을 추적하세요
        </h1>
        <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">
          링크를 입력하면 AI가 핵심 키워드와 관련 산업을 추출하고,
          <br className="hidden md:block" />
          섹터별 영향도 히트맵과 1·2·3차 파급 경로를 그려드립니다.
        </p>
        <AnalyzeForm />
      </section>

      {/* 인기 뉴스 + 우측 현황 */}
      <section className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          <h2 className="mb-4 text-lg font-bold">🔥 인기 뉴스</h2>
          <PopularNews />
        </div>

        <div className="flex flex-col gap-10">
          {/* 주요 섹터 현황 */}
          <div>
            <h2 className="mb-4 text-lg font-bold">주요 섹터 현황</h2>
            <SectorOverview />
          </div>

          <MyRecentAnalyses />

          <RecentAnalyses />
        </div>
      </section>
    </main>
  );
}
