import type { DateFormat } from "./core/index.js";

const fmt = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  currencyDisplay: "code",
});

/** piasters -> "EGP 1,234.56" */
export function egp(piasters: number | null): string {
  return piasters === null ? "—" : fmt.format(piasters / 100);
}

/** decimal fraction -> "16.23%" (with sign) */
export function pct(x: number | null): string {
  if (x === null) return "—";
  const s = (x * 100).toFixed(2);
  return `${x > 0 ? "+" : ""}${s}%`;
}

/** EGP string/number from a form -> integer piasters */
export function toPiasters(egpValue: string | number): number {
  const n = typeof egpValue === "string" ? parseFloat(egpValue) : egpValue;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

/** ISO "YYYY-MM-DD" -> a display string per the dateFormat setting. */
export function formatDate(dateStr: string, format: DateFormat): string {
  if (format === "iso") return dateStr;
  const dt = new Date(dateStr + "T00:00:00");
  if (format === "en-US") return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** #rrggbb -> readable text color for a background of that color (perceived brightness). */
export function accentForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? "#062018" : "#e8ebe9";
}

/** Free-typed ticker -> canonical EGX symbol, e.g. "comi" -> "COMI.EGX". */
export function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase();
  return t === "" || t.endsWith(".EGX") ? t : `${t}.EGX`;
}
