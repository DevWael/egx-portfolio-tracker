import { egp, pct } from "@/lib/format";
import type { Digest } from "@egx/core";

export function DigestCard({ d }: { d: Digest }) {
  return (
    <div className="panel grid" style={{ gap: 12 }}>
      <div style={{ fontWeight: 700 }}>Daily digest {d.date ? <span className="dim">· prices as of {d.date}</span> : null}</div>
      <div>
        <div className="dim">Triggered alerts ({d.triggered.length})</div>
        {d.triggered.length === 0 ? <div className="dim">None</div> : d.triggered.map((t) => (
          <div key={t.alert.id}>• {t.alert.ticker} {t.alert.direction} {egp(t.alert.targetPrice)} — crossed at {egp(t.lastClose)}</div>
        ))}
      </div>
      <div>
        <div className="dim">Top movers</div>
        {d.topMovers.length === 0 ? <div className="dim">None</div> : d.topMovers.map((m) => (
          <div key={m.ticker}>• {m.ticker} <span className={m.unrealizedPnlPct && m.unrealizedPnlPct > 0 ? "gain" : "loss"}>{pct(m.unrealizedPnlPct)}</span></div>
        ))}
      </div>
    </div>
  );
}
