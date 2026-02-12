# CLAUDE.md — OpenDART MCP Server

> 이 파일은 AI 코딩 어시스턴트(Claude Code, Cursor 등)가 프로젝트를 이해하기 위한 마스터 문서입니다.
> 코드를 작성하기 전에 반드시 이 파일 전체를 읽으세요.

---

## 🎯 프로젝트 한 줄 요약

**한국 금융감독원 DART(전자공시시스템) 데이터를 AI 에이전트가 사용할 수 있게 하는 MCP 서버.**

"삼성전자 최근 3년 매출 추이 알려줘", "카카오 최대주주가 누구야?", "오늘 공시 나온 거 있어?" 같은 질문에 AI가 직접 DART API를 호출해 답할 수 있게 만든다.

---

## 📦 프로젝트 정보

- **이름:** `opendart-mcp-server`
- **npm 패키지명:** `opendart-mcp` (추후 배포 시)
- **언어:** TypeScript
- **런타임:** Node.js 18+
- **프레임워크:** FastMCP (TypeScript) — `npm i fastmcp`
- **라이선스:** MIT

---

## 🏗️ 프로젝트 구조

```
opendart-mcp-server/
├── src/
│   ├── index.ts              # 진입점 — FastMCP 서버 초기화 + 시작
│   ├── tools/                # MCP Tool 정의 (DART API별 1파일)
│   │   ├── disclosure.ts     # 공시검색, 기업개황, 고유번호
│   │   ├── financial.ts      # 재무제표, 주요계정, 재무지표
│   │   ├── shareholder.ts    # 최대주주, 지분공시, 임원현황
│   │   └── event.ts          # 주요사항보고서 (유상증자, 합병 등)
│   ├── utils/
│   │   ├── dart-client.ts    # DART API HTTP 클라이언트 (인증키 관리, 요청, 에러 처리)
│   │   ├── corp-code.ts      # 회사명/종목코드 → DART 고유번호 변환 유틸리티
│   │   └── formatters.ts     # 숫자 포맷팅, 날짜 변환, 응답 정리 헬퍼
│   └── types/
│       └── dart.ts           # DART API 응답 타입 정의
├── data/
│   └── corp-codes.json       # DART 고유번호 ↔ 회사명/종목코드 매핑 캐시 (빌드 시 생성)
├── scripts/
│   └── update-corp-codes.ts  # DART에서 최신 고유번호 목록 다운로드하는 스크립트
├── package.json
├── tsconfig.json
├── .env.example              # DART_API_KEY=your_key_here
├── .gitignore
├── README.md                 # 사용자 대상 설명서 (한국어 + 영어)
├── CLAUDE.md                 # 이 파일
└── BRAND.md                  # 브랜드 가이드
```

---

## 🔧 기술 스택 상세

### FastMCP (TypeScript)
- GitHub: https://github.com/punkpeye/fastmcp
- npm: `fastmcp` (최신 버전 사용)
- 이유: MCP 서버 구축에 가장 적은 보일러플레이트. `server.addTool()`로 도구 정의가 끝남
- 전송 방식: `stdio` (Claude Desktop/Cursor 용) + `httpStream` (원격 접속 용)

### DART OpenAPI
- 공식 사이트: https://opendart.fss.or.kr
- 인증: API Key (무료 발급, 일 10,000건 제한)
- 응답 형식: JSON (기본) 또는 XML
- Base URL: `https://opendart.fss.or.kr/api/`

---

## 📡 DART OpenAPI 사용할 엔드포인트 목록

### Phase 1 (MVP — 반드시 먼저 구현)

| 카테고리 | API명 | 엔드포인트 | 설명 |
|----------|--------|-----------|------|
| 공시정보 | 공시검색 | `/api/list.json` | 특정 기업 또는 전체 공시 목록 조회 |
| 공시정보 | 기업개황 | `/api/company.json` | 회사명, 대표자, 업종, 설립일 등 기본 정보 |
| 공시정보 | 고유번호 | `/api/corpCode.xml` | 전체 기업 고유번호 ZIP 다운로드 |
| 재무정보 | 단일회사 주요계정 | `/api/fnlttSinglAcnt.json` | 매출, 영업이익, 당기순이익 등 핵심 계정 |
| 재무정보 | 다중회사 주요계정 | `/api/fnlttMultiAcnt.json` | 여러 회사 재무 비교 |
| 재무정보 | 단일회사 전체 재무제표 | `/api/fnlttSinglAll.json` | 전체 재무제표 계정과목 |

