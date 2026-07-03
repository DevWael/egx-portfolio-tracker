import { egp, pct } from "@/lib/format";
import type { HoldingRow } from "@/lib/metrics";

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">Holdings <span className="hint">{holdings.length} position{holdings.length === 1 ? "" : "s"}</span></div>
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
                return (
                  <tr key={h.ticker}>
                    <td>
                      {h.ticker}
                      {h.sector ? <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{h.sector}</div> : null}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
