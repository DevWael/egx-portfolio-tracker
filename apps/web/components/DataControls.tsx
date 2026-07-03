"use client";
import { useState, useTransition } from "react";
import { seedDemo, refreshPrices, makeBackup, restoreLatestBackup } from "@/app/actions";

export function DataControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");
  const run = (fn: () => Promise<{ message: string }>) => start(async () => { setMsg((await fn()).message); });

  return (
    <div className="row-flex" style={{ gap: 8 }}>
      {msg ? <span className="dim" style={{ fontSize: 12.5 }}>{msg}</span> : null}
      <button
        className="btn"
        disabled={pending}
        onClick={() => {
          if (!confirm("Replace ALL your data with demo data?\n\nThis clears your current holdings, transactions, and alerts. A backup is saved first — you can restore it from the Data menu.")) return;
          start(async () => { await seedDemo(); setMsg("Demo loaded — undo via Data ▾ → Restore."); });
        }}
      >Load demo</button>
      <button className="btn primary" disabled={pending} onClick={() => run(refreshPrices)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
        Refresh prices
      </button>
      <details className="menu">
        <summary className="btn">Data ▾</summary>
        <div className="menu-pop">
          <button disabled={pending} onClick={() => run(makeBackup)}>Back up now</button>
          <button disabled={pending} onClick={() => { if (!confirm("Restore the latest backup? This replaces your current data.")) return; run(restoreLatestBackup); }}>Restore latest backup</button>
          <a href="/export">Export database (.db)</a>
        </div>
      </details>
    </div>
  );
}
