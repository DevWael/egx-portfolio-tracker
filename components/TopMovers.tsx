import { egp, pct } from "@/lib/format";
import type { HoldingRow } from "@/lib/metrics";

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {up ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  );
}

export function TopMovers({ movers }: { movers: HoldingRow[] }) {
  return (
    <div className="panel panel-pad">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Top movers today</div>
      {movers.length === 0 ? (
        <div className="empty">No price moves yet.</div>
      ) : (
        movers.map((m) => {
          const up = (m.dayChangePct ?? 0) >= 0;
          return (
            <div className="mover" key={m.ticker}>
              <span className={`badge ${up ? "up" : "down"}`}><Arrow up={up} /></span>
              <span className="who">
                <span className="t">{m.ticker.replace(".EGX", "")}</span>
                <span className="p">{egp(m.lastClose)}</span>
              </span>
              <span className={`pct ${up ? "gain" : "loss"}`}>{pct(m.dayChangePct)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
