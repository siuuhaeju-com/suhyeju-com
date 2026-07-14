/**
 * GPT 클라이언트 + 뉴스 분석 (analyze 파이프라인 ②단계).
 *
 * OPENAI_API_KEY가 있으면 실제 호출, 없으면 mock 폴백.
 *   - GPT_BASE_URL 있음 → 엘리스 OpenAI 호환 프록시(기본 모델 openai/gpt-5.4)
 *   - GPT_BASE_URL 없음 → 표준 OpenAI(api.openai.com, 기본 모델 gpt-4o, 키 sk-…)
 * 모델은 GPT_MODEL로 덮어쓸 수 있다. 키·주소는 .env.local에서 읽는다.
 */
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다 (.env.local 확인)');
  }
  // GPT_BASE_URL 있으면 엘리스 게이트웨이, 없으면 표준 OpenAI(baseURL 생략).
  const baseURL = process.env.GPT_BASE_URL || undefined;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

/**
 * 호출할 모델명. GPT_MODEL로 지정하거나, base_url 유무로 기본값을 고른다.
 *   - 게이트웨이(GPT_BASE_URL 있음) → 'openai/gpt-5.4'
 *   - 표준 OpenAI(없음)            → 'gpt-4o'
 */
function resolveModel(): string {
  if (process.env.GPT_MODEL) return process.env.GPT_MODEL;
  return process.env.GPT_BASE_URL ? 'openai/gpt-5.4' : 'gpt-4o';
}

/* ── AnalysisResult 중 "GPT가 생성"하는 부분의 스키마 ──
 * 제외(서버/FE 파생): SpreadNode.row · KnowledgeNode.x/y
 * topStocks: 동적 키(Record) 회피 위해 배열로 받고 서버에서 Record로 변환
 * changePct: GPT 초안값. ③단계에서 네이버 실시세로 교체
 * impact: 노드별 영향도(부호=방향, |1~100|=강도) — 시세가 아니라 GPT의 분석값 (F-16)
 */
const zSignalItem = z.object({ text: z.string(), source: z.string() });

// 관련 뉴스 — searchQuery로 서버가 실제 기사를 검색해 링크(url)를 붙인다(reports엔 없음).
const zSignalNewsItem = z.object({
  text: z.string(),
  source: z.string(),
  searchQuery: z.string(),
});

const zSignalGroup = z.object({
  ratio: z.number(), // 좋은/주의 신호 비율(%)
  headline: z.string(),
  news: z.array(zSignalNewsItem),
  reports: z.array(zSignalItem),
  analyst: z.object({ name: z.string(), firm: z.string(), quote: z.string() }),
});

const zSpreadNode = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), // 0=뉴스 원점, 1·2·3=파급 단계
  // 이슈가 이 섹터에 미치는 영향 — 부호=방향(+긍정/−부정), |값|=강도(1~100). tier 0은 0.
  impact: z.number(),
});

const zSpreadEdge = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string(),
  // 근거 뉴스는 LLM이 생성하지 않는다 — 서버가 이 검색어로 네이버 뉴스를 검색해
  // 실제 기사(제목·언론사·URL)를 sources로 매핑한다(analyze.ts joinSources).
  searchQuery: z.string(),
});

const zKnowledgeNode = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(['center', 'tier1', 'tier2', 'etc']),
});

// ── 3분할 스키마 (응답시간 단축: 큰 생성 1회를 3콜 병렬로) ──
// A: 텍스트/여론 · B: 파급+히트맵+종목(서로 참조) · C: 지식그래프
const SchemaA = z.object({
  sector: z.string(),
  verdict: z.string(), // "호재 분석" / "악재 분석"
  summary: z.string(),
  keywords: z.array(z.string()),
  relatedSectors: z.array(z.object({ name: z.string(), changePct: z.number() })),
  reviewedCount: z.number().int(),
  goodSignal: zSignalGroup,
  warnSignal: zSignalGroup,
});

