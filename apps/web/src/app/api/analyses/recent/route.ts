import { NextResponse } from 'next/server';

import { recentAnalyses } from '@/lib/store';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// GET /api/analyses/recent  →  RecentAnalysis[] (최근 분석 내역)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  return NextResponse.json(await recentAnalyses(limit), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
