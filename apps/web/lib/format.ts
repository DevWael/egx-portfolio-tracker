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
