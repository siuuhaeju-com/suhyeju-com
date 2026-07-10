#!/usr/bin/env node
/**
 * Enrich knowledge-graph pool chunk 2 (WICS sectors indices 27-53, ko sort).
 * Run: node scripts/enrich-pool-chunk-2.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_DIR = join(__dirname, '../apps/web/src/lib/knowledge-graph/data/pool');
const STAGING_DIR = join(POOL_DIR, 'staging');
const OUT_PATH = join(STAGING_DIR, 'chunk-2.json');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100;

const PRESS_BY_DOMAIN = {
  'hankyung.com': '한국경제',
  'mk.co.kr': '매일경제',
  'sedaily.com': '서울경제',
  'edaily.co.kr': '이데일리',
  'etnews.com': '전자신문',
  'yna.co.kr': '연합뉴스',
  'einfomax.co.kr': '연합인포맥스',
  'mt.co.kr': '머니투데이',
  'fnnews.com': '파이낸셜뉴스',
  'chosun.com': '조선일보',
  'joongang.co.kr': '중앙일보',
  'hani.co.kr': '한겨레',
  'heraldcorp.com': '헤럴드경제',
  'asiae.co.kr': '아시아경제',
  'newsis.com': '뉴시스',
  'news1.kr': '뉴스1',
  'zdnet.co.kr': '지디넷코리아',
  'ddaily.co.kr': '디지털데일리',
  'thebell.co.kr': '더벨',
  'donga.com': '동아일보',
  'hankookilbo.com': '한국일보',
};

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(join(__dirname, '../.env.local'));
loadEnvFile(join(__dirname, '../apps/web/.env.local'));

function readJson(name) {
  return JSON.parse(readFileSync(join(POOL_DIR, name), 'utf8'));
}

function slugifyWics(name) {
  return name
    .replace(/[,·\s()]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function companySlug(name, code) {
  const ascii = name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (ascii.length >= 2) return ascii.slice(0, 24);
  return code;
}

function stripHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function pressLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^(www|news|biz|m)\./, '');
    return PRESS_BY_DOMAIN[host] ?? host;
  } catch {
    return '';
  }
}

function toIsoDate(input) {
  if (/^\d{14}$/.test(input)) {
    const y = input.slice(0, 4);
    const mo = input.slice(4, 6);
    const d = input.slice(6, 8);
    return `${y}-${mo}-${d}`;
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '2026-07-10';
  return d.toISOString().slice(0, 10);
}

function tickerSuffix(exchangeCode) {
  return exchangeCode === 'KQ' ? 'KQ' : 'KS';
}

async function fetchIndustryResponse() {
  const res = await fetch(`${NAVER_STOCK_BASE}/industry?page=1&pageSize=${PAGE_SIZE}`, {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`Naver industry API ${res.status}`);
  return res.json();
}

async function fetchIndustryStocks(no, totalCount) {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetch(`${NAVER_STOCK_BASE}/industry/${no}?page=${i + 1}&pageSize=${PAGE_SIZE}`, {
        headers: { 'User-Agent': BROWSER_UA },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  );
  return results.filter(Boolean).flatMap((d) => d.stocks ?? []);
}

async function searchNaverNews(query, limit = 5) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret || !query.trim()) return [];

  try {
    const params = new URLSearchParams({ query: query.trim(), display: '10', sort: 'sim' });
    const res = await fetch(`https://openapi.naver.com/v1/search/news.json?${params}`, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const seen = new Set();
    const out = [];
    for (const item of data.items ?? []) {
      const url = item.originallink || item.link;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({
        title: stripHtml(item.title),
        source: pressLabel(url),
        url,
        date: toIsoDate(item.pubDate),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchStockNews(code, limit = 3) {
  try {
    const res = await fetch(
      `https://api.stock.naver.com/news/stock/${code}?page=1&pageSize=${limit}`,
      { headers: { 'User-Agent': BROWSER_UA } },
    );
    if (!res.ok) return [];
    const groups = await res.json();
    const out = [];
    for (const group of groups) {
      for (const item of group.items ?? []) {
        const url =
          item.mobileNewsUrl ||
          (item.officeId && item.articleId
            ? `https://n.news.naver.com/mnews/article/${item.officeId}/${item.articleId}`
            : '');
        if (!url) continue;
        out.push({
          title: stripHtml(item.titleFull || item.title),
          source: item.officeName || '네이버뉴스',
          url,
          date: toIsoDate(item.datetime),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function newsQueryForSector(name) {
  const cleaned = name.replace(/,/g, ' ');
  return `${cleaned} 업종 주식`;
}

async function collectSectorNews(sectorName, stocks, minCount = 2, maxCount = 5) {
  const seen = new Set();
  const collected = [];

  const queries = [newsQueryForSector(sectorName), `${sectorName.replace(/,/g, ' ')} 주가`];
  for (const q of queries) {
    const hits = await searchNaverNews(q, maxCount);
    for (const hit of hits) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      collected.push(hit);
      if (collected.length >= maxCount) return collected;
    }
  }

  for (const stock of stocks.slice(0, 5)) {
    const hits = await fetchStockNews(stock.itemCode, 3);
    for (const hit of hits) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      collected.push(hit);
      if (collected.length >= maxCount) return collected;
    }
  }

  return collected.length >= minCount ? collected : collected;
}

async function main() {
  const sectorNodes = readJson('sector-nodes.json');
  const companyNodes = readJson('company-nodes.json');
  const edgeNodes = readJson('edge-nodes.json');
  const newsNodes = readJson('news-nodes.json');

  const sortedSectors = [...sectorNodes.nodes].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const chunkSectors = sortedSectors.slice(27, 54);

  const existingCompanyByName = new Map(companyNodes.nodes.map((n) => [n.name, n]));
  const existingCompanyIds = new Set(companyNodes.nodes.map((n) => n.id));
  const existingEdgeIds = new Set(edgeNodes.nodes.map((n) => n.id));
  const existingSectorCompany = new Set(
    edgeNodes.nodes.map((n) => `${n.props?.sectorName}|${n.props?.companyName}`),
  );
  const existingNewsUrls = new Set(newsNodes.nodes.flatMap((n) => n.props?.link ?? []));
  let nextNewsNum =
    Math.max(0, ...newsNodes.nodes.map((n) => Number(n.id.replace('news-', '')) || 0)) + 1;

  console.log('Fetching Naver WICS industry data...');
  const industryData = await fetchIndustryResponse();
  const industryByName = new Map(industryData.groups.map((g) => [g.name, g]));

  const out = {
    edgeNodes: [],
    edgeEdges: [],
    companyNodes: [],
    newsNodes: [],
    newsEdges: [],
  };

  const skipped = [];
  const stats = { sectors: 0, companies: 0, news: 0 };

  for (const sector of chunkSectors) {
    const sectorName = sector.name;
    const sectorId = sector.id;
    const group = industryByName.get(sectorName);

    if (!group) {
      skipped.push({ sector: sectorName, reason: 'no Naver industry mapping' });
      continue;
    }

    const allStocks = await fetchIndustryStocks(group.no, group.totalCount);
    const topStocks = allStocks
      .map((s) => ({
        itemCode: s.itemCode,
        stockName: s.stockName,
        marketCap: Number(s.marketValueRaw) || 0,
        exchange: s.stockExchangeType?.code ?? 'KS',
      }))
      .sort((a, b) => b.marketCap - a.marketCap);

    const newStocks = [];
    for (const stock of topStocks) {
      const key = `${sectorName}|${stock.stockName}`;
      if (existingSectorCompany.has(key)) continue;
      newStocks.push(stock);
      if (newStocks.length >= 5) break;
    }

    if (newStocks.length < 3) {
      skipped.push({
        sector: sectorName,
        reason: `insufficient new stocks (${newStocks.length}/3)`,
      });
    }

    const sectorNews = await collectSectorNews(sectorName, topStocks, 2, 5);
    if (sectorNews.length < 2) {
      skipped.push({
        sector: sectorName,
        reason: `insufficient news (${sectorNews.length}/2)`,
      });
    }

    const sectorNewsIds = [];

    for (const article of sectorNews) {
      if (existingNewsUrls.has(article.url)) continue;

      const newsId = `news-${nextNewsNum++}`;
      existingNewsUrls.add(article.url);
      sectorNewsIds.push(newsId);

      out.newsNodes.push({
        id: newsId,
        label: 'News',
        name: article.title,
        props: {
          date: article.date,
          source: article.source,
          link: [article.url],
        },
      });

      out.newsEdges.push({
        source: newsId,
        target: sectorId,
        relation: 'mentions',
        weight: 0.9,
      });
      stats.news++;
    }

    for (const stock of newStocks.slice(0, 5)) {
      const compSlug = companySlug(stock.stockName, stock.itemCode);
      let companyId = `company-${compSlug}`;
      if (existingCompanyIds.has(companyId)) {
        let i = 2;
        while (existingCompanyIds.has(`${companyId}-${i}`)) i++;
        companyId = `${companyId}-${i}`;
      }

      const wicsSlug = slugifyWics(sectorName);
      const edgeId = `edgenode-${wicsSlug}-${compSlug}`;
      if (existingEdgeIds.has(edgeId)) continue;

      if (!existingCompanyByName.has(stock.stockName)) {
        out.companyNodes.push({
          id: companyId,
          label: 'Company',
          name: stock.stockName,
          props: {
            ticker: `${stock.itemCode}.${tickerSuffix(stock.exchange)}`,
          },
        });
        existingCompanyByName.set(stock.stockName, { id: companyId, name: stock.stockName });
        existingCompanyIds.add(companyId);
        stats.companies++;
      } else {
        companyId = existingCompanyByName.get(stock.stockName).id;
      }

      out.edgeNodes.push({
        id: edgeId,
        label: 'EdgeNode',
        name: stock.stockName,
        props: {
          sectorId,
          sectorName,
          companyId,
          companyName: stock.stockName,
          newsIds: sectorNewsIds.slice(0, 3),
          link: sectorNews.slice(0, 3).map((n) => n.url),
          refs: sectorNews.slice(0, 3).map((n) => ({
            url: n.url,
            title: n.title.slice(0, 80),
            publisher: n.source,
          })),
        },
      });
      existingEdgeIds.add(edgeId);
      existingSectorCompany.add(`${sectorName}|${stock.stockName}`);

      out.edgeEdges.push(
        { source: sectorId, target: edgeId, relation: 'includes', weight: 1 },
        { source: edgeId, target: companyId, relation: 'includes', weight: 1 },
      );
    }

    stats.sectors++;
    console.log(
      `  ${sectorName}: +${Math.min(newStocks.length, 5)} companies, +${sectorNewsIds.length} news`,
    );

    await new Promise((r) => setTimeout(r, 150));
  }

  mkdirSync(STAGING_DIR, { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log('\n--- Summary ---');
  console.log(`Path: ${OUT_PATH}`);
  console.log(`edgeNodes: ${out.edgeNodes.length}`);
  console.log(`edgeEdges: ${out.edgeEdges.length}`);
  console.log(`companyNodes: ${out.companyNodes.length}`);
  console.log(`newsNodes: ${out.newsNodes.length}`);
  console.log(`newsEdges: ${out.newsEdges.length}`);
  if (skipped.length) {
    console.log('\nSkipped / partial sectors:');
    for (const s of skipped) console.log(`  - ${s.sector}: ${s.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
