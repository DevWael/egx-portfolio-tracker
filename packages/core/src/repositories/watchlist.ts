import type { DB } from "../db/connection.js";
import type { Alert, NewAlert } from "../types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapRow(r: any): Alert {
  return {
    id: r.id, ticker: r.ticker, targetPrice: r.target_price,
    direction: r.direction, active: !!r.active, note: r.note,
    createdAt: r.created_at, triggeredAt: r.triggered_at,
  };
}

export function addAlert(db: DB, a: NewAlert): Alert {
  const row = {
    ticker: a.ticker, target_price: a.targetPrice, direction: a.direction,
    note: a.note ?? null, created_at: today(),
  };
  const info = db
    .prepare(
      `INSERT INTO watchlist_alerts (ticker, target_price, direction, active, note, created_at, triggered_at)
       VALUES (@ticker, @target_price, @direction, 1, @note, @created_at, NULL)`
    )
    .run(row);
  return mapRow({ id: Number(info.lastInsertRowid), active: 1, triggered_at: null, ...row });
}

export function listAlerts(db: DB, activeOnly = false): Alert[] {
  const rows = activeOnly
    ? db.prepare(`SELECT * FROM watchlist_alerts WHERE active = 1 ORDER BY id`).all()
    : db.prepare(`SELECT * FROM watchlist_alerts ORDER BY id`).all();
  return (rows as any[]).map(mapRow);
}

export function setAlertActive(db: DB, id: number, active: boolean): void {
  db.prepare(`UPDATE watchlist_alerts SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
}

export function markTriggered(db: DB, id: number, when: string): void {
  db.prepare(`UPDATE watchlist_alerts SET triggered_at = ? WHERE id = ?`).run(when, id);
}

export function deleteAlert(db: DB, id: number): void {
  db.prepare(`DELETE FROM watchlist_alerts WHERE id = ?`).run(id);
}
