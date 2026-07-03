import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { snapshot } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a fresh, consistent snapshot of the DB as a download (also keeps it as a backup).
export async function GET() {
  const path = await snapshot("export");
  const buf = readFileSync(path);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${basename(path)}"`,
    },
  });
}
