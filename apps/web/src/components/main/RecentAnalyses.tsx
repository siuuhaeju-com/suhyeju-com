'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { sortAnalysesByNewest } from '@/lib/analysis-time';
import { formatRelativeDateTime } from '@/lib/format';
import { normalizeLocalOriginUrl, useLocalAnalyses } from '@/lib/local-analyses';
import { useRecentAnalyses } from '@/lib/queries';

const COMMUNITY_ANALYSES_LIMIT = 5;

/** 전체 사용자가 분석한 최근 뉴스. 내 localStorage 항목은 제외해서 개인 목록과 분리한다. */
export function RecentAnalyses() {
  const { data, isError } = useRecentAnalyses();
  const { items: myAnalyses, isLoaded } = useLocalAnalyses();

  const myAnalysisKeys = useMemo(() => {
    return {
      ids: new Set(myAnalyses.map((item) => item.id)),
      originUrls: new Set(
        myAnalyses
          .map((item) => normalizeLocalOriginUrl(item.originUrl))
          .filter((originUrl): originUrl is string => originUrl !== null),
      ),
    };
  }, [myAnalyses]);

  const communityAnalyses = useMemo(() => {
    return sortAnalysesByNewest(data ?? [])
      .filter((item) => {
        const originUrl = normalizeLocalOriginUrl(item.originUrl);
        return (
          !myAnalysisKeys.ids.has(item.id) &&
          (originUrl === null || !myAnalysisKeys.originUrls.has(originUrl))
        );
      })
      .slice(0, COMMUNITY_ANALYSES_LIMIT);
  }, [data, myAnalysisKeys]);

  if (!isLoaded || isError || !communityAnalyses.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">다른 사람들은 이 뉴스를 분석했어요!</h2>
      <Card className="divide-y divide-border">
        {communityAnalyses.map((item) => (
          <Link
            key={item.id}
            href={`/analysis/${item.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-surface-raised/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate text-[13.5px] font-medium text-ink-sub">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeDateTime(item.analyzedAt)}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
