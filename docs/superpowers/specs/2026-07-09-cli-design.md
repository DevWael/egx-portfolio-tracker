# CLI Layer — Design Spec

## Summary

Add a command-line interface over the same 11 tool definitions already registered in
`lib/mcp/tools.ts`. The CLI is a third thin shell alongside the web dashboard and the MCP HTTP
endpoint — no business logic lives in it, it only maps `argv` into the same zod-validated tool
calls MCP already makes, against the same database.

## Motivation

The MCP tools ([2026-07-09 one-app architecture spec](2026-07-09-one-app-architecture-design.md))
are the only non-UI way to drive the tracker today, and they require Claude Code as an
intermediary. A CLI gives direct terminal/scripting access — quick checks, cron-driven
`refresh-prices`, or piping `--json` output into other tools — without opening a chat session.

## Scope

- **In:** all 11 commands (read + write), human-readable table output by default, `--json` on
  every command, a `help` command, `pnpm egx <command>` invocation via a `package.json` script,
  a `bin` entry for future global/npx use.
- **Out:** interactive/REPL mode, shell completions, colorized output, any new business logic —
  every command's behavior must match its MCP tool exactly (same validation, same EGP↔piaster
  conversion, same auto-create-security-on-write behavior).

## Design

### Why reuse `lib/mcp/tools.ts` instead of writing CLI-specific logic

Each tool already has `{ name, description, inputSchema: ZodRawShape, handler }`. The CLI's job
is entirely mechanical: turn `--ticker COMI.EGX --side buy` into `{ ticker: "COMI.EGX", side:
"buy" }`, validate it against the tool's own `inputSchema`, call `handler(db, args)`, print the
result. This means web, MCP, and CLI are three equally-thin shells over one set of tool
definitions — there is no second place for read/write logic to drift out of sync with MCP.

### The `server-only` problem (learned the hard way during the one-app merge)

`lib/db.ts`'s `getDb()` is guarded by `import "server-only"`, which throws unless resolved via
the `"react-server"` export condition — something Next's webpack build sets, but a plain `tsx`
script does not (this is exactly what broke `vitest` for `test/mcp/server.test.ts` during the
one-app merge, fixed there by setting that condition in `vitest.config.ts`). A CLI script isn't
running inside Next at all, so setting the condition doesn't apply here — instead `lib/cli/db.ts`
opens the database directly via `openDb`/`migrate` from `lib/core`, without the `server-only`
guard, mirroring why the now-deleted `apps/mcp/src/db.ts` used to exist as its own small file
rather than importing `lib/db.ts`.

### File layout

```
lib/cli/
  db.ts        getDb(): DB — openDb(EGX_DB_PATH ?? ./data/egx.db) + migrate, no server-only guard
  parse.ts     parseFlags(argv, shape): unknown — kebab --flags -> camelCase raw object,
               coercing per the zod type at each key (string, number, enum passthrough,
               string-array via comma-split), then the caller runs z.object(shape).parse(...)
  format.ts    formatOutput(result, json): string — table for arrays, key:value for plain
               objects, raw JSON.stringify when json is true
  dispatch.ts  COMMANDS table (kebab name -> tool name) + runCli(argv, db): Promise<{code,
               output}> — resolves the command, parses/validates flags, calls the tool handler,
               formats the result; catches ZodError and re-formats issues as `field: message`
               lines with code 1; unknown command or --help prints the command list (each tool's
               existing `description`) with code 0 (or 1 for a truly unknown command)
scripts/cli.ts   #!/usr/bin/env tsx — runCli(process.argv.slice(2), getDb()), print output,
                 process.exit(code)
test/cli/
  parse.test.ts     flag coercion: string, number, enum, optional-missing, comma-split array,
                     unknown-flag rejection
  format.test.ts    table rendering for arrays, key:value for objects, --json passthrough
  dispatch.test.ts  end-to-end against an in-memory DB for a representative read command, a
                     write command, and an invalid-input case
```

### Command surface

1:1 with the 11 MCP tools, kebab-cased:

| Command | Flags |
|---|---|
| `list-positions` | — |
| `summary` | — |
| `transactions` | `[--ticker]` |
| `price-history` | `--ticker [--from] [--to]` |
| `watchlist` | — |
| `alerts-triggered` | — |
| `record-transaction` | `--ticker --side --qty --price [--fee] [--traded-at] [--note]` |
| `delete-transaction` | `--id` |
| `set-alert` | `--ticker --target-price --direction [--note]` |
| `upsert-security` | `--ticker --name [--sector]` |
| `refresh-prices` | `[--tickers a,b,c]` |
| `help` | — |

### Output

- Array of objects → aligned table (header row from the union of keys across all rows, one row
  per object).
- Single object → `key: value` lines.
- `{ ok: false, message }` (e.g. `refresh-prices` with no `EODHD_API_KEY`) → print `message`,
  exit code 1.
- `--json` on any command → `JSON.stringify(result, null, 2)` regardless of the above, exit 0
  unless the command itself failed validation.

### Errors

Zod validation failures are caught in `dispatch.ts` and reformatted as one `path: message` line
per issue (not a raw stack trace), exit code 1. An unrecognized command prints the command list
and exits 1.

### Invocation

`package.json` gets a `"scripts".egx` entry (`"tsx scripts/cli.ts"`) so `pnpm egx <command>`
works immediately, and a `"bin".egx` entry (`"scripts/cli.ts"`) with a real `#!/usr/bin/env tsx`
shebang for future global/`npx` use — unlike the old (now-deleted) `apps/mcp` bin entry, which had
no shebang and was never actually invoked as a direct executable.

## Testing

New tests in `test/cli/` (see file layout above) — no existing test is touched, since no existing
code changes behavior. Total test count should only go up from the current 82.

## Non-goals

Interactive/REPL mode, shell completions, colorized output, any CLI-only business logic.
