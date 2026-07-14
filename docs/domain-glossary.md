# 도메인 용어집

> 분석 리팩토링 기준 문서. 코드·문서·이슈에서 같은 개념을 같은 이름으로 부르기 위한 짧은 사전이다.

## 분석 파이프라인

| 용어 | 의미 | 코드 기준 |
| --- | --- | --- |
| `AnalysisDraft` | GPT가 만든 원시 분석 초안. 서버/FE 파생 필드는 아직 없다. | `apps/web/src/lib/sources/gpt.ts` |
| `AnalysisResult` | 사용자 화면과 저장소에 노출되는 최종 분석 계약. | `apps/web/src/lib/types.ts` |
| `runNewsAnalysis` | 뉴스 분석 유스케이스. 본문 확보, GPT 초안 생성, 계약 검증, join, assemble 순서를 조율한다. | `apps/web/src/lib/analysis/usecase.ts` |
| `assemble` | GPT 초안과 join 결과를 최종 `AnalysisResult`로 조립하는 단계. | `apps/web/src/lib/analysis/assemble.ts` |
| `contract` | GPT 초안 또는 최종 결과가 UI에서 안전하게 렌더링될 수 있는 구조인지 확인하는 규칙. | `apps/web/src/lib/analysis/contracts.ts` |

## 확산 그래프

| 용어 | 의미 | 주의 |
| --- | --- | --- |
| `spread` | 뉴스 이슈가 산업으로 번지는 1→2→3차 파급 흐름. | UI 제목은 “영향력 확산 그래프”를 쓴다. |
| `tier` | 파급 차수. `0`은 뉴스 원점, `1·2·3`은 산업 파급 단계. | tier는 화면 열과 연결선 방향의 기준이다. |
| `impact` | 뉴스 이슈가 해당 산업에 미치는 방향과 강도. 부호는 방향, 절댓값은 강도다. | 시세 등락률이 아니다. 긍정은 레드, 부정은 블루로 표현한다. |
| `changePct` | 종목·섹터의 실제 또는 초안 등락률. | spread node 표시에는 쓰지 않는다. |
| `source` | 연결선 또는 신호 뉴스의 근거 기사. | GPT가 URL을 만들지 않고 서버가 검색으로 붙인다. |
| `topStocks` | 파급 산업별 대표 종목 5개. | key는 비원점 `spreadNodes[].name`과 일치해야 한다. |

## 화면 경계

| 용어 | 의미 | 코드 기준 |
| --- | --- | --- |
| `Page` | 라우팅, 서버 데이터 조회, 404 판단을 맡는다. | `apps/web/src/app/**/page.tsx` |
| `View` | 페이지 단위 화면 조립을 맡는다. | `components/analysis/AnalysisView.tsx` |
| `Section` | 분석 화면의 독립 섹션. | `SummarySection`, `SpreadGraph`, `SignalSection`, `KnowledgeGraph` |
| `Hook` | 클라이언트 진행 상태나 구독 로직을 맡는다. | `useAnalyzeStream`, `useLocalAnalyses` |
| `Query Policy` | TanStack Query 캐시·재시도·갱신 주기 기준. | `apps/web/src/lib/query-policies.ts` |
