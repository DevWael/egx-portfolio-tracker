import type { DB } from "../db/connection.js";
import { EodhdClient, EodhdError } from "../eodhd/client.js";
import { upsertPrices } from "../repositories/prices.js";

export async function syncPrices(
  db: DB, client: EodhdClient, tickers: string[], from: string, to: string
): Promise<number> {
  let stored = 0;
  for (const ticker of tickers) {
    try {
      const bars = await client.getEod(ticker, from, to);
      upsertPrices(db, bars);
      stored += bars.length;
    } catch (e) {
      if (e instanceof EodhdError) continue; // graceful degrade; keep last stored close
      throw e;
    }
  }
  return stored;
}
