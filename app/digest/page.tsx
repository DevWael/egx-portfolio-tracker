import { data } from "@/lib/data";
import { egp, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DigestPage() {
  const d = data.digest();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Daily digest</div>
        <div className="page-sub">{d.date ? `Prices as of ${d.date}` : "No prices yet — load demo or refresh."}</div>
      </div>

      <div className="grid stat-grid">
        <div className="panel stat">
          <div className="k">Portfolio value</div>
          <div className="v">{egp(d.totalMarketValue)}</div>
        </div>
        <div className="panel stat">
          <div className="k">Unrealized P&amp;L</div>
          <div className={`v ${d.totalUnrealizedPnl >= 0 ? "gain" : "loss"}`}>{egp(d.totalUnrealizedPnl)}</div>
          <div className="foot">{pct(d.totalUnrealizedPnlPct)} all-time</div>
        </div>
      </div>

      <div className="panel panel-pad">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Triggered alerts ({d.triggered.length})</div>
        {d.triggered.length === 0
          ? <div className="dim">No alerts crossed at the latest close.</div>
          : d.triggered.map((t) => (
              <div key={t.alert.id} style={{ padding: "6px 0" }}>
                <span className="tag crossed">{t.alert.ticker}</span> {t.alert.direction} {egp(t.alert.targetPrice)} — crossed at {egp(t.lastClose)} ({t.lastCloseDate})
              </div>
            ))}
      </div>

      <div className="panel panel-pad">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top movers <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· by unrealized P&amp;L</span></div>
        {d.topMovers.length === 0
          ? <div className="dim">No holdings yet.</div>
          : d.topMovers.map((m) => (
              <div key={m.ticker} style={{ padding: "6px 0" }}>
                {m.ticker} <span className={(m.unrealizedPnlPct ?? 0) >= 0 ? "gain" : "loss"}>{pct(m.unrealizedPnlPct)}</span> <span className="dim">({egp(m.unrealizedPnl)})</span>
              </div>
            ))}
      </div>
    </div>
  );
}
