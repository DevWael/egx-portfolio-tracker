import type { DB } from "./connection.js";
import { SCHEMA_SQL } from "./schema.js";

export function migrate(db: DB): void {
  db.exec(SCHEMA_SQL);
}