### Phase 2 (확장)

| 카테고리 | API명 | 엔드포인트 | 설명 |
|----------|--------|-----------|------|
| 재무정보 | 단일회사 주요 재무지표 | `/api/fnlttSinglIndx.json` | ROE, 부채비율 등 재무비율 |
| 재무정보 | 다중회사 주요 재무지표 | `/api/fnlttMultiIndx.json` | 여러 회사 재무비율 비교 |
| 정기보고서 | 배당에 관한 사항 | `/api/alotMatter.json` | 배당금, 배당수익률 |
| 정기보고서 | 최대주주 현황 | `/api/hyslrSttus.json` | 최대주주 이름, 지분율 |
| 정기보고서 | 최대주주 변동현황 | `/api/hyslrChgSttus.json` | 최대주주 변경 이력 |
| 정기보고서 | 임원 현황 | `/api/exctvSttus.json` | 임원 이름, 직위, 보수 |
| 정기보고서 | 직원 현황 | `/api/empSttus.json` | 직원 수, 평균 급여 |
| 지분공시 | 대량보유 상황보고 | `/api/majorstock.json` | 5% 이상 지분 보유 |
| 지분공시 | 임원 주요주주 소유보고 | `/api/elestock.json` | 임원/주요주주 주식 거래 |

### Phase 3 (고급)

| 카테고리 | API명 | 엔드포인트 | 설명 |
|----------|--------|-----------|------|
| 주요사항 | 유상증자 | `/api/piicDecsn.json` | 유상증자 결정 |
| 주요사항 | 무상증자 | `/api/friDecsn.json` | 무상증자 결정 |
| 주요사항 | 전환사채 발행 | `/api/cvbdIsDecsn.json` | CB 발행 결정 |
| 주요사항 | 합병 | `/api/mgDecsn.json` | 합병 결정 |
| 주요사항 | 자기주식 취득/처분 | `/api/tesstkAcqsDspsSttus.json` | 자사주 매매 |
| 증권신고서 | 지분증권 | `/api/estkIsDecsn.json` | 주식 발행 정보 |

---

## 🔨 MCP Tool 설계 명세

### 핵심 원칙

1. **Tool 이름은 영어, description은 영어+한국어 병기** — 글로벌 사용자와 한국 사용자 모두 대상
2. **Tool 하나는 하나의 일만** — `search_disclosures`는 공시 검색만, 재무정보는 별도 tool
3. **회사 식별은 유연하게** — 회사명("삼성전자"), 종목코드("005930"), DART 고유번호("00126380") 모두 허용
4. **응답은 AI가 해석하기 좋게** — 원본 JSON을 그대로 주지 말고, 핵심만 추려서 읽기 좋은 텍스트+구조화 데이터로

### Tool 목록 (Phase 1 MVP)

#### 1. `search_company`
```
설명: Search for a Korean company and get basic info (기업 검색 및 기본 정보 조회)
입력:
  - query: string (필수) — 회사명, 종목코드, 또는 DART 고유번호
출력: 회사명, 영문명, 종목코드, 대표자, 법인구분, 업종, 설립일, 결산월, 홈페이지, IR URL, 주소
내부: company.json API 호출. query가 회사명이면 corp-codes.json에서 고유번호 매핑 후 호출.
```

#### 2. `search_disclosures`
```
설명: Search DART disclosure filings (공시 보고서 검색)
입력:
  - company: string (선택) — 회사명 또는 종목코드. 생략 시 전체 공시
  - start_date: string (선택) — 검색 시작일 (YYYY-MM-DD). 기본값: 30일 전
  - end_date: string (선택) — 검색 종료일 (YYYY-MM-DD). 기본값: 오늘
  - type: enum (선택) — "annual" | "major" | "issue" | "share" | "all". 기본값: "all"
    - annual = 정기공시(A), major = 주요사항보고(B), issue = 발행공시(C), share = 지분공시(D)
  - limit: number (선택) — 최대 결과 수 (1-100). 기본값: 20
출력: 공시 목록 (접수번호, 회사명, 보고서명, 제출인, 접수일자, DART 링크)
내부: list.json API 호출
```

