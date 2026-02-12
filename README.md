# 🇰🇷 OpenDART MCP Server

> AI 에이전트를 위한 한국 기업 공시 데이터 — powered by DART

![license](https://img.shields.io/badge/license-MIT-blue)
![MCP](https://img.shields.io/badge/MCP-compatible-green)
![node](https://img.shields.io/badge/node-18%2B-brightgreen)

**DART(전자공시시스템) 데이터를 AI에게 넘기는 가장 쉬운 방법.**

Claude Desktop, Cursor 등 MCP 지원 AI에게 "삼성전자 재무제표 보여줘"라고 말하면 바로 답을 받을 수 있습니다.

<!-- TODO: 데모 GIF 추가 -->
<!-- ![demo](./assets/demo.gif) -->

---

## ⚡ 빠른 시작

```bash
git clone https://github.com/SongHyojun0228/OpenDart-MCP-Server.git
cd opendart-mcp-server
npm install
echo "DART_API_KEY=발급받은_키" > .env
npm run update-corp-codes && npm run build && npm start
```

> DART API 키는 [OpenDART](https://opendart.fss.or.kr) 에서 무료로 발급받을 수 있습니다 (일 10,000건).

---

## 🔧 제공하는 도구

| 도구 | 설명 | 입력 예시 |
|------|------|----------|
| `search_company` | 기업 검색 및 기본 정보 조회 | `"삼성전자"`, `"005930"` |
| `search_disclosures` | 공시 보고서 검색 | `company: "카카오", type: "annual"` |
| `get_financial_summary` | 주요 재무 데이터 조회 (매출, 영업이익, 순이익 등) | `company: "삼성전자", year: 2024` |
| `compare_financials` | 다중 회사 재무 비교 | `companies: ["삼성전자", "SK하이닉스"]` |
| `get_full_financial_statements` | 전체 재무제표 상세 조회 | `company: "카카오", statement_type: "IS"` |

---

## 💬 사용 예시

### "삼성전자 기본 정보 알려줘"

```
삼성전자(주) (SAMSUNG ELECTRONICS CO,.LTD)
────────────────────────────────────────
종목코드: 005930 (유가증권시장상장법인)
대표이사: 전영현, 노태문
법인구분: 유가증권시장상장법인
설립일: 1969-01-13
결산월: 12월
홈페이지: https://www.samsung.com/sec
주소: 경기도 수원시 영통구 삼성로 129 (매탄동)
```

### "오늘 나온 공시 있어?"

```
전체 공시 검색 결과 (2026-01-14 ~ 2026-02-13)
────────────────────────────────────────

[기타공시] 투자판단관련주요경영사항 (2026-02-13)
  https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260213801610
[주요사항] 주요사항보고서(유상증자결정) (2026-02-13)
  https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260213000234
...
총 847건
```

### "카카오 2023년 매출이랑 영업이익 알려줘"

```
카카오 2023년 연간 재무 요약 (연결)
────────────────────────────────────────
매출액         7조 5,570억원 (+11.2%)
영업이익        4,609억원 (-19.1%)
당기순이익       -1조 8,167억원 (-270.3%)
────────────────────────────────────────
자산총계        25조 1,800억원
부채총계        11조 3,214억원
자본총계        13조 8,586억원
────────────────────────────────────────
부채비율      81.7%
```

---

## 📦 상세 설치 가이드

### 1. DART API 키 발급

1. [OpenDART](https://opendart.fss.or.kr) 접속
2. 회원가입 후 로그인
3. **인증키 신청** → API 키 발급 (즉시 발급, 무료)
4. 발급받은 키를 복사해두세요

### 2. 프로젝트 설치

```bash
git clone https://github.com/SongHyojun0228/OpenDart-MCP-Server.git
cd opendart-mcp-server
npm install
```

### 3. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어서 발급받은 API 키를 입력:

```
DART_API_KEY=여기에_발급받은_키_입력
```

### 4. 기업 고유번호 데이터 다운로드

```bash
npm run update-corp-codes
```

> DART에 등록된 전체 기업(약 115,000개)의 고유번호를 다운로드합니다. 최초 1회만 실행하면 됩니다.

### 5. 빌드 & 실행

```bash
npm run build
npm start
```

---

## ⚙️ AI 클라이언트 설정

### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "opendart": {
      "command": "node",
      "args": ["/절대경로/opendart-mcp-server/dist/src/index.js"],
      "env": {
        "DART_API_KEY": "발급받은_키"
      }
    }
  }
}
```

<details>
<summary>설정 파일 위치</summary>

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

</details>

### Cursor

Cursor Settings → MCP → Add Server:

```json
{
  "mcpServers": {
    "opendart": {
      "command": "node",
      "args": ["/절대경로/opendart-mcp-server/dist/src/index.js"],
      "env": {
        "DART_API_KEY": "발급받은_키"
      }
    }
  }
}
```

### MCP Inspector (디버깅)

```bash
npx @modelcontextprotocol/inspector node dist/src/index.js
```

---

## 🛠️ 개발 참여

```bash
# 빌드
npm run build

# 빌드 + 실행
npm run dev

# 기업 고유번호 업데이트
npm run update-corp-codes

# MCP Inspector로 테스트
npx @modelcontextprotocol/inspector node dist/src/index.js
```

### 프로젝트 구조

```
src/
├── index.ts              # FastMCP 서버 진입점
├── tools/
│   ├── disclosure.ts     # search_company, search_disclosures
│   └── financial.ts      # get_financial_summary, compare_financials, get_full_financial_statements
└── utils/
    ├── dart-client.ts    # DART API HTTP 클라이언트
    ├── corp-code.ts      # 회사명/종목코드 → 고유번호 변환
    └── formatters.ts     # 금액 포매팅 헬퍼
```

### 기여 방법

1. Fork → 브랜치 생성 → 커밋 → PR
2. 커밋 메시지: `feat:`, `fix:`, `docs:` 등 [Conventional Commits](https://www.conventionalcommits.org) 스타일
3. `console.log()` 사용 금지 (stdio 전송 오염 방지). `console.error()`만 사용

---

## 📄 라이선스

[MIT](LICENSE) — 자유롭게 사용, 수정, 배포할 수 있습니다.

이 프로젝트는 금융감독원 [DART OpenAPI](https://opendart.fss.or.kr)의 공개 데이터를 사용합니다.

---

## English

### OpenDART MCP Server

> Korean corporate disclosure data for AI agents — powered by DART

MCP server that connects Korea's [DART](https://opendart.fss.or.kr) (Electronic Disclosure System) to AI agents like Claude, ChatGPT, and Cursor.

Ask your AI "What's Samsung Electronics' revenue?" and get real answers from official Korean financial filings.

### Available Tools

| Tool | Description |
|------|-------------|
| `search_company` | Search Korean companies by name, stock code, or DART corp code |
| `search_disclosures` | Search disclosure filings with date/type filters |
| `get_financial_summary` | Get key financials: revenue, operating profit, net income, assets, liabilities |
| `compare_financials` | Compare financials across multiple companies side by side |
| `get_full_financial_statements` | Get full financial statements (BS, IS, CIS, CF, SCE) |

### Quick Start

```bash
git clone https://github.com/SongHyojun0228/OpenDart-MCP-Server.git
cd opendart-mcp-server
npm install
echo "DART_API_KEY=your_key" > .env
npm run update-corp-codes && npm run build && npm start
```

Get your free DART API key at [opendart.fss.or.kr](https://opendart.fss.or.kr).

### Claude Desktop Config

```json
{
  "mcpServers": {
    "opendart": {
      "command": "node",
      "args": ["/path/to/opendart-mcp-server/dist/src/index.js"],
      "env": {
        "DART_API_KEY": "your_api_key"
      }
    }
  }
}
```

### License

MIT
