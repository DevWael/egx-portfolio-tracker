import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";

export const dynamic = "force-dynamic";

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="panel stat"><div className="k">{label}</div><div className={`v ${cls ?? ""}`} style={{ fontSize: 18 }}>{value}</div></div>;
}
const sign = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let sym = symbol;
  try { sym = decodeURIComponent(symbol); } catch { notFound(); } // malformed URL → 404, not 500
  const d = tickerDetail(sym);
  if (!d) notFound();
  const s = d.stats;
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="page-title">{d.ticker}</div>
          <div className="page-sub">{d.name}{d.sector ? ` · ${d.sector}` : ""}{d.lastClose !== null ? ` · ${egp(d.lastClose)}` : ""}</div>
        </div>
        <Link href="/" className="btn">← Portfolio</Link>
      </div>

      <div className="panel panel-pad">
        <PriceChart points={d.history} id={d.ticker.replace(/\W/g, "")} height={320} />
      </div>

      <div className="grid stat-grid">
        {d.position ? (
          <>
            <Stat label="Your qty" value={d.position.qty.toLocaleString()} />
            <Stat label="Avg cost" value={egp(d.position.avgCost)} />
            <Stat label="Market value" value={egp(d.position.marketValue)} />
            <Stat label="Unrealized P&L" value={`${egp(d.position.unrealizedPnl)} (${pct(d.position.unrealizedPnlPct)})`} cls={sign(d.position.unrealizedPnl)} />
          </>
        ) : (
          <div className="panel stat"><div className="k">Position</div><div className="v" style={{ fontSize: 16 }}>Not in your portfolio</div></div>
        )}
      </div>

      <div className="grid stat-grid">
        <Stat label="52-week high" value={egp(s.high52)} />
        <Stat label="52-week low" value={egp(s.low52)} />
        <Stat label="From high" value={pct(s.pctFromHigh)} cls={sign(s.pctFromHigh)} />
        <Stat label="From low" value={pct(s.pctFromLow)} cls={sign(s.pctFromLow)} />
        <Stat label="Return 1M" value={pct(s.returns.m1)} cls={sign(s.returns.m1)} />
        <Stat label="Return 3M" value={pct(s.returns.m3)} cls={sign(s.returns.m3)} />
        <Stat label="Return 6M" value={pct(s.returns.m6)} cls={sign(s.returns.m6)} />
        <Stat label="Return YTD" value={pct(s.returns.ytd)} cls={sign(s.returns.ytd)} />
        <Stat label="Return 1Y" value={pct(s.returns.y1)} cls={sign(s.returns.y1)} />
        <Stat label="Volatility (ann.)" value={pct(s.volatilityAnnual)} />
        <Stat label="Max drawdown" value={pct(s.maxDrawdown)} cls={sign(s.maxDrawdown)} />
        <Stat label="Avg volume" value={s.avgVolume === null ? "—" : Math.round(s.avgVolume).toLocaleString()} />
        <Stat label="Last volume" value={s.lastVolume === null ? "—" : s.lastVolume.toLocaleString()} />
      </div>

      <div className="panel">
        <div className="panel-head">Transaction history <span className="hint">{d.txns.length} entr{d.txns.length === 1 ? "y" : "ies"}</span></div>
        <div className="overflow-x">
          <table>
            <thead><tr><th>Date</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Note</th></tr></thead>
            <tbody>
              {d.txns.length === 0 ? <tr><td colSpan={6} className="empty">No transactions.</td></tr> : d.txns.map((t) => (
                <tr key={t.id}>
                  <td>{t.tradedAt}</td>
                  <td><span className={`tag ${t.side === "buy" ? "crossed" : "off"}`}>{t.side}</span></td>
                  <td>{t.qty.toLocaleString()}</td><td>{egp(t.price)}</td><td>{egp(t.fee)}</td>
                  <td className="dim" style={{ textAlign: "left" }}>{t.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
