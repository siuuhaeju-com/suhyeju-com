#!/usr/bin/env bash
# 컨벤션(docs/issue-convention.md)에 맞춰 GitHub Issue를 결정적으로 생성한다.
# 에이전트는 자연어 요청에서 필드를 뽑아 이 스크립트를 호출한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$REPO_ROOT/.github/issue_template.md"
# shellcheck source=scripts/lib/labels.sh
. "$SCRIPT_DIR/lib/labels.sh"

usage() {
  cat <<'EOF'
사용법: scripts/new-issue.sh --type <유형> --title "<제목>" [옵션]

필수:
  --type      feat | setup | prototype | infra | deploy | fix | chore
  --title     간결한 명사형 제목. 예: "산업 파급 경로 연결지도 시각화"

권장:
  --id        F-06 / F-21a / SETUP-01 / INFRA-01 / PROTO-01 (카탈로그)
              fix·chore는 생략 시 제목 앞에 [FIX]/[CHORE] 자동 부여
  --priority  1|2|3|4     (순위 라벨 — 주로 기능 이슈)
  --page      "분석 /analysis/[id]" 등 페이지/영역
  --refs      "docs/proposal/11 · docs/proposal/14" 참고 문서
  --done      완료 조건 한두 문장
  --seonhaeng 선행 라벨 부여 (플래그)

체크리스트(유형별):
  feat/prototype        --ui --api --demo
  fix                   --repro --cause --fix
  setup/infra/deploy    --setup --verify
  chore                 --task --verify

기타:
  --assignee  @me 등
  --dry-run   등록하지 않고 조립 결과(제목·라벨·본문)만 출력
  -h, --help  도움말
EOF
}

ID="" TITLE="" TYPE="" PRIORITY="" PAGE="" REFS="" DONE=""
UI="" API="" DEMO="" REPRO="" CAUSE="" FIX="" SETUP="" VERIFY="" TASK=""
ASSIGNEE="" SEONHAENG="" DRYRUN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --id) ID="$2"; shift 2;;
    --title) TITLE="$2"; shift 2;;
    --type) TYPE="$2"; shift 2;;
    --priority) PRIORITY="$2"; shift 2;;
    --page) PAGE="$2"; shift 2;;
    --refs) REFS="$2"; shift 2;;
    --done) DONE="$2"; shift 2;;
    --ui) UI="$2"; shift 2;;
    --api) API="$2"; shift 2;;
    --demo) DEMO="$2"; shift 2;;
    --repro) REPRO="$2"; shift 2;;
    --cause) CAUSE="$2"; shift 2;;
    --fix) FIX="$2"; shift 2;;
    --setup) SETUP="$2"; shift 2;;
    --verify) VERIFY="$2"; shift 2;;
    --task) TASK="$2"; shift 2;;
    --assignee) ASSIGNEE="$2"; shift 2;;
    --seonhaeng) SEONHAENG="1"; shift;;
    --dry-run) DRYRUN="1"; shift;;
    -h|--help) usage; exit 0;;
    *) echo "알 수 없는 옵션: $1" >&2; usage; exit 1;;
  esac
done

# --- 검증 ---
[ -n "$TITLE" ] || { echo "오류: --title 필요" >&2; exit 1; }
[ -n "$TYPE" ] || { echo "오류: --type 필요" >&2; exit 1; }
case "$TYPE" in
  feat|setup|prototype|infra|deploy|fix|chore) ;;
  *) echo "오류: --type 값이 잘못됨: '$TYPE'" >&2; exit 1;;
esac

# --- 제목 prefix(ID) 결정 ---
if [ -n "$ID" ]; then
  PREFIX="$ID"
else
  case "$TYPE" in
    fix) PREFIX="FIX";;
    chore) PREFIX="CHORE";;
    *) echo "오류: '$TYPE' 유형은 --id 필요 (예: F-06, SETUP-01)" >&2; exit 1;;
  esac
fi
FULL_TITLE="[$PREFIX] $TITLE"

# --- 라벨 조립: 유형 + (순위) + (선행) ---
LABELS="$TYPE"
if [ -n "$PRIORITY" ]; then
  case "$PRIORITY" in
    1|2|3|4) LABELS="$LABELS ${PRIORITY}순위";;
    *) echo "오류: --priority 는 1~4" >&2; exit 1;;
  esac
fi
[ -n "$SEONHAENG" ] && LABELS="$LABELS 선행"

# --- 유형별 체크리스트 ---
checklist() {
  case "$TYPE" in
    feat|prototype)
      printf '%s\n' "- [ ] UI: $UI" "- [ ] API: $API" "- [ ] 데모: $DEMO";;
    fix)
      printf '%s\n' "- [ ] 재현: $REPRO" "- [ ] 원인: $CAUSE" "- [ ] 수정: $FIX";;
    setup|infra|deploy)
      printf '%s\n' "- [ ] 구성: $SETUP" "- [ ] 검증: $VERIFY";;
    chore)
      printf '%s\n' "- [ ] 작업: $TASK" "- [ ] 검증: $VERIFY";;
  esac
}

# 템플릿(.github/issue_template.md)을 읽어 토큰({{ID}} 등)을 채운다.
# {{CHECKLIST}}는 유형별 체크리스트로 치환한다.
render_from_template() {
  local line p r d
  p="${PAGE:-–}"; r="${REFS:-–}"; d="${DONE:-–}"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *'{{CHECKLIST}}'*) checklist ;;
      *)
        line="${line//'{{ID}}'/$PREFIX}"
        line="${line//'{{TYPE}}'/$TYPE}"
        line="${line//'{{PAGE}}'/$p}"
        line="${line//'{{REFS}}'/$r}"
        line="${line//'{{DONE}}'/$d}"
        printf '%s\n' "$line"
        ;;
    esac
  done < "$TEMPLATE"
}

# --- 본문 조립: .github/issue_template.md 기준 (없으면 내장 폴백) ---
if [ -f "$TEMPLATE" ]; then
  BODY="$(render_from_template)"
else
  BODY="$(cat <<EOF
## 개요
- **ID:** ${PREFIX} · **유형:** ${TYPE}
- **페이지/영역:** ${PAGE:-–}
- **참고:** ${REFS:-–}

## 완료 조건
- ${DONE:-–}

## 체크리스트
$(checklist)
EOF
)"
fi

# --- dry-run 이면 출력만 ---
if [ -n "$DRYRUN" ]; then
  echo "── DRY RUN (등록하지 않음) ──"
  echo "제목: $FULL_TITLE"
  echo "라벨: $LABELS"
  echo "----- 본문 -----"
  echo "$BODY"
  exit 0
fi

# --- 실제 등록 ---
command -v gh >/dev/null 2>&1 || { echo "gh CLI 필요: brew install gh" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh 인증 필요: gh auth login" >&2; exit 1; }

# 적용할 라벨이 저장소에 없으면 생성
for l in $LABELS; do ensure_label "$l"; done

GH_ARGS=(--title "$FULL_TITLE" --body "$BODY")
for l in $LABELS; do GH_ARGS+=(--label "$l"); done
[ -n "$ASSIGNEE" ] && GH_ARGS+=(--assignee "$ASSIGNEE")

URL="$(gh issue create "${GH_ARGS[@]}")"
echo "✓ 생성: $URL"
echo "  제목: $FULL_TITLE"
echo "  라벨: $LABELS"
