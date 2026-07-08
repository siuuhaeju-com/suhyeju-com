/**
 * 화면 프로토타입용 mock 데이터 — 시각 정본(docs/design/mockup)과 동일한 내용.
 * FE 연동 시 이 모듈의 export를 API 호출(react-query)로 교체한다.
 *   - 메인:   GET /api/news/popular, /api/sectors, /api/analysis/recent
 *   - 분석:   GET /api/analysis/:id  →  AnalysisResult
 */
import type {
  AnalysisResult,
  AnalysisStep,
  FloatingChip,
  NewsItem,
  RecentAnalysis,
  SectorChange,
} from '@/lib/types';

/* ── 메인: 인기 뉴스 (F-03a) ─────────────────────────────── */
export const popularNews: NewsItem[] = [
  {
    id: 'news-battery',
    sector: '2차전지',
    sectorTone: 'negative',
    source: '한국경제',
    publishedAt: '6시간 전',
    title: '전기차 수요 둔화 우려…배터리 소재 업체 실적 하향 조정',
    summary:
      '글로벌 완성차 업체의 전기차 생산 계획 축소로 국내 배터리 소재 기업의 하반기 실적 전망이 낮아졌다.',
  },
  {
    id: 'news-semicon',
    sector: '반도체',
    sectorTone: 'positive',
    source: '매일경제',
    publishedAt: '8시간 전',
    title: '삼성전자, 파운드리 2나노 시험 생산 성공…TSMC 추격 본격화',
    summary:
      '삼성전자가 2나노 공정 시험 생산에 성공하며 첨단 파운드리 경쟁에서 반등 발판을 마련했다.',
  },
  {
    id: 'news-bio',
    sector: '바이오',
    sectorTone: 'teal',
    source: '이데일리',
    publishedAt: '10시간 전',
    title: '신약 임상 3상 일부 지연…바이오 섹터 변동성 확대',
    summary: '주요 바이오 기업의 임상 일정 조정 소식에 섹터 전반의 투자 심리가 엇갈리고 있다.',
  },
  {
    id: 'news-energy',
    sector: '에너지',
    sectorTone: 'amber',
    source: '연합인포맥스',
    publishedAt: '12시간 전',
    title: '국제유가 급등…정유·태양광 밸류체인 동반 강세',
    summary:
      '지정학적 리스크로 국제유가가 급등하며 에너지 관련 종목 전반에 매수세가 유입되고 있다.',
  },
];

/* ── 메인: 주요 섹터 현황 (F-03b) ────────────────────────── */
export const sectorOverview: SectorChange[] = [
  { name: '반도체', changePct: 2.4, description: '메모리·파운드리·설계 전반의 밸류체인' },
  { name: '2차전지', changePct: -1.1, description: '양극재·음극재·셀 제조 및 소재' },
  { name: '바이오', changePct: 0.8, description: '신약 개발·CMO·헬스케어 플랫폼' },
  { name: 'AI·소프트웨어', changePct: 3.6, description: '생성형 AI·클라우드·데이터센터' },
  { name: '자동차', changePct: -0.5, description: '완성차·전장·자율주행 부품' },
  { name: '에너지', changePct: 1.2, description: '정유·태양광·원전 및 신재생' },
  { name: '금융', changePct: 0.3, description: '은행·증권·보험 및 핀테크' },
  { name: '방산', changePct: 1.9, description: '지상·항공·해양 방위 산업' },
];

/* ── 메인: 최근 분석 내역 (F-03c) ────────────────────────── */
export const recentAnalyses: RecentAnalysis[] = [
  { id: 'hbm4', title: '테슬라 로보택시 공개 임박…자율주행 밸류체인 재조명', analyzedAt: '어제' },
  { id: 'hbm4', title: '메모리 반도체 가격 3분기 연속 상승', analyzedAt: '3일 전' },
  { id: 'hbm4', title: '방산 수출 사상 최대…관련주 재평가 흐름', analyzedAt: '지난주' },
];

