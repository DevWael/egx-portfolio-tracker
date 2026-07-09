import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, migrate, type DB } from "../../lib/core/index.js";
import { runCli } from "../../lib/cli/dispatch.js";

let db: DB;
let dir: string;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "egx-settings-cli-"));
  process.env.EGX_SETTINGS_PATH = join(dir, "settings.json");
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("runCli", () => {
  it("list-positions on an empty portfolio returns an empty table", async () => {
    const { code, output } = await runCli(["list-positions"], db);
    expect(code).toBe(0);
    expect(output).toBe("(no results)");
  });

  it("record-transaction writes a transaction and returns it", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "buy", "--qty", "100", "--price", "84.15"],
      db,
    );
    expect(code).toBe(0);
    expect(output).toContain("ok: true");
  });

  it("rejects an invalid side with a validation error", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "hold", "--qty", "1", "--price", "1"],
      db,
    );
    expect(code).toBe(1);
    expect(output).toContain("side");
  });

  it("reports an unknown command", async () => {
    const { code, output } = await runCli(["bogus"], db);
    expect(code).toBe(1);
    expect(output).toContain("Unknown command");
  });

  it("help lists all commands", async () => {
    const { code, output } = await runCli(["help"], db);
    expect(code).toBe(0);
    expect(output).toContain("list-positions");
    expect(output).toContain("record-transaction");
    expect(output).toContain("settings");
    expect(output).toContain("set-settings");
  });

  it("settings returns the current settings", async () => {
    const { code, output } = await runCli(["settings"], db);
    expect(code).toBe(0);
    expect(output).toContain("theme: dark");
  });

  it("set-settings updates a field", async () => {
    const { code, output } = await runCli(["set-settings", "--theme", "light"], db);
    expect(code).toBe(0);
    expect(output).toContain("ok: true");
  });
});
