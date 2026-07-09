import type { DB } from "../db/connection.js";
import type { PriceBar } from "../types.js";

export function upsertPrice(db: DB, bar: PriceBar): void {
  db.prepare(
    `INSERT INTO prices (ticker, date, open, high, low, close, volume, source)
     VALUES (@ticker, @date, @open, @high, @low, @close, @volume, @source)
     ON CONFLICT(ticker, date) DO UPDATE SET
       open=excluded.open, high=excluded.high, low=excluded.low,
       close=excluded.close, volume=excluded.volume, source=excluded.source`
  ).run(bar);
}

export function upsertPrices(db: DB, bars: PriceBar[]): void {
  const tx = db.transaction((rows: PriceBar[]) => {
    for (const b of rows) upsertPrice(db, b);
  });
  tx(bars);
}

export function getLatestPrice(db: DB, ticker: string): PriceBar | null {
  const row = db
    .prepare(`SELECT * FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT 1`)
    .get(ticker) as PriceBar | undefined;
  return row ?? null;
}

export function getPriceHistory(db: DB, ticker: string, from: string, to: string): PriceBar[] {
  return db
    .prepare(`SELECT * FROM prices WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date`)
    .all(ticker, from, to) as PriceBar[];
}

export function getLatestPriceDate(db: DB): string | null {
  const row = db.prepare(`SELECT MAX(date) AS d FROM prices`).get() as { d: string | null };
  return row.d ?? null;
}
