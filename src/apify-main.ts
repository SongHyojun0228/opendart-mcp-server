import { Actor } from "apify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ensureCorpCodes } from "./utils/corp-code.js";
import {
  executeSearchCompany,
  executeSearchDisclosures,
} from "./tools/disclosure.js";
import {
  executeGetFinancialSummary,
  executeCompareFinancials,
  executeGetFullFinancialStatements,
} from "./tools/financial.js";

// --- Apify Actor init ---
await Actor.init();

const input = (await Actor.getInput<{ dartApiKey?: string }>()) ?? {};
if (input.dartApiKey) {
  process.env.DART_API_KEY = input.dartApiKey;
}

if (!process.env.DART_API_KEY) {
  throw new Error(
    "DART_API_KEY is required. Provide it via Actor input (dartApiKey) or environment variable.",
  );
}

await Actor.charge({ eventName: "actor-start" });

// Download corp-code mapping (if not cached)
await ensureCorpCodes();

// --- MCP Server setup ---
const mcpServer = new McpServer(
  { name: "OpenDART", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Helper: wrap execute function with PPE charging
function withCharge<T>(fn: (args: T) => Promise<string>) {
  return async (args: T): Promise<{ content: { type: "text"; text: string }[] }> => {
    await Actor.charge({ eventName: "tool-request" });
    const text = await fn(args);
    return { content: [{ type: "text" as const, text }] };
  };
}

// --- Register tools ---

mcpServer.registerTool(
  "search_company",
  {
    description:
      "Search for a Korean company and get basic corporate info " +
      "(한국 기업 검색 및 기본 정보 조회). " +
      "Input can be a company name (삼성전자), stock code (005930), " +
      "or DART corp code (00126380).",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Company name (회사명), stock code (종목코드), or DART corp code (고유번호)",
        ),
    },
  },
  withCharge(executeSearchCompany),
);

mcpServer.registerTool(
  "search_disclosures",
  {
    description:
      "Search DART disclosure filings (공시 보고서 검색). " +
      "Can search by company or browse all recent filings. " +
      "Returns filing title, date, and DART link.",
    inputSchema: {
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
    },
  },
  withCharge(executeSearchDisclosures),
);

mcpServer.registerTool(
  "get_financial_summary",
  {
    description:
      "Get key financial data for a Korean company " +
      "(기업 주요 재무 데이터 조회). " +
      "Returns revenue, operating profit, net income, total assets/liabilities/equity " +
      "with year-over-year change rates.",
    inputSchema: {
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
    },
  },
  withCharge(executeGetFinancialSummary),
);

mcpServer.registerTool(
  "compare_financials",
  {
    description:
      "Compare financial data across multiple Korean companies " +
      "(다중 회사 재무 비교). " +
      "Shows revenue, operating profit, and net income side by side.",
    inputSchema: {
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
    },
  },
  withCharge(executeCompareFinancials),
);

mcpServer.registerTool(
  "get_full_financial_statements",
  {
    description:
      "Get full financial statements with all account items " +
      "(전체 재무제표 상세 조회). " +
      "Returns every line item of BS, IS, CIS, CF, or SCE.",
    inputSchema: {
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
    },
  },
  withCharge(executeGetFullFinancialStatements),
);

// --- Express + Streamable HTTP transport ---
const app = express();
app.use(cors());
app.use(express.json());

// Map of session ID -> transport
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Existing session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — check if this is an initialization request
  if (!sessionId) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    await mcpServer.connect(transport);

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }

    await transport.handleRequest(req, res, req.body);
    return;
  }

  // Session ID provided but not found — stale session
  res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Session not found" },
    id: null,
  });
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }
  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Session ID required for GET" },
    id: null,
  });
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }
  res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Session not found" },
    id: null,
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.APIFY_CONTAINER_PORT) || 3000;

app.listen(port, () => {
  console.error(`[OpenDART] MCP server listening on port ${port}`);
  console.error(`[OpenDART] MCP endpoint: http://localhost:${port}/mcp`);
});
