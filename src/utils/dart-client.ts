const STATUS_MESSAGES: Record<string, string> = {
  "000": "정상",
  "010": "등록되지 않은 API 키입니다. DART OpenAPI에서 키를 발급받았는지 확인하세요.",
  "011": "사용할 수 없는 API 키입니다. 키 상태를 확인하세요.",
  "012": "접근할 수 없는 IP입니다. DART OpenAPI에서 허용 IP를 확인하세요.",
  "013": "조회된 데이터가 없습니다.",
  "020": "요청 제한을 초과했습니다. 일일 10,000건 한도를 확인하세요.",
  "100": "필드 오류입니다. 요청 파라미터를 확인하세요.",
  "800": "DART 시스템 오류입니다. 잠시 후 다시 시도하세요.",
};

interface DartBaseResponse {
  status: string;
  message: string;
}

export class DartApiError extends Error {
  constructor(
    public readonly status: string,
    message: string,
  ) {
    super(message);
    this.name = "DartApiError";
  }
}

export class DartClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://opendart.fss.or.kr/api";
  private readonly timeoutMs = 15_000;

  constructor() {
    const key = process.env.DART_API_KEY;
    if (!key) {
      throw new Error(
        "환경변수 DART_API_KEY가 설정되지 않았습니다. " +
          ".env 파일 또는 환경변수에 DART OpenAPI 키를 설정하세요. " +
          "(https://opendart.fss.or.kr 에서 무료 발급)",
      );
    }
    this.apiKey = key;
  }

  async request<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set("crtfc_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new DartApiError(
          String(response.status),
          `DART API HTTP 오류: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DartBaseResponse & T;

      if (data.status && data.status !== "000") {
        const msg =
          STATUS_MESSAGES[data.status] ??
          `알 수 없는 DART API 오류 (status: ${data.status}, message: ${data.message})`;
        throw new DartApiError(data.status, msg);
      }

      return data as T;
    } catch (error) {
      if (error instanceof DartApiError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new DartApiError(
          "TIMEOUT",
          "DART API 요청 시간이 초과되었습니다 (15초). 잠시 후 다시 시도하세요.",
        );
      }
      throw new DartApiError(
        "NETWORK",
        `DART API 네트워크 오류: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

let instance: DartClient | null = null;

export function getDartClient(): DartClient {
  if (!instance) {
    instance = new DartClient();
  }
  return instance;
}
