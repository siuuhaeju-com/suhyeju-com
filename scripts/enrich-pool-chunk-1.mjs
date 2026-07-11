#!/usr/bin/env node
/**
 * Issue #83 — Enrich WICS sector pool chunk 1 (sectors 0–26 by ko name).
 * Run: node scripts/enrich-pool-chunk-1.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_DIR = join(__dirname, '../apps/web/src/lib/knowledge-graph/data/pool');
const OUT_PATH = join(POOL_DIR, 'staging/chunk-1.json');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100;
const COMPANIES_PER_SECTOR = 5;
const NEWS_PER_SECTOR = 5;

function readJson(name) {
  return JSON.parse(readFileSync(join(POOL_DIR, name), 'utf8'));
}

function sectorSlugFromId(sectorId) {
  return sectorId.replace(/^sector-/, '');
}

function companySlugFromCode(itemCode) {
  return itemCode;
}

function parseDate(dt) {
  if (!dt) return new Date().toISOString().slice(0, 10);
  const s = String(dt);
  if (/^\d{14}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{8}/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
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

async function fetchStockNews(itemCode, pageSize = 5) {
  const data = await fetchJson(
    `https://api.stock.naver.com/news/stock/${itemCode}?pageSize=${pageSize}&page=1`,
  );
  if (!Array.isArray(data)) return [];
  return data.flatMap((group) => group.items ?? []);
}

async function fetchNewsList(pageSize = 50) {
  const data = await fetchJson(
    `https://m.stock.naver.com/api/news/list?pageSize=${pageSize}&page=1`,
  );
  return Array.isArray(data) ? data : [];
}

async function fetchRankNews() {
  const data = await fetchJson('https://api.stock.naver.com/news/ranknews');
  return Array.isArray(data) ? data : [];
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
        source: '',
        url,
        date: parseDate(item.pubDate),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

function loadEnv() {
  for (const rel of ['.env.local', 'apps/web/.env.local']) {
    try {
      const text = readFileSync(join(__dirname, '..', rel), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* optional */
    }
  }
}

function buildExistingIndexes() {
  const companyNodes = readJson('company-nodes.json').nodes;
  const edgeNodes = readJson('edge-nodes.json').nodes;
  const newsNodes = readJson('news-nodes.json').nodes;

  const companyByName = new Map(companyNodes.map((n) => [n.name, n.id]));
  const companyIds = new Set(companyNodes.map((n) => n.id));
  const edgeNodeIds = new Set(edgeNodes.map((n) => n.id));
  const sectorCompanies = new Map();

  for (const en of edgeNodes) {
    const sid = en.props?.sectorId;
    const cid = en.props?.companyId;
    if (!sid || !cid) continue;
    if (!sectorCompanies.has(sid)) sectorCompanies.set(sid, new Set());
    sectorCompanies.get(sid).add(cid);
  }

  let maxNewsNum = 0;
  const newsUrls = new Set();
  for (const n of newsNodes) {
    const m = n.id.match(/^news-(\d+)$/);
    if (m) maxNewsNum = Math.max(maxNewsNum, Number(m[1]));
    for (const url of n.props?.link ?? []) newsUrls.add(url);
  }

  return { companyByName, companyIds, edgeNodeIds, sectorCompanies, maxNewsNum, newsUrls };
}

function normalizeNewsItem(item) {
  const oid = item.officeId ?? item.oid;
  const aid = item.articleId ?? item.aid;
  const url =
    item.mobileNewsUrl ??
    (oid && aid ? `https://n.news.naver.com/mnews/article/${oid}/${aid}` : null);
  if (!url) return null;
  return {
    title: stripHtml(item.title ?? item.titleFull ?? item.tit ?? ''),
    source: item.officeName ?? item.ohnm ?? '',
    url,
    date: parseDate(item.datetime ?? item.dt),
    summary: stripHtml(item.body ?? item.subcontent ?? ''),
  };
}

function isRelevantNews(news, sectorName, stockNames) {
  const text = `${news.title} ${news.summary ?? ''}`;
  if (text.includes(sectorName)) return true;
  for (const name of stockNames) {
    if (name.length >= 2 && text.includes(name)) return true;
  }
  return false;
}