const SchemaB = z.object({
  spreadNodes: z.array(zSpreadNode),
  spreadEdges: z.array(zSpreadEdge),
  // 그래프 섹션 해설 — "이 그림이 말하는 것" 한 문단 (F-16, sectionNotes.spread로 전달)
  spreadNote: z.string(),
  // topStocks는 spreadNodes와 같은 콜에서 생성해 섹터명을 일관되게(툴팁·시세 join 매칭).
  topStocks: z.array(
    z.object({
      sector: z.string(),
      stocks: z.array(z.object({ name: z.string(), changePct: z.number() })),
    }),
  ),
});

const SchemaC = z.object({
  knowledgeNodes: z.array(zKnowledgeNode),
  knowledgeEdges: z.array(z.object({ from: z.string(), to: z.string() })),
  // 지식그래프 섹션 해설 — 한 문단 (F-16, sectionNotes.knowledge로 전달)
  knowledgeNote: z.string(),
});

// 전체 스키마 = 3분할 병합 (타입·mock용)
export const AnalysisSchema = SchemaA.merge(SchemaB).merge(SchemaC);

export type AnalysisDraft = z.infer<typeof AnalysisSchema>;

const COMMON = `당신은 증시 전문 애널리스트입니다. 먼저 뉴스의 **핵심 시장을 판별**합니다:
- 핵심 주체가 한국 기업·한국 경제 이슈면 → **한국 시장 관점**(한국 산업·종목).
- 핵심 주체가 미국·글로벌 기업(예: 엔비디아·애플·테슬라)이면 → **미국 시장 관점**(미국 산업·종목).
판별한 관점을 sector·spreadNodes·relatedSectors·topStocks **전체에 일관되게** 적용합니다(두 시장을 한 분석에 섞지 않음). 모든 텍스트는 한국어로 작성하되, 종목명은 시세 조회가 되도록 널리 쓰이는 표기를 씁니다(한국: 종목명, 미국: 엔비디아·애플 등 한글 표기 또는 티커). changePct는 부호 포함(상승 +, 하락 −)으로 방향성만 추정합니다(실제 시세는 서버가 교체).
사용자 메시지 맨 앞에 "제목: …"·"출처: …" 줄이 주어지면 그것이 분석 대상 원문 기사입니다(맥락 참고용).`;

const PROMPT_A = `${COMMON}

아래 뉴스의 핵심을 요약하고 여론 신호를 정리합니다.
- sector: 뉴스의 핵심 산업 1개. verdict: "호재 분석" 또는 "악재 분석".
- summary: 2~3문장 요약. keywords: 핵심 키워드 5개 내외. reviewedCount: 검토한 자료 수(정수).
- relatedSectors: 관련 산업과 방향성 3개 내외.
- goodSignal(좋은 신호)/warnSignal(주의 신호): ratio(%)·headline·news·reports·analyst(name/firm/quote).
- news 각 항목의 searchQuery: 그 뉴스의 근거가 될 **실제 언론사 기사를 찾기 위한 검색어**입니다(핵심 명사 2~4개, 조사 없이. 예: "HBM 공급 계약"). 서버가 이 검색어로 네이버 뉴스를 검색해 실제 기사 링크를 붙입니다 — 제목·URL을 지어내지 마세요. reports·analyst엔 searchQuery가 없습니다.`;

