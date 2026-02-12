import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { fileURLToPath } from "node:url";
import path from "node:path";

// --- path resolution ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// compiled to dist/scripts/ → project root is ../..
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "corp-codes.json");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

// --- load .env ---
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_KEY = process.env.DART_API_KEY;
if (!API_KEY) {
  console.error(
    "DART_API_KEY 환경변수가 설정되지 않았습니다.\n" +
      ".env 파일에 DART_API_KEY=your_key_here 를 추가하세요.",
  );
  process.exit(1);
}

// --- ZIP extraction using built-in zlib ---
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
    // stored (no compression)
    return zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
  }
  if (compressionMethod === 8) {
    // deflate
    const compressed =
      compressedSize > 0
        ? zipBuffer.subarray(dataOffset, dataOffset + compressedSize)
        : zipBuffer.subarray(dataOffset);
    return inflateRawSync(compressed);
  }

  throw new Error(`지원하지 않는 압축 방식입니다: ${compressionMethod}`);
}

// --- XML item type ---
interface CorpCodeXmlItem {
  corp_code: string | number;
  corp_name: string;
  stock_code: string | number;
  modify_date: string | number;
}

// --- main ---
async function main() {
  console.error("[1/4] DART 고유번호 ZIP 다운로드 중...");

  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${API_KEY}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`다운로드 실패: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    // DART returns JSON on error (e.g. invalid API key)
    const body = (await response.json()) as { status: string; message: string };
    throw new Error(`DART API 오류: ${body.message} (status: ${body.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);
  console.error(
    `[2/4] ZIP 압축 해제 중... (${(zipBuffer.length / 1024 / 1024).toFixed(1)}MB)`,
  );

  const xmlBuffer = extractFirstFileFromZip(zipBuffer);
  const xmlString = xmlBuffer.toString("utf-8");
  console.error(
    `[3/4] XML 파싱 중... (${(xmlString.length / 1024 / 1024).toFixed(1)}MB)`,
  );

  const parser = new XMLParser({
    isArray: (_tagName: string, jPath: string) => jPath === "result.list",
  });
  const parsed = parser.parse(xmlString) as {
    result: { list: CorpCodeXmlItem[] };
  };
  const items = parsed.result.list;

  const byName: Record<string, string> = {};
  const byStockCode: Record<string, string> = {};
  const byCorpCode: Record<string, { name: string; stockCode: string }> = {};

  let listedCount = 0;

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
      listedCount++;
    }
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ byName, byStockCode, byCorpCode }, null, 2),
    "utf-8",
  );

  console.error(
    `[4/4] 완료: ${items.length}개 기업 (상장 ${listedCount}개)\n` +
      `      저장: ${OUTPUT_PATH}`,
  );
}

main().catch((err) => {
  console.error("오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
