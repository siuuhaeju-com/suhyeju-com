# 수혜주.com

> 뉴스 링크를 붙여넣으면 AI가 그 이슈가 어느 산업으로 번지는지 **1→2→3차 파급 경로를 노드 그래프·히트맵으로 시각화**하는 **뉴스 기반 산업 파급 분석 서비스**입니다. — 테오 AI 스프린트 6팀

예: _"AI 투자 확대"_ 뉴스를 넣으면 `GPU → HBM → 반도체 장비 → 유리기판 → 특수가스 → 데이터센터 → 전력설비`처럼 산업이 꼬리를 무는 **연쇄 파급 사슬**과 **다음 수혜 산업**을 짚어 줍니다.

이 저장소는 아래 **vibe sprint** 템플릿으로 기획·구현했습니다. 스프린트 진행 과정과 산출물은 `docs/proposal/01`~`docs/proposal/15`에 있습니다.

---

## vibe sprint — 이 프로젝트를 만든 스프린트 템플릿

해커톤·스프린트에서 **아이디어에서 MVP까지** 가는 과정을, 팀이 따라갈 수 있는 **문서 템플릿**으로 정리한 방식입니다.

기존에도 “문제 이해 → 아이디어 구체화 → 만들기” 순서로 MVP를 만드는 워크숍·스프린트 방식은 있었습니다. **vibe sprint**는 그 흐름을 바꾸지 않고, AI 에이전트(Cursor, Claude, Codex 등)와 함께 돌리기 쉽게 다듬은 버전입니다.

- 각 단계마다 **무엇을 할지·하지 말지**가 `docs/` 템플릿에 적혀 있습니다.
- 단계 문서마다 **Guide**와 **프롬프트 예시**가 있어, 팀 논의 내용을 에이전트에 넘겨 산출물을 채울 수 있습니다.
- 루트 **`AGENTS.md`** 에 **Sprint Master** 페르소나가 정의되어 있어, “지금 몇 단계인지·다음에 뭘 하면 되는지”를 에이전트에게 물어볼 수 있습니다.

## 이 레포에 있는 것

| 경로                                    | 역할                                                        |
| --------------------------------------- | ----------------------------------------------------------- |
| `docs/proposal/01` ~ `docs/proposal/15` | 스프린트 15단계별 템플릿 (Guide·프롬프트 예시 포함)         |
| `AGENTS.md`                             | Sprint Master — 단계 안내·실행 시 따를 페르소나             |
| `scripts/`                              | 특정 단계에서 쓰는 보조 스크립트 (해당 `docs/` 가이드 참고) |

단계별 상세 절차·명령어·체크리스트는 **README가 아니라 각 `docs/proposal/NN_*.md`** 에 있습니다.

## 스프린트는 세 구간으로 이어집니다

| 구간                  | Step    | 한 줄 요약                                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------------------------- |
| **① 팀·문제 이해**    | 01 → 08 | 아이디어 떠올리기 → 팀빌딩 → 누구와 무엇을, 지금 어떻게, 무엇이 아픈지·좋은지까지 넓게 수집 |
| **② 아이디어 구체화** | 09 → 12 | 질문·기능·화면·우리 서비스 흐름으로 좁힘                                                    |
| **③ 만들기**          | 13 → 15 | 스케치 합의 → 우선순위 → GitHub Issue로 구현                                                |

### 15단계별로 무엇을 하나

