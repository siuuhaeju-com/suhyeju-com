# 데이터 소스 · 외부 API 정리

수혜주.com이 **실제로 호출하는 외부 API**와, 검토했으나 **채택하지 않은 API + 이유**를 정리한다.
(시세/등락률 소스 조사 결과는 재조사 방지를 위해 근거까지 남긴다.)

---

## ✅ 사용 중인 API/소스

### 1. 네이버 금융 (비공식 모바일 API) — 인증 불필요

정상 브라우저처럼 `User-Agent` 헤더를 붙이고, 응답을 캐시한다. 비공식이라 차단 가능성이 리스크.

| 용도                   | 엔드포인트                                      | 쓰는 곳                                        |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------- |
| 업종 등락률(WICS 79개) | `m.stock.naver.com/api/stocks/industry`         | 시장 섹터 API (#34)                            |
| 업종 구성종목          | `m.stock.naver.com/api/stocks/industry/{no}`    | 시장 히트맵 (#34)                              |
| 종목명→코드 자동완성   | `ac.stock.naver.com/ac`                         | 시세 join (#9) — 한글명으로 한·미 종목 매칭    |
| 한국 종목 시세         | `m.stock.naver.com/api/stock/{code}/basic`      | 시세 join (#9)                                 |
| 미국 종목 시세         | `api.stock.naver.com/stock/{reutersCode}/basic` | 시세 join (#9) — `NVDA.O`·`AFL` 등 접미사 가변 |

### 2. 네이버 검색 API (공식) — 인증 필요

- `openapi.naver.com/v1/search/news.json`
- 키: `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` (.env.local)
- 용도: 인기 뉴스 (#33)

### 3. GPT 게이트웨이 (엘리스, OpenAI 호환)

- `mlapi.run/{api_id}/v1` — 모델 `openai/gpt-5.4`
- 키: `OPENAI_API_KEY` (JWT, .env.local) / 주소: `GPT_BASE_URL`
- 용도: 뉴스 분석 (#9). **표준 OpenAI(gpt-4o 등)로도 전환 가능** — `GPT_BASE_URL` 비우면 자동.

### 4. 뉴스 본문 추출 (직접 스크래핑)

- `cheerio` 셀렉터맵(`#dic_area` 등) + `@extractus/article-extractor` 폴백
- 용도: URL → 본문 (#9)
- ⚠️ 저작권: 언론사 약관이 AI 학습 스크래핑 금지 → **본문 붙여넣기를 1차 입력**, 추출 본문은 영구 저장 안 함.

---

## ❌ 검토했으나 미채택 (재조사 방지)

### tradingeconomics

> https://github.com/tradingeconomics/tradingeconomics

- **유료** — 무료 `guest` 토큰이 폐지되어 인증 없이는 `401/410` 반환
- **한국 데이터가 얕음** — OTC/CFD 위주라 KRX 정식 종목·업종 커버가 부족
- **섹터(업종) API가 없음** — 수혜주의 핵심인 "산업별 영향도 히트맵" 용도에 부적합

→ 우리는 무료 + 한국 KRX 커버 + 업종 데이터가 필요한데 셋 다 안 맞아 탈락.

### 기타 미채택

| 소스                              | 미채택 이유                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| Finnhub                           | 미국은 무료지만 **한국은 유료**                             |
| FMP · Polygon · financialdatasets | 무료 티어는 **미국 시장만**                                 |
| EODHD                             | 한국은 유료 패키지만, EOD(종가)만 제공                      |
| marketstack                       | KRX 가능성은 있으나 **섹터 API 0개**, 월 100콜 제한, 미검증 |
| Alpha Vantage · Twelve Data       | KRX **무료 실시간 불가**                                    |
| DBnomics · WorldBank · FRED       | 매크로 지표만(개별 종목·업종 없음)                          |

---

## 결론

- **한국 시세/업종** = 네이버 비공식 API (직접 검증됨, 무인증)
- **미국 시세** = 네이버 worldstock (`api.stock.naver.com`) — 별도 미국 API 불필요
- **뉴스** = 네이버 검색 API(공식)
- **분석(LLM)** = 엘리스 게이트웨이 `gpt-5.4` (또는 표준 OpenAI)

상용 시세 API는 대부분 **유료 · 미국 편중 · 섹터 데이터 부재**로 탈락했고, 네이버 비공식 API가 무료로 한국+미국+업종을 모두 커버해 채택했다.