async function main() {
  loadEnv();

  const sectors = readJson('sector-nodes.json')
    .nodes.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .slice(0, 27);

  const idx = buildExistingIndexes();
  let nextNewsId = idx.maxNewsNum + 1;

  const out = {
    edgeNodes: [],
    edgeEdges: [],
    companyNodes: [],
    newsNodes: [],
    newsEdges: [],
  };

  const addedCompanyIds = new Set();
  const addedEdgeNodeIds = new Set();
  const addedNewsUrls = new Set(idx.newsUrls);
  const addedNewsIds = new Set();

  const industryData = await fetchIndustryResponse();
  if (!industryData?.groups) throw new Error('Failed to fetch Naver industry list');

  const groupByName = new Map(industryData.groups.map((g) => [g.name, g]));

  const [newsList, rankNews] = await Promise.all([fetchNewsList(80), fetchRankNews()]);

  const summary = {
    sectorsProcessed: 0,
    companiesAdded: 0,
    newsAdded: 0,
    sectorsSkipped: [],
    sectorDetails: [],
  };

  for (const sector of sectors) {
    const group = groupByName.get(sector.name);
    if (!group || group.totalCount === 0) {
      summary.sectorsSkipped.push({
        id: sector.id,
        name: sector.name,
        reason: 'no Naver industry data',
      });
      continue;
    }

    summary.sectorsProcessed += 1;
    const sectorSlug = sectorSlugFromId(sector.id);
    const existingForSector = idx.sectorCompanies.get(sector.id) ?? new Set();

    const stocks = (await fetchIndustryStocks(group.no, group.totalCount))
      .map((s) => ({
        itemCode: s.itemCode,
        stockName: s.stockName,
        marketCap: Number(s.marketValueRaw) || 0,
      }))
      .sort((a, b) => b.marketCap - a.marketCap);

    if (stocks.length === 0) {
      summary.sectorsSkipped.push({ id: sector.id, name: sector.name, reason: 'empty stock list' });
      continue;
    }

    const topStocks = stocks.slice(0, COMPANIES_PER_SECTOR);
    const stockNames = topStocks.map((s) => s.stockName);
    let sectorCompaniesAdded = 0;

    for (const stock of topStocks) {
      let companyId = idx.companyByName.get(stock.stockName);
      if (!companyId) {
        companyId = `company-${companySlugFromCode(stock.itemCode)}`;
        if (!idx.companyIds.has(companyId) && !addedCompanyIds.has(companyId)) {
          out.companyNodes.push({
            id: companyId,
            label: 'Company',
            name: stock.stockName,
            props: { ticker: `${stock.itemCode}.KS` },
          });
          addedCompanyIds.add(companyId);
          idx.companyByName.set(stock.stockName, companyId);
          summary.companiesAdded += 1;
          sectorCompaniesAdded += 1;
        }
      } else if (!existingForSector.has(companyId)) {
        sectorCompaniesAdded += 1;
      }

      const edgeNodeId = `edgenode-${sectorSlug}-${companySlugFromCode(stock.itemCode)}`;
      if (idx.edgeNodeIds.has(edgeNodeId) || addedEdgeNodeIds.has(edgeNodeId)) continue;
      if (existingForSector.has(companyId)) continue;

      out.edgeNodes.push({
        id: edgeNodeId,
        label: 'EdgeNode',
        name: stock.stockName,
        props: {
          sectorId: sector.id,
          sectorName: sector.name,
          companyId,
          companyName: stock.stockName,
          newsIds: [],
          link: [],
          refs: [],
        },
      });
      addedEdgeNodeIds.add(edgeNodeId);

      out.edgeEdges.push(
        { source: sector.id, target: edgeNodeId, relation: 'includes', weight: 1 },
        { source: edgeNodeId, target: companyId, relation: 'includes', weight: 1 },
      );
    }

    const sectorNewsCandidates = [];
    const seenTitles = new Set();

    const pushNews = (raw) => {
      const n = normalizeNewsItem(raw);
      if (!n?.title || !n.url || addedNewsUrls.has(n.url) || seenTitles.has(n.title)) return;
      seenTitles.add(n.title);
      sectorNewsCandidates.push(n);
    };

    for (const item of newsList) pushNews(item);
    for (const item of rankNews) pushNews(item);

    for (const stock of topStocks.slice(0, 3)) {
      const items = await fetchStockNews(stock.itemCode, 5);
      for (const item of items) pushNews(item);
    }

    const searchQueries = [
      `${sector.name} 업종`,
      `${stockNames[0] ?? sector.name}`,
      `${sector.name} 주가`,
    ];
    for (const q of searchQueries) {
      const items = await searchNaverNews(q, 3);
      for (const item of items) {
        if (!item.url || addedNewsUrls.has(item.url) || seenTitles.has(item.title)) continue;
        seenTitles.add(item.title);
        sectorNewsCandidates.push(item);
      }
    }

    const relevant = sectorNewsCandidates.filter((n) => isRelevantNews(n, sector.name, stockNames));
    const picked = (relevant.length >= 2 ? relevant : sectorNewsCandidates).slice(
      0,
      NEWS_PER_SECTOR,
    );

    let sectorNewsAdded = 0;
    for (const article of picked) {
      if (addedNewsUrls.has(article.url)) continue;
      const newsId = `news-${nextNewsId++}`;
      out.newsNodes.push({
        id: newsId,
        label: 'News',
        name: article.title,
        props: {
          date: article.date,
          source: article.source || '네이버 증권',
          link: [article.url],
        },
      });
      out.newsEdges.push({
        source: newsId,
        target: sector.id,
        relation: 'mentions',
        weight: 0.85,
      });
      addedNewsUrls.add(article.url);
      addedNewsIds.add(newsId);
      summary.newsAdded += 1;
      sectorNewsAdded += 1;
    }

    summary.sectorDetails.push({
      sector: sector.name,
      stocksAvailable: stocks.length,
      companiesAdded: sectorCompaniesAdded,
      newsAdded: sectorNewsAdded,
    });
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log('\n=== Chunk 1 Enrichment Summary ===');
  console.log(`Output: ${OUT_PATH}`);
  console.log(`Sectors processed: ${summary.sectorsProcessed}/27`);
  console.log(`Companies added: ${summary.companiesAdded}`);
  console.log(`Edge nodes added: ${out.edgeNodes.length}`);
  console.log(`News added: ${summary.newsAdded}`);
  console.log(`Sectors skipped (no Naver data): ${summary.sectorsSkipped.length}`);
  if (summary.sectorsSkipped.length) {
    for (const s of summary.sectorsSkipped) console.log(`  - ${s.name}: ${s.reason}`);
  }
  console.log('\nPer-sector breakdown:');
  for (const d of summary.sectorDetails) {
    console.log(
      `  ${d.sector}: ${d.companiesAdded} companies, ${d.newsAdded} news (${d.stocksAvailable} stocks in Naver)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
