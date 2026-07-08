import { NextResponse } from 'next/server';

import { recentAnalyses } from '@/lib/store';

// GET /api/analyses/recent  →  RecentAnalysis[] (최근 분석 내역)
export async function GET() {
  return NextResponse.json(await recentAnalyses());
}
