import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb, migrate, type DB } from "@egx/core";

const dbPath = process.env.EGX_DB_PATH ?? join(process.cwd(), "data", "egx.db");

declare global {
  // eslint-disable-next-line no-var
  var __egxDb: DB | undefined;
}

export function getDb(): DB {
  if (!globalThis.__egxDb) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = openDb(dbPath);
    migrate(db);
    globalThis.__egxDb = db;
  }
  return globalThis.__egxDb;
}