const PROMPT_B = `${COMMON}

이 뉴스의 이슈가 어느 산업으로 번지는지 1→2→3차 파급 경로를 **깊고 구체적으로** 분석합니다.
## 파급 그래프 (spreadNodes/spreadEdges)
- **반드시 tier 0·1·2·3을 모두 채웁니다. tier 2·3을 생략하면 안 됩니다.**
  - tier 0: 뉴스의 원점 (정확히 1개)
  - tier 1: 뉴스에서 **직접** 수혜/타격받는 산업 (수혜 2~3개 + **부정 영향(경쟁사·대체재·비용 부담 등) 1~2개** — 뉴스 성격상 부정 파급이 정말 없으면 0개 허용)
  - tier 2: tier 1 산업의 **공급망(전방·후방)**으로 번지는 산업 (2~3개)
  - tier 3: tier 2에서 **한 단계 더** 확산되는 산업 (1~2개)
- spreadNodes는 **전체 최소 7개** 이상, 각 노드에 고유 id.
- impact: 이슈가 그 섹터에 미치는 **영향의 강도와 방향**입니다(등락률·시세 아님). 부호 포함, |impact|는 1~100.
  - 긍정(수혜) 영향은 +, 부정(타격) 영향은 −. tier 0(원점)은 0.
  - 뉴스에 가까운·직접 영향일수록 크게: tier1 = 60~100, tier2 = 30~60, tier3 = 10~30.
- **tier N(N≥1)의 모든 노드는 tier N-1의 어떤 노드로부터 spreadEdges 연결을 최소 1개 받습니다 (고립 노드 금지).** 부정 노드도 동일하며, reason에 왜 타격인지 씁니다.
- spreadEdges의 from/to는 반드시 존재하는 spreadNodes id, reason에 한 줄 근거.
- spreadEdges.searchQuery: 그 연결의 근거가 될 **실제 언론사 기사를 찾기 위한 뉴스 검색어**입니다.
  근거 기사의 제목·URL을 직접 지어내는 것은 **절대 금지** — 서버가 이 검색어로 네이버 뉴스를 검색해 실제 기사를 연결합니다.
  검색이 잘 되도록 조사 없이 핵심 명사 2~4개로 씁니다(예: "우주항공 부품 주가", "HBM 소재 수급").
  뉴스 원문에만 있는 고유 표현보다 **언론이 흔히 쓰는 일반 용어**를 쓰고, **edge마다 그 연결에 특정된 서로 다른 검색어**를 씁니다.
## 그래프 해설 (spreadNote)
- 이 그래프가 보여주는 파급 흐름의 의미를 **투자 초보도 이해할 한 문단(2~3문장)**으로 요약합니다.
  어떤 이슈가 어느 산업으로 번지고, 어디가 가장 강한 수혜/타격인지를 짚습니다. 과장 없이 중립 톤.
## 종목 (topStocks)
- **spreadNodes의 tier 1·2·3 섹터 각각에 대해**(빠짐없이 전부) topStocks 항목을 하나씩 만듭니다.
- 각 sector 이름을 해당 spreadNodes의 name과 **일치**시키고, 대표 종목을 **정확히 5개**(Top5) 담습니다.
- 판별한 시장 관점을 따릅니다(미국 관점이면 미국 종목).
- name 표기 규칙(시세·링크 매칭에 직결되므로 엄수):
  - 한국 종목: 정식 상장명 (예: 삼성전자, SK하이닉스, 한미반도체)
  - 미국 종목: **티커**(예: RTX, NVDA, BA, LMT)로 씁니다. "Boeing"·"Lockheed Martin" 같은 **영문 회사명 표기는 금지** — 네이버증권 종목 매칭에 실패합니다.`;

const PROMPT_C = `${COMMON}

이 뉴스와 관련된 산업 지식그래프를 구성합니다.
- knowledgeNodes/knowledgeEdges: 중심 산업과 연관 산업을 group(center/tier1/tier2/etc)으로 구성하고, edge의 from/to는 존재하는 knowledgeNodes id를 참조합니다.
- knowledgeNote: 이 지식그래프가 보여주는 산업 연결 구조의 의미를 **투자 초보도 이해할 한 문단(2~3문장)**으로 요약합니다. 과장 없이 중립 톤.`;

/** GPT에게 넘길 기사 메타 — 있으면 원문 제목·출처를 근거 인용에 그대로 쓰게 한다. */
export interface ArticleInput {
  text: string;
  title?: string;
  source?: string;
}

/** 사용자 메시지 맨 앞에 제목·출처 줄을 붙인다(없으면 본문만). */
function buildUserMessage({ text, title, source }: ArticleInput): string {
  const lines = [];
  if (title) lines.push(`제목: ${title}`);
  if (source) lines.push(`출처: ${source}`);
  return lines.length ? `${lines.join('\n')}\n\n${text}` : text;
}

