// Conventional Commits 표준 검증 (commit-msg 훅에서 실행)
// 규칙 정본: https://www.conventionalcommits.org/ko/v1.0.0/
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 허용 커밋 유형 — Conventional Commits 표준 세트
    'type-enum': [
      2,
      'always',
      [
        'feat', // 새 기능
        'fix', // 버그 수정
        'docs', // 문서만 변경
        'style', // 포맷팅 등 코드 동작에 영향 없는 변경
        'refactor', // 기능 변경 없는 리팩터링
        'perf', // 성능 개선
        'test', // 테스트 추가/수정
        'build', // 빌드 시스템·의존성 변경
        'ci', // CI 설정 변경
        'chore', // 기타 잡무 (빌드/보조 도구 등)
        'revert', // 이전 커밋 되돌리기
      ],
    ],
    // 제목(subject) 길이 제한
    'subject-max-length': [2, 'always', 72],
    // 제목 비어 있으면 실패
    'subject-empty': [2, 'never'],
    // 유형 비어 있으면 실패
    'type-empty': [2, 'never'],
    // 본문(body)에 반드시 한 줄 이상 설명 작성
    'body-empty': [2, 'never'],
    'body-min-length': [2, 'always', 1],
    // 제목과 본문 사이 빈 줄 필수 (Conventional Commits 표준)
    'body-leading-blank': [2, 'always'],
  },
};
