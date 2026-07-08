'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { usePopularNews } from '@/lib/queries';

const NEWS_COUNT = 5;

/** 인기 뉴스 리스트 (F-03a · #15) */
export function PopularNews() {
  const { data, isPending, isError, refetch } = usePopularNews();

  if (isPending) {
    return (
      <ul className="flex flex-col gap-4">
        {Array.from({ length: NEWS_COUNT }).map((_, i) => (
          <li key={i}>
            <Card className="h-[104px] animate-pulse p-5" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-muted-foreground">인기 뉴스를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm font-bold text-primary hover:underline"
        >
          다시 시도
        </button>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {data.map((news) => (
        <li key={news.id}>
          {/* 뉴스 카드 클릭 → 원문 링크로 해당 뉴스 분석 시작 (AnalyzeForm과 동일한 경로) */}
          <Link
            href={`/analyzing?url=${encodeURIComponent(news.url ?? '')}`}
            className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${news.title} 분석 보기`}
          >
            <Card className="p-5 transition-colors group-hover:border-primary/40 group-hover:bg-surface-raised/60">
              <div className="flex items-center gap-2.5">
                <Badge tone={news.sectorTone}>{news.sector}</Badge>
                {news.subTag && <Badge tone="neutral">{news.subTag}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {news.source} · {news.publishedAt}
                </span>
              </div>
              <h3 className="mt-3 text-[15px] font-bold text-foreground">{news.title}</h3>
              <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">{news.summary}</p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
