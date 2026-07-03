"use client";
import { useState, useTransition } from "react";
import { seedDemo, refreshPrices } from "@/app/actions";

export function DataControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");
  return (
    <div className="row-flex" style={{ gap: 8 }}>
      {msg ? <span className="dim" style={{ fontSize: 12.5 }}>{msg}</span> : null}
      <button className="btn" disabled={pending} onClick={() => {
        if (!confirm("Replace ALL your data with demo data?\n\nThis clears your current holdings, transactions, and alerts. This can't be undone.")) return;
        start(async () => { await seedDemo(); setMsg("Demo data loaded."); });
      }}>Load demo</button>
      <button className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await refreshPrices(); setMsg(r.message); })}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
        Refresh prices
      </button>
    </div>
  );
}