/* ── 로딩: 진행 단계 (F-04) ─────────────────────────────── */
export const analysisSteps: AnalysisStep[] = [
  { label: '뉴스 읽는 중' },
  { label: '핵심 이슈 및 키워드 추출 중' },
  { label: '호재/악재 의견 비교 중' },
  { label: '수혜 산업 그래프 생성 중' },
  { label: '산업 영향도 히트맵 생성 중' },
];

/* ── 로딩: 부유 키워드 칩 ───────────────────────────────── */
export const floatingChips: FloatingChip[] = [
  { label: '# HBM4', tone: 'neutral', x: 22, y: 12, delay: 0 },
  { label: '# 엔비디아', tone: 'neutral', x: 58, y: 20, delay: 0.8 },
  { label: '전기장비', tone: 'teal', x: 8, y: 32, delay: 1.6 },
  { label: '반도체', tone: 'positive', x: 78, y: 44, delay: 0.4 },
  { label: '# TC본더', tone: 'neutral', x: 6, y: 62, delay: 2.0 },
  { label: '# AI 데이터센터', tone: 'neutral', x: 60, y: 76, delay: 1.2 },
  { label: 'IT하드웨어', tone: 'blue', x: 30, y: 86, delay: 0.6 },
];

/* ── 분석 결과 (GET /api/analysis/:id) ──────────────────── */
export const analysisResult: AnalysisResult = {
  id: 'hbm4',
  sector: '반도체',
  verdict: '호재 분석',
  title: "SK하이닉스, 엔비디아 'HBM4' 단독 공급 계약 체결… 역대 최대 규모",
  source: '한국경제',
  publishedAt: '2026.07.05 12:10',
  desk: '산업부',
  analyzedAt: '2026.07.05 14:23',
  engineVersion: '수혜주.com AI v2.1',
  summary:
    "SK하이닉스가 엔비디아의 차세대 AI 가속기 '루빈(Rubin)'에 탑재될 6세대 고대역폭메모리 HBM4를 단독 공급하는 계약을 체결했다. 계약 규모는 역대 HBM 공급 계약 중 최대로, 2027년 말까지의 공급 물량이 사실상 확정된 것으로 알려졌다. 이번 수주로 SK하이닉스는 HBM 시장 점유율 1위 지위를 굳히는 동시에 청주 M15X 팹 증설 투자를 당초 계획보다 앞당길 방침이다. 증권가는 TC본더 등 적층 장비, 공정 소재, 테스트 등 후방 밸류체인 전반의 발주 확대가 뒤따를 것으로 전망하며, AI 데이터센터 증설 가속에 따라 전력기기·기판 업종까지 온기가 확산될 것으로 분석했다. 다만 경쟁사가 HBM4 품질 인증에 진입할 경우 공급 단가 인하 압력이 커질 수 있다는 점은 변수로 지목된다.",
  originUrl: 'https://www.hankyung.com',
  keywords: [
    '# HBM4',
    '# 엔비디아',
    '# SK하이닉스',
    '# AI 데이터센터',
    '# 첨단 패키징',
    '# TC본더',
  ],
  relatedSectors: [
    { name: '반도체', changePct: 8.4 },
    { name: 'IT하드웨어', changePct: 5.2 },
    { name: '전기장비', changePct: 3.1 },
    { name: '운송', changePct: -1.2 },
  ],
  reviewedCount: 42,
  goodSignal: {
    ratio: 72,
    headline: '관련 뉴스와 리포트에서는 긍정적인 해석이 더 많아요.',
    news: [
      { text: 'HBM4 공급 물량 2027년까지 사실상 확정', source: '한국경제' },
      { text: 'AI 가속기 수요 전망 일제히 상향', source: '매경' },
    ],
    reports: [
      { text: '"AI 사이클 초입, 목표가 상향"', source: '미래에셋' },
      { text: '"설비투자 수혜 뚜렷"', source: 'KB증권' },
    ],
    analyst: {
      name: '김OO 애널리스트',
      firm: '미래에셋',
      quote:
        '"AI 인프라 투자는 이제 시작 단계로, 반도체 장비 수요가 구조적으로 늘어날 전망입니다."',
    },
  },
  warnSignal: {
    ratio: 28,
    headline: '단기 과열이나 비용 부담을 우려하는 시각도 있어요.',
    news: [
      { text: '단기 급등 부담 지적', source: '이데일리' },
      { text: '밸류에이션 고평가 논란', source: '서울경제' },
    ],
    reports: [
      { text: '"단기 과열 구간 유의"', source: '하나증권' },
      { text: '"투자비 부담에 마진 압박 가능"', source: '신한' },
    ],
    analyst: {
      name: '이OO 애널리스트',
      firm: '하나증권',
      quote:
        '"기대는 크지만 실적이 뒷받침되지 못하면 변동성이 커질 수 있어 분할 접근이 필요합니다."',
    },
  },
  spreadNodes: [
    { id: 'origin', name: 'HBM4 수주 뉴스', tier: 0, row: 0.5 },
    { id: 'hbm', name: 'HBM·메모리', tier: 1, changePct: 8.4, row: 0.18 },
    { id: 'equip', name: '반도체 장비', tier: 1, changePct: 4.9, row: 0.5 },
    { id: 'dc', name: 'AI 데이터센터', tier: 1, changePct: 3.5, row: 0.82 },
    { id: 'pkg', name: '첨단 패키징·후공정', tier: 2, changePct: 4.8, row: 0.08 },
    { id: 'material', name: '반도체 소재', tier: 2, changePct: 3.4, row: 0.3 },
    { id: 'test', name: '테스트·계측', tier: 2, changePct: 2.6, row: 0.5 },
    { id: 'server', name: 'AI 서버·기판', tier: 2, changePct: 3.9, row: 0.7 },
    { id: 'power', name: '전력기기', tier: 2, changePct: 3.7, row: 0.9 },
    { id: 'gas', name: '특수가스·케미컬', tier: 3, changePct: 1.8, row: 0.16 },
    { id: 'cooling', name: '냉각·열관리', tier: 3, changePct: 2.2, row: 0.44 },
    { id: 'grid', name: '전력망·ESS', tier: 3, changePct: 2.1, row: 0.68 },
    { id: 'wire', name: '변압기·전선', tier: 3, changePct: 2.4, row: 0.9 },
  ],
  spreadEdges: [
    {
      from: 'origin',
      to: 'hbm',
      reason: 'HBM4 단독 공급으로 메모리 매출·점유율 직접 수혜',
      sources: ['한국경제 · HBM4 단독 공급 계약', '매경 · HBM 시장 점유율 전망'],
    },
    {
      from: 'origin',
      to: 'equip',
      reason: 'M15X 팹 증설 앞당김 → 장비 발주 확대',
      sources: ['한국경제 · 청주 M15X 증설 계획'],
    },
    {
      from: 'origin',
      to: 'dc',
      reason: 'AI 가속기 출하 확대 → 데이터센터 증설 가속',
      sources: ['매경 · AI 데이터센터 투자 동향'],
    },
    {
      from: 'hbm',
      to: 'pkg',
      reason: 'HBM 적층 물량 증가 → TC본더 등 후공정 수요 확대',
      sources: ['이데일리 · 후공정 장비 발주 전망'],
    },
    {
      from: 'hbm',
      to: 'material',
      reason: '생산 물량 확대 → 공정 소재 사용량 동반 증가',
      sources: ['서울경제 · 반도체 소재 수급'],
    },
    {
      from: 'equip',
      to: 'test',
      reason: '장비 증설 → 수율 검증용 테스트·계측 수요 확대',
      sources: ['전자신문 · 테스트 장비 시장'],
    },
    {
      from: 'dc',
      to: 'server',
      reason: '데이터센터 증설 → AI 서버·고다층 기판 수요 증가',
      sources: ['디지털타임스 · AI 서버 출하 전망'],
    },
    {
      from: 'dc',
      to: 'power',
      reason: '전력 소모 급증 → 전력기기 발주 확대',
      sources: ['연합인포맥스 · 데이터센터 전력 수요'],
    },
    {
      from: 'pkg',
      to: 'gas',
      reason: '후공정 가동률 상승 → 특수가스·케미컬 소비 증가',
      sources: ['머니투데이 · 특수가스 수요'],
    },
    {
      from: 'server',
      to: 'cooling',
      reason: '고밀도 서버 발열 → 냉각·열관리 솔루션 수요',
      sources: ['전자신문 · 液冷 시장 전망'],
    },
    {
      from: 'server',
      to: 'grid',
      reason: '전력 사용량 증가 → 전력망 증설·ESS 수요',
      sources: ['연합인포맥스 · 전력망 투자'],
    },
    {
      from: 'power',
      to: 'wire',
      reason: '전력 인프라 투자 → 변압기·전선 수주 확대',
      sources: ['한국경제 · 변압기 수출 동향'],
    },
  ],
  heatmap: [
    { sector: '반도체', changePct: 8.4, area: 'semi', weight: 1 },
    { sector: '반도체 소재·부품', changePct: 4.6, area: 'material', weight: 0.6 },
    { sector: '기계·장비', changePct: 3.8, area: 'machine', weight: 0.5 },
    { sector: 'IT하드웨어', changePct: 5.2, area: 'it', weight: 0.7 },
    { sector: '전기장비', changePct: 3.1, area: 'electric', weight: 0.45 },
    { sector: '화학', changePct: 1.9, area: 'chemical', weight: 0.3 },
    { sector: '운송', changePct: -1.2, area: 'transport', weight: 0.35 },
    { sector: '유틸리티', changePct: -0.8, area: 'utility', weight: 0.25 },
  ],
  knowledgeNodes: [
    { id: 'semi', name: '반도체', group: 'center', x: 50, y: 52 },
    { id: 'equip', name: '반도체 장비', group: 'tier1', x: 41, y: 56 },
    { id: 'hbm', name: 'HBM·메모리', group: 'tier1', x: 58, y: 62 },
    { id: 'pkg', name: '첨단 패키징', group: 'tier1', x: 55, y: 44 },
    { id: 'power', name: '전력기기', group: 'tier1', x: 52, y: 40 },
    { id: 'dc', name: 'AI 데이터센터', group: 'tier1', x: 42, y: 40 },
    { id: 'it', name: 'IT하드웨어', group: 'tier1', x: 38, y: 66 },
    { id: 'software', name: '소프트웨어', group: 'tier2', x: 44, y: 30 },
    { id: 'battery', name: '2차전지', group: 'tier2', x: 30, y: 74 },
    { id: 'autoparts', name: '자동차부품', group: 'tier2', x: 26, y: 66 },
    { id: 'test', name: '테스트·검사', group: 'tier2', x: 44, y: 78 },
    { id: 'display', name: '디스플레이', group: 'tier2', x: 40, y: 88 },
    { id: 'gas', name: '특수가스', group: 'tier2', x: 62, y: 68 },
    { id: 'car', name: '자동차', group: 'tier2', x: 72, y: 66 },
    { id: 'steel', name: '철강', group: 'etc', x: 80, y: 58 },
    { id: 'construction', name: '건설', group: 'etc', x: 74, y: 34 },
    { id: 'chemical', name: '화학', group: 'etc', x: 26, y: 42 },
    { id: 'grid', name: '전력망·ESS', group: 'tier2', x: 30, y: 46 },
    { id: 'wire', name: '변압기·전선', group: 'tier2', x: 64, y: 38 },
    { id: 'bio', name: '제약·바이오', group: 'etc', x: 66, y: 26 },
    { id: 'renewable', name: '신재생에너지', group: 'etc', x: 56, y: 20 },
    { id: 'stock', name: '증권', group: 'etc', x: 34, y: 22 },
    { id: 'retail', name: '유통', group: 'etc', x: 22, y: 28 },
    { id: 'game', name: '게임', group: 'etc', x: 24, y: 84 },
    { id: 'media', name: '미디어·엔터', group: 'etc', x: 58, y: 86 },
    { id: 'platform', name: '인터넷 플랫폼', group: 'etc', x: 52, y: 92 },
    { id: 'machine', name: '기계', group: 'tier2', x: 50, y: 46 },
  ],
  knowledgeEdges: [
    { from: 'semi', to: 'equip' },
    { from: 'semi', to: 'hbm' },
    { from: 'semi', to: 'pkg' },
    { from: 'semi', to: 'dc' },
    { from: 'semi', to: 'it' },
    { from: 'semi', to: 'power' },
    { from: 'semi', to: 'machine' },
    { from: 'equip', to: 'test' },
    { from: 'equip', to: 'chemical' },
    { from: 'hbm', to: 'gas' },
    { from: 'hbm', to: 'display' },
    { from: 'pkg', to: 'gas' },
    { from: 'pkg', to: 'wire' },
    { from: 'power', to: 'wire' },
    { from: 'power', to: 'grid' },
    { from: 'power', to: 'construction' },
    { from: 'dc', to: 'software' },
    { from: 'dc', to: 'grid' },
    { from: 'dc', to: 'renewable' },
    { from: 'it', to: 'battery' },
    { from: 'it', to: 'autoparts' },
    { from: 'it', to: 'platform' },
    { from: 'software', to: 'stock' },
    { from: 'software', to: 'game' },
    { from: 'battery', to: 'car' },
    { from: 'autoparts', to: 'car' },
    { from: 'car', to: 'steel' },
    { from: 'display', to: 'media' },
    { from: 'platform', to: 'media' },
    { from: 'retail', to: 'stock' },
    { from: 'bio', to: 'renewable' },
  ],
  topStocks: {
    'HBM·메모리': [
      { name: 'SK하이닉스', changePct: 8.9 },
      { name: '삼성전자', changePct: 3.2 },
      { name: '한미반도체', changePct: 7.4 },
      { name: '디아이', changePct: 5.1 },
      { name: '테크윙', changePct: 4.6 },
    ],
    '반도체 장비': [
      { name: '한미반도체', changePct: 7.4 },
      { name: '주성엔지니어링', changePct: 4.2 },
      { name: '원익IPS', changePct: 3.8 },
      { name: '피에스케이', changePct: 3.1 },
      { name: '유진테크', changePct: 2.7 },
    ],
    'AI 데이터센터': [
      { name: 'LS ELECTRIC', changePct: 4.4 },
      { name: 'HD현대일렉트릭', changePct: 3.9 },
      { name: '삼성물산', changePct: 2.2 },
      { name: 'GS건설', changePct: 1.8 },
      { name: 'SK가스', changePct: 1.1 },
    ],
    '첨단 패키징·후공정': [
      { name: '한미반도체', changePct: 7.4 },
      { name: '이오테크닉스', changePct: 5.5 },
      { name: '하나마이크론', changePct: 4.8 },
      { name: 'SFA반도체', changePct: 3.6 },
      { name: '네패스', changePct: 2.9 },
    ],
    '반도체 소재': [
      { name: '동진쎄미켐', changePct: 4.1 },
      { name: '솔브레인', changePct: 3.5 },
      { name: '한솔케미칼', changePct: 3.0 },
      { name: 'SK머티리얼즈', changePct: 2.6 },
      { name: '이엔에프테크', changePct: 2.2 },
    ],
    '테스트·계측': [
      { name: '리노공업', changePct: 3.4 },
      { name: 'ISC', changePct: 2.9 },
      { name: '티에스이', changePct: 2.5 },
      { name: '엑시콘', changePct: 2.0 },
      { name: '네오셈', changePct: 1.7 },
    ],
    'AI 서버·기판': [
      { name: '이수페타시스', changePct: 5.2 },
      { name: '대덕전자', changePct: 3.7 },
      { name: '심텍', changePct: 3.1 },
      { name: '코리아써키트', changePct: 2.4 },
      { name: '티엘비', changePct: 2.0 },
    ],
    전력기기: [
      { name: 'HD현대일렉트릭', changePct: 4.8 },
      { name: 'LS ELECTRIC', changePct: 4.4 },
      { name: '효성중공업', changePct: 3.9 },
      { name: '일진전기', changePct: 3.2 },
      { name: '제룡전기', changePct: 2.8 },
    ],
    '특수가스·케미컬': [
      { name: '원익머트리얼즈', changePct: 2.4 },
      { name: 'SK스페셜티', changePct: 2.0 },
      { name: '티이엠씨', changePct: 1.8 },
      { name: '후성', changePct: 1.4 },
      { name: '덕산테코피아', changePct: 1.1 },
    ],
    '냉각·열관리': [
      { name: '케이엔솔', changePct: 3.1 },
      { name: 'GST', changePct: 2.7 },
      { name: '유니셈', changePct: 2.3 },
      { name: '에스앤에스텍', changePct: 1.9 },
      { name: '태경케미컬', changePct: 1.5 },
    ],
    '전력망·ESS': [
      { name: 'LS', changePct: 2.9 },
      { name: '효성중공업', changePct: 2.5 },
      { name: '서진시스템', changePct: 2.2 },
      { name: '삼화콘덴서', changePct: 1.8 },
      { name: '비나텍', changePct: 1.4 },
    ],
    '변압기·전선': [
      { name: '제룡전기', changePct: 3.3 },
      { name: 'LS전선아시아', changePct: 2.8 },
      { name: '대한전선', changePct: 2.5 },
      { name: '가온전선', changePct: 2.1 },
      { name: '일진전기', changePct: 1.9 },
    ],
    반도체: [
      { name: 'SK하이닉스', changePct: 8.9 },
      { name: '삼성전자', changePct: 3.2 },
      { name: '한미반도체', changePct: 7.4 },
      { name: 'DB하이텍', changePct: 2.8 },
      { name: '리노공업', changePct: 3.4 },
    ],
    '반도체 소재·부품': [
      { name: '동진쎄미켐', changePct: 4.1 },
      { name: '솔브레인', changePct: 3.5 },
      { name: '한솔케미칼', changePct: 3.0 },
      { name: '원익QnC', changePct: 2.7 },
      { name: '월덱스', changePct: 2.3 },
    ],
    '기계·장비': [
      { name: '두산로보틱스', changePct: 3.2 },
      { name: 'HD현대인프라코어', changePct: 2.6 },
      { name: '두산밥캣', changePct: 2.1 },
      { name: 'SNT다이내믹스', changePct: 1.8 },
      { name: '현대에버다임', changePct: 1.5 },
    ],
    IT하드웨어: [
      { name: '이수페타시스', changePct: 5.2 },
      { name: '삼성전기', changePct: 3.4 },
      { name: 'LG이노텍', changePct: 2.7 },
      { name: '대덕전자', changePct: 3.7 },
      { name: '심텍', changePct: 3.1 },
    ],
    전기장비: [
      { name: 'HD현대일렉트릭', changePct: 4.8 },
      { name: 'LS ELECTRIC', changePct: 4.4 },
      { name: '효성중공업', changePct: 3.9 },
      { name: '산일전기', changePct: 3.0 },
      { name: '제룡전기', changePct: 2.8 },
    ],
    화학: [
      { name: 'LG화학', changePct: 1.4 },
      { name: '롯데케미칼', changePct: 1.1 },
      { name: '금호석유', changePct: 0.9 },
      { name: '한화솔루션', changePct: 0.7 },
      { name: '코오롱인더', changePct: 0.5 },
    ],
    운송: [
      { name: 'HMM', changePct: -1.8 },
      { name: '대한항공', changePct: -1.2 },
      { name: '팬오션', changePct: -0.9 },
      { name: 'CJ대한통운', changePct: -0.7 },
      { name: '현대글로비스', changePct: -0.4 },
    ],
    유틸리티: [
      { name: '한국전력', changePct: -1.1 },
      { name: '한국가스공사', changePct: -0.8 },
      { name: '지역난방공사', changePct: -0.6 },
      { name: 'SK가스', changePct: -0.3 },
      { name: 'E1', changePct: -0.2 },
    ],
  },
};

/** 분석 결과 조회 — FE 연동 시 이 함수만 API 호출(GET /api/analysis/:id)로 교체 */
export function getAnalysis(id: string): AnalysisResult {
  // 프로토타입: id와 무관하게 동일 mock을 반환한다
  void id;
  return analysisResult;
}
