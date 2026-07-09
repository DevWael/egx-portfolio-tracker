"use client";
import { usePathname } from "next/navigation";
import { DataControls } from "./DataControls";
import { formatDate } from "@/lib/format";
import type { DateFormat } from "../lib/core/index.js";

const NAMES: Record<string, string> = {
  "/": "Portfolio",
  "/transactions": "Transactions",
  "/watchlist": "Watchlist",
  "/digest": "Digest",
  "/settings": "Settings",
};

export function Topbar({ asOf, dateFormat }: { asOf: string | null; dateFormat: DateFormat }) {
  const pathname = usePathname();
  const name = pathname === "/" ? "Portfolio" : NAMES[pathname] ?? "EGX Folio";
  return (
    <header className="topbar">
      <span className="crumb">{name}</span>
      <span className="spacer" />
      <span className="chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        Prices as of <b>{asOf ? formatDate(asOf, dateFormat) : "—"}</b>
      </span>
      <DataControls />
    </header>
  );
}