| Step | 절차                                                              | 템플릿                                                                                           |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 01   | 아이디어 떠올리기                                                 | [`docs/proposal/01_idea_recall.md`](docs/proposal/01_idea_recall.md)                             |
| 02   | 각자 아이디어 소개 및 팀빌딩 (대면)                               | [`docs/proposal/02_idea_teambuilding.md`](docs/proposal/02_idea_teambuilding.md)                 |
| 03   | 팀 캔버스 — 역할·목표·규칙 합의                                   | [`docs/proposal/03_team_canvas.md`](docs/proposal/03_team_canvas.md)                             |
| 04   | 서비스 목적·타겟·핵심 가치 정리 (아직 하나로 결정하지 않음)       | [`docs/proposal/04_service_goal_target_value.md`](docs/proposal/04_service_goal_target_value.md) |
| 05   | **기존** 고객 여정 — 사용자가 목적을 지금 어떻게 달성하는가       | [`docs/proposal/05_existing_customer_journey.md`](docs/proposal/05_existing_customer_journey.md) |
| 06   | 여정에서 Pain Point / Wow Point 추출                              | [`docs/proposal/06_pain_wow_points.md`](docs/proposal/06_pain_wow_points.md)                     |
| 07   | Wow 뒤 숨은 전제를 검증하는 질문 만들기                           | [`docs/proposal/07_hypothesis_questions.md`](docs/proposal/07_hypothesis_questions.md)           |
| 08   | 키워드로 팀 생각 시각화 (워드클라우드)                            | [`docs/proposal/08_word_cloud.md`](docs/proposal/08_word_cloud.md)                               |
| 09   | "어떻게 하면 ~" 질문으로 메커니즘 구체화                          | [`docs/proposal/09_how_might_we_questions.md`](docs/proposal/09_how_might_we_questions.md)       |
| 10   | 논의에서 나온 기능을 **전부** 나열 (우선순위·제외 없음)           | [`docs/proposal/10_feature_list.md`](docs/proposal/10_feature_list.md)                           |
| 11   | 기능(F-xx)을 페이지별로 배치 (제외 없음)                          | [`docs/proposal/11_page_routing_split.md`](docs/proposal/11_page_routing_split.md)               |
| 12   | **우리 서비스** 고객 여정 맵                                      | [`docs/proposal/12_customer_journey_map.md`](docs/proposal/12_customer_journey_map.md)           |
| 13   | 각자 AI로 스케치 → 공유·합의, 최종 스케치만 기록 (대면 워크숍)    | [`docs/proposal/13_sketch_and_decision.md`](docs/proposal/13_sketch_and_decision.md)             |
| 14   | 기능(F-xx)별 1~4순위·스펙 아웃                                    | [`docs/proposal/14_priority_matrix.md`](docs/proposal/14_priority_matrix.md)                     |
| 15   | `docs/proposal/14` 기준 Issue 일괄 등록, 팀원이 Issue 단위로 구현 | [`docs/proposal/15_development.md`](docs/proposal/15_development.md)                             |

Step 02·13은 문서 작성 없이 대면으로 진행합니다. **본격적인 팀 스프린트 문서는 `docs/proposal/04`부터** 채웁니다. Step 15 이후 진행 상황은 **GitHub Issues**가 기준입니다.

**헷갈리기 쉬운 점:** Step 05는 *지금 세상*의 여정, Step 12는 _우리가 만들 서비스_ 여정입니다. Step 10·11에서는 기능을 빼지 않고 모으고 배치하고, **Step 14에서 비로소** 우선순위를 정합니다.

## 처음 시작하기

1. GitHub에서 **Use this template** → **Create a new repository** 로 프로젝트 레포를 만듭니다.
2. **`docs/proposal/01_idea_recall.md`** 를 채워 아이디어를 떠올려 둡니다. (Step 02 팀빌딩 전)
3. clone한 뒤, 팀빌딩·팀 캔버스(Step 02·03)를 마칩니다.
4. **`docs/proposal/04_service_goal_target_value.md`** 를 열고, 상단 **Guide**를 읽은 다음 **프롬프트 예시**를 에이전트에 붙여 논의 내용을 채웁니다.
5. **`docs/proposal/05` → … → `docs/proposal/15`** 순서로 진행합니다. 단계를 건너뛰지 않는 것이 좋습니다 (예: 기능 나열 전에 우선순위를 정하지 않음).
6. 막히면 에이전트에게 “지금 Step 몇이야? 뭘 하면 돼?”라고 물어보세요. `AGENTS.md`의 Sprint Master가 해당 `docs/` 파일을 가리켜 안내합니다.

## 템플릿으로 만든 프로젝트 예시

| 프로젝트                                                | 설명                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [da-in/vibe-chord](https://github.com/da-in/vibe-chord) | 비전문가도 직관적인 인터페이스로 코드 진행을 탐색·학습·만드는 웹 도구. `docs/` 스프린트 산출물과 `web/` 구현 코드가 함께 있습니다. |

위 레포는 이 템플릿에서 **Use this template** 으로 만든 프로젝트 예시입니다. `docs/` 스프린트 산출물과 `web/` 구현 코드가 함께 있습니다.

## 에이전트 친화적으로 바뀐 점

- **입력·출력이 문서로 고정**되어, 팀 논의 → 마크다운 → 다음 단계 입력이 이어집니다.
- **단계마다 프롬프트 예시**가 있어, 매번 지시문을 새로 쓰지 않아도 됩니다.
- **Sprint Master**(`AGENTS.md`)가 15단계 순서와 “이 단계에서 하지 말 것”을 알고 있어, 조기에 범위를 자르거나 단계를 건너뛰는 실수를 줄입니다.
- Step 15에서 **`docs/proposal/14` 기준으로 Issue를 등록**해, 구현도 에이전트·팀원이 Issue 단위로 나눠 진행할 수 있습니다.
