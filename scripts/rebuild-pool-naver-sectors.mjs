#!/usr/bin/env node
/**
 * Issue #83 — Rebuild knowledge-graph pool sector data to Naver WICS definitions.
 * Run: node scripts/rebuild-pool-naver-sectors.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_DIR = join(__dirname, '../apps/web/src/lib/knowledge-graph/data/pool');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stocks';
const PAGE_SIZE = 100;

/** Old custom pool sector → primary WICS sector */
const OLD_SECTOR_TO_WICS = {
  반도체: '반도체와반도체장비',
  클라우드: 'IT서비스',
  AI: '소프트웨어',
  자동차: '자동차',
  에너지: '석유와가스',
  바이오: '생물공학',
  금융: '은행',
  '소매·유통': '인터넷과카탈로그소매',
  방산: '우주항공과국방',
  로봇: '기계',
  우주항공: '우주항공과국방',
  신재생에너지: '에너지장비및서비스',
  이차전지: '화학',
  자율주행: '소프트웨어',
  '메타버스·XR': '게임엔터테인먼트',
  사이버보안: '소프트웨어',
  '제약·헬스케어': '제약',
  핀테크: '기타금융',
  게임: '게임엔터테인먼트',
  '조선·해운': '조선',
  '엔터테인먼트·미디어': '방송과엔터테인먼트',
  '통신·6G': '무선통신서비스',
  '화학·신소재': '화학',
};

/** Old sector id → old sector name */
const OLD_SECTOR_ID_TO_NAME = {
  'sector-semi': '반도체',
  'sector-cloud': '클라우드',
  'sector-ai': 'AI',
  'sector-auto': '자동차',
  'sector-energy': '에너지',
  'sector-bio': '바이오',
  'sector-finance': '금융',
  'sector-retail': '소매·유통',
  'sector-defense': '방산',
  'sector-robotics': '로봇',
  'sector-aerospace': '우주항공',
  'sector-renewable': '신재생에너지',
  'sector-battery': '이차전지',
  'sector-autonomous': '자율주행',
  'sector-metaverse': '메타버스·XR',
  'sector-cybersecurity': '사이버보안',
  'sector-pharma': '제약·헬스케어',
  'sector-fintech': '핀테크',
  'sector-gaming': '게임',
  'sector-shipbuilding': '조선·해운',
  'sector-entertainment': '엔터테인먼트·미디어',
  'sector-telecom': '통신·6G',
  'sector-materials': '화학·신소재',
};

/** Context-specific overrides: companyName + oldSectorName → WICS */
const COMPANY_OLD_SECTOR_OVERRIDES = {
  '한화오션|방산': '조선',
  '한화오션|조선·해운': '조선',
  '한화에어로스페이스|방산': '우주항공과국방',
  '한화에어로스페이스|우주항공': '우주항공과국방',
  '삼성전자|로봇': '전자제품',
  '삼성전자|화학·신소재': '반도체와반도체장비',
  '삼성전자|반도체': '반도체와반도체장비',
  'LG화학|이차전지': '화학',
  'LG화학|화학·신소재': '화학',
  '솔브레인홀딩스|이차전지': '화학',
  '솔브레인홀딩스|화학·신소재': '화학',
  'Tesla|에너지': '자동차',
  'Tesla|신재생에너지': '에너지장비및서비스',
  'Tesla|로봇': '자동차',
  'Tesla|자율주행': '자동차',
  'Apple|자율주행': '소프트웨어',
  'Apple|메타버스·XR': '게임엔터테인먼트',
  'Apple|클라우드': 'IT서비스',
  'Apple|AI': '소프트웨어',
  'Apple|자동차': '자동차',
  'Apple|로봇': '기계',
  'NVIDIA|AI': '반도체와반도체장비',
  'NVIDIA|클라우드': '반도체와반도체장비',
  'NVIDIA|반도체': '반도체와반도체장비',
  'Microsoft|사이버보안': '소프트웨어',
  'Microsoft|클라우드': 'IT서비스',
  'Microsoft|AI': '소프트웨어',
  'Eli Lilly|바이오': '제약',
  'Eli Lilly|제약·헬스케어': '제약',
  'Novo Nordisk|바이오': '제약',
  'Novo Nordisk|제약·헬스케어': '제약',
  '비바리퍼블리카(토스)|핀테크': '기타금융',
  '비바리퍼블리카(토스)|금융': '기타금융',
  'Boston Dynamics|자동차': '기계',
  'Boston Dynamics|로봇': '기계',
  '한화솔루션|신재생에너지': '에너지장비및서비스',
  '한화솔루션|에너지': '화학',
  'SpaceX|우주항공': '우주항공과국방',
  '우주항공청|우주항공': '우주항공과국방',
  'JPMorgan|금융': '은행',
  'Amazon|소매·유통': '인터넷과카탈로그소매',
  'Amazon|클라우드': 'IT서비스',
  'Alphabet (Google)|AI': '양방향미디어와서비스',
  'Alphabet (Google)|클라우드': 'IT서비스',
  'Meta|메타버스·XR': '양방향미디어와서비스',
  'Meta|클라우드': 'IT서비스',
  'Meta|AI': '양방향미디어와서비스',
  'NAVER|엔터테인먼트·미디어': '양방향미디어와서비스',
  '웹툰엔터테인먼트|엔터테인먼트·미디어': '방송과엔터테인먼트',
  '하이브|엔터테인먼트·미디어': '방송과엔터테인먼트',
  'JYP엔터테인먼트|엔터테인먼트·미디어': '방송과엔터테인먼트',
  'SK온|이차전지': '화학',
  '포스코퓨처엠|이차전지': '화학',
  'LG에너지솔루션|이차전지': '화학',
  '삼성SDI|이차전지': '화학',
};

