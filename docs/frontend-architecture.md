# 프론트엔드 구조 결정

## 앱 위치

- 프론트엔드 앱은 `apps/web`에 둔다.
- Next.js App Router를 사용하므로 라우트 파일은 `apps/web/src/app` 아래에 둔다.
- 백엔드와 익스텐션은 각각 `apps/api`, `apps/extension`에 둔다.

## UI 컴포넌트 위치

공통 UI 컴포넌트는 `packages/ui`로 분리할 수 있다. 예를 들어 `web`과 `extension`이 같은 Button, Input, Dialog, Card 등을 함께 사용한다면 `packages/ui`를 두고 `@suhyeju/ui`로 가져오는 구조가 적합하다.

다만 이번 MVP에서는 UI 작업 범위가 주로 `apps/web`에 집중되어 있고, `extension`의 UI 재사용 범위가 아직 확정되지 않았으므로 당장은 `packages/ui`를 만들지 않는다.

현재 결정:

- shadcn/ui 컴포넌트는 `apps/web/src/components/ui`에 둔다.
- 앱 내부 공통 유틸은 `apps/web/src/lib`에 둔다.
- 실제로 두 앱 이상에서 같은 컴포넌트를 재사용하게 되면 그때 `packages/ui`로 분리한다.

## 현재 스캐폴딩 기준 라우트

- `/`: 메인 페이지
- `/analyzing`: 분석 진행 페이지
- `/analysis/[id]`: 분석 결과 상세 페이지

## 분석 리팩토링 기준선 (#101)

분석 기능은 **Next.js App Router 기반 도메인 중심 레이어드 아키텍처 + 파이프라인/어댑터 패턴**으로 정리한다. 사용자에게 보이는 `AnalysisResult` 응답 계약은 유지하고, 내부 책임만 아래처럼 나눈다.

### 1. App / Route Layer

- 위치: `apps/web/src/app`
- 책임: 라우팅, Server Component/Client Component 경계, Route Handler 입출력.
- 원칙:
  - `/analysis/[id]` 페이지는 서버 컴포넌트에서 `store.ts`를 직접 읽는다.
  - `/api/analyze`는 NDJSON 진행 이벤트와 최종 `done/error` 이벤트만 책임진다.
  - 외부 소비가 필요한 조회 API만 Route Handler로 유지한다.

### 2. Application Pipeline Layer

- 위치: `apps/web/src/lib/analyze.ts`
- 책임: `extract -> analyzeDraft -> validate -> joinQuotes/joinSources -> assemble` 순서 조율.
- 원칙:
  - `runAnalysis`는 오케스트레이션만 맡고, 도메인 계산·외부 호출 세부 구현을 직접 갖지 않는다.
  - GPT 호출 뒤에는 도메인 계약 검증을 통과한 초안만 join/assemble 단계로 넘긴다.
  - 시세 join, 근거 뉴스 join, 신호 뉴스 링크 join처럼 독립적인 작업은 병렬 실행한다.

### 3. Domain / Contract Layer

- 위치: `apps/web/src/lib/types.ts`, `apps/web/src/lib/analysis/contracts.ts`
- 책임: API 응답 타입과 GPT 초안의 구조적 invariant 검증.
- 현재 검증:
  - `spreadNodes` id 중복 금지
  - tier 0 뉴스 원점 정확히 1개
  - `spreadEdges`와 `knowledgeEdges`가 존재하는 노드만 참조
  - tier 1·2·3 노드는 이전 tier에서 들어오는 edge 필요
  - `topStocks[].sector`는 비원점 `spreadNodes[].name`과 일치

### 4. Adapter / Join Layer

- 위치: `apps/web/src/lib/sources/*`, `apps/web/src/lib/analysis/quote-join.ts`, `apps/web/src/lib/analysis/source-join.ts`
- 책임:
  - `sources/gpt.ts`: GPT 구조화 출력 adapter
  - `sources/naver-stock.ts`: 종목명 -> 코드/시장/등락률 adapter
  - `sources/naver-news.ts`: 근거 뉴스 검색 adapter
  - `quote-join.ts`: GPT 종목 초안에 실시세와 섹터 평균을 비파괴적으로 join
  - `source-join.ts`: edge/searchQuery와 신호 뉴스 searchQuery를 실제 기사 링크로 join

### 5. Assembly / View Model Layer

- 위치: `apps/web/src/lib/analysis/assemble.ts`, `apps/web/src/lib/analysis/spread-graph-view-model.ts`
- 책임:
  - 서버 assembly: `AnalysisDraft`를 `AnalysisResult`로 변환하고 서버 파생 필드(`id`, `analyzedAt`, `spreadNodes.row`, `knowledgeNodes.x/y`, `topStocks` record)를 채운다.
  - UI view-model: 확산 그래프 좌표, tier label/color, 렌더 가능한 edge 필터링, 모바일 tier block 계산을 컴포넌트 밖에서 제공한다.

### 6. Component Layer

- 위치: `apps/web/src/components`
- 책임: 사용자 상호작용과 렌더링.
- 원칙:
  - 컴포넌트는 props를 받아 그리는 일을 우선한다.
  - 데이터 계약·시세 join·외부 검색·좌표 상수 같은 공유 계산은 `lib/analysis`에 둔다.
  - shadcn/ui primitives는 `components/ui`, 도메인 화면 컴포넌트는 `components/main`, `components/analysis`, `components/knowledge-graph`에 둔다.
