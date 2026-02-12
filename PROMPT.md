# PROMPT.md — 바이브코딩 프롬프트 모음

> 이 문서는 Claude Code, Cursor 등에서 바이브코딩할 때 복사해서 쓸 프롬프트 모음입니다.
> 순서대로 하나씩 실행하면 프로젝트가 완성됩니다.

---

## 🚀 사전 준비

시작하기 전에 아래를 먼저 하세요:
1. DART OpenAPI 인증키 발급: https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do
2. Node.js 18+ 설치 확인: `node -v`
3. 작업 디렉토리 생성: `mkdir opendart-mcp-server && cd opendart-mcp-server`

---

## 프롬프트 1: 프로젝트 초기화

```
CLAUDE.md 파일을 읽고 프로젝트를 초기화해줘.

해야 할 것:
1. package.json 생성 (name: "opendart-mcp-server", type: "module")
2. TypeScript + FastMCP + zod 설치
3. tsconfig.json 생성 (strict, ES2022, Node16)
4. CLAUDE.md에 정의된 디렉토리 구조 생성 (src/tools, src/utils, src/types, data, scripts)
5. .env.example 파일 생성 (DART_API_KEY=your_key_here)
6. .gitignore 생성 (node_modules, dist, .env, data/corp-codes.json)
7. src/index.ts에 FastMCP 서버 기본 뼈대 작성 (서버 이름: "OpenDART", 버전: "1.0.0")

아직 tool은 구현하지 마. 서버가 정상적으로 시작되는 것만 확인.
```

---

## 프롬프트 2: DART API 클라이언트 구현

```
CLAUDE.md를 참고해서 src/utils/dart-client.ts를 구현해줘.

요구사항:
1. DartClient 클래스 생성
2. 생성자에서 환경변수 DART_API_KEY 읽기. 없으면 명확한 에러 메시지.
3. request<T>(endpoint, params) 메서드 — DART API 공통 호출 래퍼
   - base URL: https://opendart.fss.or.kr/api
   - 모든 요청에 crtfc_key 파라미터 자동 추가
   - JSON 응답 파싱
   - status !== '000'이면 CLAUDE.md의 상태 코드 표 참고해서 한국어 에러 메시지 throw
   - 타임아웃 15초
4. Node.js 내장 fetch 사용 (외부 HTTP 라이브러리 설치 불필요)
5. console.log 사용 금지. 디버깅은 console.error만.

DartClient 인스턴스를 export해서 다른 파일에서 import해서 쓸 수 있게.
```

---

## 프롬프트 3: 고유번호 매핑 시스템 구현

```
CLAUDE.md를 참고해서 회사명/종목코드 → DART 고유번호 변환 시스템을 구현해줘.

파일: src/utils/corp-code.ts, scripts/update-corp-codes.ts

요구사항:

[scripts/update-corp-codes.ts]
1. DART API의 /api/corpCode.xml 호출 → ZIP 파일 다운로드
2. ZIP 압축 해제 → XML 파싱 (corp_code, corp_name, stock_code, modify_date)
3. data/corp-codes.json에 저장:
   {
     "byName": { "삼성전자": "00126380", ... },
     "byStockCode": { "005930": "00126380", ... },
     "byCorpCode": { "00126380": { "name": "삼성전자", "stockCode": "005930" }, ... }
   }
4. package.json에 "update-corp-codes" 스크립트 추가

[src/utils/corp-code.ts]
1. data/corp-codes.json을 메모리에 로드 (서버 시작 시 1회)
2. resolveCorpCode(query: string) 함수:
   - 8자리 숫자면 → 고유번호로 간주, 그대로 반환
   - 6자리 숫자면 → 종목코드로 간주, byStockCode에서 찾기
   - 그 외 → 회사명으로 간주, byName에서 완전일치 → 부분일치(includes) 순으로 검색
   - 못 찾으면 에러: "'{query}'에 해당하는 기업을 찾을 수 없습니다."
3. searchCompanies(query: string) 함수:
   - 부분일치하는 회사 목록 반환 (최대 10개)
   - 상장사 우선 정렬

ZIP 처리는 Node.js 내장 zlib 사용. XML 파싱은 가벼운 라이브러리 하나만 설치 허용.
```

---

## 프롬프트 4: search_company Tool 구현

