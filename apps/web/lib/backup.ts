import "server-only";
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { getDb } from "./db.js";

const DB_PATH = process.env.EGX_DB_PATH ?? join(process.cwd(), "data", "egx.db");
const BACKUP_DIR = join(dirname(DB_PATH), "backups");

/** Online, consistent snapshot of the live DB (checkpoints WAL). Returns the file path. */
export async function snapshot(reason = "manual"): Promise<string> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = join(BACKUP_DIR, `egx-${ts}-${reason}.db`);
  await getDb().backup(dest);
  return dest;
}

export interface BackupInfo { file: string; size: number; mtime: string; }

export function listBackups(): BackupInfo[] {
  try {
    return readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".db"))
      .map((f) => { const s = statSync(join(BACKUP_DIR, f)); return { file: f, size: s.size, mtime: s.mtime.toISOString() }; })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

// child tables first when deleting, parents first when inserting (FK-safe)
const DELETE_ORDER = ["transactions", "prices", "watchlist_alerts", "settings", "securities"];
const INSERT_ORDER = ["securities", "transactions", "prices", "watchlist_alerts", "settings"];

/** Replace all live data with the contents of a backup file (in one transaction). */
export function restore(file: string): void {
  const src = new Database(join(BACKUP_DIR, file), { readonly: true });
  const live = getDb();
  try {
    live.transaction(() => {
      for (const t of DELETE_ORDER) live.exec(`DELETE FROM ${t}`);
      for (const t of INSERT_ORDER) {
        const rows = src.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
        if (rows.length === 0) continue;
        const cols = Object.keys(rows[0]);
        const stmt = live.prepare(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`);
        for (const r of rows) stmt.run(r);
      }
    })();
  } finally {
    src.close();
  }
}

export function restoreLatest(): string | null {
  const latest = listBackups()[0];
  if (!latest) return null;
  restore(latest.file);
  return latest.file;
}
