import type { DB } from "../db/connection.js";
import type { Security } from "../types.js";

export function upsertSecurity(db: DB, s: Security): void {
  db.prepare(
    `INSERT INTO securities (ticker, name, sector, currency)
     VALUES (@ticker, @name, @sector, @currency)
     ON CONFLICT(ticker) DO UPDATE SET
       name = excluded.name,
       sector = excluded.sector,
       currency = excluded.currency`
  ).run(s);
}

export function getSecurity(db: DB, ticker: string): Security | null {
  const row = db
    .prepare(`SELECT ticker, name, sector, currency FROM securities WHERE ticker = ?`)
    .get(ticker) as Security | undefined;
  return row ?? null;
}

export function listSecurities(db: DB): Security[] {
  return db
    .prepare(`SELECT ticker, name, sector, currency FROM securities ORDER BY ticker`)
    .all() as Security[];
}
