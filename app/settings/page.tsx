import { readSettings } from "../../lib/core/index.js";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const s = readSettings();
  const { saved } = await searchParams;
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Settings</div>
        <div className="page-sub">Personal preferences — shared by the dashboard, MCP, and the CLI.</div>
      </div>
      {saved ? <div className="toast">✓ Settings saved</div> : null}
      <form action={saveSettings} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
        <label className="field">
          Theme
          <select name="theme" defaultValue={s.theme}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="field">
          Accent color
          <input type="color" name="accentColor" defaultValue={s.accentColor} />
        </label>
        <label className="field">
          Default ticker chart range
          <select name="defaultPriceHistoryRange" defaultValue={s.defaultPriceHistoryRange}>
            <option value="1W">1 week</option>
            <option value="1M">1 month</option>
            <option value="3M">3 months</option>
            <option value="6M">6 months</option>
            <option value="1Y">1 year</option>
            <option value="max">Max</option>
          </select>
        </label>
        <label className="field">
          Date format
          <select name="dateFormat" defaultValue={s.dateFormat}>
            <option value="en-GB">09 Jul 2026</option>
            <option value="iso">2026-07-09</option>
            <option value="en-US">Jul 09, 2026</option>
          </select>
        </label>
        <button className="btn primary" type="submit">Save settings</button>
      </form>
    </div>
  );
}
