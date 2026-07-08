/**
 * 도메인 타입 — BE API 응답 스키마와 1:1로 맞추는 지점.
 * FE 연동 시 lib/mock-data.ts 를 API 호출로 교체하면 된다. (SETUP-04 스키마 참고)
 */

/** 등락 방향: 긍정=up(레드), 부정=down(블루) — 국내 증시 관례 */
export type Direction = 'up' | 'down';

export interface SectorChange {
  /** 섹터명 (예: 반도체) */
  name: string;
  /** 전일대비 변동폭(%) — 부호 포함 (예: +8.4, -1.2) */
  changePct: number;
  /** 짧은 설명 (메인 섹터 현황 카드에서 사용) */
  description?: string;
}

export interface NewsItem {
  id: string;
  /** 관련 섹터 태그 */
  sector: string;
  /** 태그 색 변형 (메인 인기 뉴스 칩) */
  sectorTone: 'positive' | 'negative' | 'teal' | 'amber';
  source: string;
  /** 상대 시각 텍스트 (예: 6시간 전) */
  publishedAt: string;
  title: string;
  summary: string;
  /** 원문 기사 링크 (네이버 뉴스) */
  url?: string;
}

export interface RecentAnalysis {
  id: string;
  title: string;
  analyzedAt: string;
}

/** 로딩 화면 진행 단계 */
export interface AnalysisStep {
  label: string;
}

/** 로딩 화면 좌측에 부유하는 키워드 칩 */
export interface FloatingChip {
  label: string;
  tone: 'neutral' | 'positive' | 'negative' | 'teal' | 'blue';
  /** 구체 주위 배치 (% 단위 좌표) */
  x: number;
  y: number;
  /** 부유 애니메이션 지연(초) */
  delay: number;
}

/** Top5 종목 현황 (노드·히트맵 hover 툴팁 — F-10) */
export interface TopStock {
  name: string;
  changePct: number;
}

export interface SignalItem {
  text: string;
  source: string;
}

export interface AnalystOpinion {
  name: string;
  firm: string;
  quote: string;
}

/** 전망 분석의 좋은 신호/주의할 신호 카드 */
export interface SignalGroup {
  /** 비율(%) — 좋은 신호 72, 주의할 신호 28 */
  ratio: number;
  headline: string;
  news: SignalItem[];
  reports: SignalItem[];
  analyst: AnalystOpinion;
}

/** 영향력 확산 그래프 노드 */
export interface SpreadNode {
  id: string;
  name: string;
  /** 0=원점(뉴스), 1·2·3=파급 단계 */
  tier: 0 | 1 | 2 | 3;
  changePct?: number;
  /** 같은 열 안에서의 세로 위치 (0~1) */
  row: number;
}

/** 영향력 확산 그래프 연결선 — hover 시 근거 툴팁 (F-09) */
export interface SpreadEdge {
  from: string;
  to: string;
  /** 한 줄 근거 */
  reason: string;
  /** 근거 출처 뉴스 목록 */
  sources: string[];
}

/** 섹터별 영향도 히트맵 셀 */
export interface HeatmapCell {
  sector: string;
  changePct: number;
  /** 트리맵 배치 영역 키 (grid-area) */
  area: string;
  /** 영향도 크기(0~1) — 색 진하기 */
  weight: number;
}

/** 산업 연결 지식그래프 노드 */
export interface KnowledgeNode {
  id: string;
  name: string;
  /** center=중심 산업, tier1/tier2=연관 단계, etc=기타 */
  group: 'center' | 'tier1' | 'tier2' | 'etc';
  x: number;
  y: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
}

/** 분석 페이지 전체 데이터 — GET /api/analysis/:id 응답 형태 */
export interface AnalysisResult {
  id: string;
  sector: string;
  verdict: string;
  title: string;
  source: string;
  publishedAt: string;
  desk: string;
  analyzedAt: string;
  engineVersion: string;
  summary: string;
  originUrl: string;
  keywords: string[];
  relatedSectors: SectorChange[];
  reviewedCount: number;
  goodSignal: SignalGroup;
  warnSignal: SignalGroup;
  spreadNodes: SpreadNode[];
  spreadEdges: SpreadEdge[];
  heatmap: HeatmapCell[];
  knowledgeNodes: KnowledgeNode[];
  knowledgeEdges: KnowledgeEdge[];
  /** 섹터명 → Top5 종목 현황 (F-10 툴팁) */
  topStocks: Record<string, TopStock[]>;
}

/** ─ 시장 히트맵 (Finviz식 트리맵) — 분석용 HeatmapCell과 무관 ─ */
export interface MarketHeatmapStock {
  name: string;
  code: string;
  /** 시가총액 → 트리맵 사각형 크기 */
  marketCap: number;
  /** 등락률 → 색상 */
  changePct: number;
}

export interface MarketHeatmapSector {
  name: string;
  changePct: number;
  stocks: MarketHeatmapStock[];
}

export interface MarketHeatmap {
  market: 'KR' | 'US';
  /** 기준 시각 (ISO) */
  asOf: string;
  /** 장 상태 */
  status: 'OPEN' | 'CLOSE';
  sectors: MarketHeatmapSector[];
}
