import { egp, pct } from "@/lib/format";
import type { PortfolioSummary } from "@egx/core";

export function SummaryBand({ s }: { s: PortfolioSummary }) {
  const cls = (n: number) => (n > 0 ? "gain" : n < 0 ? "loss" : "");
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
      <div className="panel"><div className="dim">Market value</div><div className="stat">{egp(s.totalMarketValue)}</div></div>
      <div className="panel"><div className="dim">Cost basis</div><div className="stat">{egp(s.totalCostBasis)}</div></div>
      <div className="panel"><div className="dim">Unrealized P&L</div><div className={`stat ${cls(s.totalUnrealizedPnl)}`}>{egp(s.totalUnrealizedPnl)} <span style={{fontSize:14}}>({pct(s.totalUnrealizedPnlPct)})</span></div></div>
      <div className="panel"><div className="dim">Realized P&L</div><div className={`stat ${cls(s.totalRealizedPnl)}`}>{egp(s.totalRealizedPnl)}</div></div>
    </div>
  );
}
