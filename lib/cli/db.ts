import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb, migrate, type DB } from "../core/index.js";

export function getDb(): DB {
  const dbPath = process.env.EGX_DB_PATH ?? join(process.cwd(), "data", "egx.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDb(dbPath);
  migrate(db);
  return db;
}
