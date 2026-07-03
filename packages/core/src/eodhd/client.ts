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
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new EodhdError(res.status, `EODHD request failed: ${res.status}`);
    return res.json();
  }

  async getEod(ticker: string, from: string, to: string): Promise<PriceBar[]> {
    const url = `${this.baseUrl}/eod/${encodeURIComponent(ticker)}?api_token=${this.apiKey}&fmt=json&from=${from}&to=${to}`;
    const rows = (await this.getJson(url)) as EodRow[];
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
    const rows = (await this.getJson(url)) as SearchRow[];
    return rows
      .filter((r) => r.Exchange === "EGX")
      .map((r) => ({ ticker: `${r.Code}.EGX`, name: r.Name }));
  }
}
