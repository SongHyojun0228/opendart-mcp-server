# BRAND.md — OpenDART MCP Server 브랜드 가이드

---

## 프로젝트 아이덴티티

### 이름
- **정식 이름:** OpenDART MCP Server
- **짧은 이름:** opendart-mcp
- **npm 패키지명:** `opendart-mcp`
- **GitHub 레포명:** `opendart-mcp-server`

### 태그라인
- **영어:** "Korean corporate data for AI agents — powered by DART"
- **한국어:** "AI 에이전트를 위한 한국 기업 공시 데이터"

### 포지셔닝
이 프로젝트는 **한국 주식/기업 데이터를 AI 에이전트에게 제공하는 표준 인터페이스**다.
DART 데이터를 파이썬으로 분석하는 라이브러리(OpenDartReader, dart-fss)는 이미 있지만,
MCP 프로토콜을 통해 Claude/ChatGPT/Cursor 같은 AI에게 직접 제공하는 것은 이것이 최초다.

---

## 톤 & 보이스

### README / 문서
- **전문적이되 접근 가능하게.** 금융 데이터를 다루므로 정확해야 하지만, MCP를 처음 접하는 개발자도 이해할 수 있게.
- **코드 예시 중심.** 장황한 설명보다 "이렇게 하면 됩니다" 스타일.
- **한국어가 기본, 영어 병기.** README는 한국어 섹션을 먼저, 영어 섹션을 아래에.

### 커밋 메시지
- 영어로 작성
- Conventional Commits 스타일: `feat:`, `fix:`, `docs:`, `chore:`
- 예: `feat: add get_financial_summary tool`

### Tool Description (MCP)
- **영어로 작성** (MCP 클라이언트가 글로벌이므로)
- 괄호 안에 한국어 병기
- 예: `"Search for a Korean company and get basic corporate info (한국 기업 검색 및 기본 정보 조회)"`

---

## README 구조 가이드

```markdown
# 🇰🇷 OpenDART MCP Server

> AI 에이전트를 위한 한국 기업 공시 데이터 | Korean corporate disclosure data for AI agents

[배지: npm version] [배지: license MIT] [배지: MCP compatible]

## 데모 (스크린샷/GIF)
Claude Desktop에서 "삼성전자 재무제표 보여줘"라고 물어보는 스크린샷

## 빠른 시작 (Quick Start)
5줄 이내로 설치 → 설정 → 실행

## 제공하는 도구 (Available Tools)
각 tool의 이름, 설명, 입력/출력을 테이블로

## 사용 예시 (Usage Examples)
실제 대화 예시 3-5개

## 설치 & 설정 (Installation)
상세 가이드

## 개발 (Development)
기여 가이드

## 라이선스 (License)
```

---

## 시각 자산

### 로고/아이콘 (나중에 필요 시)
- DART의 파란색(#003478)을 기본 색상으로
- 차트/그래프 + 연결 아이콘 조합
- 한국 국기 이모지 🇰🇷를 적극 활용 (텍스트 환경에서)

### 배지 (README용)
```markdown
![npm](https://img.shields.io/npm/v/opendart-mcp)
![license](https://img.shields.io/badge/license-MIT-blue)
![MCP](https://img.shields.io/badge/MCP-compatible-green)
```

---

## 경쟁 포지션

| 기존 도구 | 형태 | 한계 | 우리의 차별점 |
|-----------|------|------|--------------|
| OpenDartReader | Python 라이브러리 | 코드 작성 필요, AI 연동 불가 | MCP로 AI가 직접 사용 |
| dart-fss | Python 라이브러리 | 동일 | 동일 |
| DART 홈페이지 | 웹사이트 | 수동 검색, API 아님 | 에이전트 자동화 |
| 증권사 MTS/HTS | 앱/프로그램 | 폐쇄적, 자동화 불가 | 개방형 표준 프로토콜 |

**핵심 메시지: "DART 데이터를 AI에게 넘기는 가장 쉬운 방법"**

---

## 타겟 사용자

### 1차 타겟: 개발자 / AI 파워유저
- Claude Desktop, Cursor, VS Code + MCP 사용하는 개발자
- 한국 주식 투자하면서 AI로 분석하고 싶은 사람
- 금융 데이터 프로젝트 만드는 사람

### 2차 타겟: 해외 투자자 / 리서치
- 한국 시장에 투자하는 외국인
- 한국 기업 리서치하는 해외 VC/애널리스트
- K-주식 분석 유튜버/블로거

### 3차 타겟: 기업 사용자
- 경쟁사 분석 자동화하려는 기업 전략팀
- IR/공시 모니터링하려는 기업

---

## 콘텐츠 마케팅 키워드

### 한국어
- "DART MCP", "한국 주식 AI 분석", "전자공시 자동화"
- "MCP 서버 만들기", "Claude DART 연동"
- "AI로 재무제표 분석", "AI 주식 분석 도구"

### 영어
- "Korean stock data MCP", "DART financial data AI"
- "Korea company disclosure API", "Korean corporate data for LLM"
- "MCP server Korean finance"