```
CLAUDE.md의 Tool 설계 명세를 참고해서 첫 번째 MCP tool을 구현해줘.

파일: src/tools/disclosure.ts

search_company tool:
- 설명: "Search for a Korean company and get basic corporate info (한국 기업 검색 및 기본 정보 조회)"
- 입력: query (string, 필수) — 회사명, 종목코드, 또는 DART 고유번호
- 내부 로직:
  1. resolveCorpCode(query)로 고유번호 변환
  2. DartClient로 /api/company.json 호출
  3. 응답을 읽기 쉽게 포매팅
- 출력 형식 (텍스트):
  ```
  📊 삼성전자 (Samsung Electronics Co.,Ltd.)
  ─────────────────────────────
  종목코드: 005930 (유가증권시장)
  대표이사: 한종희, 경계현
  법인구분: 유가증권시장상장법인
  업종: 반도체, 전자부품 제조업
  설립일: 1969-01-13
  결산월: 12월
  홈페이지: https://www.samsung.com
  주소: 경기도 수원시 영통구 삼성로 129
  ```

src/index.ts에 이 tool을 서버에 등록하는 코드도 추가해줘.
빌드 후 MCP Inspector로 테스트할 수 있게.
```

---

## 프롬프트 5: search_disclosures Tool 구현

```
CLAUDE.md의 Tool 설계 명세를 참고해서 search_disclosures tool을 구현해줘.

파일: src/tools/disclosure.ts (기존 파일에 추가)

search_disclosures tool:
- 설명: "Search DART disclosure filings (공시 보고서 검색)"
- 입력:
  - company: string (선택) — 회사명/종목코드. 없으면 전체 공시
  - start_date: string (선택) — YYYY-MM-DD. 기본값: 30일 전
  - end_date: string (선택) — YYYY-MM-DD. 기본값: 오늘
  - type: "annual" | "major" | "issue" | "share" | "all" (선택, 기본: "all")
  - limit: number (선택, 기본: 20, 최대: 100)
- 내부 로직:
  1. company가 있으면 resolveCorpCode로 변환
  2. type을 DART API의 pblntf_ty 코드로 변환 (annual→A, major→B, etc)
  3. /api/list.json 호출
  4. limit만큼 잘라서 반환
- 출력 형식:
  ```
  📋 삼성전자 공시 검색 결과 (2024-01-01 ~ 2024-03-15)
  ─────────────────────────────
  1. [정기공시] 사업보고서 (2024-03-14)
     → https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240314000123
  2. [주요사항] 임원ㆍ주요주주특정증권등소유상황보고서 (2024-03-10)
     → https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240310000456
  ...
  총 15건
  ```

날짜 파라미터 처리 시 DART가 요구하는 YYYYMMDD 형식으로 변환 필요.
```

---

## 프롬프트 6: get_financial_summary Tool 구현

```
CLAUDE.md의 Tool 설계 명세를 참고해서 get_financial_summary tool을 구현해줘.

파일: src/tools/financial.ts (새 파일)

get_financial_summary tool:
- 설명: "Get key financial data for a Korean company (기업 주요 재무 데이터 조회)"
- 입력:
  - company: string (필수)
  - year: number (선택, 기본: 현재연도-1)
  - quarter: "Q1" | "Q2" | "Q3" | "annual" (선택, 기본: "annual")
  - consolidated: boolean (선택, 기본: true)
- 내부 로직:
  1. resolveCorpCode
  2. quarter → reprt_code 변환 (Q1→11013, Q2→11012, Q3→11014, annual→11011)
  3. consolidated → fs_div 변환 (true→CFS, false→OFS)
  4. /api/fnlttSinglAcnt.json 호출
  5. 금액 포매팅: 억원 단위로 변환 + 전년 대비 증감률 계산
- 출력 형식:
  ```
  💰 삼성전자 2024년 연간 재무 요약 (연결)
  ─────────────────────────────
  매출액:        267조 1,834억원 (+8.5%)
  영업이익:       32조 7,293억원 (+512.7%)
  당기순이익:     25조 8,476억원 (+234.1%)
  ─────────────────────────────
  자산총계:      462조 1,543억원
  부채총계:       96조 3,218억원
  자본총계:      365조 8,325억원
  ─────────────────────────────
  부채비율: 26.3%
  ```

src/utils/formatters.ts에 금액 포매팅 헬퍼 함수들도 함께 구현해줘:
- formatKoreanCurrency(amount: number): string — 억원/조원 단위로
- formatPercentChange(current: number, previous: number): string — (+12.3%) 형태로
- parseDartAmount(value: string): number — DART의 문자열 금액을 숫자로

src/index.ts에 이 tool도 등록해줘.
```

---

## 프롬프트 7: 통합 테스트 & 디버깅