/**
 * 뉴스 본문을 분석해 AnalysisResult 초안(GPT 생성 부분)을 반환한다.
 *
 * 실호출 조건: OPENAI_API_KEY가 있고 MOCK_ANALYZE 강제가 아닐 때.
 *   - 키 없음 / MOCK_ANALYZE=1 → 샘플 초안(mock) 반환.
 *   - 키 있음 + GPT_BASE_URL 있음 → 엘리스 게이트웨이 호출.
 *   - 키 있음 + GPT_BASE_URL 없음 → 표준 OpenAI 직접 호출.
 */
export async function analyzeNews(article: ArticleInput): Promise<AnalysisDraft> {
  const forceMock = process.env.MOCK_ANALYZE === '1' || process.env.MOCK_ANALYZE === 'true';
  const hasKey = !!process.env.OPENAI_API_KEY;

  // 실호출 조건: 키가 있고 mock 강제가 아닐 때. 키가 없으면 mock 폴백(개발·데모 가능).
  if (forceMock || !hasKey) {
    console.warn(
      `[analyzeNews] mock 모드로 동작합니다 (${
        forceMock ? 'MOCK_ANALYZE 강제' : 'OPENAI_API_KEY 미설정'
      }). OPENAI_API_KEY를 .env.local에 채우면 실제 호출로 전환됩니다.`,
    );
    return mockAnalysis(article.text);
  }

  const client = getClient();
  const model = resolveModel();
  console.log(
    `[analyzeNews] 실호출: model=${model}, gateway=${process.env.GPT_BASE_URL ? 'elice' : 'openai'}`,
  );

  const userMessage = buildUserMessage(article);

  // 3분할 병렬 호출 — 큰 생성 1회를 텍스트/파급+종목/지식그래프로 쪼개 응답시간 단축.
  const call = <T extends z.ZodType>(prompt: string, schema: T, name: string) =>
    client.chat.completions.parse({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
      response_format: zodResponseFormat(schema, name),
      max_completion_tokens: 3500,
    });

  const [a, b, c] = await Promise.all([
    call(PROMPT_A, SchemaA, 'analysisA'),
    call(PROMPT_B, SchemaB, 'analysisB'),
    call(PROMPT_C, SchemaC, 'analysisC'),
  ]);

  const parsedA = a.choices[0]?.message.parsed;
  const parsedB = b.choices[0]?.message.parsed;
  const parsedC = c.choices[0]?.message.parsed;
  if (!parsedA || !parsedB || !parsedC) {
    throw new Error('GPT 분석 결과 파싱에 실패했습니다');
  }
  return { ...parsedA, ...parsedB, ...parsedC };
}

/**
 * base_url 미확보 동안 파이프라인·FE 데모를 굴리기 위한 샘플 초안.
 * 시나리오: "AI 반도체 수요 급증" 호재가 한국 반도체 밸류체인으로 번지는 케이스.
 * 스키마 참조 무결성(tier0 1개 · edge가 존재하는 id 참조 · topStocks.sector↔spreadNodes.name)을
 * 지켜서 assemble/deriveRows와 FE 렌더가 깨지지 않게 구성.
 */
