import { Card } from '@/components/ui/card';
import type { AnalysisResult, SignalGroup } from '@/lib/types';

/** 비율 도넛 — 정적 SVG (stroke-dasharray) */
function RatioDonut({ ratio, tone }: { ratio: number; tone: 'good' | 'warn' }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const color = tone === 'good' ? 'var(--positive)' : 'var(--negative)';
  return (
    <div className="relative size-20 shrink-0" aria-hidden>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(ratio / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">
        {ratio}%
      </span>
    </div>
  );
}

function SignalCard({ group, tone }: { group: SignalGroup; tone: 'good' | 'warn' }) {
  const isGood = tone === 'good';
  const rowBg = isGood ? 'bg-positive/7' : 'bg-negative/7';
  return (
    <Card
      className={`p-6 ${isGood ? 'border-positive/30 bg-positive/[0.04]' : 'border-negative/30 bg-negative/[0.04]'}`}
    >
      <div className="flex items-center gap-4">
        <RatioDonut ratio={group.ratio} tone={tone} />
        <div>
          <h3 className={`text-[15px] font-bold ${isGood ? 'text-positive' : 'text-negative'}`}>
            {isGood ? '좋은 신호' : '주의할 신호'}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-sub">{group.headline}</p>
        </div>
      </div>

      <h4 className="mt-5 text-xs font-bold text-muted-foreground">📰 관련 뉴스</h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {group.news.map((item) => (
          <li key={item.text} className={`rounded-sm px-3 py-2 text-[13px] text-ink-sub ${rowBg}`}>
            {item.text} <span className="text-muted-foreground">({item.source})</span>
          </li>
        ))}
      </ul>

      <h4 className="mt-4 text-xs font-bold text-muted-foreground">📄 증권사 리포트</h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {group.reports.map((item) => (
          <li key={item.text} className={`rounded-sm px-3 py-2 text-[13px] text-ink-sub ${rowBg}`}>
            <span className="font-medium text-foreground">{item.source}</span> {item.text}
          </li>
        ))}
      </ul>

      <div
        className={`mt-4 rounded-md border px-4 py-3 ${isGood ? 'border-positive/25' : 'border-negative/25'}`}
      >
        <p className="text-xs font-bold text-muted-foreground">
          🎤 {group.analyst.name} · {group.analyst.firm}
        </p>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-sub">{group.analyst.quote}</p>
      </div>
    </Card>
  );
}

/**
 * 전망 분석 섹션 (F-06) — 좋은 신호/주의할 신호 대칭 카드
 * 섹션 간격은 페이지 래퍼(gap-12)가 담당하므로 자체 마진을 두지 않는다.
 */
export function SignalSection({ result }: { result: AnalysisResult }) {
  return (
    <section aria-labelledby="signal-heading">
      <div className="flex items-baseline gap-3">
        <h2 id="signal-heading" className="text-lg font-bold">
          전망 분석
        </h2>
        <p className="text-xs text-muted-foreground">
          관련 뉴스·리포트 {result.reviewedCount}건을 AI가 종합했어요
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SignalCard group={result.goodSignal} tone="good" />
        <SignalCard group={result.warnSignal} tone="warn" />
      </div>
    </section>
  );
}
