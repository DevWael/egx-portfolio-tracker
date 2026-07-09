export function formatOutput(result: unknown, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);
  if (Array.isArray(result)) return formatTable(result as Record<string, unknown>[]);
  if (result && typeof result === "object") return formatObject(result as Record<string, unknown>);
  return String(result);
}

function formatTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "(no results)";
  const keys: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
  }
  const widths = keys.map((k, i) =>
    i === keys.length - 1 ? 0 : Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)),
  );
  const pad = (v: string, i: number) => (i === keys.length - 1 ? v : v.padEnd(widths[i]));
  const header = keys.map((k, i) => pad(k, i)).join("  ");
  const lines = rows.map((r) => keys.map((k, i) => pad(String(r[k] ?? ""), i)).join("  "));
  return [header, ...lines].join("\n");
}

function formatObject(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
