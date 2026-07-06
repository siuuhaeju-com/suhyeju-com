---
description: 컨벤션(docs/issue-convention.md)에 맞춰 GitHub Issue 생성
argument-hint: <만들 이슈 설명>
---

사용자 요청: $ARGUMENTS

다음 절차로 GitHub Issue를 생성해줘. **직접 `gh issue create`를 손으로 구성하지 말고 반드시 `scripts/new-issue.sh`를 사용**한다.

1. **컨벤션 정본은 `docs/issue-convention.md`.** 아직 안 읽었으면 먼저 읽는다.
2. 요청에서 아래를 결정한다:
   - **유형**: feat / setup / prototype / infra / deploy / fix / chore
   - **ID**: 카탈로그면 `F-xx`·`SETUP-xx`·`INFRA-xx`·`PROTO-xx`. fix·chore면 생략(스크립트가 `[FIX]`/`[CHORE]` 부여)
   - **제목**: 간결한 명사형(문장형 금지)
   - **순위**: 기능이면 1~4 (docs/proposal/14 참고)
   - **페이지/영역, 참고 문서(docs/proposal/11~14), 완료 조건, 체크리스트 항목**
   - 이미 `docs/issues-list.md`·`docs/proposal/14`에 정의된 항목이면 **그 내용을 그대로 재사용**한다.
3. `scripts/new-issue.sh … --dry-run` 으로 조립 결과(제목·라벨·본문)를 보여주고 사용자 확인을 받는다.
4. 확인되면 `--dry-run`을 빼고 실제 등록한다.
5. 생성된 **이슈 번호·제목·라벨**을 보고한다.

gh CLI 인증(`gh auth login`)이 안 되어 있으면 먼저 안내한다.