#### 3. `get_financial_summary`
```
설명: Get key financial data for a company (기업 주요 재무제표 조회)
입력:
  - company: string (필수) — 회사명 또는 종목코드
  - year: number (선택) — 사업연도. 기본값: 최근 연도
  - quarter: enum (선택) — "Q1" | "Q2" | "Q3" | "annual". 기본값: "annual"
  - consolidated: boolean (선택) — 연결재무제표 여부. 기본값: true
출력: 매출액, 영업이익, 당기순이익, 자산총계, 부채총계, 자본총계 + 전년 대비 증감률
내부: fnlttSinglAcnt.json API 호출
```

#### 4. `get_full_financial_statements`
```
설명: Get full financial statements with all accounts (전체 재무제표 상세 조회)
입력:
  - company: string (필수)
  - year: number (선택) — 기본값: 최근 연도
  - quarter: enum (선택) — 기본값: "annual"
  - consolidated: boolean (선택) — 기본값: true
  - statement_type: enum (선택) — "BS" | "IS" | "CIS" | "CF" | "SCE" | "all"
    - BS=재무상태표, IS=손익계산서, CIS=포괄손익계산서, CF=현금흐름표, SCE=자본변동표
출력: 요청한 재무제표의 전체 계정과목 목록 (계정명, 당기금액, 전기금액)
내부: fnlttSinglAll.json API 호출
```

#### 5. `compare_financials`
```
설명: Compare financial data across multiple companies (다중 회사 재무 비교)
입력:
  - companies: string[] (필수) — 회사명 또는 종목코드 배열 (최대 10개)
  - year: number (선택)
  - quarter: enum (선택)
출력: 각 회사의 주요 재무지표를 나란히 비교한 테이블 형태
내부: fnlttMultiAcnt.json API 호출
```

---

## 🔑 DART API 공통 파라미터 참조

### 보고서 코드 (reprt_code)
- `11013` — 1분기보고서
- `11012` — 반기보고서
- `11014` — 3분기보고서
- `11011` — 사업보고서(연간)

### 공시유형 (pblntf_ty)
- `A` — 정기공시
- `B` — 주요사항보고
- `C` — 발행공시
- `D` — 지분공시
- `E` — 기타공시
- `F` — 외부감사관련
- `G` — 펀드공시
- `H` — 자산유동화
- `I` — 거래소공시
- `J` — 공정위공시

### 재무제표구분 (fs_div)
- `CFS` — 연결재무제표
- `OFS` — 개별재무제표

### 응답 상태 코드 (status)
- `000` — 정상
- `010` — 등록되지 않은 키
- `011` — 사용할 수 없는 키
- `012` — 접근할 수 없는 IP
- `013` — 조회된 데이터가 없음
- `020` — 요청 제한 초과
- `100` — 필드 오류
- `800` — 시스템 오류

---

## ⚙️ 핵심 구현 세부사항

### 회사명 → 고유번호 변환 (corp-code.ts)

DART API는 모든 기업별 조회에 8자리 `corp_code`(고유번호)를 요구한다.
사용자는 "삼성전자"나 "005930"으로 검색하므로 변환이 필수.

**구현 방식:**
1. `/api/corpCode.xml` 에서 ZIP 파일 다운로드 → 압축 해제 → XML 파싱
2. `{ corp_name → corp_code, stock_code → corp_code }` 매핑 테이블 생성
3. `data/corp-codes.json`에 캐시 저장
4. `scripts/update-corp-codes.ts`로 주기적 업데이트 가능
5. 검색 시: 완전일치 → 부분일치(포함) → 초성검색 순으로 fallback

**주의:**
- 고유번호 ZIP은 약 3MB, 파싱 결과 약 90,000+ 기업
- 종목코드가 없는 기업은 비상장법인 (stock_code가 빈 문자열)
- 동일 회사명이 여러 개일 수 있음 (예: "삼성전자" vs "삼성전자서비스")

### DART API 클라이언트 (dart-client.ts)

```typescript
// 핵심 설계
class DartClient {
  private apiKey: string;
  private baseUrl = 'https://opendart.fss.or.kr/api';
  
  // 모든 API 호출의 공통 래퍼
  async request<T>(endpoint: string, params: Record<string, string>): Promise<T>
  
  // 에러 처리: status !== '000'이면 한국어 에러 메시지 반환
  // 레이트 리밋: 일 10,000건 관리 (선택)
}
```

