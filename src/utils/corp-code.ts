import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { XMLParser } from "fast-xml-parser";

interface CorpCodeData {
  byName: Record<string, string>;
  byStockCode: Record<string, string>;
  byCorpCode: Record<string, { name: string; stockCode: string }>;
}

export interface CompanySearchResult {
  corpCode: string;
  corpName: string;
  stockCode: string;
}

// Data paths
// 1) User cache: ~/.opendart-mcp/corp-codes.json (npx / global install)
// 2) Local dev:  <project-root>/data/corp-codes.json (git clone)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_PATH = path.resolve(__dirname, "../../../data/corp-codes.json");
const CACHE_DIR = path.join(os.homedir(), ".opendart-mcp");
const CACHE_DATA_PATH = path.join(CACHE_DIR, "corp-codes.json");

let cachedData: CorpCodeData | null = null;

function getDataPath(): string | null {
  if (existsSync(CACHE_DATA_PATH)) return CACHE_DATA_PATH;
  if (existsSync(LOCAL_DATA_PATH)) return LOCAL_DATA_PATH;
  return null;
}

function loadCorpCodes(): CorpCodeData {
  if (cachedData) return cachedData;

  const dataPath = getDataPath();
  if (!dataPath) {
    throw new Error(
      "고유번호 데이터 파일이 없습니다. " +
        "서버를 재시작하거나 'npm run update-corp-codes'를 실행하세요.",
    );
  }

  cachedData = JSON.parse(readFileSync(dataPath, "utf-8")) as CorpCodeData;
  return cachedData;
}

// --- ZIP extraction ---
function extractFirstFileFromZip(zipBuffer: Buffer): Buffer {
  if (zipBuffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("유효하지 않은 ZIP 파일입니다.");
  }
  const compressionMethod = zipBuffer.readUInt16LE(8);
  const compressedSize = zipBuffer.readUInt32LE(18);
  const fileNameLength = zipBuffer.readUInt16LE(26);
  const extraFieldLength = zipBuffer.readUInt16LE(28);
  const dataOffset = 30 + fileNameLength + extraFieldLength;

  if (compressionMethod === 0) {
    return zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
  }
  if (compressionMethod === 8) {
    const compressed =
      compressedSize > 0
        ? zipBuffer.subarray(dataOffset, dataOffset + compressedSize)
        : zipBuffer.subarray(dataOffset);
    return inflateRawSync(compressed);
  }
  throw new Error(`지원하지 않는 압축 방식입니다: ${compressionMethod}`);
}

interface CorpCodeXmlItem {
  corp_code: string | number;
  corp_name: string;
  stock_code: string | number;
  modify_date: string | number;
}

/**
 * Ensure corp-codes.json exists. Downloads automatically if missing.
 * Called once at server startup.
 */
