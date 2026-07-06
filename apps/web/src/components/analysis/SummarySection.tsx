import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPct, getPctToneClass } from '@/lib/format';
import type { AnalysisResult } from '@/lib/types';

/** AI 요약 섹션 (F-05) — 요약 카드 + 핵심 키워드·관련 섹터 패널 */
export function SummarySection({ result }: { result: AnalysisResult }) {
  return (
    <section aria-labelledby="summary-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="red">{result.sector}</Badge>
        <Badge tone="neutral">{result.verdict}</Badge>
      </div>
      <h1
        id="summary-heading"
        className="mt-3 text-2xl font-extrabold tracking-tight text-balance md:text-3xl"
      >
        {result.title}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {result.source} · {result.publishedAt} · {result.desk}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* AI 요약 */}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-blue-bright">
              <span aria-hidden>✦</span> AI 요약
            </h2>
            {/* 원문 보기 — 새 탭으로 원문 이동 */}
            <Button
              variant="outline"
              size="sm"
              render={<a href={result.originUrl} target="_blank" rel="noreferrer" />}
            >
              원문 보기 ↗
            </Button>
          </div>
          <p className="mt-4 text-[13.5px] leading-7 text-ink-sub">{result.summary}</p>
        </Card>

        {/* 핵심 키워드 · 관련 섹터 */}
        <Card className="p-6">
          <h2 className="text-[13px] font-bold text-muted-foreground">핵심 키워드</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.keywords.map((keyword) => (
              <Badge key={keyword} tone="neutral">
                {keyword}
              </Badge>
            ))}
          </div>
          <h2 className="mt-6 text-[13px] font-bold text-muted-foreground">관련 섹터</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.relatedSectors.map((sector) => (
              <Badge key={sector.name} tone={sector.changePct >= 0 ? 'red' : 'green'}>
                {sector.name}
                <span className={`font-bold ${getPctToneClass(sector.changePct)}`}>
                  {formatPct(sector.changePct)}
                </span>
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
