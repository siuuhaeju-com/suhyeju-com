# 코드·커밋 품질 자동 검사 (Husky + lint-staged + commitlint)

팀원이 **커밋하기 직전** 변경 파일의 린팅·포맷팅과 커밋 메시지 규칙을 자동으로 검사한다. 검사에 실패하면 **커밋이 차단**되어, 잘못된 코드/메시지가 저장소에 들어오지 않는다.

## 무엇이 언제 실행되나

| Git 훅       | 시점                                | 실행 도구                           | 하는 일                                                        | 실패 시   |
| ------------ | ----------------------------------- | ----------------------------------- | -------------------------------------------------------------- | --------- |
| `pre-commit` | `git commit` 직후, 커밋 생성 **전** | **lint-staged** → ESLint + Prettier | **staged(변경) 파일만** 린트·포맷 (자동 수정 후 다시 스테이징) | 커밋 차단 |
| `commit-msg` | 메시지 입력 직후                    | **commitlint**                      | 커밋 메시지가 Conventional Commits 규칙에 맞는지 검증          | 커밋 차단 |

> **staged 파일만** 검사하므로 저장소 전체를 매번 검사하지 않아 빠르다.

## 설치 (팀원이 저장소를 처음 clone 한 뒤 1회)

```bash
npm install
```

- `package.json`의 `prepare` 스크립트가 `npm install` 시 자동 실행되어 **Husky 훅이 활성화**된다.
- 별도의 `husky install` 명령을 손으로 칠 필요 없다.
- 이후에는 평소처럼 `git commit` 하면 훅이 자동으로 돈다.

## 커밋 메시지 규칙 (Conventional Commits)

**형식:**

```
<type>(<scope>): <subject>

<body>

[optional footer]
```

- `type` / `subject` / **`body`는 필수**, `scope` / `footer`는 선택.
- `subject`는 **72자 이내**.
- **`body`(본문)에 한 줄 이상 설명을 반드시 작성**한다. 제목과 본문 사이에는 **빈 줄**이 있어야 한다.

**허용 `type` 목록:**

| type       | 용도                            | 예시                              |
| ---------- | ------------------------------- | --------------------------------- |
| `feat`     | 새 기능                         | `feat: 로그인 화면 추가`          |
| `fix`      | 버그 수정                       | `fix: 결제 금액 반올림 오류 수정` |
| `docs`     | 문서만 변경                     | `docs: README 설치법 보완`        |
| `style`    | 포맷팅 등 동작에 영향 없는 변경 | `style: 들여쓰기 정리`            |
| `refactor` | 기능 변경 없는 리팩터링         | `refactor: 유틸 함수 분리`        |
| `perf`     | 성능 개선                       | `perf: 이미지 lazy load`          |
| `test`     | 테스트 추가/수정                | `test: 로그인 케이스 추가`        |
| `build`    | 빌드 시스템·의존성 변경         | `build: vite 5로 업그레이드`      |
| `ci`       | CI 설정 변경                    | `ci: GitHub Actions 캐시 추가`    |
| `chore`    | 기타 잡무                       | `chore: .gitignore 정리`          |
| `revert`   | 이전 커밋 되돌리기              | `revert: feat 로그인 화면 추가`   |

**❌ 차단되는 예**

- `업데이트`, `수정함`, `WIP` — 유형(type) 없음
- 제목만 있고 본문(body)이 없는 커밋 (예: `feat: 회원가입 기능 추가` 한 줄만)

**✅ 통과되는 예** (제목 + 빈 줄 + 본문)

```
feat: 회원가입 기능 추가

이메일 인증과 비밀번호 규칙 검사를 포함해 신규 가입 흐름을 구현했다.
```

> 터미널에서 여러 줄로 커밋하려면 `-m`을 두 번 쓴다: `git commit -m "feat: 회원가입 기능 추가" -m "이메일 인증과 비밀번호 규칙 검사를 추가했다."`

## 코드 스타일 규칙

- **ESLint** — JS/TS 코드의 문법·품질 검사 (`eslint.config.mjs`). 팀이 프레임워크(React/Vue 등)를 도입하면 이 파일에 플러그인을 추가한다.
- **Prettier** — 코드 포맷 통일 (`.prettierrc.json`). JS/TS 외에 `json·md·css·yaml` 등도 포맷.
- 두 도구는 `eslint-config-prettier`로 규칙 충돌을 제거해 함께 쓴다.

**lint-staged 대상별 실행 (`package.json`의 `lint-staged`):**

| 파일 패턴                                | 실행                                |
| ---------------------------------------- | ----------------------------------- |
| `*.{js,jsx,ts,tsx,mjs,cjs}`              | `eslint --fix` → `prettier --write` |
| `*.{json,md,mdx,css,scss,html,yml,yaml}` | `prettier --write`                  |

> 현재 저장소에는 JS/TS 소스가 없어 ESLint는 앞으로 작성할 코드부터 적용된다. 지금은 Prettier가 문서/설정 파일 포맷을 담당한다.

## 수동 실행 (커밋 없이 전체 검사하고 싶을 때)

```bash
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
npm run format        # Prettier로 전체 포맷 적용
npm run format:check  # 포맷 어긋난 파일만 확인 (수정 X)
```

## 자주 겪는 상황

- **커밋이 막혔어요** → 터미널의 실패 메시지(어떤 규칙/파일인지)를 읽고 수정 후 다시 `git commit`. 대부분 pre-commit이 자동 수정까지 해두므로 `git add` 후 재커밋하면 된다.
- **훅이 아예 안 돌아요** → `npm install`을 실행했는지 확인. (`.husky/_` 디렉터리와 `git config core.hooksPath`가 `.husky/_`인지 확인)
- **긴급 상황에 훅을 건너뛰어야 해요** → `git commit --no-verify` (권장하지 않음. 정말 필요할 때만).

## 관련 파일

| 파일                                   | 역할                                             |
| -------------------------------------- | ------------------------------------------------ |
| `package.json`                         | 의존성 · `prepare` 스크립트 · `lint-staged` 설정 |
| `.husky/pre-commit`                    | 커밋 전 `npx lint-staged` 실행                   |
| `.husky/commit-msg`                    | 커밋 메시지 `npx commitlint` 검증                |
| `commitlint.config.mjs`                | Conventional Commits 규칙                        |
| `eslint.config.mjs`                    | ESLint 규칙                                      |
| `.prettierrc.json` / `.prettierignore` | Prettier 규칙 / 제외 경로                        |

---

**요약**

- `pre-commit`은 **lint-staged로 변경 파일만** ESLint·Prettier 실행, `commit-msg`는 **commitlint로 Conventional Commits** 검증 → 실패 시 커밋 차단.
- 팀원은 clone 후 **`npm install` 한 번**이면 훅이 자동 활성화된다.
- 커밋 메시지는 `feat: ...`, `fix: ...`처럼 **`type: 제목`** 형식에 더해, **빈 줄 뒤 한 줄 이상의 본문(body)**을 반드시 작성해야 한다.