/** US / non-KR listed companies → default WICS */
const US_COMPANY_DEFAULT_WICS = {
  NVIDIA: '반도체와반도체장비',
  TSMC: '반도체와반도체장비',
  Apple: '컴퓨터와주변기기',
  Meta: '양방향미디어와서비스',
  Tesla: '자동차',
  'Eli Lilly': '제약',
  JPMorgan: '은행',
  Amazon: '인터넷과카탈로그소매',
  Microsoft: '소프트웨어',
  'Alphabet (Google)': '양방향미디어와서비스',
  'Boston Dynamics': '기계',
  SpaceX: '우주항공과국방',
  CrowdStrike: '소프트웨어',
  'Novo Nordisk': '제약',
  ASML: '반도체와반도체장비',
  'ARM Holdings': '반도체와반도체장비',
  Intel: '반도체와반도체장비',
  'Palo Alto Networks': '소프트웨어',
  BYD: '자동차',
};

/** WICS → GICS (mirrors gics-sectors.ts; 기타 excluded) */
const WICS_TO_GICS = {
  문구류: '산업재',
  전자제품: '경기소비재',
  디스플레이패널: '정보기술',
  해운사: '산업재',
  기타금융: '금융',
  담배: '필수소비재',
  가정용품: '필수소비재',
  다각화된통신서비스: '커뮤니케이션서비스',
  교육서비스: '경기소비재',
  게임엔터테인먼트: '커뮤니케이션서비스',
  부동산: '부동산',
  카드: '금융',
  손해보험: '금융',
  광고: '커뮤니케이션서비스',
  다각화된소비자서비스: '경기소비재',
  '섬유,의류,신발,호화품': '경기소비재',
  소프트웨어: '정보기술',
  음료: '필수소비재',
  항공사: '산업재',
  상업서비스와공급품: '산업재',
  가구: '경기소비재',
  자동차: '경기소비재',
  무선통신서비스: '커뮤니케이션서비스',
  종이와목재: '소재',
  전문소매: '경기소비재',
  복합유틸리티: '유틸리티',
  사무용전자제품: '정보기술',
  가스유틸리티: '유틸리티',
  운송인프라: '산업재',
  자동차부품: '경기소비재',
  방송과엔터테인먼트: '커뮤니케이션서비스',
  도로와철도운송: '산업재',
  식품: '필수소비재',
  컴퓨터와주변기기: '정보기술',
  은행: '금융',
  무역회사와판매업체: '산업재',
  포장재: '소재',
  양방향미디어와서비스: '커뮤니케이션서비스',
  건축자재: '소재',
  식품과기본식료품소매: '필수소비재',
  건축제품: '산업재',
  레저용장비와제품: '경기소비재',
  '호텔,레스토랑,레저': '경기소비재',
  석유와가스: '에너지',
  항공화물운송과물류: '산업재',
  판매업체: '경기소비재',
  건강관리기술: '건강관리',
  출판: '커뮤니케이션서비스',
  건강관리장비와용품: '건강관리',
  화장품: '필수소비재',
  증권: '금융',
  철강: '소재',
  제약: '건강관리',
  디스플레이장비및부품: '정보기술',
  인터넷과카탈로그소매: '경기소비재',
  전기유틸리티: '유틸리티',
  핸드셋: '정보기술',
  가정용기기와용품: '경기소비재',
  창업투자: '금융',
  IT서비스: '정보기술',
  비철금속: '소재',
  생명과학도구및서비스: '건강관리',
  화학: '소재',
  복합기업: '산업재',
  백화점과일반상점: '경기소비재',
  통신장비: '정보기술',
  전기제품: '산업재',
  반도체와반도체장비: '정보기술',
  에너지장비및서비스: '에너지',
  조선: '산업재',
  건설: '산업재',
  생물공학: '건강관리',
  기계: '산업재',
  생명보험: '금융',
  건강관리업체및서비스: '건강관리',
  우주항공과국방: '산업재',
  전자장비와기기: '정보기술',
  전기장비: '산업재',
};

