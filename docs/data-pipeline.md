# 데이터 가공 파이프라인 (analyze)

> 뉴스 한 건이 `AnalysisResult`가 되기까지의 단일 기준. **무엇을 GPT가 만들고, 무엇을 서버가 채우고, 무엇을 FE가 그리는지**를 여기서 정한다.
>
> 관련 코드: `apps/web/src/lib/extract-article.ts` · `lib/sources/gpt.ts` · `lib/analyze.ts` · `lib/store.ts`
> 계약(타입): `apps/web/src/lib/types.ts` (`AnalysisResult`)
> 엔드포인트: `POST /api/analyze` → `GET /api/analysis/[id]` · `GET /api/analyses/recent`

---

## 0. 대원칙

- **역할 분리:** `GPT = 구조·지능` · `시세 API = 숫자` · `FE = 표현(좌표·색)`
- **GPT는 실시간 시세를 모른다** (물으면 환각) → 모든 `changePct`(등락률)는 반드시 시세 API로 **교체**한다. GPT가 준 값은 방향성 힌트(초안)일 뿐이다.
- **추출 본문은 영구 저장 금지** — 요청 처리 중 메모리에만 둔다(법적 리스크, §1 참고).
- **표현용 필드는 GPT 스키마에서 뺀다** — GPT가 좌표·색을 지어내면 안 된다. 서버가 파생하거나 FE가 계산한다(§3).

---

## 1. 데이터 소스는 4개뿐

