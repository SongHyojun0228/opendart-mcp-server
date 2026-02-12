# CAUTION.md — 주의사항 & 삽질 방지 가이드

> 이 프로젝트를 만들면서 마주칠 수 있는 함정들을 미리 정리했습니다.
> 문제가 생기면 이 문서를 먼저 확인하세요.

---

## 🚫 절대 하지 말 것

### 1. console.log() 사용
**MCP stdio 전송에서 console.log()를 쓰면 서버가 즉사합니다.**
stdout으로 출력되는 내용이 JSON-RPC 메시지와 섞여서 통신이 깨집니다.
- ❌ `console.log("debug:", data)`
- ✅ `console.error("debug:", data)`
- ✅ 아예 로깅 안 하기 (프로덕션)

### 2. API 키 하드코딩
- ❌ `const API_KEY = "abc123..."`
- ❌ .env 파일을 git에 커밋
- ✅ `process.env.DART_API_KEY`
- ✅ .env.example만 커밋 (키 값 없이)

### 3. 고유번호 ZIP을 매 요청마다 다운로드
고유번호 ZIP 파일은 3MB+, 파싱에 수 초 소요.
- ❌ tool 호출할 때마다 corpCode.xml 다운로드
- ✅ `scripts/update-corp-codes.ts`로 사전에 다운 → `data/corp-codes.json` 캐시
- ✅ 서버 시작 시 JSON 파일 1회 로드

### 4. DART API 응답을 그대로 AI에게 전달
DART 응답은 AI가 이해하기 어려운 형태입니다:
- 금액이 문자열 ("1234567890000")
- 계정과목이 코드 (ifrs-full_Revenue)
- 불필요한 메타데이터가 많음
- ❌ `return JSON.stringify(dartResponse)`
- ✅ 핵심 정보만 추려서 읽기 쉬운 텍스트로 포매팅

---

## ⚠️ DART API 특이사항

### 고유번호 vs 종목코드
- **고유번호 (corp_code):** DART 내부 ID. 8자리. 예: "00126380" (삼성전자)
- **종목코드 (stock_code):** 거래소 코드. 6자리. 예: "005930" (삼성전자)
- DART API는 모든 기업별 조회에 고유번호를 요구. 종목코드로는 직접 조회 불가!
- 비상장법인은 종목코드가 없음 (stock_code = "")

### 공시검색 API 날짜 제한
- `bgn_de`(시작일)와 `end_de`(종료일) 사이 최대 기간 제한이 있음
- 기업 지정 없이 전체 검색 시: 최대 3개월
- 기업 지정 시: 제한 없음 (1999년~현재)
- 날짜 형식: `YYYYMMDD` (하이픈 없음!)

### 재무정보 제공 범위
- 2015년 이후 데이터만 제공 (그 이전은 API로 조회 불가)
- 금융업종(은행, 보험, 증권)의 재무제표는 일반 기업과 계정과목이 다름
- 상장법인 + IFRS 적용 주요 비상장법인만 대상

### 보고서 코드 주의
- `11011` = 사업보고서(연간) — 가장 많이 쓰는 것
- `11012` = 반기보고서 (← "반기"가 2분기가 아님! 상반기 전체)
- `11013` = 1분기보고서
- `11014` = 3분기보고서
- 사용자가 "2분기"를 요청하면 → `11012` (반기보고서)로 매핑해야 함

### 연결재무제표 vs 개별재무제표
- 기본값은 연결재무제표(CFS)로 해야 함 — 투자자에게 더 의미있는 정보
- 연결재무제표가 없는 회사(자회사 없음)는 OFS만 있음
- CFS 요청했는데 데이터 없으면(status: '013') → OFS로 자동 fallback 구현 권장

### 금액 단위
- DART API 응답의 금액은 **원(KRW)** 단위
- "1234567890000"은 약 1.23조원
- 포매팅: 1조 이상은 "X조 Y억원", 1억 이상은 "X억원", 그 미만은 "X만원"

### API 응답의 null / 빈 값
- 데이터 없음: `status: '013'` (에러가 아님! 해당 기간에 보고서가 없는 것)
- 금액이 없는 계정: 빈 문자열 `""` 또는 `"-"`로 올 수 있음
- 이런 경우 `parseInt()`하면 NaN → 반드시 예외 처리

---

## 🔧 FastMCP 관련 주의사항

