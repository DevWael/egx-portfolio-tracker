"use client";
import { usePathname } from "next/navigation";
import { DataControls } from "./DataControls";
import { ThemeToggle } from "./ThemeToggle";

const NAMES: Record<string, string> = {
  "/": "Portfolio",
  "/transactions": "Transactions",
  "/watchlist": "Watchlist",
  "/digest": "Digest",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function Topbar({ asOf }: { asOf: string | null }) {
  const pathname = usePathname();
  const name = pathname === "/" ? "Portfolio" : NAMES[pathname] ?? "EGX Folio";
  return (
    <header className="topbar">
      <span className="crumb">{name}</span>
      <span className="spacer" />
      <span className="chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        Prices as of <b>{fmtDate(asOf)}</b>
      </span>
      <DataControls />
      <ThemeToggle />
    </header>
  );
}