| #   | 소스      | 무엇을                                            | 방식                                    |
| --- | --------- | ------------------------------------------------- | --------------------------------------- |
| ①   | 뉴스 본문 | GPT 입력                                          | 붙여넣기(1순위) 또는 URL 스크래핑       |
| ②   | **GPT**   | 요약·키워드·신호·그래프·히트맵 구조 (화면의 ~80%) | OpenAI 호환 게이트웨이, 구조화 출력     |
| ③   | 시세 API  | 종목·섹터 `changePct`, 시총                       | 네이버 금융(한국)/Finnhub(미국) `fetch` |
| ④   | 뉴스 목록 | 메인 인기 뉴스 (#15/#53, analyze와 별개)          | 네이버 증권 ranknews(비공식)            |

---

## 2. 파이프라인 5단계

### ① 본문 확보 — `extract-article.ts`

- **입력 우선순위:** 본문 붙여넣기(`text`) > URL 스크래핑(`url`). 붙여넣기가 있으면 스크래핑 생략.
- **스크래핑 폴백 체인:** `cheerio` + 셀렉터맵(네이버 `#dic_area`가 대부분 제휴 언론사 커버) → `@extractus/article-extractor` → (최후) 붙여넣기 유도.
  - 언론사 직접 도메인: `.article-body`(한경) / `.news_cnt_detail_wrap`(매경).
- **⚠️ 법적 리스크:** 네이버·한경·매경 robots.txt가 AI 학습 크롤링을 금지하고 본문에 저작권 고지가 있다. → **붙여넣기를 1차 입력**으로 리스크를 사용자 행위로 넘기고, **추출 본문은 절대 영구 저장하지 않는다**.
- 실패 시 `422`로 응답해 붙여넣기를 유도한다.

### ② GPT 구조 생성 — `sources/gpt.ts`

- 본문을 `SYSTEM_PROMPT` + `AnalysisSchema`(zod)로 넣어 **구조화 출력**을 강제한다.
- GPT가 만드는 것: `sector`, `verdict`, `summary`, `keywords`, `relatedSectors`, `goodSignal`/`warnSignal`, `spreadNodes`(원시), `spreadEdges`, `heatmap`(원시), `knowledgeNodes`(원시), `knowledgeEdges`, `topStocks`(배열).
- **스키마 무결성 규칙**(§4)을 프롬프트로 강제한다.
- base_url 미확보 시 **mock 폴백**으로 동작한다([.env.example](../apps/web/.env.example) 참고). `MOCK_ANALYZE=1`로 강제 가능.

### ③ 시세 join — `analyze.ts` **(⚠️ 미구현, TODO)**

GPT가 준 종목·섹터명에 **실시세를 붙여 `changePct`를 교체**하는 단계. 현재는 GPT 초안값을 그대로 쓴다.

- **종목마스터**(이름 → 코드 → 시세): 네이버 `marketValue/{KOSPI|KOSDAQ}` 페이지네이션으로 종목 마스터를 빌드타임/cron 1회 캐시. 시세만 런타임 fetch.
- **이름 매칭:** 정규화(공백 제거·우선주 접미사 `/([0-9]?우[A-Z]?)$/`) → exact → alias 테이블 → fuzzy → 실패 시 미매칭(오조인 금지).
- **섹터 역조회:** 코드 확정 후 `m.stock.naver.com/api/stock/{code}/integration`의 `industryCode`가 이름 매칭보다 안전(예: SK하이닉스 `000660` → 반도체).
- 대상 필드: `relatedSectors[].changePct`, `spreadNodes[].changePct`, `heatmap[].changePct`, `topStocks[][].changePct`.
- 전제: **`lib/sectors.ts`**(섹터 taxonomy)가 있어야 매칭이 안정적이다(§4·§6).

### ④ 표현필드 파생 — `analyze.ts` `assemble()`

GPT 스키마엔 없는(=지어내면 안 되는) 표현 필드를 **서버가 계산**해 응답에 채운다.

- `SpreadNode.row`: 같은 `tier` 노드들을 세로 `0~1`로 균등 배치(`deriveRows`).
- `HeatmapCell.area`: `area0`, `area1`… 슬롯 키. `HeatmapCell.weight`: `abs(changePct)/max`로 `0~1` 색 농도(`deriveHeatmap`).
- `KnowledgeNode.x/y`: 서버는 `0`으로 두고 **FE가 `group` 기반으로 실제 좌표 계산**.
- `topStocks`: GPT의 배열을 `Record<섹터명, TopStock[]>`로 변환.

### ⑤ 저장·응답 — `store.ts`

- `UPSTASH_REDIS_REST_URL`(+TOKEN)이 있으면 Upstash Redis(KV)에 영속 저장, 없으면 인메모리 `Map` 폴백(서버리스라 인스턴스별 휘발 — 로컬·개발용).
- `POST /api/analyze`는 `{ id }`를 단순 반환하지 않고, 진행 상황을 **NDJSON 스트림**으로 흘린다(`Content-Type: application/x-ndjson`, 로딩 화면 단계 표시용). 한 줄 = JSON 이벤트 하나:
  - `{ step: 'extract' | 'analyze' | 'quote', label }` — 각 단계 시작 시
  - `{ step: 'done', id, title, analyzedAt, originUrl }` — 저장 완료. 화면은 이 `id`로 `/analysis/[id]`로 이동하고, 브라우저 개인 최근 목록은 이 메타데이터를 `localStorage`에 저장한다.
  - `{ step: 'error', message }` — 실패 시
- `/api/analyses/recent`는 KV/인메모리 저장소의 **전체 최근 분석 목록**을 반환한다. 로그인/DB가 없으므로 개인 최근 목록은 서버가 아니라 브라우저 `localStorage`에 `id/title/analyzedAt/originUrl`로 따로 저장한다. 이 `originUrl` 덕분에 로컬 목록의 오래된 `id`가 서버 재시작 등으로 404가 되면 같은 원문 링크로 재분석할 수 있다.
- `/analysis/[id]` 페이지는 `GET /api/analysis/[id]`를 클라이언트에서 다시 호출하지 않는다 — 서버 컴포넌트에서 `store.ts`를 직접 읽는다. `GET /api/analysis/[id]` 라우트 자체는 남아 있고 별도 API 소비처(공유 링크 등)를 위해 존재한다.

---

## 3. 필드 소유권 — 누가 채우나

`AnalysisResult` 기준. **한 값의 출처를 헷갈리지 않기 위한 표.**

| 필드                                                                                              | 채우는 주체         | 비고                                   |
| ------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------- |
| `id`·`analyzedAt`·`engineVersion`                                                                 | 서버                | 메타                                   |
| `title`·`source`·`publishedAt`·`desk`                                                             | 서버(스크래핑 메타) | 일부 TODO(현재 빈값)                   |
| `originUrl`                                                                                       | 서버(입력)          |                                        |
| `sector`·`verdict`·`summary`·`keywords`·`reviewedCount`                                           | **GPT**             |                                        |
| `goodSignal`·`warnSignal`·`spreadEdges`·`knowledgeEdges`                                          | **GPT**             |                                        |
| `spreadNodes`(id·name·tier)·`heatmap`(sector)·`knowledgeNodes`(id·name·group)·`topStocks`(종목명) | **GPT**             | 원시값                                 |
| **모든 `changePct`**                                                                              | **시세 API**(③)     | GPT 초안 → 실시세로 교체 (현재 미구현) |
| `spreadNodes.row`·`heatmap.area`·`heatmap.weight`                                                 | 서버 파생(④)        | GPT 스키마 제외                        |
| `knowledgeNodes.x/y`                                                                              | **FE 계산**         | 서버는 `0`                             |
| `NewsItem.sectorTone`                                                                             | **FE**              | 칩 색 변형(analyze 아님)               |

---

## 4. GPT 출력 규칙 (스키마 무결성)

`AnalysisSchema`가 강제하고, `SYSTEM_PROMPT`가 다시 지시한다. 파급 그래프가 깨지지 않으려면 필수:

- `spreadNodes`: `tier 0`은 **뉴스 원점 정확히 1개**, `tier 1·2·3`은 파급 단계. 각 노드는 **고유 `id`**.
- `spreadEdges.from/to`: 반드시 **존재하는 `spreadNodes.id`**를 참조(없는 id 금지).
- `knowledgeEdges.from/to`: 반드시 **존재하는 `knowledgeNodes.id`**를 참조.
- `topStocks[].sector`: **`spreadNodes[].name`과 일치**시킨다(이름 join이라 깨지기 쉬움 — 아래 주의).
- `changePct`: 부호 포함(상승 `+`, 하락 `−`). 실제 값은 ③에서 교체되므로 **방향성만** 추정.
- 모든 텍스트 한국어. `verdict`는 `"호재 분석"`/`"악재 분석"` 형태.

> **알려진 취약점:** `topStocks`와 섹터 매칭이 **표시명(이름) 기반**이라 깨지기 쉽다. 안정적 `id` 키 방식 + `lib/sectors.ts`(섹터명 enum 고정)로 개선 예정.

---

## 5. 시세 소스 레퍼런스 (③ 구현용)

시세는 GPT가 아니라 API `fetch`로만 채운다. Route Handler는 Node `fetch`만(Python 불가).

- **한국(KRX) = 네이버 금융 비공식 모바일 API** (인증 불필요, 직접 검증됨):
  - 업종 등락률(79개 WICS): `m.stock.naver.com/api/stocks/industry?page=1&pageSize=100` → `changeRate`
  - 시총순 종목+등락률: `m.stock.naver.com/api/stocks/marketValue/{KOSPI|KOSDAQ}?...` → `stockName`·`itemCode`·`marketValue`·`fluctuationsRatio`
  - 실시간 개별(배치): `polling.finance.naver.com/api/realtime/domestic/stock/005930,000660`
  - 리스크: 비공식 → `User-Agent` 헤더 + 응답 캐싱 폴백.
- **미국(US) = Finnhub 무료 + 위키 GICS 정적 매핑**: 섹터 = 하위 종목 시총가중 평균(Finviz 방식). `/quote`+`/stock/profile2` 1회 사전수집 후 캐시. (미국 종목도 네이버 `api.stock.naver.com/stock/AAPL.O/basic`로 대체 가능.)

---

## 6. 현재 상태 / 남은 일

| 항목                            | 상태                                          |
| ------------------------------- | --------------------------------------------- |
| ① 본문 확보                     | ✅ 구현                                       |
| ② GPT 구조 생성                 | ✅ 구현 (mock 폴백 포함)                      |
| ③ 시세 join                     | ❌ **미구현** (`changePct`는 아직 GPT 초안값) |
| ④ 표현필드 파생                 | ✅ 구현                                       |
| ⑤ 저장·응답                     | ✅ 구현 (인메모리)                            |
| `lib/sectors.ts`(섹터 taxonomy) | ❌ **미작성** — GPT enum·시세 매칭의 전제     |
| GPT 실호출                      | ⏳ base_url 대기 중 (그동안 mock)             |

**③을 완성하려면 먼저 `lib/sectors.ts` → 종목마스터 → 시세 join 순으로 작업한다.**
