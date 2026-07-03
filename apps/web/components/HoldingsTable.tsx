import { egp, pct } from "@/lib/format";
import type { HoldingValuation } from "@egx/core";

export function HoldingsTable({ holdings }: { holdings: HoldingValuation[] }) {
  if (holdings.length === 0) {
    return <div className="panel dim">No holdings yet. Add a transaction, or load demo data from the dashboard header.</div>;
  }
  const cls = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");
  return (
    <div className="panel overflow-x">
      <table>
        <thead><tr>
          <th>Ticker</th><th>Qty</th><th>Avg cost</th><th>Last</th><th>Mkt value</th><th>Unrealized</th><th>P&L %</th>
        </tr></thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.ticker}>
              <td>{h.ticker}</td>
              <td>{h.qty.toLocaleString()}</td>
              <td>{egp(h.avgCost)}</td>
              <td>{egp(h.lastClose)}</td>
              <td>{egp(h.marketValue)}</td>
              <td className={cls(h.unrealizedPnl)}>{egp(h.unrealizedPnl)}</td>
              <td className={cls(h.unrealizedPnlPct)}>{pct(h.unrealizedPnlPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
