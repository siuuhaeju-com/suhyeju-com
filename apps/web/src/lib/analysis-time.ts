import type { RecentAnalysis } from '@/lib/types';

type AnalysisTimestamp = Pick<RecentAnalysis, 'analyzedAt'>;

function getAnalysisTime(item: AnalysisTimestamp): number {
  const time = Date.parse(item.analyzedAt);
  return Number.isNaN(time) ? 0 : time;
}

export function sortAnalysesByNewest<T extends AnalysisTimestamp>(items: T[]): T[] {
  return [...items].sort((a, b) => getAnalysisTime(b) - getAnalysisTime(a));
}
