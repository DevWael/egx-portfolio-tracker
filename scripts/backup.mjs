// Manual DB backup from the CLI: `pnpm --filter @egx/web backup`
// Writes a consistent snapshot to apps/web/data/backups/ (works while the app is running).
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const dbPath = process.env.EGX_DB_PATH ?? join(process.cwd(), "data", "egx.db");
const dir = join(dirname(dbPath), "backups");
mkdirSync(dir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = join(dir, `egx-${ts}-cli.db`);

const db = new Database(dbPath, { readonly: true });
await db.backup(dest);
db.close();
console.log("backup ->", dest);
