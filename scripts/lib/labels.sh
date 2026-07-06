#!/usr/bin/env bash
# 라벨 정의 SSOT — docs/issue-convention.md 와 동기화해서 관리한다.
# init-labels.sh / new-issue.sh 가 이 파일을 source 한다.
# (bash 3.2 호환: 연관배열 대신 case 사용)
# 순위 라벨은 한국어, 유형/부가 라벨은 영어.

ALL_LABELS="1순위 2순위 3순위 4순위 feat setup prototype infra deploy fix chore pre"

label_color() {
  case "$1" in
    1순위) echo "B60205";;
    2순위) echo "D93F0B";;
    3순위) echo "FBCA04";;
    4순위) echo "C5DEF5";;
    feat) echo "0E8A16";;
    setup) echo "5319E7";;
    prototype) echo "1D76DB";;
    infra) echo "006B75";;
    deploy) echo "A2703F";;
    fix) echo "D73A4A";;
    chore) echo "BFD4F2";;
    pre) echo "E99695";;
    *) echo "";;
  esac
}

label_desc() {
  case "$1" in
    1순위) echo "즉시 구현 (높은 임팩트/짧은 시간)";;
    2순위) echo "핵심 확장 (높은 임팩트/긴 시간)";;
    3순위) echo "여유 시 (낮은 임팩트/짧은 시간)";;
    4순위) echo "스펙아웃·mock (낮은 임팩트/긴 시간)";;
    feat) echo "기능 구현 (F-xx)";;
    setup) echo "프로젝트 초기 세팅";;
    prototype) echo "정적 UI 프로토타입";;
    infra) echo "인프라·CI·시크릿";;
    deploy) echo "배포·도메인";;
    fix) echo "버그 수정";;
    chore) echo "잡무·리팩터·설정";;
    pre) echo "기능 구현 전 완료해야 하는 선행 작업";;
    *) echo "";;
  esac
}

# 라벨 1개를 idempotent 하게 생성/갱신 (--force: 있으면 갱신, 없으면 생성)
ensure_label() {
  local name="$1" color desc
  color="$(label_color "$name")"
  desc="$(label_desc "$name")"
  if [ -z "$color" ]; then
    echo "  ! 알 수 없는 라벨: $name" >&2
    return 1
  fi
  gh label create "$name" --color "$color" --description "$desc" --force >/dev/null 2>&1
}

# 전체 라벨 부트스트랩
ensure_all_labels() {
  local l
  for l in $ALL_LABELS; do
    if ensure_label "$l"; then echo "  ✓ $l"; else echo "  ! $l 실패" >&2; fi
  done
}
