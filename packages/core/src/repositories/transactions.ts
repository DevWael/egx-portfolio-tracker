import type { DB } from "../db/connection.js";
import type { Transaction, NewTransaction } from "../types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addTransaction(db: DB, t: NewTransaction): Transaction {
  const row = {
    ticker: t.ticker,
    side: t.side,
    qty: t.qty,
    price: t.price,
    fee: t.fee ?? 0,
    traded_at: t.tradedAt ?? today(),
    note: t.note ?? null,
  };
  const info = db
    .prepare(
      `INSERT INTO transactions (ticker, side, qty, price, fee, traded_at, note)
       VALUES (@ticker, @side, @qty, @price, @fee, @traded_at, @note)`
    )
    .run(row);
  return {
    id: Number(info.lastInsertRowid),
    ticker: row.ticker,
    side: row.side,
    qty: row.qty,
    price: row.price,
    fee: row.fee,
    tradedAt: row.traded_at,
    note: row.note,
  };
}

function mapRow(r: any): Transaction {
  return {
    id: r.id, ticker: r.ticker, side: r.side, qty: r.qty,
    price: r.price, fee: r.fee, tradedAt: r.traded_at, note: r.note,
  };
}

export function listTransactions(db: DB, ticker?: string): Transaction[] {
  const rows = ticker
    ? db.prepare(`SELECT * FROM transactions WHERE ticker = ? ORDER BY traded_at, id`).all(ticker)
    : db.prepare(`SELECT * FROM transactions ORDER BY traded_at, id`).all();
  return (rows as any[]).map(mapRow);
}

export function deleteTransaction(db: DB, id: number): void {
  db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
}
