"use client";
import { useState } from "react";
import { egp, pct } from "@/lib/format";
import type { HoldingRow } from "@/lib/metrics";

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <div className="dim" style={{ fontSize: 13 }}>Not enough price history yet.</div>;
  const w = 260, h = 60, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = up ? "var(--green)" : "var(--red)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel">
      <div className="panel-head">
        Holdings
        <span className="hint">{holdings.length === 0 ? "" : "Click a row for detail · "}{holdings.length} position{holdings.length === 1 ? "" : "s"}</span>
      </div>
      {holdings.length === 0 ? (
        <div className="empty">No holdings yet. Load demo data or add a transaction.</div>
      ) : (
        <div className="overflow-x">
          <table>
            <thead>
              <tr>
                <th>Ticker</th><th>Qty</th><th>Avg cost</th><th>Last close</th>
                <th>Mkt value</th><th>Unrealized P&amp;L</th><th>Day</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const pnlCls = h.unrealizedPnl === null ? "" : h.unrealizedPnl > 0 ? "gain" : h.unrealizedPnl < 0 ? "loss" : "";
                const dayCls = h.dayChangePct === null ? "muted" : h.dayChangePct > 0 ? "gain" : h.dayChangePct < 0 ? "loss" : "";
                const isOpen = open === h.ticker;
                return (
                  <RowGroup key={h.ticker} isOpen={isOpen} onToggle={() => setOpen(isOpen ? null : h.ticker)} h={h} pnlCls={pnlCls} dayCls={dayCls} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({ h, isOpen, onToggle, pnlCls, dayCls }: {
  h: HoldingRow; isOpen: boolean; onToggle: () => void; pnlCls: string; dayCls: string;
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--label)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M9 6l6 6-6 6" /></svg>
            <span>
              {h.ticker}
              {h.sector ? <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{h.sector}</div> : null}
            </span>
          </span>
        </td>
        <td>{h.qty.toLocaleString()}</td>
        <td>{egp(h.avgCost)}</td>
        <td>{egp(h.lastClose)}</td>
        <td>{egp(h.marketValue)}</td>
        <td className={pnlCls}>
          {egp(h.unrealizedPnl)}
          {h.unrealizedPnlPct !== null ? <div style={{ fontSize: 12, fontWeight: 400 }} className={pnlCls}>{pct(h.unrealizedPnlPct)}</div> : null}
        </td>
        <td className={dayCls}>{h.dayChangePct === null ? "—" : pct(h.dayChangePct)}</td>
      </tr>
      {isOpen ? (
        <tr className="detail-row">
          <td colSpan={7} style={{ background: "var(--panel-2)" }}>
            <div className="detail-grid">
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Last {h.spark.length} closes</div>
                <Sparkline values={h.spark} up={(h.dayChangePct ?? h.unrealizedPnlPct ?? 0) >= 0} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Transaction history</div>
                {h.txns.length === 0 ? <div className="dim" style={{ fontSize: 13 }}>None.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {h.txns.map((t) => (
                      <div key={t.id} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center" }}>
                        <span className="dim" style={{ width: 82 }}>{t.tradedAt}</span>
                        <span className={`tag ${t.side === "buy" ? "crossed" : "off"}`} style={{ minWidth: 40, justifyContent: "center" }}>{t.side}</span>
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
