# Step 15. 개발 진행

> 목적: Step 14까지 정리한 내용을 **GitHub Issue**로 옮기고, 팀원이 **Issue 하나씩** 구현한다.  
> **이후 진행·상태·완료 여부는 모두 GitHub Issues를 기준**으로 한다.

---

## 1. Agent로 Issue 일괄 등록

> `docs/proposal/14`의 **모든 기능(F-xx)** 마다 Issue 1개. 우선순위는 **GitHub 라벨**로 붙인다.

> **자동화(권장):** 이슈 등록 방법은 `docs/issue-open-guide.md`에 안내되어 있고, 등록은 **`scripts/new-issue.sh`**, 라벨(11종) 부트스트랩은 **`scripts/init-labels.sh`** 로 한다. 아래 수동 `gh` 예시 대신 스크립트를 쓰면 제목·본문·라벨이 규칙에 맞게 자동 조립된다. (Claude `/new-issue`, Cursor 룰도 동일 스크립트를 호출)

**Agent 프롬프트 예시**

```
docs/proposal/14_priority_matrix.md를 읽고, 모든 F-xx 기능마다 GitHub Issue를 생성해줘.

규칙:
- 기능 1개 = Issue 1개, 제목: [F-xx] 기능명
- docs/proposal/14에 적힌 순위마다 라벨 부여: 1순위, 2순위, 3순위, 4순위 (없으면 gh label create로 먼저 생성)
- 본문: F-xx, 페이지명, docs/proposal/11~14 경로, 완료 조건, 체크리스트(UI / API / 데모)
- docs/proposal/14에 있는 기능 빠짐없이 전부 등록
- 생성된 Issue 번호·제목·라벨 목록을 요약해서 알려줘
```

**라벨·Issue 확인**

```bash
gh label create "1순위" --color "B60205" --description "즉시 구현"
gh label create "2순위" --color "D93F0B"
gh label create "3순위" --color "FBCA04"
gh label create "4순위" --color "C5DEF5" --description "스펙 아웃·mock"

gh issue list --label "1순위"
```

---

## 2. 팀원별 구현 흐름

> Issue가 준비되면, **각 팀원이 Open Issue 하나**를 맡아 구현한다.

> **Guide:**
>
> 1. `gh issue list --label "1순위"`로 **1순위 Open Issue**부터 본다.
> 2. 팀원이 **맡을 Issue 하나**를 고르고 Assignee를 자신으로 둔다.
> 3. Agent에게 **그 Issue 번호**를 주고 구현시킨다.
> 4. PR 머지 후 Issue **Close** → 다음 Open Issue를 고른다.
> 5. 1순위가 끝나면 `2순위` → `3순위` 순으로 같은 방식 반복.

```bash
gh issue list --state open --label "1순위"
gh issue edit 12 --add-assignee @me
```

---

## 3. Agent로 Issue 구현·상태 갱신

**프롬프트 예시**

```
GitHub Issue #12를 읽고 구현해줘.
docs/proposal/11~14과 Issue 본문의 완료 조건만 참고해. 이 Issue(F-xx) 범위만 구현해.

완료 후:
- 변경 요약
- Issue 체크리스트·댓글 반영 (gh issue comment)
- Close 가능하면 gh issue close
```

```bash
gh issue view 12
gh issue comment 12 --body "구현 완료: …"
gh issue close 12
```

> Assignee·라벨·진행 상태는 GitHub에서만 관리한다. `docs/proposal/15` 본문은 수정하지 않는다.
