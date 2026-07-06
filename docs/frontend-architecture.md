# 프론트엔드 구조 결정

## 앱 위치

- 프론트엔드 앱은 `apps/web`에 둔다.
- Next.js App Router를 사용하므로 라우트 파일은 `apps/web/src/app` 아래에 둔다.
- 백엔드와 익스텐션은 각각 `apps/api`, `apps/extension`에 둔다.

## UI 컴포넌트 위치

공통 UI 컴포넌트는 `packages/ui`로 분리할 수 있다. 예를 들어 `web`과 `extension`이 같은 Button, Input, Dialog, Card 등을 함께 사용한다면 `packages/ui`를 두고 `@suhyeju/ui`로 가져오는 구조가 적합하다.

다만 이번 MVP에서는 UI 작업 범위가 주로 `apps/web`에 집중되어 있고, `extension`의 UI 재사용 범위가 아직 확정되지 않았으므로 당장은 `packages/ui`를 만들지 않는다.

현재 결정:

- shadcn/ui 컴포넌트는 `apps/web/src/components/ui`에 둔다.
- 앱 내부 공통 유틸은 `apps/web/src/lib`에 둔다.
- 실제로 두 앱 이상에서 같은 컴포넌트를 재사용하게 되면 그때 `packages/ui`로 분리한다.

## 현재 스캐폴딩 기준 라우트

- `/`: 메인 페이지
- `/analyzing`: 분석 진행 페이지
- `/analysis/[id]`: 분석 결과 상세 페이지