### 응답 포매팅 (formatters.ts)

**DART API 응답의 문제점:**
- 금액이 문자열로 옴 ("1234567890")
- 음수가 마이너스 기호 없이 올 수 있음
- 날짜가 "20240315" 형식

**반드시 처리할 것:**
- 금액: `1,234,567,890원` 또는 `12,345억원`으로 읽기 쉽게
- 날짜: `2024-03-15` ISO 형식으로 통일
- 비율: 퍼센트 계산 및 표시
- null/빈 값: "-" 또는 "정보 없음"으로 표시

---

## 🚨 주의사항 (반드시 준수)

### API 관련
1. **API 키를 코드에 하드코딩하지 마라.** 반드시 환경변수 `DART_API_KEY`에서 읽을 것.
2. **일일 요청 한도 10,000건.** 불필요한 반복 호출 금지. 고유번호 변환은 캐시 사용.
3. **에러 응답을 무시하지 마라.** `status !== '000'`이면 사용자에게 의미 있는 메시지 반환.
4. **DART API 서버가 느릴 수 있다.** 타임아웃을 15초 이상으로 설정.
5. **2015년 이전 데이터는 재무정보 API에서 제공하지 않는다.**

### MCP 관련
6. **Tool의 description을 정성껏 작성하라.** AI가 언제 이 도구를 쓸지 판단하는 유일한 단서.
7. **Tool 응답은 텍스트(text) 타입으로.** 구조화된 데이터도 읽기 좋은 텍스트로 포매팅해서 반환.
8. **console.log() 사용 금지.** stdio 전송 시 JSON-RPC 메시지를 오염시킴. `console.error()`만 사용.
9. **하나의 Tool에 너무 많은 기능을 넣지 마라.** AI가 혼란스러워함.

### 코드 품질
10. **모든 외부 API 호출에 try-catch.** 네트워크 오류 시 graceful한 에러 메시지.
11. **TypeScript strict 모드.** `any` 타입 사용 최소화.
12. **의존성 최소화.** `fastmcp`, `zod`(스키마 검증), HTTP 클라이언트(fetch 또는 undici) 정도만.

---

## 🏃 빌드 & 실행

### 개발 환경 설정
```bash
# 프로젝트 생성
mkdir opendart-mcp-server && cd opendart-mcp-server
npm init -y
npm install fastmcp zod
npm install -D typescript @types/node

# 환경변수 설정
cp .env.example .env
# .env 파일에 DART_API_KEY 입력

# 빌드 & 실행
npx tsc
node dist/index.js
```

### Claude Desktop에서 테스트
`claude_desktop_config.json`에 추가:
```json
{
  "mcpServers": {
    "opendart": {
      "command": "node",
      "args": ["/path/to/opendart-mcp-server/dist/index.js"],
      "env": {
        "DART_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### MCP Inspector로 테스트
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## 📋 구현 우선순위 체크리스트

### Phase 1: MVP (첫 주말)
- [ ] 프로젝트 초기화 (package.json, tsconfig.json, 디렉토리 구조)
- [ ] DartClient 기본 구현 (API 키 로딩, 요청, 에러 처리)
- [ ] 고유번호 매핑 구현 (corp-codes.json 생성)
- [ ] `search_company` tool 구현 + 테스트
- [ ] `search_disclosures` tool 구현 + 테스트
- [ ] `get_financial_summary` tool 구현 + 테스트
- [ ] README.md 작성
- [ ] Claude Desktop에서 실제 대화 테스트

### Phase 2: 확장 (다음 주)
- [ ] `get_full_financial_statements` tool
- [ ] `compare_financials` tool
- [ ] 주주/임원 관련 tools
- [ ] 배당 정보 tool
- [ ] 재무지표(ROE, 부채비율 등) tool
- [ ] npm 패키지 배포

### Phase 3: 수익화
- [ ] Apify Actor로 래핑 + 마켓플레이스 등록
- [ ] Smithery/MCP Market 등 MCP 디렉토리 등록
- [ ] README에 영어 설명 보강
- [ ] 블로그/유튜브 콘텐츠 작성
