'use client';

import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { useRecentAnalyses } from '@/lib/queries';

/** 최근 분석 내역 (F-03c) — API에 저장된 항목이 없으면 섹션 자체를 비운다. */
export function RecentAnalyses() {
  const { data, isError } = useRecentAnalyses();

  if (isError || !data?.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>🕐</span> 최근 분석 내역
      </h2>
      <Card className="divide-y divide-border">
        {data.map((item) => (
          <Link
            key={item.id}
            href={`/analysis/${item.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-surface-raised/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate text-[13.5px] font-medium text-ink-sub">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(item.analyzedAt)}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
