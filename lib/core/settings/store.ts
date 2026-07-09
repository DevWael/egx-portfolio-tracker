import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SettingsSchema, DEFAULT_SETTINGS, type Settings } from "./schema.js";

function settingsPath(): string {
  return process.env.EGX_SETTINGS_PATH ?? join(process.cwd(), "data", "settings.json");
}

export function readSettings(): Settings {
  const path = settingsPath();
  if (!existsSync(path)) return DEFAULT_SETTINGS;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return SettingsSchema.parse(raw);
}

export function writeSettings(settings: Settings): Settings {
  const validated = SettingsSchema.parse(settings);
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(validated, null, 2) + "\n", "utf-8");
  return validated;
}

export function updateSettings(partial: Partial<Settings>): Settings {
  return writeSettings({ ...readSettings(), ...partial });
}
