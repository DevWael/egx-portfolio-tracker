"use client";
import { useState, useTransition } from "react";
import { seedDemo, refreshPrices } from "@/app/actions";

export function DataControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");
  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      {msg ? <span className="dim" style={{ fontSize: 13 }}>{msg}</span> : null}
      <button className="btn secondary" disabled={pending} onClick={() => start(async () => { await seedDemo(); setMsg("Demo data loaded."); })}>Load demo</button>
      <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await refreshPrices(); setMsg(r.message); })}>Refresh prices</button>
    </div>
  );
}
