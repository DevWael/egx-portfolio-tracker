import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDb, migrate, type DB } from "@egx/core";

const DEFAULT_PATH = fileURLToPath(new URL("../../web/data/egx.db", import.meta.url));
const dbPath = process.env.EGX_DB_PATH ?? DEFAULT_PATH;

let db: DB | undefined;
export function getDb(): DB {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = openDb(dbPath);
    migrate(db);
  }
  return db;
}
