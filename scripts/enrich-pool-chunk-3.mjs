#!/usr/bin/env node
/**
 * Enrich knowledge-graph pool staging chunk 3 (WICS sectors indices 54-78, ko sort).
 * Run: node scripts/enrich-pool-chunk-3.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_DIR = join(__dirname, '../apps/web/src/lib/knowledge-graph/data/pool');
const STAGING_DIR = join(POOL_DIR, 'staging');
const OUT_PATH = join(STAGING_DIR, 'chunk-3.json');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100;
const CHUNK_START = 54;
const CHUNK_END = 78; // inclusive
const COMPANIES_PER_SECTOR = { min: 3, max: 5 };
const NEWS_PER_SECTOR = { min: 2, max: 5 };

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
};

function readJson(rel) {
  return JSON.parse(readFileSync(join(POOL_DIR, rel), 'utf8'));
}

function loadEnv() {
  const paths = [join(__dirname, '../apps/web/.env.local'), join(__dirname, '../.env.local')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function slugifyWics(name) {
  return name
    .replace(/[,·\s()]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function companySlugFromCode(code) {
  return `kr${code}`;
}

function stripHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
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

function parseNaverDatetime(dt) {
  if (!/^\d{12,14}$/.test(dt)) return '';
  const y = dt.slice(0, 4);
  const mo = dt.slice(4, 6);
  const d = dt.slice(6, 8);
  return `${y}-${mo}-${d}`;
}

function toMonthDay(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchIndustryResponse() {
  return fetchJson(`${NAVER_STOCK_BASE}/industry?page=1&pageSize=${PAGE_SIZE}`);
}

async function fetchIndustryStocks(no, totalCount) {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchJson(`${NAVER_STOCK_BASE}/industry/${no}?page=${i + 1}&pageSize=${PAGE_SIZE}`),
    ),
  );
  return results.filter(Boolean).flatMap((d) => d.stocks ?? []);
}

async function resolveTicker(name, code, sosok) {
  const ac = await fetchJson(
    `https://ac.stock.naver.com/ac?target=stock&q=${encodeURIComponent(name)}`,
  );
  const hit = ac?.items?.find((i) => i.code === code && i.nationCode === 'KOR');
  if (hit?.typeCode === 'KOSDAQ') return `${code}.KQ`;
  if (hit?.typeCode === 'KOSPI') return `${code}.KS`;
  return sosok === '1' ? `${code}.KQ` : `${code}.KS`;
}

async function searchNaverNews(query, limit = 5) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret || !query.trim()) return [];

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
      url,
      source: pressLabel(url),
      date: toMonthDay(item.pubDate),
      id: `news-search-${Buffer.from(url).toString('base64url').slice(0, 16)}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchStockNews(code, limit = 5) {
  const data = await fetchJson(
    `https://m.stock.naver.com/api/news/stock/${code}?page=1&pageSize=${limit}`,
  );
  if (!Array.isArray(data)) return [];
  const items = data.flatMap((g) => g.items ?? []);
  return items.slice(0, limit).map((item) => ({
    title: stripHtml(item.titleFull || item.title),
    url:
      item.mobileNewsUrl ||
      `https://n.news.naver.com/mnews/article/${item.officeId}/${item.articleId}`,
    source: item.officeName ?? '',
    date: parseNaverDatetime(String(item.datetime ?? '')),
    id: `news-${item.officeId}-${item.articleId}`,
    stockCode: code,
  }));
}

async function main() {
  loadEnv();

  const sectorNodes = readJson('sector-nodes.json');
  const edgeNodes = readJson('edge-nodes.json');
  const companyNodes = readJson('company-nodes.json');
  const newsNodes = readJson('news-nodes.json');

  const existingCompanyByName = new Map(companyNodes.nodes.map((n) => [n.name, n]));
  const existingEdgeNodeIds = new Set(edgeNodes.nodes.map((n) => n.id));
  const existingCompanyIds = new Set(companyNodes.nodes.map((n) => n.id));
  const existingNewsIds = new Set(newsNodes.nodes.map((n) => n.id));
  const existingNewsUrls = new Set(
    newsNodes.nodes.flatMap((n) => (Array.isArray(n.props?.link) ? n.props.link : [])),
  );
  const sectorCompanyKeys = new Set(
    edgeNodes.nodes.map((n) => `${n.props?.sectorId}|${n.props?.companyName}`),
  );

  const sortedSectors = [...sectorNodes.nodes].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const chunkSectors = sortedSectors.slice(CHUNK_START, CHUNK_END + 1);

  console.log(`Chunk 3: ${chunkSectors.length} sectors (indices ${CHUNK_START}-${CHUNK_END})`);

  const industryData = await fetchIndustryResponse();
  if (!industryData?.groups) throw new Error('Failed to fetch Naver industry list');

  const industryByName = new Map(industryData.groups.map((g) => [g.name, g]));

  const result = {
    edgeNodes: [],
    edgeEdges: [],
    companyNodes: [],
    newsNodes: [],
    newsEdges: [],
  };

  const stagedNewsIds = new Set();
  const stagedUrls = new Set();
  const skipped = [];

  for (const sector of chunkSectors) {
    const wicsName = sector.name;
    const sectorId = sector.id;
    const industry = industryByName.get(wicsName);

    if (!industry) {
      skipped.push({ sector: wicsName, reason: 'not in Naver industry API' });
      continue;
    }

    console.log(`\nProcessing: ${wicsName} (no=${industry.no}, count=${industry.totalCount})`);

    const allStocks = await fetchIndustryStocks(industry.no, industry.totalCount);
    await sleep(150);

    if (allStocks.length === 0) {
      skipped.push({ sector: wicsName, reason: 'no stocks returned' });
      continue;
    }

    const byCap = [...allStocks].sort(
      (a, b) => (Number(b.marketValueRaw) || 0) - (Number(a.marketValueRaw) || 0),
    );

    const candidates = byCap.filter((s) => !sectorCompanyKeys.has(`${sectorId}|${s.stockName}`));
    const picks = candidates.slice(0, COMPANIES_PER_SECTOR.max);

    if (picks.length < COMPANIES_PER_SECTOR.min && allStocks.length >= COMPANIES_PER_SECTOR.min) {
      // If all top caps already exist, still try to add any missing members
      const fallback = byCap.filter((s) => !sectorCompanyKeys.has(`${sectorId}|${s.stockName}`));
      while (picks.length < COMPANIES_PER_SECTOR.min && fallback.length > picks.length) {
        picks.push(fallback[picks.length]);
      }
    }

    let companiesAdded = 0;
    const sectorStockCodes = [];

    for (const stock of picks) {
      const code = stock.itemCode;
      const name = stock.stockName;
      const compSlug = companySlugFromCode(code);
      const companyId = existingCompanyByName.get(name)?.id ?? `company-${compSlug}`;
      const edgeNodeId = `edgenode-${slugifyWics(wicsName)}-${compSlug}`;

      if (existingEdgeNodeIds.has(edgeNodeId)) continue;

      if (
        !existingCompanyIds.has(companyId) &&
        !result.companyNodes.some((n) => n.id === companyId)
      ) {
        const ticker = await resolveTicker(name, code, stock.sosok);
        await sleep(80);
        result.companyNodes.push({
          id: companyId,
          label: 'Company',
          name,
          props: { ticker },
        });
        existingCompanyIds.add(companyId);
      }

      result.edgeNodes.push({
        id: edgeNodeId,
        label: 'EdgeNode',
        name,
        props: {
          sectorId,
          sectorName: wicsName,
          companyId,
          companyName: name,
          newsIds: [],
          link: [],
          refs: [],
        },
      });
      existingEdgeNodeIds.add(edgeNodeId);
      sectorCompanyKeys.add(`${sectorId}|${name}`);

      result.edgeEdges.push(
        { source: sectorId, target: edgeNodeId, relation: 'includes', weight: 1 },
        { source: edgeNodeId, target: companyId, relation: 'includes', weight: 1 },
      );

      sectorStockCodes.push(code);
      companiesAdded++;
    }

    // News: Naver search API first, then stock news from top picks
    const newsArticles = [];
    const searchQueries = [`${wicsName} 업종`, `${wicsName} 주식`, wicsName];

    for (const q of searchQueries) {
      if (newsArticles.length >= NEWS_PER_SECTOR.max) break;
      const found = await searchNaverNews(q, NEWS_PER_SECTOR.max);
      await sleep(100);
      for (const a of found) {
        if (newsArticles.length >= NEWS_PER_SECTOR.max) break;
        if (stagedUrls.has(a.url) || existingNewsUrls.has(a.url)) continue;
        newsArticles.push(a);
        stagedUrls.add(a.url);
      }
    }

    for (const code of sectorStockCodes.slice(0, 3)) {
      if (newsArticles.length >= NEWS_PER_SECTOR.max) break;
      const stockNews = await fetchStockNews(code, 3);
      await sleep(100);
      for (const a of stockNews) {
        if (newsArticles.length >= NEWS_PER_SECTOR.max) break;
        if (stagedUrls.has(a.url) || existingNewsUrls.has(a.url)) continue;
        newsArticles.push(a);
        stagedUrls.add(a.url);
      }
    }

    for (const article of newsArticles.slice(0, NEWS_PER_SECTOR.max)) {
      let newsId = article.id;
      if (existingNewsIds.has(newsId) || stagedNewsIds.has(newsId)) {
        newsId = `news-chunk3-${Buffer.from(article.url).toString('base64url').slice(0, 12)}`;
      }
      if (existingNewsIds.has(newsId) || stagedNewsIds.has(newsId)) continue;

      stagedNewsIds.add(newsId);
      result.newsNodes.push({
        id: newsId,
        label: 'News',
        name: article.title,
        props: {
          date: article.date || undefined,
          source: article.source || undefined,
          link: [article.url],
        },
      });

      result.newsEdges.push({
        source: newsId,
        target: sectorId,
        relation: 'mentions',
        weight: 0.9,
      });

      // Link to companies mentioned in title
      for (const stock of picks) {
        if (article.title.includes(stock.stockName)) {
          const compSlug = companySlugFromCode(stock.itemCode);
          const companyId = existingCompanyByName.get(stock.stockName)?.id ?? `company-${compSlug}`;
          result.newsEdges.push({
            source: newsId,
            target: companyId,
            relation: 'mentions',
            weight: 0.82,
          });
        }
      }
    }

    const newsAdded = Math.min(newsArticles.length, NEWS_PER_SECTOR.max);
    console.log(`  +${companiesAdded} companies, +${newsAdded} news`);

    if (companiesAdded === 0 && newsAdded < NEWS_PER_SECTOR.min) {
      skipped.push({
        sector: wicsName,
        reason: `insufficient new data (companies=${companiesAdded}, news=${newsAdded})`,
      });
    }
  }

  mkdirSync(STAGING_DIR, { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const summary = {
    path: OUT_PATH,
    sectorsProcessed: chunkSectors.length,
    counts: {
      companyNodes: result.companyNodes.length,
      edgeNodes: result.edgeNodes.length,
      edgeEdges: result.edgeEdges.length,
      newsNodes: result.newsNodes.length,
      newsEdges: result.newsEdges.length,
    },
    skippedSectors: skipped,
    naverSearchEnabled: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
  };

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
