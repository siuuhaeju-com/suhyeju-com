---
name: 수혜주.com
description: 뉴스 한 건의 산업 파급을 시각화하는 다크 테마 분석 도구
colors:
  bg: '#0b0d12'
  surface: '#12151d'
  surface-raised: '#1a1f2c'
  ink: '#e9edf4'
  ink-sub: '#c6cdda'
  ink-muted: '#8a93a6'
  ink-dim: '#5b6474'
  brand-blue: '#3d6bff'
  blue-bright: '#6ea0ff'
  positive: '#f2495c'
  negative: '#2fbf71'
  tier2-purple: '#8b7bff'
  tier3-teal: '#2fb3c9'
typography:
  headline:
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif"
    fontSize: '18px'
    fontWeight: 700
  title:
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif"
    fontSize: '15px'
    fontWeight: 700
  body:
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif"
    fontSize: '13.5px'
    fontWeight: 400
  label:
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif"
    fontSize: '12px'
    fontWeight: 500
rounded:
  sm: '9px'
  md: '12px'
  lg: '16px'
  full: '50%'
components:
  button-primary:
    backgroundColor: '{colors.brand-blue}'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.lg}'
  chip:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink-sub}'
    rounded: '{rounded.sm}'
  tooltip:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
---

# Design System: 수혜주.com

> 시각 정본: `docs/design/mockup/뉴스 영향력 분석.dc.html`(Claude Design 목업) + `docs/proposal/13`(팀 합의).
> 위 frontmatter 토큰은 목업에서 추출한 실측값이다(hex가 소스 오브 트루스, OKLCH는 아래 병기). 구현 시 `src/app/globals.css`의 shadcn CSS 변수로 주입한다 — 현재 globals.css는 shadcn 무채색 기본값이므로 이 문서 기준으로 교체해야 한다.

## Overview

다크 단일 테마 뉴스 영향력 분석 도구. 배경은 near-black 네이비 — 어두운 방에서 뉴스를 분석하는 투자자의 화면. 라이트 테마는 범위 밖(`:root`에 다크 값을 직접 정의, `.dark` variant 불필요).

- 크롬(헤더·카드·버튼)은 조용하게, **색·모션 예산은 데이터 시각화(파급 그래프·히트맵)에 몰아준다.**
- 카드 기반 2단 레이아웃(콘텐츠 좌 / 요약·현황 우). 좌상단 로고 `수혜주.com`, 우상단 상태 표시.
- 분석 페이지 섹션 순서: AI 요약 → 전망 분석 → 영향력 확산 그래프 → 섹터별 영향도 히트맵 → 산업 지식그래프.
- 모션 어휘: `fadeUp`(등장) · `ripple`(파급 원점) · `dashmove`(연결선 흐름) · `glowPulse`(라이브 상태). 역할은 장식이 아니라 "분석이 살아 있다"는 서사. ease-out 지수 계열, `transform`/`opacity`만 애니메이트, 모든 모션에 `prefers-reduced-motion` 대안 필수.

## Colors

### Primary

- **brand-blue** (`#3d6bff` / oklch(0.585 0.226 266.2)): 주 액션(분석하기 버튼)·포커스 링. ⚠️ 배경 위 대비 4.4:1 — **작은 텍스트 링크로 쓰지 말 것**(텍스트 링크는 blue-bright 사용). 버튼 라벨(흰색)은 14px bold 이상만.
- **blue-bright** (`#6ea0ff` / oklch(0.713 0.149 262.2)): 텍스트 링크·하이라이트·그래프 1차 파급. 배경 위 7.5:1로 안전.

### Secondary (의미색 — ⚠️ 한국 시장 관례, 서구와 반대)

- **positive** (`#f2495c` / oklch(0.650 0.204 18.8)): 긍정/상승/호재. 틴트 배경 `rgba(242,73,92,0.07)`. surface-raised 위 4.6:1 — 통과하지만 여유 없음, 수치는 bold로.
- **negative** (`#2fbf71` / oklch(0.712 0.164 154.1)): 부정/하락/악재. 틴트 배경 `rgba(47,191,113,0.07)`.
- 등락·신호 카드·히트맵 전부 이 규칙. **범례 필수 병기**, 색 외에 화살표·부호(+/−) 병용.

### Tertiary (파급 단계색 — 영향력 확산 그래프)

- 원점(뉴스): `{colors.brand-blue}` · 1차: `{colors.blue-bright}` · 2차: **tier2-purple** (`#8b7bff` / oklch(0.661 0.189 285.5)) · 3차: **tier3-teal** (`#2fb3c9` / oklch(0.708 0.112 211.6)).

### Neutral (실측 대비 — WCAG AA 기준)

| 토큰           | 값        | OKLCH                  | bg 위 대비  | 용도                                         |
| -------------- | --------- | ---------------------- | ----------- | -------------------------------------------- |
| bg             | `#0b0d12` | oklch(0.159 0.011 268) | —           | body 배경                                    |
| surface        | `#12151d` | oklch(0.196 0.017 269) | —           | 카드·패널                                    |
| surface-raised | `#1a1f2c` | oklch(0.241 0.026 268) | —           | hover·툴팁                                   |
| ink            | `#e9edf4` | oklch(0.945 0.010 262) | 16.6:1      | 제목·주요 수치                               |
| ink-sub        | `#c6cdda` | oklch(0.847 0.020 263) | 12.2:1      | 본문                                         |
| ink-muted      | `#8a93a6` | oklch(0.662 0.030 265) | 6.3:1       | 라벨·캡션                                    |
| ink-dim        | `#5b6474` | oklch(0.501 0.028 262) | **3.3:1 ✗** | **텍스트 금지** — 장식 선·비활성 아이콘 전용 |