```
지금까지 구현한 3개의 tool (search_company, search_disclosures, get_financial_summary)이 
제대로 작동하는지 확인하고 문제가 있으면 고쳐줘.

확인 사항:
1. npx tsc로 빌드 에러 없는지
2. DART_API_KEY 환경변수 없이 실행하면 명확한 에러 메시지 나오는지
3. 존재하지 않는 회사명으로 검색하면 적절한 에러 메시지 나오는지
4. search_company "삼성전자" 정상 동작
5. search_disclosures 날짜 없이 호출 시 기본값 정상 적용
6. get_financial_summary "카카오" 2023 정상 동작
7. console.log가 코드 어디에도 없는지 (console.error만 허용)
8. 모든 에러가 try-catch로 잡히는지

문제 발견 시 바로 수정하고, 수정 내용을 알려줘.
```

---

## 프롬프트 8: README 작성

```
CLAUDE.md와 BRAND.md를 참고해서 README.md를 작성해줘.

구조:
1. 제목 + 태그라인 + 배지
2. 한 줄 소개 (한국어)
3. 데모 GIF 자리 (TODO 표시)
4. 빠른 시작 (5줄 이내)
5. 제공하는 도구 (테이블)
6. 사용 예시 — Claude Desktop에서의 실제 대화 3가지:
   - "삼성전자 기본 정보 알려줘"
   - "오늘 나온 공시 있어?"
   - "카카오 2023년 매출이랑 영업이익 알려줘"
7. 상세 설치 가이드 (DART API 키 발급부터)
8. Claude Desktop / Cursor 설정 방법
9. 개발 참여 가이드
10. 라이선스 (MIT)
11. --- 구분선 후 영어 버전 (간략)

README는 깔끔하고 읽기 쉽게. 이모지 적절히 사용.
```

---

## 프롬프트 9: compare_financials + get_full_financial_statements 구현

```
CLAUDE.md의 Phase 1 나머지 tool 2개를 구현해줘.

[compare_financials]
- 여러 회사의 재무 데이터를 한눈에 비교
- /api/fnlttMultiAcnt.json 사용
- 입력: companies (string[], 최대 10개), year, quarter
- 출력: 회사별 매출/영업이익/순이익을 나란히 비교하는 깔끔한 텍스트 테이블

[get_full_financial_statements]
- 단일 회사의 전체 재무제표 상세 조회
- /api/fnlttSinglAll.json 사용
- 입력: company, year, quarter, consolidated, statement_type
- statement_type으로 재무상태표(BS), 손익계산서(IS) 등 필터링
- 출력: 계정과목 이름 + 당기금액 + 전기금액을 읽기 쉽게

두 tool 모두 src/tools/financial.ts에 추가하고 src/index.ts에 등록해줘.
```

---

## 프롬프트 10: npm 배포 준비

```
이 프로젝트를 npm에 배포할 수 있게 준비해줘.

1. package.json 정리:
   - name: "opendart-mcp"
   - version: "0.1.0"
   - description 추가 (영어)
   - keywords: ["mcp", "dart", "korean", "finance", "disclosure", "ai-agent"]
   - bin 필드 추가 (CLI로 실행 가능하게)
   - files 필드 (dist, data만 포함)
   - repository, homepage, bugs URL 추가 (GitHub)
   
2. bin 스크립트 생성:
   - #!/usr/bin/env node
   - dist/index.js를 실행하는 간단한 엔트리포인트
   
3. .npmignore 또는 files 필드로 불필요한 파일 제외

4. 빌드 확인: npm run build → dist/ 생성 → 실행 정상

이렇게 하면 사용자가 이렇게 쓸 수 있어야 함:
npx opendart-mcp
또는
npm install -g opendart-mcp && opendart-mcp
```

---

## 💡 디버깅용 프롬프트

### API 응답이 이상할 때
```
DART API에서 이런 응답이 왔어: [응답 내용 붙여넣기]
CLAUDE.md의 DART API 명세를 참고해서 이 응답을 해석하고, 
문제가 있으면 코드를 수정해줘.
```

### Tool이 AI에게 잘 선택되지 않을 때
```
Claude Desktop에서 "[사용자 질문]"이라고 물어봤는데 
이 MCP tool을 선택하지 않았어.
tool의 description을 개선해줘. 
AI가 언제 이 도구를 사용해야 하는지 더 명확하게 설명해야 해.
```

### 타입 에러가 날 때
```
이 TypeScript 에러를 고쳐줘: [에러 메시지]
src/types/dart.ts의 타입 정의가 실제 DART API 응답과 맞는지 확인하고,
불일치하면 타입을 수정해줘.
```