export async function ensureCorpCodes(): Promise<void> {
  if (getDataPath()) return;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    console.error(
      "[OpenDART] DART_API_KEY가 없어 고유번호 자동 다운로드를 건너뜁니다.",
    );
    return;
  }

  console.error("[OpenDART] 고유번호 데이터를 자동 다운로드합니다 (최초 1회)...");

  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
  const maxRetries = 3;
  const timeoutMs = 60_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.error(`[OpenDART] 재시도 ${attempt}/${maxRetries}...`);
      }

      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`다운로드 실패: HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("json")) {
        const body = (await response.json()) as {
          status: string;
          message: string;
        };
        throw new Error(
          `DART API 오류: ${body.message} (status: ${body.status})`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      const xmlBuffer = extractFirstFileFromZip(zipBuffer);
      const xmlString = xmlBuffer.toString("utf-8");

      const parser = new XMLParser({
        isArray: (_tagName: string, jPath: string) => jPath === "result.list",
      });
      const parsed = parser.parse(xmlString) as {
        result: { list: CorpCodeXmlItem[] };
      };
      const items = parsed.result.list;

      const byName: Record<string, string> = {};
      const byStockCode: Record<string, string> = {};
      const byCorpCode: Record<string, { name: string; stockCode: string }> =
        {};

      for (const item of items) {
        const corpCode = String(item.corp_code).padStart(8, "0");
        const corpName = String(item.corp_name).trim();
        const rawStockCode = String(item.stock_code ?? "").trim();
        const stockCode =
          rawStockCode && rawStockCode !== "0"
            ? rawStockCode.padStart(6, "0")
            : "";

        byName[corpName] = corpCode;
        byCorpCode[corpCode] = { name: corpName, stockCode };
        if (stockCode) {
          byStockCode[stockCode] = corpCode;
        }
      }

      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(
        CACHE_DATA_PATH,
        JSON.stringify({ byName, byStockCode, byCorpCode }),
        "utf-8",
      );

      console.error(
        `[OpenDART] 고유번호 다운로드 완료: ${items.length}개 기업`,
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        console.error(`[OpenDART] 다운로드 실패 (${msg}), 재시도 대기...`);
        await new Promise((r) => setTimeout(r, 3_000));
      } else {
        console.error(`[OpenDART] 고유번호 자동 다운로드 실패: ${msg}`);
      }
    }
  }
}

/**
 * 회사명, 종목코드, 또는 고유번호 → DART 8자리 고유번호(corp_code)로 변환.
 *
 * - 8자리 숫자 → 고유번호 그대로 반환
 * - 6자리 숫자 → 종목코드로 매핑
 * - 그 외 → 회사명 완전일치 → 부분일치 순으로 검색
 */
export function resolveCorpCode(query: string): string {
  const trimmed = query.trim();

  // 8자리 숫자 → 고유번호
  if (/^\d{8}$/.test(trimmed)) {
    return trimmed;
  }

  const data = loadCorpCodes();

  // 6자리 숫자 → 종목코드
  if (/^\d{6}$/.test(trimmed)) {
    const corpCode = data.byStockCode[trimmed];
    if (!corpCode) {
      throw new Error(`'${trimmed}'에 해당하는 종목코드를 찾을 수 없습니다.`);
    }
    return corpCode;
  }

  // 회사명 완전일치
  const exactMatch = data.byName[trimmed];
  if (exactMatch) {
    return exactMatch;
  }

  // 회사명 부분일치 (상장사 우선)
  const lowerQuery = trimmed.toLowerCase();
  let partialMatch: string | null = null;

  for (const [name, corpCode] of Object.entries(data.byName)) {
    if (name.toLowerCase().includes(lowerQuery)) {
      // 상장사면 즉시 반환
      const info = data.byCorpCode[corpCode];
      if (info?.stockCode) {
        return corpCode;
      }
      // 비상장사는 첫 매칭만 저장
      if (!partialMatch) {
        partialMatch = corpCode;
      }
    }
  }

  if (partialMatch) {
    return partialMatch;
  }

  throw new Error(`'${trimmed}'에 해당하는 기업을 찾을 수 없습니다.`);
}

/**
 * 부분일치하는 회사 목록 검색 (최대 10개, 상장사 우선).
 */
export function searchCompanies(query: string): CompanySearchResult[] {
  const data = loadCorpCodes();
  const lowerQuery = query.trim().toLowerCase();
  const results: CompanySearchResult[] = [];

  for (const [corpCode, info] of Object.entries(data.byCorpCode)) {
    if (info.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        corpCode,
        corpName: info.name,
        stockCode: info.stockCode,
      });
    }
  }

  // 상장사 우선, 이름순 정렬
  results.sort((a, b) => {
    const aListed = a.stockCode ? 0 : 1;
    const bListed = b.stockCode ? 0 : 1;
    if (aListed !== bListed) return aListed - bListed;
    return a.corpName.localeCompare(b.corpName);
  });

  return results.slice(0, 10);
}
