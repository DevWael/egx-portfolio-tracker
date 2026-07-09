import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettings, writeSettings, updateSettings } from "../../lib/core/settings/store.js";
import { DEFAULT_SETTINGS } from "../../lib/core/settings/schema.js";

let dir: string;
let settingsPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "egx-settings-"));
  settingsPath = join(dir, "settings.json");
  process.env.EGX_SETTINGS_PATH = settingsPath;
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("settings store", () => {
  it("returns defaults when the file doesn't exist", () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips a full write/read", () => {
    const custom = { theme: "light", accentColor: "#3b82f6", defaultPriceHistoryRange: "1M", dateFormat: "iso" } as const;
    writeSettings(custom);
    expect(readSettings()).toEqual(custom);
  });

  it("merges a partial update, leaving other fields alone", () => {
    writeSettings({ theme: "light", accentColor: "#3b82f6", defaultPriceHistoryRange: "1M", dateFormat: "iso" });
    updateSettings({ theme: "dark" });
    expect(readSettings()).toEqual({
      theme: "dark",
      accentColor: "#3b82f6",
      defaultPriceHistoryRange: "1M",
      dateFormat: "iso",
    });
  });

  it("fills in missing keys on an old settings file with schema defaults", () => {
    writeSettings(DEFAULT_SETTINGS);
    const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
    delete raw.dateFormat;
    writeFileSync(settingsPath, JSON.stringify(raw));
    expect(readSettings().dateFormat).toBe("en-GB");
  });

  it("rejects an invalid accent color", () => {
    expect(() => writeSettings({ ...DEFAULT_SETTINGS, accentColor: "red" })).toThrow();
  });
});
