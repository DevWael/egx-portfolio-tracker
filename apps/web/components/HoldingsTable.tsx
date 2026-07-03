"use client";
import { useState } from "react";
import Link from "next/link";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import type { HoldingRow } from "@/lib/metrics";

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel">
      <div className="panel-head">Holdings <span className="hint">{holdings.length === 0 ? "" : "Click a row for detail · "}{holdings.length} position{holdings.length === 1 ? "" : "s"}</span></div>
      {holdings.length === 0 ? (
        <div className="empty">No holdings yet. Load demo data or add a transaction.</div>
      ) : (
        <div className="overflow-x">
          <table>
            <thead><tr><th>Ticker</th><th>Qty</th><th>Avg cost</th><th>Last close</th><th>Mkt value</th><th>Unrealized P&amp;L</th><th>Day</th></tr></thead>
            <tbody>{holdings.map((h) => <RowGroup key={h.ticker} h={h} isOpen={open === h.ticker} onToggle={() => setOpen(open === h.ticker ? null : h.ticker)} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({ h, isOpen, onToggle }: { h: HoldingRow; isOpen: boolean; onToggle: () => void }) {
  const pnlCls = h.unrealizedPnl === null ? "" : h.unrealizedPnl > 0 ? "gain" : h.unrealizedPnl < 0 ? "loss" : "";
  const dayCls = h.dayChangePct === null ? "muted" : h.dayChangePct > 0 ? "gain" : h.dayChangePct < 0 ? "loss" : "";
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--label)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M9 6l6 6-6 6" /></svg>
            <span>{h.ticker}{h.sector ? <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{h.sector}</div> : null}</span>
          </span>
        </td>
        <td>{h.qty.toLocaleString()}</td>
        <td>{egp(h.avgCost)}</td>
        <td>{egp(h.lastClose)}</td>
        <td>{egp(h.marketValue)}</td>
        <td className={pnlCls}>{egp(h.unrealizedPnl)}{h.unrealizedPnlPct !== null ? <div style={{ fontSize: 12, fontWeight: 400 }} className={pnlCls}>{pct(h.unrealizedPnlPct)}</div> : null}</td>
        <td className={dayCls}>{h.dayChangePct === null ? "—" : pct(h.dayChangePct)}</td>
      </tr>
      {isOpen ? (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="detail-grid">
              <div>
                <PriceChart points={h.spark} id={h.ticker.replace(/\W/g, "")} />
                <Link href={`/ticker/${encodeURIComponent(h.ticker)}`} className="btn" style={{ marginTop: 12, display: "inline-flex" }}>View details →</Link>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Transaction history</div>
                {h.txns.length === 0 ? <div className="dim" style={{ fontSize: 13 }}>None.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {h.txns.map((t) => (
                      <div key={t.id} style={{ display: "flex", gap: 12, fontSize: 13, alignItems: "center" }}>
                        <span className={`tag ${t.side === "buy" ? "crossed" : "off"}`} style={{ minWidth: 46, justifyContent: "center", textTransform: "uppercase" }}>{t.side}</span>
                        <span className="dim" style={{ width: 92 }}>{t.tradedAt}</span>
                        <span>{t.qty.toLocaleString()} @ {egp(t.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
