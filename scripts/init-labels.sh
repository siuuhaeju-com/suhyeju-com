#!/usr/bin/env bash
# 이슈 라벨(11종)을 GitHub 저장소에 일괄 생성/갱신한다. 최초 1회 실행.
# 컨벤션 정본: docs/issue-convention.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/labels.sh
. "$SCRIPT_DIR/lib/labels.sh"

command -v gh >/dev/null 2>&1 || { echo "gh CLI가 필요합니다: brew install gh" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh 인증이 필요합니다: gh auth login" >&2; exit 1; }

echo "라벨 부트스트랩 (11종)…"
ensure_all_labels
echo "완료. 'gh label list' 로 확인하세요."
