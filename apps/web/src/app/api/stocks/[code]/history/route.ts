import { NextResponse } from 'next/server';

import type { StockPricePoint } from '@/lib/types';

/**
 * GET /api/stocks/:code/history?market=KR|US&start=YYYYMMDD&end=YYYYMMDD
 * → 일봉 종가 시계열 StockPricePoint[] (F-16 주가 추이 차트)
 *
 * 소스: 네이버 금융 비공식 차트 API (2026-07 직접 검증, 한국·미국 동일 포맷 JSON)
 *   한국 → api.stock.naver.com/chart/domestic/item/{6자리코드}/day
 *   미국 → api.stock.naver.com/chart/foreign/item/{reutersCode}/day (NVDA.O 등)
 * code·market은 analyze 시세 join(#49)이 TopStock에 채운 값을 그대로 쓴다.
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/** 네이버 차트 API 일봉 한 행 (필요한 필드만) */
interface NaverDailyCandle {
  localDate: string; // YYYYMMDD
  closePrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
}

const CODE_PATTERN = /^[A-Za-z0-9.]{1,12}$/; // 한국 6자리 숫자 · 미국 reutersCode(NVDA.O, AFL 등)
const DATE_PATTERN = /^\d{8}$/;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') === 'US' ? 'US' : 'KR';
  const start = searchParams.get('start') ?? '';
  const end = searchParams.get('end') ?? '';

  if (!CODE_PATTERN.test(code) || !DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다 (code, start/end=YYYYMMDD)' },
      { status: 400 },
    );
  }

  // startDateTime/endDateTime은 YYYYMMDDHH — 시(HH)는 00으로 고정
  const url =
    `https://api.stock.naver.com/chart/${market === 'KR' ? 'domestic' : 'foreign'}` +
    `/item/${encodeURIComponent(code)}/day?startDateTime=${start}00&endDateTime=${end}00`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 3600 }, // 일봉 과거 데이터는 하루 단위로만 변한다 → 1시간 캐시
  });
  if (!res.ok) {
    return NextResponse.json({ error: '시세 조회에 실패했습니다' }, { status: 502 });
  }

  const candles = (await res.json()) as NaverDailyCandle[];
  if (!Array.isArray(candles)) {
    return NextResponse.json({ error: '시세 응답 형식이 올바르지 않습니다' }, { status: 502 });
  }

  const points: StockPricePoint[] = candles
    .filter((c) => DATE_PATTERN.test(c.localDate ?? '') && Number.isFinite(c.closePrice))
    .map((c) => ({
      date: `${c.localDate.slice(0, 4)}-${c.localDate.slice(4, 6)}-${c.localDate.slice(6, 8)}`,
      // 시/고/저는 hover 상세용 — 혹시 빠진 행은 종가로 대체(차트 라인은 종가 기준)
      open: Number.isFinite(c.openPrice) ? c.openPrice : c.closePrice,
      high: Number.isFinite(c.highPrice) ? c.highPrice : c.closePrice,
      low: Number.isFinite(c.lowPrice) ? c.lowPrice : c.closePrice,
      close: c.closePrice,
    }));

  return NextResponse.json(points);
}