function mockAnalysis(articleText: string): AnalysisDraft {
  // 본문 일부를 요약 말미에 녹여 "이 기사를 읽은" 느낌만 살린다(고정 시나리오는 유지).
  const snippet = articleText.replace(/\s+/g, ' ').trim().slice(0, 60);

  return {
    sector: '반도체',
    verdict: '호재 분석',
    summary: `AI 반도체 수요 급증이 한국 반도체 밸류체인(HBM·장비·소재·후공정)으로 파급되는 호재로 판단됩니다. 원문 요지: "${snippet}…"`,
    keywords: ['AI 반도체', 'HBM', '수요 급증', '국산화', '밸류체인'],
    relatedSectors: [
      { name: '반도체 소재·부품·장비', changePct: 3.2 },
      { name: 'IT 하드웨어', changePct: 1.8 },
      { name: '디스플레이', changePct: 0.9 },
    ],
    reviewedCount: 42,
    goodSignal: {
      ratio: 78,
      headline: 'AI 가속기 수요가 HBM·후공정 투자 확대로 직결',
      news: [
        {
          text: '글로벌 클라우드 CAPEX 상향으로 HBM 주문 증가',
          source: '샘플뉴스',
          searchQuery: '클라우드 CAPEX HBM 수요',
        },
        {
          text: '국내 장비사 수주잔고 사상 최대',
          source: '샘플뉴스',
          searchQuery: '반도체 장비 수주잔고',
        },
      ],
      reports: [{ text: 'HBM3E 믹스 확대로 메모리 ASP 반등 전망', source: '샘플리포트' }],
      analyst: {
        name: '홍길동',
        firm: '샘플증권',
        quote: 'AI 사이클 수혜는 메모리에서 소부장으로 확산될 것.',
      },
    },
    warnSignal: {
      ratio: 22,
      headline: '단기 급등에 따른 밸류에이션 부담',
      news: [
        {
          text: '일부 종목 단기 과열 지표 진입',
          source: '샘플뉴스',
          searchQuery: '반도체 단기 과열',
        },
      ],
      reports: [{ text: '환율·전방 수요 변동성은 리스크 요인', source: '샘플리포트' }],
      analyst: {
        name: '김철수',
        firm: '샘플투자',
        quote: '실적 확인 전까지는 변동성 확대에 유의.',
      },
    },
    // impact: 부호=방향(+수혜/−타격), |값|=강도. 부정 파급(tier1)도 포함 (F-16).
    spreadNodes: [
      { id: 'n0', name: 'AI 반도체 수요 급증', tier: 0, impact: 0 },
      { id: 'n1', name: 'HBM', tier: 1, impact: 90 },
      { id: 'n2', name: '반도체 장비', tier: 1, impact: 65 },
      { id: 'n6', name: '레거시 D램', tier: 1, impact: -35 },
      { id: 'n3', name: '반도체 소재', tier: 2, impact: 45 },
      { id: 'n4', name: '후공정(OSAT)', tier: 2, impact: 40 },
      { id: 'n7', name: '파운드리 경쟁', tier: 2, impact: -30 },
      { id: 'n5', name: '전력·냉각', tier: 3, impact: 25 },
    ],
    spreadEdges: [
      {
        from: 'n0',
        to: 'n1',
        reason: 'AI 가속기 수요가 HBM 주문으로 직결',
        searchQuery: 'AI 반도체 HBM 수요',
      },
      {
        from: 'n0',
        to: 'n2',
        reason: '증설 사이클로 장비 발주 확대',
        searchQuery: '반도체 장비 수주 증가',
      },
      {
        from: 'n0',
        to: 'n6',
        reason: 'AI 메모리로 캐파·수요가 이동해 범용 D램 비중 축소',
        searchQuery: '레거시 D램 수요 둔화',
      },
      {
        from: 'n1',
        to: 'n3',
        reason: 'HBM 생산 확대가 소재 수요를 견인',
        searchQuery: 'HBM 반도체 소재 수급',
      },
      {
        from: 'n2',
        to: 'n4',
        reason: '전공정 증설이 후공정 병목을 유발',
        searchQuery: '반도체 후공정 패키징 투자',
      },
      {
        from: 'n1',
        to: 'n7',
        reason: '선단 공정 캐파 선점 경쟁 심화로 중소 파운드리 원가 부담',
        searchQuery: '파운드리 경쟁 심화',
      },
      {
        from: 'n4',
        to: 'n5',
        reason: '후공정 패키징 고도화가 고발열 칩 확산과 전력·냉각 수요 증가로 이어짐',
        searchQuery: 'AI 데이터센터 전력 냉각 수요',
      },
    ],
    spreadNote:
      'AI 반도체 수요 급증이 HBM과 반도체 장비에 가장 강한 수혜로 작용하고, 그 여파가 소재·후공정을 거쳐 전력·냉각 산업까지 번지는 흐름입니다. 반면 수요와 생산 능력이 AI 쪽으로 쏠리면서 레거시 D램과 중소 파운드리는 상대적으로 타격을 받을 수 있습니다.',
    knowledgeNodes: [
      { id: 'k0', name: 'AI 반도체', group: 'center' },
      { id: 'k1', name: 'HBM', group: 'tier1' },
      { id: 'k2', name: '반도체 장비', group: 'tier1' },
      { id: 'k3', name: '소재', group: 'tier2' },
      { id: 'k4', name: '후공정', group: 'tier2' },
      { id: 'k5', name: '전력·냉각', group: 'etc' },
    ],
    knowledgeEdges: [
      { from: 'k0', to: 'k1' },
      { from: 'k0', to: 'k2' },
      { from: 'k1', to: 'k3' },
      { from: 'k2', to: 'k4' },
      { from: 'k1', to: 'k5' },
    ],
    knowledgeNote:
      'AI 반도체를 중심으로 HBM·장비가 1차로 연결되고, 그 아래로 소재·후공정·전력 인프라가 이어지는 밸류체인 구조입니다. 중심 산업의 업황 변화가 연결된 산업들로 순차적으로 전달되는 경로를 보여줍니다.',
    topStocks: [
      {
        sector: 'HBM',
        stocks: [
          { name: 'SK하이닉스', changePct: 5.2 },
          { name: '삼성전자', changePct: 3.5 },
          { name: '한미반도체', changePct: 6.1 },
          { name: '디아이', changePct: 4.0 },
          { name: '테크윙', changePct: 3.1 },
        ],
      },
      {
        sector: '반도체 장비',
        stocks: [
          { name: '한미반도체', changePct: 6.1 },
          { name: '주성엔지니어링', changePct: 3.3 },
          { name: '원익IPS', changePct: 2.8 },
          { name: '피에스케이', changePct: 2.2 },
          { name: '유진테크', changePct: 1.9 },
        ],
      },
      {
        sector: '반도체 소재',
        stocks: [
          { name: '동진쎄미켐', changePct: 2.4 },
          { name: '솔브레인', changePct: 1.7 },
          { name: '한솔케미칼', changePct: 1.5 },
          { name: 'SK머티리얼즈', changePct: 1.2 },
          { name: '이엔에프테크', changePct: 1.0 },
        ],
      },
      {
        sector: '후공정(OSAT)',
        stocks: [
          { name: '하나마이크론', changePct: 2.9 },
          { name: 'SFA반도체', changePct: 1.8 },
          { name: '이오테크닉스', changePct: 1.6 },
          { name: '네패스', changePct: 1.3 },
          { name: '테스나', changePct: 1.1 },
        ],
      },
      {
        sector: '전력·냉각',
        stocks: [
          { name: 'LS ELECTRIC', changePct: 1.9 },
          { name: 'HD현대일렉트릭', changePct: 1.6 },
          { name: '효성중공업', changePct: 1.4 },
          { name: '한전KPS', changePct: 1.0 },
          { name: '비앤비성원', changePct: 0.8 },
        ],
      },
      {
        sector: '파운드리 경쟁',
        stocks: [
          { name: 'DB하이텍', changePct: -1.4 },
          { name: '가온칩스', changePct: -2.1 },
          { name: '에이디테크놀로지', changePct: -1.8 },
          { name: '텔레칩스', changePct: -0.9 },
          { name: '어보브반도체', changePct: -1.2 },
        ],
      },
      {
        sector: '레거시 D램',
        stocks: [
          { name: '제주반도체', changePct: -2.3 },
          { name: '피델릭스', changePct: -1.7 },
          { name: '심텍', changePct: -1.1 },
          { name: '티엘비', changePct: -0.8 },
          { name: '엑시콘', changePct: -1.5 },
        ],
      },
    ],
  };
}
