# 이슈 컨벤션 (정본 · SSOT)

> 이 문서는 GitHub Issue의 **제목·ID·본문·라벨 규칙의 정본**이다.
> 사람도, AI 에이전트(Claude·Cursor·Codex)도 이슈를 만들 땐 이 규칙을 따른다.
> **직접 `gh issue create`를 손으로 구성하지 말고 `scripts/new-issue.sh`를 사용**하면 이 컨벤션대로 자동 조립된다.

관련: `.github/issue_template.md`(본문 템플릿 정본) · `AGENTS.md`(에이전트 지시) · `scripts/new-issue.sh`(등록) · `scripts/init-labels.sh`(라벨 부트스트랩) · `docs/proposal/14_priority_matrix.md`(기능·순위) · `docs/issues-list.md`(기능 이슈 카탈로그).

---

## 1. 제목

`[<ID>] <간결한 명사형>` — "이 이슈를 끝내면 무엇이 되는지"가 드러나게.

- ✅ `[F-06] 산업 파급 경로 연결지도 시각화`
- ✅ `[F-21a] 뉴스 AI 요약 카드 표시`
- ✅ `[FIX] 그래프 노드 겹침 수정`
- ❌ `분석 결과 상단에 뉴스 AI 요약 + 호재/악재 카드를 표시한다` (문장형·복합 금지 → 명사형·단일 관심사)

## 2. ID 네임스페이스

| 유형(라벨)         | ID 예                | 비고                                                             |
| ------------------ | -------------------- | ---------------------------------------------------------------- |
| `feat`             | `F-06`, `F-21a`      | `docs/proposal/14`·`docs/issues-list.md` 기준                    |
| `setup`            | `SETUP-01`           |                                                                  |
| `infra` · `deploy` | `INFRA-01`           | 라벨은 성격에 따라 `infra`(CI·시크릿) 또는 `deploy`(배포·도메인) |
| `prototype`        | `PROTO-01`           |                                                                  |
| `fix`              | _(생략)_ → `[FIX]`   | 번호 없이 유형 prefix                                            |
| `chore`            | _(생략)_ → `[CHORE]` | 번호 없이 유형 prefix                                            |

> 하나의 이슈 = 하나의 관심사. 요약+호재/악재처럼 독립 구현이 되면 나눈다(예: `F-21` → `F-21a`/`F-21b`).

## 3. 본문 스켈레톤

> 본문 구조의 **정본은 `.github/issue_template.md`** — `scripts/new-issue.sh`가 이 파일을 읽어 토큰(`{{ID}}`·`{{TYPE}}`·`{{PAGE}}`·`{{REFS}}`·`{{DONE}}`·`{{CHECKLIST}}`)을 채운다. GitHub 웹에서 새 이슈를 열 때도 이 템플릿이 기본값이 된다. (`{{CHECKLIST}}`는 유형별 체크리스트로 스크립트가 주입)

```md
## 개요

- **ID:** F-06 · **유형:** feat
- **페이지/영역:** 분석 페이지 `/analysis/[id]`
- **참고:** docs/proposal/11 · docs/proposal/14

## 완료 조건

- (이 이슈가 끝나면 무엇이 되는지 1~2문장)

## 체크리스트

- [ ] UI: …
- [ ] API: …
- [ ] 데모: …
```

**체크리스트는 유형별로 다르다** (스크립트가 `--type`으로 자동 선택):

| 유형                         | 체크리스트 항목          |
| ---------------------------- | ------------------------ |
| `feat` · `prototype`         | `UI` / `API` / `데모`    |
| `fix`                        | `재현` / `원인` / `수정` |
| `setup` · `infra` · `deploy` | `구성` / `검증`          |
| `chore`                      | `작업` / `검증`          |

## 4. 라벨 (12종)

이슈마다 **유형 라벨 1개**는 필수, `feat`이면 **순위 라벨**을 함께, 선행 작업이면 `pre`를 추가한다.
(순위 라벨은 한국어, 유형·부가 라벨은 영어)

| 분류 | 라벨                                                      | color                                                        |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 순위 | `1순위` `2순위` `3순위` `4순위`                           | B60205 / D93F0B / FBCA04 / C5DEF5                            |
| 유형 | `feat` `setup` `prototype` `infra` `deploy` `fix` `chore` | 0E8A16 / 5319E7 / 1D76DB / 006B75 / A2703F / D73A4A / BFD4F2 |
| 부가 | `pre`                                                     | E99695                                                       |

- 라벨 정의 SSOT는 `scripts/lib/labels.sh`. 색/설명 변경은 거기서 하고 이 표와 맞춘다.
- 저장소에 라벨이 없으면 `scripts/init-labels.sh`(최초 1회) 또는 `scripts/new-issue.sh`가 자동 생성한다.

## 5. 등록 방법 (에이전트/사람 공통)

1. 요청에서 **유형·ID·제목·순위·페이지·참고·완료조건·체크리스트**를 결정한다. 카탈로그(`docs/issues-list.md`)에 있으면 그 내용을 재사용한다.
2. **먼저 `--dry-run`** 으로 조립 결과를 확인한다.
3. 확인되면 `--dry-run`을 빼고 등록한다.
4. 생성된 **번호·제목·라벨**을 보고한다.

**예시**

```bash
# 기능
scripts/new-issue.sh --type feat --id F-06 --priority 1 \
  --page "분석 /analysis/[id]" --refs "docs/proposal/11 · docs/proposal/14" \
  --title "산업 파급 경로 연결지도 시각화" \
  --done "뉴스에서 도출한 산업 파급 경로를 연결지도로 표현" \
  --ui "산업 노드·연결선 배치" --api "노드/엣지 데이터" --demo "샘플 뉴스 → 파급 지도 렌더" \
  --dry-run

# 기반 세팅(선행)
scripts/new-issue.sh --type setup --id SETUP-03 --seonhaeng \
  --title "3개 페이지 라우팅 골격" --refs "docs/proposal/11" \
  --setup "/, /analyzing, /analysis/[id] 라우트" --verify "링크 이동으로 3개 화면 순회"

# 버그(카탈로그 밖)
scripts/new-issue.sh --type fix \
  --title "그래프 노드 겹침 수정" \
  --repro "노드 20개↑ 그래프에서 겹침" --cause "레이아웃 반발력 미설정" --fix "force layout 파라미터 조정"
```

> **선행:** gh CLI 설치(`brew install gh`)·인증(`gh auth login`)이 되어 있어야 실제 등록된다.
