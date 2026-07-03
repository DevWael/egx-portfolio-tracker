import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DB } from "./connection.js";

const here = dirname(fileURLToPath(import.meta.url));

export function migrate(db: DB): void {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  db.exec(sql);
}
