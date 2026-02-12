import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

// compiled to dist/src/utils/ → project root is ../../..
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../../../data/corp-codes.json");

let cachedData: CorpCodeData | null = null;

function loadCorpCodes(): CorpCodeData {
  if (cachedData) return cachedData;

  if (!existsSync(DATA_PATH)) {
    throw new Error(
      "고유번호 데이터 파일이 없습니다. " +
        "먼저 'npm run update-corp-codes'를 실행하세요.",
    );
  }

  cachedData = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as CorpCodeData;
  return cachedData;
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
