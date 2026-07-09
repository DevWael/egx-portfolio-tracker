import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, migrate, type DB } from "../../lib/core/index.js";
import { tools } from "../../lib/mcp/tools.js";

function tool(name: string) {
  return tools.find((t) => t.name === name)!;
}

let db: DB;
let dir: string;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "egx-settings-mcp-"));
  process.env.EGX_SETTINGS_PATH = join(dir, "settings.json");
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("settings tools", () => {
  it("get_settings returns defaults on a fresh env", async () => {
    const result = (await tool("get_settings").handler(db, {})) as { theme: string };
    expect(result.theme).toBe("dark");
  });

  it("update_settings changes only the passed fields", async () => {
    const result = (await tool("update_settings").handler(db, { theme: "light" })) as {
      ok: boolean;
      settings: { theme: string; accentColor: string };
    };
    expect(result.ok).toBe(true);
    expect(result.settings.theme).toBe("light");
    expect(result.settings.accentColor).toBe("#34d399");
  });
});