### Tool 등록 방식
```typescript
// FastMCP TypeScript에서 tool 등록
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

const server = new FastMCP({
  name: 'OpenDART',
  version: '1.0.0',
});

server.addTool({
  name: 'search_company',
  description: 'Search for a Korean company... (한국 기업 검색...)',
  parameters: z.object({
    query: z.string().describe('Company name, stock code, or DART corp code'),
  }),
  execute: async (params) => {
    // 반환값은 반드시 string 또는 { type: 'text', text: string }
    return formatCompanyInfo(result);
  },
});
```

### Tool Description이 매우 중요
AI가 도구를 선택하는 유일한 단서가 `description`과 파라미터의 `.describe()`입니다.
- 너무 짧으면: AI가 언제 써야 할지 모름
- 너무 길면: AI가 혼란스러워함
- 적정 길이: 1~2문장. "무엇을 하는지" + "언제 쓰면 좋은지"

### 서버 시작 방식
```typescript
// stdio (Claude Desktop, Cursor용)
server.start({ transportType: 'stdio' });

// HTTP (원격, 디버깅용)
server.start({
  transportType: 'httpStream',
  httpStream: { port: 3000 },
});
```

개발 중에는 httpStream으로 시작해서 MCP Inspector로 테스트하는 게 편합니다.
배포 시에는 stdio가 기본.

---

## 🐛 자주 겪는 에러

### "DART_API_KEY is not set"
→ `.env` 파일을 만들었는지 확인. `dotenv` 패키지가 필요할 수 있음.
또는 Claude Desktop config에서 env로 직접 전달.

### DART API "020" (요청 제한 초과)
→ 일일 10,000건 초과. 개발 중 반복 테스트 시 주의.
→ 고유번호 변환 캐시를 안 쓰고 매번 API 호출하면 빠르게 소진됨.

### ZIP 다운로드 실패 (corpCode.xml)
→ DART 서버가 간헐적으로 느림. 재시도 로직 필요.
→ 또는 사전에 다운로드해서 data/corp-codes.json을 git에 포함시키는 것도 방법.

### TypeScript 빌드 에러: "Cannot find module"
→ `tsconfig.json`의 `module`이 `Node16`인지 확인
→ import 시 `.js` 확장자 필요할 수 있음 (ESM): `import { x } from './utils/dart-client.js'`

### MCP Inspector에서 연결 안 됨
→ `stdio` 모드에서는 Inspector 사용 불가. `httpStream`으로 전환.
→ 또는: `npx @modelcontextprotocol/inspector node dist/index.js`

### Claude Desktop에서 tool이 안 보임
→ `claude_desktop_config.json` 경로 확인 (맥: ~/Library/Application Support/Claude/)
→ 설정 변경 후 Claude Desktop 완전 종료 → 재시작 필요
→ args의 경로가 절대경로인지 확인

---

## 📏 코드 컨벤션

### 파일명
- 소문자 + 하이픈: `dart-client.ts`, `corp-code.ts`
- Tool 파일은 DART API 카테고리별: `disclosure.ts`, `financial.ts`

### 변수명
- camelCase 기본
- DART API 파라미터는 원본 유지: `corp_code`, `bsns_year`, `reprt_code`
- 내부 변수는 camelCase: `corpCode`, `businessYear`

### 에러 처리
```typescript
// 좋은 예: 사용자에게 의미있는 메시지
throw new Error(`'${query}'에 해당하는 기업을 찾을 수 없습니다. 회사명, 종목코드(6자리), 또는 DART 고유번호(8자리)를 확인해주세요.`);

// 나쁜 예: 기술적 에러 그대로 노출
throw new Error(`HTTP 404: Not Found at /api/company.json`);
```

### 응답 포매팅
```typescript
// 좋은 예: AI가 해석하기 쉬운 구조화된 텍스트
return `📊 삼성전자 2024년 재무 요약\n매출액: 267조원 (+8.5%)\n영업이익: 32조원`;

// 나쁜 예: 원본 JSON 덤프
return JSON.stringify(dartApiResponse, null, 2);
```

---

## 🔄 DART API 변경 대응

DART API는 가끔 업데이트됩니다.
- 공식 변동내역: https://opendart.fss.or.kr/cop/bbs/selectArticleList.do?bbsId=B0000000000000000004
- 새 API 추가 시: 기존 API는 보통 유지됨
- 응답 필드 변경 시: TypeScript 타입 업데이트 필요
- **주기적으로 변동내역알림 페이지를 확인하세요**