function slugifyWics(name) {
  return name
    .replace(/[,·\s()]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sectorIdFromWics(name) {
  return `sector-${slugifyWics(name)}`;
}

function companySlug(companyId) {
  return companyId.replace(/^company-/, '');
}

function readJson(name) {
  return JSON.parse(readFileSync(join(POOL_DIR, name), 'utf8'));
}

function writeJson(name, data) {
  writeFileSync(join(POOL_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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

async function buildKrStockToWics() {
  const data = await fetchIndustryResponse();
  const map = new Map();
  for (const group of data.groups) {
    const stocks = await fetchIndustryStocks(group.no, group.totalCount);
    for (const stock of stocks) {
      map.set(stock.stockName, group.name);
    }
  }
  return map;
}

function resolveWicsForEdgeNode(edgeNode, krStockToWics) {
  const companyName = String(edgeNode.props?.companyName ?? '');
  const oldSectorName = String(edgeNode.props?.sectorName ?? '');
  const overrideKey = `${companyName}|${oldSectorName}`;
  if (COMPANY_OLD_SECTOR_OVERRIDES[overrideKey]) {
    return COMPANY_OLD_SECTOR_OVERRIDES[overrideKey];
  }
  const krWics = krStockToWics.get(companyName);
  if (krWics) return krWics;
  if (US_COMPANY_DEFAULT_WICS[companyName]) return US_COMPANY_DEFAULT_WICS[companyName];
  if (OLD_SECTOR_TO_WICS[oldSectorName]) return OLD_SECTOR_TO_WICS[oldSectorName];
  return null;
}

function buildSectorEdges(wicsNames, oldSectorEdges) {
  const wicsSet = new Set(wicsNames);
  const seen = new Set();
  const edges = [];

  const addEdge = (sourceWics, targetWics, explain, weight = 0.8) => {
    if (!wicsSet.has(sourceWics) || !wicsSet.has(targetWics) || sourceWics === targetWics) return;
    const key = `${sourceWics}→${targetWics}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      source: sectorIdFromWics(sourceWics),
      target: sectorIdFromWics(targetWics),
      relation: 'impacts',
      weight,
      explain,
    });
  };

  // Migrate thematic edges from old pool
  for (const edge of oldSectorEdges.edges) {
    const oldSource = OLD_SECTOR_ID_TO_NAME[edge.source];
    const oldTarget = OLD_SECTOR_ID_TO_NAME[edge.target];
    if (!oldSource || !oldTarget) continue;
    const sourceWics = OLD_SECTOR_TO_WICS[oldSource];
    const targetWics = OLD_SECTOR_TO_WICS[oldTarget];
    if (sourceWics && targetWics) {
      addEdge(sourceWics, targetWics, edge.explain ?? '', edge.weight ?? 0.8);
    }
  }

  // GICS sibling edges — same GICS parent, different WICS
  const byGics = new Map();
  for (const wics of wicsNames) {
    const gics = WICS_TO_GICS[wics];
    if (!gics) continue;
    if (!byGics.has(gics)) byGics.set(gics, []);
    byGics.get(gics).push(wics);
  }

  const gicsExplains = {
    정보기술: '동일 GICS 정보기술 대분류 내 밸류체인 연동',
    커뮤니케이션서비스: '동일 GICS 커뮤니케이션서비스 대분류 내 콘텐츠·플랫폼 연동',
    금융: '동일 GICS 금융 대분류 내 자금·결제 흐름 연동',
    건강관리: '동일 GICS 건강관리 대분류 내 R&D·임상 연동',
    소재: '동일 GICS 소재 대분류 내 원자재·소재 수요 연동',
    산업재: '동일 GICS 산업재 대분류 내 설비·인프라 수요 연동',
    경기소비재: '동일 GICS 경기소비재 대분류 내 소비 심리 연동',
    필수소비재: '동일 GICS 필수소비재 대분류 내 내수 수요 연동',
    에너지: '동일 GICS 에너지 대분류 내 에너지 가격·설비 연동',
    유틸리티: '동일 GICS 유틸리티 대분류 내 전력·가스 인프라 연동',
    부동산: '동일 GICS 부동산 대분류 내 자산·개발 연동',
  };

  for (const [gics, members] of byGics) {
    if (members.length < 2) continue;
    // Connect representative pairs within GICS group (limit combinatorial explosion)
    const rep = members.slice(0, 4);
    for (let i = 0; i < rep.length - 1; i++) {
      addEdge(rep[i], rep[i + 1], gicsExplains[gics] ?? '동일 GICS 대분류 내 연동', 0.65);
    }
  }

  return { edges };
}

async function main() {
  const edgeNodes = readJson('edge-nodes.json');
  const newsEdges = readJson('news-edges.json');
  const oldSectorEdges = readJson('sector-edges.json');

  console.log('Fetching Naver WICS list and KR stock memberships...');
  const industryData = await fetchIndustryResponse();
  const wicsNames = industryData.groups.map((g) => g.name);
  console.log(`WICS sectors: ${wicsNames.length}`);

  const krStockToWics = await buildKrStockToWics();
  console.log(`KR stock→WICS mappings: ${krStockToWics.size}`);

  const wicsToId = new Map(wicsNames.map((n) => [n, sectorIdFromWics(n)]));
  const unmapped = [];

  // 1. sector-nodes.json
  const sectorNodes = {
    nodes: wicsNames.map((name) => ({
      id: sectorIdFromWics(name),
      label: 'Sector',
      name,
      props: { market: 'KR' },
    })),
  };
  writeJson('sector-nodes.json', sectorNodes);
  console.log(`Wrote sector-nodes.json (${sectorNodes.nodes.length} nodes)`);

  // 2. edge-nodes.json + edge-edges.json
  const oldEdgeNodeIdToNew = new Map();
  const newEdgeNodes = [];
  const newEdgeEdges = [];

  for (const node of edgeNodes.nodes) {
    const wics = resolveWicsForEdgeNode(node, krStockToWics);
    if (!wics) {
      unmapped.push({
        company: node.props?.companyName,
        oldSector: node.props?.sectorName,
        edgeNodeId: node.id,
      });
      continue;
    }

    const sectorId = wicsToId.get(wics);
    const compSlug = companySlug(String(node.props?.companyId ?? 'unknown'));
    const newId = `edgenode-${slugifyWics(wics)}-${compSlug}`;

    oldEdgeNodeIdToNew.set(node.id, newId);

    newEdgeNodes.push({
      ...node,
      id: newId,
      props: {
        ...node.props,
        sectorId,
        sectorName: wics,
      },
    });

    newEdgeEdges.push({
      source: sectorId,
      target: newId,
      relation: 'includes',
      weight: 1,
    });
    newEdgeEdges.push({
      source: newId,
      target: node.props?.companyId,
      relation: 'includes',
      weight: 1,
    });
  }

  writeJson('edge-nodes.json', { nodes: newEdgeNodes });
  writeJson('edge-edges.json', { edges: newEdgeEdges });
  console.log(
    `Wrote edge-nodes.json (${newEdgeNodes.length}), edge-edges.json (${newEdgeEdges.length})`,
  );

  // 3. news-edges.json — remap sector targets
  const oldSectorIdToWics = Object.fromEntries(
    Object.entries(OLD_SECTOR_ID_TO_NAME).map(([id, name]) => [id, OLD_SECTOR_TO_WICS[name]]),
  );

  const newNewsEdges = newsEdges.edges.map((edge) => {
    const isSectorTarget = edge.target?.startsWith('sector-');
    const isSectorSource = edge.source?.startsWith('sector-');
    if (!isSectorTarget && !isSectorSource) return edge;

    const oldSectorId = isSectorTarget ? edge.target : edge.source;
    const wics = oldSectorIdToWics[oldSectorId];
    if (!wics) return edge;

    const newSectorId = wicsToId.get(wics);
    if (isSectorTarget) return { ...edge, target: newSectorId };
    return { ...edge, source: newSectorId };
  });

  writeJson('news-edges.json', { edges: newNewsEdges });
  console.log(`Wrote news-edges.json (${newNewsEdges.length} edges)`);

  // 4. sector-edges.json
  const sectorEdges = buildSectorEdges(wicsNames, oldSectorEdges);
  writeJson('sector-edges.json', sectorEdges);
  console.log(`Wrote sector-edges.json (${sectorEdges.edges.length} edges)`);

  if (unmapped.length) {
    console.warn('\nUnmapped edge nodes:');
    for (const u of unmapped) console.warn(`  - ${u.company} (${u.oldSector})`);
  } else {
    console.log('\nAll edge nodes mapped successfully.');
  }

  // Summary for parent agent
  console.log('\n--- Mapping summary ---');
  console.log('Old sector → WICS:');
  for (const [old, wics] of Object.entries(OLD_SECTOR_TO_WICS)) {
    console.log(`  ${old} → ${wics}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