보더: `rgba(255,255,255,0.06~0.09)` 1px.

## Typography

- **Pretendard Variable / Pretendard** 단일 패밀리, weight로 위계(800/700/500/400). 숫자·티커에 모노스페이스 허용.
- 정보 밀도가 높은 분석 도구 스케일(데스크톱): headline 18px/700 · title 15px/700 · body 12.5–13.5px/400 · label 10.5–12px/500. Tailwind로는 `text-lg`/`text-[15px]`/`text-[13.5px]`/`text-xs` 수준.
- 등락률 등 핵심 수치는 크기 대신 **weight(700–800) + 의미색**으로 강조.
- letter-spacing은 짧은 uppercase 라벨에만 ≤0.1em. 본문 트래킹 금지.
- 헤딩 레벨은 건너뛰지 않는다(h1→h2→h3).

## Elevation

다크 테마의 높이감은 그림자가 아니라 **서피스 밝기 단계 + 1px 보더**로 표현한다.

1. `bg` (#0b0d12) — 바닥
2. `surface` (#12151d) + 보더 — 카드
3. `surface-raised` (#1a1f2c) — hover·툴팁·팝오버 (툴팁 배경은 `rgba(11,13,18,0.9)` 허용)

컬러 글로우(box-shadow에 브랜드 블루)는 **라이브 상태 인디케이터 한 곳만** 허용, 카드·버튼 장식용 금지. z-index는 시맨틱 스케일(dropdown→sticky→modal→toast→tooltip)로.

## Components

**구현 스택: Next.js + Tailwind v4 + shadcn/ui.** shadcn CSS 변수 매핑(globals.css `:root`):

| shadcn 변수                          | 토큰                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| `--background`                       | `{colors.bg}`                                                         |
| `--card` / `--popover`               | `{colors.surface}`                                                    |
| `--foreground` / `--card-foreground` | `{colors.ink}`                                                        |
| `--muted-foreground`                 | `{colors.ink-muted}`                                                  |
| `--primary`                          | `{colors.brand-blue}` (foreground `#ffffff`)                          |
| `--secondary` / `--accent`           | `{colors.surface-raised}`                                             |
| `--destructive`                      | `{colors.negative}` — 파괴적 액션(삭제)용. 시세 하락과 의미 구분 주의 |
| `--border` / `--input`               | `rgba(255,255,255,0.08)`                                              |
| `--ring`                             | `{colors.brand-blue}`                                                 |
| `--chart-1..5`                       | blue-bright · tier2-purple · tier3-teal · positive · negative         |
| `--radius`                           | `12px` (카드는 `{rounded.lg}`)                                        |

주요 컴포넌트 규칙:

- **헤더**: 로고(좌)+상태 인디케이터(우), 얇은 보더로 배경과 동화.
- **AI 요약 카드**: 뉴스 메타(제목·언론사·일자·태그) + 요약본 + 원문 버튼 + 키워드/섹터 칩.
- **신호 카드**: 호재(positive 틴트)/주의(negative 틴트) 대칭, 비율 바, 뉴스·리포트·애널리스트 목록.
- **확산 그래프**: 원점→1차→2차→3차 열 배치, 단계색 점 + 등락%, 연결선 hover 근거 툴팁. 캔버스 렌더 시 노드 라벨 800/600 weight.
- **히트맵**: 트리맵(면적=영향도), positive/negative + 영향 클수록 진하게, 셀에 섹터명+%.
- **칩(pill)**: 섹터·키워드 공통, `{components.chip}`.
- 카드·보더 있는 컨테이너 내부 패딩 최소 12px — 텍스트가 경계선에 붙지 않게.

## Do's and Don'ts

**Do**

- 긍정=빨강 / 부정=초록(한국 관례)을 전 화면 일관 적용 + 범례·화살표·부호 병기.
- 모든 시각화 수치에 "왜"(근거 툴팁·출처)를 한 번의 인터랙션 안에 배치.
- 로딩은 단계 서사(뉴스 읽기 → 키워드 추출 → 전망 분석 → 산업 영향 시각화)로.
- 캔버스 시각화에는 동등한 정보의 텍스트 대안(툴팁·표) 제공.

**Don't** — ⚠️ 아래 일부는 **목업에 실제로 존재**(detect 24건). 구현 시 따라 하지 말 것:

- `ink-dim`(#5b6474)을 텍스트로 사용 (전 배경에서 AA 실패 — 목업 9곳 위반).
- 히어로 위 tracked-caps 아이브로 칩("AI NEWS IMPACT ANALYSIS" 패턴 — 목업에 있음), 본문 트래킹 0.05em↑(목업 0.21em 위반).
- 카드·버튼 장식용 다크 글로우(목업의 블루 글로우는 라이브 인디케이터로만 축소 계승).
- `width`/`height`/레이아웃 속성 transition(목업에 있음) — transform/opacity로 대체.
- brand-blue 배경 위 작은 컬러 텍스트(대비 1.0~1.4:1 — 목업 위반), 헤딩 레벨 건너뛰기(h1→h3).
- 긍정=초록/부정=빨강 혼용, 크림/라이트 배경, 그라데이션 텍스트, 카드 좌측 스트라이프, `01/02/03` 섹션 번호 스캐폴딩, 단계 서사 없는 단독 스피너, 임의 z-index(999).
