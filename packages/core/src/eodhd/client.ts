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
interface SearchRow { Code: string; Exchange?: string; Name: string; }

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
    const url = `${this.baseUrl}/eod/${encodeURIComponent(ticker)}?api_token=${encodeURIComponent(this.apiKey)}&fmt=json&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const json = await this.getJson(url);
    if (!Array.isArray(json)) {
      throw new EodhdError(0, "EODHD returned unexpected EOD response shape");
    }
    const rows = json as Array<Partial<EodRow> & { warning?: string; error?: string; message?: string }>;
    const bars: PriceBar[] = rows
      .filter((r) => typeof r.date === "string" && typeof r.close === "number" && Number.isFinite(r.close))
      .map((r) => ({
        ticker,
        date: r.date as string,
        open: toPiasters(r.open as number),
        high: toPiasters(r.high as number),
        low: toPiasters(r.low as number),
        close: toPiasters(r.close as number),
        volume: typeof r.volume === "number" ? r.volume : 0,
        source: "eodhd",
      }));
    // EODHD returns e.g. [{"warning":"Data is limited by one year..."}] for
    // plan/range issues — surface that instead of emitting NaN bars.
    if (bars.length === 0) {
      const note = rows.find((r) => r.warning || r.error || r.message);
      if (note) throw new EodhdError(0, `EODHD: ${note.warning ?? note.error ?? note.message}`);
    }
    return bars;
  }

  async search(query: string): Promise<{ ticker: string; name: string }[]> {
    const url = `${this.baseUrl}/search/${encodeURIComponent(query)}?api_token=${encodeURIComponent(this.apiKey)}&fmt=json`;
    const json = await this.getJson(url);
    if (!Array.isArray(json)) {
      throw new EodhdError(0, "EODHD returned unexpected search response shape");
    }
    const rows = json as SearchRow[];
    // EODHD's search "Exchange" field carries the exchange code that forms the
    // symbol (e.g. "EGX" -> COMI.EGX). Match case-insensitively, and leave Code
    // untouched if it already includes an exchange suffix.
    return rows
      .filter((r) => (r.Exchange ?? "").toUpperCase() === "EGX")
      .map((r) => ({ ticker: r.Code.includes(".") ? r.Code : `${r.Code}.EGX`, name: r.Name }));
  }
}
