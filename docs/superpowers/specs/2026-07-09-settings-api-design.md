# Settings API + Settings Page — Design Spec

## Summary

Add a file-backed settings layer (`data/settings.json`) consumed identically by the web app, the
MCP server, and the CLI — a fourth thin-shell trio alongside the existing tools/routes/commands.
v1 covers four settings: `theme`, `accentColor`, `defaultPriceHistoryRange`, `dateFormat`. Dark/
light mode moves out of `ThemeToggle`/`localStorage` and into this layer, fixing the theme-flash
problem at its root (the server now knows the theme before sending any HTML, instead of a client
script correcting it after the fact).

## Motivation

Today's only per-user preference (theme) lives in `localStorage`, invisible to MCP and the CLI and
requiring a client-side correction script to avoid a flash on load. The app is expected to grow
more settings over time, and the user wants every settings addition automatically available from
chat (MCP) and the terminal (CLI), not just the dashboard.

## Scope

- **In:** `lib/core/settings/{schema,store}.ts`; a `/settings` page + form; `get_settings` /
  `update_settings` MCP tools; `settings` / `set-settings` CLI commands; wiring `dateFormat` and
  `defaultPriceHistoryRange` into their real call sites (`Topbar`, `PriceChart` via `HoldingsTable`
  and `TickerChartStats`); removing `ThemeToggle.tsx` and the blocking inline theme script from
  `layout.tsx`.
- **Out:** secrets (`EODHD_API_KEY` stays an env var, never settings.json — explicit user
  constraint), the digest lookback setting (dropped — no existing digest time-window concept to
  configure; see the CLI-layer-adjacent conversation where this was raised and dropped), any
  settings UI beyond a plain form (no live color preview, no toasts — matches the app's existing
  server-action-form style elsewhere).

## Design

### Where settings live

`data/settings.json`, gitignored — same tier as `data/egx.db`, overridable via `EGX_SETTINGS_PATH`
(mirrors `EGX_DB_PATH`). Not git-tracked: this is personal-machine state, not a shared default
committed to the repo, consistent with `data/` already being gitignored for the DB.

### Schema (v1)

```ts
theme: "dark" | "light"                                    default "dark"
accentColor: string (/^#[0-9a-fA-F]{6}$/)                   default "#34d399"  (today's --accent)
defaultPriceHistoryRange: "1W"|"1M"|"3M"|"6M"|"1Y"|"max"    default "max"      (today's PriceChart default)
dateFormat: "en-GB"|"iso"|"en-US"                           default "en-GB"    (today's hardcoded locale)
```

Every default matches current hardcoded behavior exactly — adopting settings changes nothing
until the user actually edits something. Each field carries its own zod `.default()`, so
`SettingsSchema.parse()` on an old `settings.json` missing newer keys fills them in automatically —
this is the mechanism that lets the file "grow over time" without a migration step.

### The settings module (`lib/core/settings/`)

`readSettings(): Settings` — returns defaults if the file doesn't exist yet (no write-on-read
side effect). `writeSettings(settings): Settings` — validates then writes. `updateSettings(partial):
Settings` — read, merge, validate, write. This lives under `lib/core` (not `lib/`) because it's
consumed by all three surfaces identically, matching the "core = the brain, no UI/MCP knowledge"
rule already governing everything else there.

### Three consumers

- **MCP** (`lib/mcp/tools.ts`): `get_settings` (no args, returns the settings object) and
  `update_settings` (all fields optional — only passed fields change). Both ignore the `db`
  parameter every tool handler receives, since settings aren't DB-backed.
- **CLI** (`lib/cli/dispatch.ts`): `settings` and `set-settings` added to the existing `COMMANDS`
  map, dispatching to the same two tools. No new CLI code needed beyond the map entry — the
  existing generic flag parser already handles `--accent-color`, `--default-price-history-range`,
  etc. against these tools' zod shapes.
- **Web**: `app/settings/page.tsx` (Server Component, calls `readSettings()`) + a plain HTML form
  bound to a Server Action (`app/settings/actions.ts`) — no client JS needed, matching how
  `app/transactions/actions.ts` and `app/watchlist/actions.ts` already work. The action calls
  `updateSettings()` then `revalidatePath("/", "layout")` so the root layout picks up the change on
  next render.

### Theme/accent: root layout, not a client script

`app/layout.tsx` calls `readSettings()` (already reads other server state here, e.g.
`data.evaluate()`) and sets `<html className={theme === "light" ? "light" : undefined}>` and an
inline `--accent` CSS variable directly — both are now known before the server sends any bytes.
This deletes the inline blocking `<script>` and `suppressHydrationWarning` added by the earlier
theme-flash fix (docs/no-longer-needed once the source of truth moves server-side) and deletes
`components/ThemeToggle.tsx` entirely — the toggle becomes a `<select>` in the settings form.
`Sidebar.tsx` gains a 5th nav link, `/settings`.

### Wiring `dateFormat` and `defaultPriceHistoryRange` into their real call sites

Both `Topbar.tsx` and `PriceChart.tsx` are client components hardcoding `toLocaleDateString("en-GB",
...)`; `PriceChart.tsx` hardcodes an initial `null` (= "Max") zoom window. Fix: a new
`formatDate(dateStr, format)` in `lib/format.ts` replaces both hardcoded calls; `PriceChart` gains
an optional `defaultRangeDays` prop (defaulting to `null`, preserving today's behavior if omitted)
used to compute its initial window instead of always starting full-zoomed-out. Both props are
threaded down from whichever Server Component page renders them — `app/layout.tsx` →
`Topbar`; `app/page.tsx` → `HoldingsTable` → `PriceChart`; `app/ticker/[symbol]/page.tsx` →
`TickerChartStats` → `PriceChart`. Each of those three Server Components calls `readSettings()`
itself (a cheap synchronous file read, consistent with how e.g. `data.evaluate()` is already
called fresh per page) rather than introducing a React Context for three primitive values.

`PriceChart`'s existing `RANGES` UI-label table (`["1W", 7], ["1M", 30], ...`) is left as-is rather
than deriving it from the settings schema's range enum — they describe the same six buckets, but
forcing one to derive from the other couples a presentational button list to the settings module
for no real benefit at this scale; a small `RANGE_DAYS` lookup in the settings schema module
converts the setting's string value to the number-or-null `PriceChart` already expects.

## Testing

New: `test/core/settings.test.ts` (defaults-when-missing, round-trip write/read, partial update
merges, old-file-missing-keys forward-compat, invalid `accentColor` rejected), settings-tool
assertions added to the MCP test suite, settings-command assertions added to
`test/cli/dispatch.test.ts`, `formatDate` assertions added to `test/format.test.ts`. No existing
test is touched for behavior — only `Topbar`/`PriceChart`'s new optional props, which default to
today's exact behavior when omitted.

## Non-goals

Secrets in settings.json, a digest lookback setting, live-preview UI, settings versioning/migration
tooling beyond zod's per-field defaults.
