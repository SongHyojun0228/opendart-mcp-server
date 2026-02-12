/**
 * DART API 금액 문자열 → 숫자 변환.
 * "300,870,903,000,000" → 300870903000000
 * "-11,526,297,000,000" → -11526297000000
 * 빈 값/파싱 불가 → NaN
 */
export function parseDartAmount(value: string | undefined | null): number {
  if (!value || value === "-") return NaN;
  return Number(value.replace(/,/g, ""));
}

/**
 * 숫자를 한국식 금액으로 포매팅 (억원/조원 단위).
 * 300870903000000 → "300조 8,709억원"
 * 32725961000000  → "32조 7,260억원"
 * 897514000000    → "8,975억원"
 */
export function formatKoreanCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "-";

  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const eok = Math.round(abs / 100_000_000); // 억원 단위

  if (eok === 0) {
    const formatted = `${Math.round(abs).toLocaleString("ko-KR")}원`;
    return isNegative ? `-${formatted}` : formatted;
  }

  const jo = Math.floor(eok / 10_000); // 조
  const remainEok = eok % 10_000; // 나머지 억

  let result: string;
  if (jo > 0 && remainEok > 0) {
    result = `${jo.toLocaleString("ko-KR")}조 ${remainEok.toLocaleString("ko-KR")}억원`;
  } else if (jo > 0) {
    result = `${jo.toLocaleString("ko-KR")}조원`;
  } else {
    result = `${remainEok.toLocaleString("ko-KR")}억원`;
  }

  return isNegative ? `-${result}` : result;
}

/**
 * 전년 대비 증감률 포매팅.
 * (현재값, 전년값) → "(+12.3%)" 또는 "(-5.2%)"
 * 전년값이 0이거나 NaN이면 "-"
 */
export function formatPercentChange(
  current: number,
  previous: number,
): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0)
    return "";

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change >= 0 ? "+" : "";
  return `(${sign}${change.toFixed(1)}%)`;
}
