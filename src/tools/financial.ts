import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { getDartClient } from "../utils/dart-client.js";
import { resolveCorpCode, searchCompanies } from "../utils/corp-code.js";
import {
  parseDartAmount,
  formatKoreanCurrency,
  formatPercentChange,
} from "../utils/formatters.js";

// --- DART fnlttSinglAcnt.json 응답 타입 ---
interface FinancialAccountItem {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  stock_code: string;
  fs_div: string;
  fs_nm: string;
  sj_div: string;
  sj_nm: string;
  account_nm: string;
  thstrm_nm: string;
  thstrm_dt: string;
  thstrm_amount: string;
  frmtrm_nm: string;
  frmtrm_dt: string;
  frmtrm_amount: string;
  bfefrmtrm_nm: string;
  bfefrmtrm_dt: string;
  bfefrmtrm_amount: string;
  ord: string;
  currency: string;
}

interface FinancialResponse {
  status: string;
  message: string;
  list: FinancialAccountItem[];
}

const REPRT_CODE_MAP: Record<string, string> = {
  Q1: "11013",
  Q2: "11012",
  Q3: "11014",
  annual: "11011",
};

const QUARTER_LABEL: Record<string, string> = {
  Q1: "1분기",
  Q2: "반기",
  Q3: "3분기",
  annual: "연간",
};

// 손익계산서 주요 항목 (표시 순서)
const IS_ACCOUNTS = ["매출액", "영업이익", "당기순이익"];
// 재무상태표 주요 항목
const BS_ACCOUNTS = ["자산총계", "부채총계", "자본총계"];

// account_nm 매칭: DART 응답은 "당기순이익(손실)" 등 괄호 포함
function matchAccount(accountNm: string, target: string): boolean {
  if (target === "당기순이익") {
    return /당기순이익|당기순손익/.test(accountNm);
  }
  return accountNm === target;
}

interface AccountData {
  current: number;
  previous: number;
}

function extractAccounts(
  items: FinancialAccountItem[],
  fsDivFilter: string,
): Map<string, AccountData> {
  const map = new Map<string, AccountData>();

  const filtered = items.filter((item) => item.fs_div === fsDivFilter);

  for (const item of filtered) {
    for (const target of [...IS_ACCOUNTS, ...BS_ACCOUNTS]) {
      if (matchAccount(item.account_nm, target) && !map.has(target)) {
        map.set(target, {
          current: parseDartAmount(item.thstrm_amount),
          previous: parseDartAmount(item.frmtrm_amount),
        });
      }
    }
  }

  return map;
}

function formatFinancialLine(
  label: string,
  data: AccountData | undefined,
  showChange: boolean,
): string {
  if (!data) return `${label.padEnd(10)}  -`;

  const amount = formatKoreanCurrency(data.current);
  const change = showChange
    ? ` ${formatPercentChange(data.current, data.previous)}`
    : "";

  return `${label.padEnd(10)}  ${amount}${change}`;
}

function formatFinancialSummary(
  companyName: string,
  year: number,
  quarter: string,
  consolidated: boolean,
  accounts: Map<string, AccountData>,
): string {
  const qLabel = QUARTER_LABEL[quarter] ?? quarter;
  const fsLabel = consolidated ? "연결" : "개별";
  const separator = "─".repeat(40);

  const lines = [
    `${companyName} ${year}년 ${qLabel} 재무 요약 (${fsLabel})`,
    separator,
  ];

  // 손익계산서 항목 (증감률 표시)
  for (const name of IS_ACCOUNTS) {
    lines.push(formatFinancialLine(name, accounts.get(name), true));
  }

  lines.push(separator);

  // 재무상태표 항목 (증감률 미표시)
  for (const name of BS_ACCOUNTS) {
    lines.push(formatFinancialLine(name, accounts.get(name), false));
  }

  // 부채비율
  const debt = accounts.get("부채총계");
  const equity = accounts.get("자본총계");
  if (
    debt &&
    equity &&
    Number.isFinite(debt.current) &&
    Number.isFinite(equity.current) &&
    equity.current !== 0
  ) {
    const debtRatio = (debt.current / equity.current) * 100;
    lines.push(separator);
    lines.push(`부채비율      ${debtRatio.toFixed(1)}%`);
  }

  return lines.join("\n");
}

// --- DART fnlttSinglAcntAll.json 응답 타입 ---
interface FullStatementItem {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  sj_div: string;
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_amount: string;
  thstrm_add_amount: string;
  frmtrm_nm: string;
  frmtrm_amount: string;
  bfefrmtrm_nm: string;
  bfefrmtrm_amount: string;
  ord: string;
  currency: string;
}

interface FullStatementResponse {
  status: string;
  message: string;
  list: FullStatementItem[];
}

