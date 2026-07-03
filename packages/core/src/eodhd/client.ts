import type { PriceBar } from "../types.js";

export class EodhdError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EodhdError";
    this.status = status;
  }
}

export interface EodhdOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface EodRow { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface SearchRow { Code: string; Exchange: string; Name: string; }

const toPiasters = (v: number): number => Math.round(v * 100);

export class EodhdClient {
  private apiKey: string;
  private fetchImpl: typeof fetch;
  private baseUrl: string;

  constructor(opts: EodhdOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://eodhd.com/api";
  }

  private async getJson(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch (e) {
      throw new EodhdError(0, `EODHD network error: ${(e as Error).message}`);
    }
    if (!res.ok) throw new EodhdError(res.status, `EODHD request failed: ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new EodhdError(res.status, "EODHD returned invalid JSON");
    }
  }

  async getEod(ticker: string, from: string, to: string): Promise<PriceBar[]> {
    const url = `${this.baseUrl}/eod/${encodeURIComponent(ticker)}?api_token=${this.apiKey}&fmt=json&from=${from}&to=${to}`;
    const json = await this.getJson(url);
    if (!Array.isArray(json)) {
      throw new EodhdError(0, "EODHD returned unexpected EOD response shape");
    }
    const rows = json as EodRow[];
    return rows.map((r) => ({
      ticker,
      date: r.date,
      open: toPiasters(r.open),
      high: toPiasters(r.high),
      low: toPiasters(r.low),
      close: toPiasters(r.close),
      volume: r.volume,
      source: "eodhd",
    }));
  }

  async search(query: string): Promise<{ ticker: string; name: string }[]> {
    const url = `${this.baseUrl}/search/${encodeURIComponent(query)}?api_token=${this.apiKey}&fmt=json`;
    const json = await this.getJson(url);
    if (!Array.isArray(json)) {
      throw new EodhdError(0, "EODHD returned unexpected search response shape");
    }
    const rows = json as SearchRow[];
    return rows
      .filter((r) => r.Exchange === "EGX")
      .map((r) => ({ ticker: `${r.Code}.EGX`, name: r.Name }));
  }
}
