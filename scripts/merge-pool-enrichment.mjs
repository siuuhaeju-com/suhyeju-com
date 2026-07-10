#!/usr/bin/env node
/**
 * Merge staging enrichment chunks into knowledge-graph pool JSON files.
 * Optionally wait for chunks or run Naver API fallback enrichment.
 *
 * Usage:
 *   node scripts/merge-pool-enrichment.mjs [--wait] [--fallback] [--dry-run]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_DIR = join(__dirname, '../apps/web/src/lib/knowledge-graph/data/pool');
const STAGING_DIR = join(POOL_DIR, 'staging');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100;

const args = new Set(process.argv.slice(2));
const WAIT = args.has('--wait');
const FALLBACK = args.has('--fallback');
const DRY_RUN = args.has('--dry-run');

const STAGING_KEYS = ['companyNodes', 'edgeNodes', 'edgeEdges', 'newsNodes', 'newsEdges'];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  if (DRY_RUN) return;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function slugifyWics(name) {
  return name
    .replace(/[,·\s()]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function edgeKey(edge) {
  return `${edge.source}|${edge.target}|${edge.relation ?? ''}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyStaging() {
  return Object.fromEntries(STAGING_KEYS.map((k) => [k, []]));
}

function normalizeStagingChunk(raw) {
  const chunk = emptyStaging();
  for (const key of STAGING_KEYS) {
    const value = raw?.[key];
    if (Array.isArray(value)) chunk[key] = value;
  }
  return chunk;
}

function loadStagingChunks() {
  if (!existsSync(STAGING_DIR)) return { chunks: [], combined: emptyStaging() };

  const files = readdirSync(STAGING_DIR)
    .filter((f) => /^chunk-\d+\.json$/.test(f))
    .sort();

  const chunks = [];
  const combined = emptyStaging();

  for (const file of files) {
    const raw = readJson(join(STAGING_DIR, file));
    const chunk = normalizeStagingChunk(raw);
    const counts = Object.fromEntries(STAGING_KEYS.map((k) => [k, chunk[k].length]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    chunks.push({ file, counts, total });
    for (const key of STAGING_KEYS) combined[key].push(...chunk[key]);
  }

  return { chunks, combined };
}

async function waitForStagingChunks() {
  const expected = ['chunk-1.json', 'chunk-2.json', 'chunk-3.json'];
  const maxAttempts = 30; // 30 × 30s = 15 min
  const intervalMs = 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const present = expected.filter((f) => existsSync(join(STAGING_DIR, f)));
    console.log(
      `[wait] attempt ${attempt}/${maxAttempts}: ${present.length}/3 chunks (${present.join(', ') || 'none'})`,
    );

    if (present.length === 3) {
      const sizes = present.map((f) => {
        const stat = readJson(join(STAGING_DIR, f));
        const normalized = normalizeStagingChunk(stat);
        return Object.values(normalized).reduce((a, arr) => a + arr.length, 0);
      });
      if (sizes.every((n) => n > 0)) return present;
    }

    if (attempt < maxAttempts) await sleep(intervalMs);
  }

  return expected.filter((f) => existsSync(join(STAGING_DIR, f)));
}

function sectorStats(edgeNodes, newsEdges) {
  const companiesBySector = new Map();
  for (const node of edgeNodes) {
    const sid = node.props?.sectorId;
    if (!sid) continue;
    companiesBySector.set(sid, (companiesBySector.get(sid) ?? 0) + 1);
  }

  const newsBySector = new Map();
  for (const edge of newsEdges) {
    if (edge.target?.startsWith('sector-')) {
      newsBySector.set(edge.target, (newsBySector.get(edge.target) ?? 0) + 1);
    }
  }

  return { companiesBySector, newsBySector };
}

function computeAverages(sectorNodes, companiesBySector, newsBySector) {
  const n = sectorNodes.length || 1;
  const totalCompanies = [...companiesBySector.values()].reduce((a, b) => a + b, 0);
  const totalNews = [...newsBySector.values()].reduce((a, b) => a + b, 0);
  return {
    avgCompaniesPerSector: totalCompanies / n,
    avgNewsPerSector: totalNews / n,
    sectorsWithCompanies: companiesBySector.size,
    sectorsWithNews: newsBySector.size,
  };
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

async function fetchStockNews(itemCode, limit = 2) {
  const res = await fetch(
    `https://m.stock.naver.com/api/news/stock/${itemCode}?page=1&pageSize=${limit}`,
    { headers: { 'User-Agent': BROWSER_UA } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data.flatMap((p) => p.items ?? []) : (data.items ?? []);
  return items.slice(0, limit);
}

async function searchNaverNews(query, limit = 3) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const params = new URLSearchParams({ query, display: String(limit + 2), sort: 'sim' });
  const res = await fetch(`https://openapi.naver.com/v1/search/news.json?${params}`, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const seen = new Set();
  const results = [];
  for (const item of data.items ?? []) {
    const url = item.originallink || item.link;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title: item.title
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&'),
      url,
      pubDate: item.pubDate,
    });
    if (results.length >= limit) break;
  }
  return results;
}

function pubDateToIso(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function naverDatetimeToIso(dt) {
  if (!/^\d{12,14}$/.test(dt)) return new Date().toISOString().slice(0, 10);
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
}

async function buildFallbackStaging(existing) {
  console.log('[fallback] Enriching underpopulated sectors via Naver APIs...');
  const sectorNodes = existing.sectorNodes.nodes;
  const sortedSectors = [...sectorNodes].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const { companiesBySector, newsBySector } = sectorStats(
    existing.edgeNodes.nodes,
    existing.newsEdges.edges,
  );

  const industryData = await fetchIndustryResponse();
  const industryByName = new Map(industryData.groups.map((g) => [g.name, g]));

  const existingCompanyIds = new Set(existing.companyNodes.nodes.map((n) => n.id));
  const existingEdgeNodeIds = new Set(existing.edgeNodes.nodes.map((n) => n.id));
  const existingNewsIds = new Set(existing.newsNodes.nodes.map((n) => n.id));
  const existingEdgeKeys = new Set(existing.edgeEdges.edges.map(edgeKey));
  const existingNewsEdgeKeys = new Set(existing.newsEdges.edges.map(edgeKey));

  let nextNewsNum =
    Math.max(
      0,
      ...existing.newsNodes.nodes
        .map((n) => Number.parseInt(String(n.id).replace(/^news-/, ''), 10))
        .filter((n) => !Number.isNaN(n)),
    ) + 1;

  const staging = emptyStaging();
  const MIN_COMPANIES = 3;
  const MIN_NEWS = 2;
  const COMPANIES_TARGET = 4;
  const NEWS_TARGET = 3;

  for (const sector of sortedSectors) {
    const haveCompanies = companiesBySector.get(sector.id) ?? 0;
    const haveNews = newsBySector.get(sector.id) ?? 0;
    if (haveCompanies >= MIN_COMPANIES && haveNews >= MIN_NEWS) continue;

    const group = industryByName.get(sector.name);
    if (!group) {
      console.warn(`[fallback] skip ${sector.name}: no Naver industry group`);
      continue;
    }

    const stocks = await fetchIndustryStocks(group.no, group.totalCount);
    stocks.sort((a, b) => Number(b.marketValueRaw ?? 0) - Number(a.marketValueRaw ?? 0));

    const needCompanies = Math.max(0, COMPANIES_TARGET - haveCompanies);
    const addedCompanies = [];

    for (const stock of stocks) {
      if (addedCompanies.length >= needCompanies) break;
      const code = String(stock.itemCode ?? '').trim();
      const name = String(stock.stockName ?? '').trim();
      if (!code || !name) continue;

      const companyId = `company-${code}`;
      const edgeNodeId = `edgenode-${slugifyWics(sector.name)}-${code}`;

      if (existingEdgeNodeIds.has(edgeNodeId)) continue;

      if (!existingCompanyIds.has(companyId)) {
        staging.companyNodes.push({
          id: companyId,
          label: 'Company',
          name,
          props: { ticker: `${code}.KS` },
        });
        existingCompanyIds.add(companyId);
      }

      staging.edgeNodes.push({
        id: edgeNodeId,
        label: 'EdgeNode',
        name,
        props: {
          sectorId: sector.id,
          sectorName: sector.name,
          companyId,
          companyName: name,
          newsIds: [],
          link: [],
          refs: [],
        },
      });
      existingEdgeNodeIds.add(edgeNodeId);
      addedCompanies.push({ code, name, companyId, edgeNodeId });

      const sectorEdge = { source: sector.id, target: edgeNodeId, relation: 'includes', weight: 1 };
      const companyEdge = {
        source: edgeNodeId,
        target: companyId,
        relation: 'includes',
        weight: 1,
      };
      for (const edge of [sectorEdge, companyEdge]) {
        const key = edgeKey(edge);
        if (!existingEdgeKeys.has(key)) {
          staging.edgeEdges.push(edge);
          existingEdgeKeys.add(key);
        }
      }
    }

    const needNews = Math.max(0, NEWS_TARGET - haveNews);
    const newsCandidates = [];

    const searchResults = await searchNaverNews(`${sector.name} 주식`, needNews + 1);
    for (const item of searchResults) {
      newsCandidates.push({
        title: item.title,
        url: item.url,
        source: 'Naver Search',
        date: pubDateToIso(item.pubDate),
      });
    }

    if (newsCandidates.length < needNews && addedCompanies.length) {
      const stockNews = await fetchStockNews(addedCompanies[0].code, needNews);
      for (const item of stockNews) {
        newsCandidates.push({
          title: item.titleFull || item.title,
          url: item.mobileNewsUrl || item.url,
          source: item.officeName || 'Naver Finance',
          date: naverDatetimeToIso(String(item.datetime ?? '')),
        });
      }
    }

    const seenUrls = new Set();
    let addedNews = 0;
    for (const article of newsCandidates) {
      if (addedNews >= needNews) break;
      if (!article.title || !article.url || seenUrls.has(article.url)) continue;
      seenUrls.add(article.url);

      const newsId = `news-${nextNewsNum++}`;
      if (existingNewsIds.has(newsId)) continue;

      staging.newsNodes.push({
        id: newsId,
        label: 'News',
        name: article.title,
        props: {
          date: article.date,
          source: article.source,
          link: [article.url],
        },
      });
      existingNewsIds.add(newsId);

      const newsEdge = {
        source: newsId,
        target: sector.id,
        relation: 'mentions',
        weight: 0.9,
      };
      const key = edgeKey(newsEdge);
      if (!existingNewsEdgeKeys.has(key)) {
        staging.newsEdges.push(newsEdge);
        existingNewsEdgeKeys.add(key);
      }
      addedNews++;
    }

    if (addedCompanies.length || addedNews) {
      console.log(
        `[fallback] ${sector.name}: +${addedCompanies.length} companies, +${addedNews} news`,
      );
    }

    await sleep(200);
  }

  return staging;
}

function mergePool(existing, staging) {
  const stats = {
    companyNodes: 0,
    edgeNodes: 0,
    edgeEdges: 0,
    newsNodes: 0,
    newsEdges: 0,
    companiesBySectorAdded: new Map(),
    newsBySectorAdded: new Map(),
  };

  const companyIds = new Set(existing.companyNodes.nodes.map((n) => n.id));
  for (const node of staging.companyNodes) {
    if (companyIds.has(node.id)) continue;
    existing.companyNodes.nodes.push(node);
    companyIds.add(node.id);
    stats.companyNodes++;
  }

  const edgeNodeIds = new Set(existing.edgeNodes.nodes.map((n) => n.id));
  for (const node of staging.edgeNodes) {
    if (edgeNodeIds.has(node.id)) continue;
    existing.edgeNodes.nodes.push(node);
    edgeNodeIds.add(node.id);
    stats.edgeNodes++;
    const sid = node.props?.sectorId;
    if (sid)
      stats.companiesBySectorAdded.set(sid, (stats.companiesBySectorAdded.get(sid) ?? 0) + 1);
  }

  const edgeKeys = new Set(existing.edgeEdges.edges.map(edgeKey));
  for (const edge of staging.edgeEdges) {
    const key = edgeKey(edge);
    if (edgeKeys.has(key)) continue;
    existing.edgeEdges.edges.push(edge);
    edgeKeys.add(key);
    stats.edgeEdges++;
  }

  const newsIds = new Set(existing.newsNodes.nodes.map((n) => n.id));
  for (const node of staging.newsNodes) {
    if (newsIds.has(node.id)) continue;
    existing.newsNodes.nodes.push(node);
    newsIds.add(node.id);
    stats.newsNodes++;
  }

  const newsEdgeKeys = new Set(existing.newsEdges.edges.map(edgeKey));
  for (const edge of staging.newsEdges) {
    const key = edgeKey(edge);
    if (newsEdgeKeys.has(key)) continue;
    existing.newsEdges.edges.push(edge);
    newsEdgeKeys.add(key);
    stats.newsEdges++;
    if (edge.target?.startsWith('sector-')) {
      stats.newsBySectorAdded.set(edge.target, (stats.newsBySectorAdded.get(edge.target) ?? 0) + 1);
    }
  }

  return stats;
}

function verifyPool(existing) {
  const sectorCount = existing.sectorNodes.nodes.length;
  const issues = [];

  if (sectorCount !== 79) {
    issues.push(`Expected 79 sectors, got ${sectorCount}`);
  }

  const sectorIds = new Set(existing.sectorNodes.nodes.map((n) => n.id));
  const edgeNodeIds = new Set(existing.edgeNodes.nodes.map((n) => n.id));
  const companyIds = new Set(existing.companyNodes.nodes.map((n) => n.id));
  const newsIds = new Set(existing.newsNodes.nodes.map((n) => n.id));

  for (const node of existing.edgeNodes.nodes) {
    if (!sectorIds.has(node.props?.sectorId)) {
      issues.push(`EdgeNode ${node.id} references unknown sector ${node.props?.sectorId}`);
    }
    if (node.props?.companyId && !companyIds.has(node.props.companyId)) {
      issues.push(`EdgeNode ${node.id} references unknown company ${node.props.companyId}`);
    }
  }

  for (const edge of existing.edgeEdges.edges) {
    const srcOk =
      sectorIds.has(edge.source) || edgeNodeIds.has(edge.source) || companyIds.has(edge.source);
    const tgtOk =
      sectorIds.has(edge.target) || edgeNodeIds.has(edge.target) || companyIds.has(edge.target);
    if (!srcOk || !tgtOk) {
      issues.push(`Broken edge-edge: ${edge.source} → ${edge.target}`);
    }
  }

  for (const edge of existing.newsEdges.edges) {
    if (!newsIds.has(edge.source)) issues.push(`News edge missing source node: ${edge.source}`);
    const tgtOk =
      sectorIds.has(edge.target) || companyIds.has(edge.target) || edgeNodeIds.has(edge.target);
    if (!tgtOk) issues.push(`News edge missing target: ${edge.target}`);
  }

  const { companiesBySector, newsBySector } = sectorStats(
    existing.edgeNodes.nodes,
    existing.newsEdges.edges,
  );
  const avgs = computeAverages(existing.sectorNodes.nodes, companiesBySector, newsBySector);

  return { sectorCount, issues, avgs, companiesBySector, newsBySector };
}

async function main() {
  mkdirSync(STAGING_DIR, { recursive: true });

  if (WAIT) {
    console.log('Waiting for staging chunks (max 15 min)...');
    await waitForStagingChunks();
  }

  const existing = {
    sectorNodes: readJson(join(POOL_DIR, 'sector-nodes.json')),
    companyNodes: existsSync(join(POOL_DIR, 'company-nodes.json'))
      ? readJson(join(POOL_DIR, 'company-nodes.json'))
      : { nodes: [] },
    edgeNodes: readJson(join(POOL_DIR, 'edge-nodes.json')),
    edgeEdges: readJson(join(POOL_DIR, 'edge-edges.json')),
    newsNodes: readJson(join(POOL_DIR, 'news-nodes.json')),
    newsEdges: readJson(join(POOL_DIR, 'news-edges.json')),
  };

  const before = verifyPool(existing);
  console.log('\n--- Before merge ---');
  console.log(
    `Sectors: ${before.sectorCount}, edge-nodes: ${existing.edgeNodes.nodes.length}, news: ${existing.newsNodes.nodes.length}`,
  );
  console.log(
    `Avg companies/sector: ${before.avgs.avgCompaniesPerSector.toFixed(2)}, avg news/sector: ${before.avgs.avgNewsPerSector.toFixed(2)}`,
  );

  let { chunks, combined } = loadStagingChunks();
  console.log(`\nStaging chunks loaded: ${chunks.length}`);
  for (const c of chunks) {
    console.log(`  ${c.file}: ${JSON.stringify(c.counts)} (total ${c.total})`);
  }

  let stagingTotal = STAGING_KEYS.reduce((sum, k) => sum + combined[k].length, 0);
  const shouldFallback = FALLBACK || (WAIT && stagingTotal === 0);
  if (shouldFallback) {
    const fallback = await buildFallbackStaging(existing);
    for (const key of STAGING_KEYS) combined[key].push(...fallback[key]);
    stagingTotal = STAGING_KEYS.reduce((sum, k) => sum + combined[k].length, 0);
    chunks.push({
      file: 'fallback',
      counts: Object.fromEntries(STAGING_KEYS.map((k) => [k, fallback[k].length])),
      total: STAGING_KEYS.reduce((s, k) => s + fallback[k].length, 0),
    });
  }

  if (stagingTotal === 0) {
    console.log('\nNo staging data to merge.');
    process.exit(0);
  }

  const mergeStats = mergePool(existing, combined);

  writeJson(join(POOL_DIR, 'company-nodes.json'), existing.companyNodes);
  writeJson(join(POOL_DIR, 'edge-nodes.json'), existing.edgeNodes);
  writeJson(join(POOL_DIR, 'edge-edges.json'), existing.edgeEdges);
  writeJson(join(POOL_DIR, 'news-nodes.json'), existing.newsNodes);
  writeJson(join(POOL_DIR, 'news-edges.json'), existing.newsEdges);

  const after = verifyPool(existing);

  console.log('\n--- Merge stats ---');
  console.log(
    `Added: ${mergeStats.companyNodes} companies, ${mergeStats.edgeNodes} edge-nodes, ${mergeStats.edgeEdges} edge-edges`,
  );
  console.log(`Added: ${mergeStats.newsNodes} news, ${mergeStats.newsEdges} news-edges`);

  const sectorsWithCompanyAdds = mergeStats.companiesBySectorAdded.size;
  const sectorsWithNewsAdds = mergeStats.newsBySectorAdded.size;
  const avgCompaniesAdded =
    sectorsWithCompanyAdds > 0
      ? [...mergeStats.companiesBySectorAdded.values()].reduce((a, b) => a + b, 0) /
        sectorsWithCompanyAdds
      : 0;
  const avgNewsAdded =
    sectorsWithNewsAdds > 0
      ? [...mergeStats.newsBySectorAdded.values()].reduce((a, b) => a + b, 0) / sectorsWithNewsAdds
      : 0;

  console.log(`Avg companies added per enriched sector: ${avgCompaniesAdded.toFixed(2)}`);
  console.log(`Avg news added per enriched sector: ${avgNewsAdded.toFixed(2)}`);

  console.log('\n--- After merge ---');
  console.log(
    `Sectors: ${after.sectorCount}, edge-nodes: ${existing.edgeNodes.nodes.length}, news: ${existing.newsNodes.nodes.length}`,
  );
  console.log(
    `Avg companies/sector: ${after.avgs.avgCompaniesPerSector.toFixed(2)}, avg news/sector: ${after.avgs.avgNewsPerSector.toFixed(2)}`,
  );
  console.log(`Sectors with companies: ${after.avgs.sectorsWithCompanies}/79`);
  console.log(`Sectors with news: ${after.avgs.sectorsWithNews}/79`);

  if (after.issues.length) {
    console.warn('\nVerification issues:');
    for (const issue of after.issues.slice(0, 20)) console.warn(`  - ${issue}`);
    if (after.issues.length > 20) console.warn(`  ... and ${after.issues.length - 20} more`);
    process.exit(1);
  }

  console.log('\nVerification passed (79 sectors, referential integrity OK).');

  // JSON summary for PR update
  const summary = {
    chunks: chunks.map((c) => c.file),
    added: {
      companies: mergeStats.companyNodes,
      edgeNodes: mergeStats.edgeNodes,
      edgeEdges: mergeStats.edgeEdges,
      news: mergeStats.newsNodes,
      newsEdges: mergeStats.newsEdges,
    },
    avgCompaniesAddedPerSector: avgCompaniesAdded,
    avgNewsAddedPerSector: avgNewsAdded,
    after: {
      sectors: after.sectorCount,
      edgeNodes: existing.edgeNodes.nodes.length,
      newsNodes: existing.newsNodes.nodes.length,
      avgCompaniesPerSector: after.avgs.avgCompaniesPerSector,
      avgNewsPerSector: after.avgs.avgNewsPerSector,
    },
  };
  writeFileSync(join(STAGING_DIR, 'merge-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log('\n--- JSON summary ---');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
