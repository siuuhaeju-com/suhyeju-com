/**
 * 뉴스 URL → 본문 텍스트 추출 (analyze 파이프라인 ①단계).
 *
 * 1순위: 알려진 도메인은 cheerio + 셀렉터로 직접 파싱.
 *   - 네이버가 모든 제휴 언론사를 n.news.naver.com 템플릿으로 감싸므로
 *     `#dic_area` 하나로 사실상 모든 한국 언론사 기사를 커버한다.
 * 2순위: 모르는 도메인은 @extractus/article-extractor (Readability 기반).
 * 실패 시 null → 프론트에서 "본문 직접 붙여넣기"로 유도.
 *
 * ⚠️ 저작권: 네이버/언론사는 AI 학습·RAG 목적 스크래핑을 약관으로 금지한다.
 *    추출 본문은 요청 처리 중에만 쓰고 절대 영구 저장하지 않는다.
 *    (그래서 사용자 본문 붙여넣기를 1차 입력으로 권장)
 */
import * as cheerio from 'cheerio';
import { extract } from '@extractus/article-extractor';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 알려진 도메인의 본문 셀렉터 (실측 검증됨)
const DOMAIN_SELECTORS: Record<string, string> = {
  'n.news.naver.com': '#dic_area',
  'news.naver.com': '#dic_area',
  'www.hankyung.com': '.article-body',
  'www.mk.co.kr': '.news_cnt_detail_wrap',
};

export interface ExtractedArticle {
  text: string;
  title: string;
  /** 발행처 (og:site_name 등). 없으면 '' */
  source: string;
  /** 발행시각 (ISO). 없으면 '' */
  publishedAt: string;
  /** 추출 경로 (디버깅용) */
  via: 'selector' | 'readability';
}

/** og/article 메타에서 발행처·발행시각을 뽑는다(없으면 빈 문자열). */
function readMeta($: cheerio.CheerioAPI): { source: string; publishedAt: string } {
  const publishedAt =
    $('meta[property="article:published_time"]').attr('content') ??
    $('meta[property="og:regDate"]').attr('content') ??
    // 네이버 뉴스 템플릿은 발행시각을 meta가 아니라 본문 상단 span의 data 속성에 담는다
    // (예: <span class="_ARTICLE_DATE_TIME" data-date-time="2026-07-10 16:04:31">)
    $('span._ARTICLE_DATE_TIME').attr('data-date-time') ??
    '';
  const source = $('meta[property="og:site_name"]').attr('content') ?? '';
  return { source: source.trim(), publishedAt: normalizePublishedAt(publishedAt.trim()) };
}

/**
 * 'YYYY-MM-DD HH:mm(:ss)' 표기를 ISO(KST +09:00)로 정규화한다 — 네이버 발행시각은 KST.
 * 이미 ISO거나 다른 표기면 그대로 둔다(FE formatDateTime이 ISO만 포맷).
 */
function normalizePublishedAt(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/);
  return match ? `${match[1]}T${match[2]}+09:00` : value;
}

const MIN_LENGTH = 200; // 이보다 짧으면 추출 실패로 간주

/** 뉴스 URL에서 본문을 추출한다. 실패 시 null. */
export async function extractArticle(url: string): Promise<ExtractedArticle | null> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null; // 잘못된 URL
  }

  // 1) 알려진 도메인 → cheerio 직접 파싱 (가장 빠르고 깨끗함)
  const selector = DOMAIN_SELECTORS[host];
  if (selector) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const $ = cheerio.load(await res.text());
        $(selector).find('script, style').remove();
        const text = $(selector).text().replace(/\s+/g, ' ').trim();
        if (text.length > MIN_LENGTH) {
          return {
            text,
            title: $('title').text().trim(),
            ...readMeta($),
            via: 'selector',
          };
        }
      }
    } catch {
      // 폴백으로 넘어간다
    }
  }

  // 2) 범용 폴백 (Readability 기반) — 모르는 도메인/1단계 실패 시
  try {
    const article = await extract(url, {}, { headers: { 'User-Agent': BROWSER_UA } });
    const text = (article?.content ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > MIN_LENGTH) {
      return {
        text,
        title: article?.title ?? '',
        source: article?.source ?? host,
        publishedAt: article?.published ?? '',
        via: 'readability',
      };
    }
  } catch {
    // 최종 실패
  }

  return null; // → 프론트: 본문 붙여넣기 유도
}