const SJ_DIV_LABEL: Record<string, string> = {
  BS: "재무상태표",
  IS: "손익계산서",
  CIS: "포괄손익계산서",
  CF: "현금흐름표",
  SCE: "자본변동표",
};

// --- compare_financials 포매팅 ---

function formatComparisonTable(
  companies: { name: string; corpCode: string }[],
  companyAccounts: Map<string, Map<string, AccountData>>,
  year: number,
  quarter: string,
): string {
  const qLabel = QUARTER_LABEL[quarter] ?? quarter;
  const separator = "─".repeat(50);

  const lines = [
    `${year}년 ${qLabel} 재무 비교`,
    separator,
  ];

  const targets = [...IS_ACCOUNTS, ...BS_ACCOUNTS];

  for (const target of targets) {
    if (target === "자산총계") {
      lines.push(separator);
    }
    lines.push(`[${target}]`);
    for (const c of companies) {
      const accounts = companyAccounts.get(c.corpCode);
      const data = accounts?.get(target);
      if (data && Number.isFinite(data.current)) {
        const amount = formatKoreanCurrency(data.current);
        const change = formatPercentChange(data.current, data.previous);
        const changeSuffix = change ? `  ${change}` : "";
        lines.push(`  ${c.name.padEnd(16)} ${amount}${changeSuffix}`);
      } else {
        lines.push(`  ${c.name.padEnd(16)} -`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// --- get_full_financial_statements 포매팅 ---

function formatFullStatements(
  companyName: string,
  year: number,
  quarter: string,
  consolidated: boolean,
  items: FullStatementItem[],
): string {
  const qLabel = QUARTER_LABEL[quarter] ?? quarter;
  const fsLabel = consolidated ? "연결" : "개별";
  const separator = "─".repeat(50);

  const lines = [
    `${companyName} ${year}년 ${qLabel} 재무제표 (${fsLabel})`,
    separator,
  ];

  let currentSjDiv = "";

  for (const item of items) {
    // 섹션 헤더
    if (item.sj_div !== currentSjDiv) {
      currentSjDiv = item.sj_div;
      const label = SJ_DIV_LABEL[currentSjDiv] ?? currentSjDiv;
      if (lines.length > 2) lines.push("");
      lines.push(`■ ${label}`);
      lines.push(separator);
    }

    const current = parseDartAmount(item.thstrm_amount);
    const previous = parseDartAmount(item.frmtrm_amount);
    const curStr = Number.isFinite(current)
      ? formatKoreanCurrency(current)
      : "-";
    const prevStr = Number.isFinite(previous)
      ? formatKoreanCurrency(previous)
      : "-";

    // 계정 상세가 있으면 인덴트
    const detail = item.account_detail && item.account_detail !== "-"
      ? `  (${item.account_detail})`
      : "";
    const name = `${item.account_nm}${detail}`;

    lines.push(`${name}`);
    lines.push(`  당기: ${curStr}  |  전기: ${prevStr}`);
  }

  lines.push("");
  lines.push(`총 ${items.length}개 계정과목`);

  return lines.join("\n");
}

export function registerFinancialTools(server: FastMCP) {
  server.addTool({
    name: "get_financial_summary",
    description:
      "Get key financial data for a Korean company " +
      "(기업 주요 재무 데이터 조회). " +
      "Returns revenue, operating profit, net income, total assets/liabilities/equity " +
      "with year-over-year change rates.",
    parameters: z.object({
      company: z
        .string()
        .describe(
          "Company name or stock code (회사명 또는 종목코드). e.g. '삼성전자' or '005930'",
        ),
      year: z
        .number()
        .optional()
        .describe("Business year (사업연도). Default: last year."),
      quarter: z
        .enum(["Q1", "Q2", "Q3", "annual"])
        .optional()
        .describe(
          "Report period: Q1(1분기), Q2(반기), Q3(3분기), annual(사업보고서). Default: annual.",
        ),
      consolidated: z
        .boolean()
        .optional()
        .describe(
          "Use consolidated financial statements (연결재무제표). Default: true.",
        ),
    }),
    execute: async ({ company, year, quarter, consolidated }) => {
      const corpCode = resolveCorpCode(company);
      const bsnsYear = year ?? new Date().getFullYear() - 1;
      const qtr = quarter ?? "annual";
      const isConsolidated = consolidated ?? true;
      const fsDiv = isConsolidated ? "CFS" : "OFS";

      const client = getDartClient();
      const data = await client.request<FinancialResponse>(
        "fnlttSinglAcnt.json",
        {
          corp_code: corpCode,
          bsns_year: String(bsnsYear),
          reprt_code: REPRT_CODE_MAP[qtr],
          fs_div: fsDiv,
        },
      );

      const accounts = extractAccounts(data.list, fsDiv);

      // 회사명은 API 응답에 없으므로 입력값 사용
      return formatFinancialSummary(
        company,
        bsnsYear,
        qtr,
        isConsolidated,
        accounts,
      );
    },
  });

  // --- compare_financials ---

  server.addTool({
    name: "compare_financials",
    description:
      "Compare financial data across multiple Korean companies " +
      "(다중 회사 재무 비교). " +
      "Shows revenue, operating profit, and net income side by side.",
    parameters: z.object({
      companies: z
        .array(z.string())
        .min(2)
        .max(10)
        .describe(
          "Array of company names or stock codes (회사명/종목코드 배열, 2~10개). " +
            'e.g. ["삼성전자", "SK하이닉스", "카카오"]',
        ),
      year: z
        .number()
        .optional()
        .describe("Business year (사업연도). Default: last year."),
      quarter: z
        .enum(["Q1", "Q2", "Q3", "annual"])
        .optional()
        .describe("Report period. Default: annual."),
    }),
    execute: async ({ companies, year, quarter }) => {
      const bsnsYear = year ?? new Date().getFullYear() - 1;
      const qtr = quarter ?? "annual";

      // 회사명 → 고유번호 변환
      const resolved: { name: string; corpCode: string }[] = [];
      for (const c of companies) {
        const corpCode = resolveCorpCode(c);
        // corp-code 데이터에서 정식 회사명 조회
        const matches = searchCompanies(c);
        const officialName =
          matches.find((m) => m.corpCode === corpCode)?.corpName ?? c;
        resolved.push({ name: officialName, corpCode });
      }

      const corpCodes = resolved.map((r) => r.corpCode).join(",");

      const client = getDartClient();
      const data = await client.request<FinancialResponse>(
        "fnlttMultiAcnt.json",
        {
          corp_code: corpCodes,
          bsns_year: String(bsnsYear),
          reprt_code: REPRT_CODE_MAP[qtr],
        },
      );

      // 회사별 데이터 분리 (CFS 우선)
      const companyAccounts = new Map<
        string,
        Map<string, AccountData>
      >();

      for (const r of resolved) {
        const items = data.list.filter(
          (i) => i.corp_code === r.corpCode,
        );
        const hasCFS = items.some((i) => i.fs_div === "CFS");
        const accounts = extractAccounts(items, hasCFS ? "CFS" : "OFS");
        companyAccounts.set(r.corpCode, accounts);
      }

      return formatComparisonTable(
        resolved,
        companyAccounts,
        bsnsYear,
        qtr,
      );
    },
  });

  // --- get_full_financial_statements ---

  server.addTool({
    name: "get_full_financial_statements",
    description:
      "Get full financial statements with all account items " +
      "(전체 재무제표 상세 조회). " +
      "Returns every line item of BS, IS, CIS, CF, or SCE.",
    parameters: z.object({
      company: z
        .string()
        .describe("Company name or stock code (회사명 또는 종목코드)."),
      year: z
        .number()
        .optional()
        .describe("Business year. Default: last year."),
      quarter: z
        .enum(["Q1", "Q2", "Q3", "annual"])
        .optional()
        .describe("Report period. Default: annual."),
      consolidated: z
        .boolean()
        .optional()
        .describe("Use consolidated statements (연결). Default: true."),
      statement_type: z
        .enum(["BS", "IS", "CIS", "CF", "SCE", "all"])
        .optional()
        .describe(
          "Statement type: BS(재무상태표), IS(손익계산서), " +
            "CIS(포괄손익계산서), CF(현금흐름표), SCE(자본변동표), all(전체). Default: all.",
        ),
    }),
    execute: async ({
      company,
      year,
      quarter,
      consolidated,
      statement_type,
    }) => {
      const corpCode = resolveCorpCode(company);
      const bsnsYear = year ?? new Date().getFullYear() - 1;
      const qtr = quarter ?? "annual";
      const fsDiv = (consolidated ?? true) ? "CFS" : "OFS";
      const stmtType = statement_type ?? "all";

      const client = getDartClient();
      const data = await client.request<FullStatementResponse>(
        "fnlttSinglAcntAll.json",
        {
          corp_code: corpCode,
          bsns_year: String(bsnsYear),
          reprt_code: REPRT_CODE_MAP[qtr],
          fs_div: fsDiv,
        },
      );

      const items =
        stmtType === "all"
          ? data.list
          : data.list.filter((i) => i.sj_div === stmtType);

      return formatFullStatements(
        company,
        bsnsYear,
        qtr,
        fsDiv === "CFS",
        items,
      );
    },
  });
}
