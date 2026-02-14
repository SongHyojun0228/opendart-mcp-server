import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { getDartClient } from "../utils/dart-client.js";
import { resolveCorpCode } from "../utils/corp-code.js";

// --- DART company.json 응답 타입 ---
interface CompanyResponse {
  status: string;
  message: string;
  corp_code: string;
  corp_name: string;
  corp_name_eng: string;
  stock_name: string;
  stock_code: string;
  ceo_nm: string;
  corp_cls: string;
  jurir_no: string;
  bizr_no: string;
  adres: string;
  hm_url: string;
  ir_url: string;
  phn_no: string;
  fax_no: string;
  induty_code: string;
  est_dt: string;
  acc_mt: string;
}

const CORP_CLS_MAP: Record<string, string> = {
  Y: "유가증권시장상장법인",
  K: "코스닥상장법인",
  N: "코넥스상장법인",
  E: "기타법인",
};

function formatDate(raw: string): string {
  if (!raw || raw.length !== 8) return raw || "-";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function formatUrl(url: string): string {
  if (!url) return "-";
  return url.startsWith("http") ? url : `https://${url}`;
}

function formatCompany(data: CompanyResponse): string {
  const corpCls = CORP_CLS_MAP[data.corp_cls] ?? data.corp_cls;
  const market = data.stock_code
    ? `${data.stock_code} (${corpCls})`
    : "비상장";

  const lines = [
    `${data.corp_name} (${data.corp_name_eng})`,
    "─".repeat(40),
    `종목코드: ${market}`,
    `대표이사: ${data.ceo_nm || "-"}`,
    `법인구분: ${corpCls}`,
    `업종코드: ${data.induty_code || "-"}`,
    `설립일: ${formatDate(data.est_dt)}`,
    `결산월: ${data.acc_mt ? `${data.acc_mt}월` : "-"}`,
    `홈페이지: ${formatUrl(data.hm_url)}`,
  ];

  if (data.ir_url) {
    lines.push(`IR페이지: ${formatUrl(data.ir_url)}`);
  }

  lines.push(`전화번호: ${data.phn_no || "-"}`);
  lines.push(`주소: ${data.adres || "-"}`);

  return lines.join("\n");
}

// --- DART list.json 응답 타입 ---
interface DisclosureItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

interface DisclosureListResponse {
  status: string;
  message: string;
  page_no: number;
  page_count: number;
  total_count: number;
  total_page: number;
  list: DisclosureItem[];
}

const PBLNTF_TY_MAP: Record<string, string> = {
  annual: "A",
  major: "B",
  issue: "C",
  share: "D",
  all: "",
};

const PBLNTF_TY_LABEL: Record<string, string> = {
  A: "정기공시",
  B: "주요사항",
  C: "발행공시",
  D: "지분공시",
  E: "기타공시",
  F: "외부감사",
  G: "펀드공시",
  H: "자산유동화",
  I: "거래소공시",
  J: "공정위공시",
};

function toYYYYMMDD(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function guessReportType(reportName: string): string {
  if (/사업보고서|반기보고서|분기보고서/.test(reportName)) return "A";
  if (/주요사항/.test(reportName)) return "B";
  if (/증권신고서|투자설명서/.test(reportName)) return "C";
  if (/소유상황|대량보유|임원/.test(reportName)) return "D";
  return "E";
}

function formatDisclosures(
  items: DisclosureItem[],
  totalCount: number,
  companyLabel: string,
  startDate: string,
  endDate: string,
): string {
  const header = `${companyLabel} 공시 검색 결과 (${startDate} ~ ${endDate})`;

  const lines = [header, "─".repeat(40), ""];

  for (const item of items) {
    const typeCode = guessReportType(item.report_nm);
    const typeLabel = PBLNTF_TY_LABEL[typeCode] ?? "기타";
    const date = formatDate(item.rcept_dt);
    const dartUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`;

    let line = `[${typeLabel}] ${item.report_nm} (${date})`;
    if (item.flr_nm && item.flr_nm !== item.corp_name) {
      line += ` - ${item.flr_nm}`;
    }
    lines.push(line);
    lines.push(`  ${dartUrl}`);
  }

  lines.push("");
  lines.push(`총 ${totalCount}건`);

  return lines.join("\n");
}

// --- Exported execute functions (reusable from Apify Actor) ---

export async function executeSearchCompany({
  query,
}: {
  query: string;
}): Promise<string> {
  const corpCode = resolveCorpCode(query);
  const client = getDartClient();
  const data = await client.request<CompanyResponse>("company.json", {
    corp_code: corpCode,
  });
  return formatCompany(data);
}

export async function executeSearchDisclosures({
  company,
  start_date,
  end_date,
  type,
  limit,
}: {
  company?: string;
  start_date?: string;
  end_date?: string;
  type?: "annual" | "major" | "issue" | "share" | "all";
  limit?: number;
}): Promise<string> {
  const startDate = start_date ?? getDefaultStartDate();
  const endDate = end_date ?? getToday();
  const pageCount = limit ?? 20;

  const params: Record<string, string> = {
    bgn_de: toYYYYMMDD(startDate),
    end_de: toYYYYMMDD(endDate),
    page_count: String(pageCount),
  };

  let companyLabel = "전체";

  if (company) {
    const corpCode = resolveCorpCode(company);
    params.corp_code = corpCode;
    companyLabel = company;
  }

  const pblntfTy = PBLNTF_TY_MAP[type ?? "all"];
  if (pblntfTy) {
    params.pblntf_ty = pblntfTy;
  }

  const client = getDartClient();
  const data = await client.request<DisclosureListResponse>(
    "list.json",
    params,
  );

  if (data.list.length > 0 && company) {
    companyLabel = data.list[0].corp_name;
  }

  return formatDisclosures(
    data.list,
    data.total_count,
    companyLabel,
    startDate,
    endDate,
  );
}

export function registerDisclosureTools(server: FastMCP) {
  server.addTool({
    name: "search_company",
    description:
      "Search for a Korean company and get basic corporate info " +
      "(한국 기업 검색 및 기본 정보 조회). " +
      "Input can be a company name (삼성전자), stock code (005930), " +
      "or DART corp code (00126380).",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Company name (회사명), stock code (종목코드), or DART corp code (고유번호)",
        ),
    }),
    execute: async (args) => executeSearchCompany(args),
  });

  server.addTool({
    name: "search_disclosures",
    description:
      "Search DART disclosure filings (공시 보고서 검색). " +
      "Can search by company or browse all recent filings. " +
      "Returns filing title, date, and DART link.",
    parameters: z.object({
      company: z
        .string()
        .optional()
        .describe(
          "Company name or stock code (회사명 또는 종목코드). Omit for all filings.",
        ),
      start_date: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format. Default: 30 days ago."),
      end_date: z
        .string()
        .optional()
        .describe("End date in YYYY-MM-DD format. Default: today."),
      type: z
        .enum(["annual", "major", "issue", "share", "all"])
        .optional()
        .describe(
          "Filing type filter: annual(정기공시), major(주요사항), " +
            "issue(발행공시), share(지분공시), all(전체). Default: all.",
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results (1-100). Default: 20."),
    }),
    execute: async (args) => executeSearchDisclosures(args),
  });
}
