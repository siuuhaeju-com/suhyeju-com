import { NextResponse } from 'next/server';

import { classifyNewsSector, getSectorTone } from '@/lib/gics-sectors';
import { fetchRankNews } from '@/lib/sources/naver-news';
import {
  classifyByStockNames,
  fetchStockNameToSectorInfo,
  type StockSectorInfo,
} from '@/lib/sources/naver';
import type { NewsItem } from '@/lib/types';

// 인기 뉴스 API (#15·#53) — 네이버 증권 '많이 본 뉴스'(ranknews)에 종목명·키워드 기반
// 섹터 자동 분류(#15)를 적용한다. 응답 형태는 lib/types.ts 의 NewsItem 과 맞춘다.

const DEFAULT_SECTOR = '증시';

export async function GET() {
  try {
    // 종목명 매칭을 우선으로 섹터를 추정한다. 실패해도 뉴스 자체는 보여줘야 하므로
    // 종목 데이터 조회 실패는 무시하고 빈 맵(→ 키워드/기본값 폴백)으로 넘어간다.
    const [articles, stockNameToSector] = await Promise.all([
      fetchRankNews(5),
      fetchStockNameToSectorInfo().catch(() => new Map<string, StockSectorInfo>()),
    ]);
    const sortedStockNames = [...stockNameToSector.keys()].sort((a, b) => b.length - a.length);

    const news: NewsItem[] = articles.map((article) => {
      const text = `${article.title} ${article.summary}`;

      // 1) 실제 종목명 언급 → 2) 주제 키워드 → 3) 기본값(증시) 순으로 섹터 추정.
      // subTag(보조 태그)는 종목명 매칭 시 WICS 소분류, 키워드 매칭 시 그 키워드 자체.
      const stockMatch = classifyByStockNames(text, sortedStockNames, stockNameToSector);
      const keywordMatch = stockMatch ? null : classifyNewsSector(text);
      const sector = stockMatch?.gicsSector ?? keywordMatch?.sector ?? DEFAULT_SECTOR;

      return {
        ...article,
        sector,
        subTag: stockMatch?.wicsSector ?? keywordMatch?.keyword,
        sectorTone: getSectorTone(sector),
      };
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error('[api/news]', error);
    return NextResponse.json({ error: '인기 뉴스를 불러오지 못했습니다.' }, { status: 502 });
  }
}
