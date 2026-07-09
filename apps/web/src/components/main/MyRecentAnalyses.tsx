'use client';

import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { formatRelativeDateTime } from '@/lib/format';
import { touchLocalAnalysis, useLocalAnalyses } from '@/lib/local-analyses';

/** 브라우저 localStorage에 저장된 개인 최근 분석 목록. */
export function MyRecentAnalyses() {
  const { items, isLoaded } = useLocalAnalyses();

  if (!isLoaded || !items.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">최근 내 분석 뉴스</h2>
      <Card className="divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/analysis/${item.id}`}
            onClick={() => touchLocalAnalysis(item.id)}
            className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-surface-raised/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate text-[13.5px] font-medium text-ink-sub">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeDateTime(item.lastOpenedAt ?? item.analyzedAt)}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
