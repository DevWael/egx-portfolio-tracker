import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";

export const dynamic = "force-dynamic";

const sign = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");

function RangeBar({ low, high, last, pctFromLow, pctFromHigh }: { low: number; high: number; last: number; pctFromLow: number | null; pctFromHigh: number | null }) {
  const pos = high > low ? Math.min(100, Math.max(0, ((last - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="range-track">
        <div className="range-fill" style={{ width: `${pos}%` }} />
        <div className="range-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="range-ends">
        <span>Low <b>{egp(low)}</b>{pctFromLow !== null ? <> · <span className="gain">{pct(pctFromLow)}</span></> : null}</span>
        <span style={{ textAlign: "right" }}>High <b>{egp(high)}</b>{pctFromHigh !== null ? <> · <span className="loss">{pct(pctFromHigh)}</span></> : null}</span>
      </div>
    </div>
  );
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let sym = symbol;
  try { sym = decodeURIComponent(symbol); } catch { notFound(); } // malformed URL → 404, not 500
  const d = tickerDetail(sym);
  if (!d) notFound();
  const s = d.stats;
  const returns: [string, number | null][] = [["1M", s.returns.m1], ["3M", s.returns.m3], ["6M", s.returns.m6], ["YTD", s.returns.ytd], ["1Y", s.returns.y1]];
  const hasRange = s.high52 !== null && s.low52 !== null && d.lastClose !== null && s.high52 > s.low52;

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

      <div className="panel panel-pad">
        <div className="section-label">Your position</div>
        {d.position ? (
          <div className="kpi-row">
            <div className="kpi"><span className="k">Quantity</span><span className="v">{d.position.qty.toLocaleString()}</span></div>
            <div className="kpi"><span className="k">Avg cost</span><span className="v">{egp(d.position.avgCost)}</span></div>
            <div className="kpi"><span className="k">Market value</span><span className="v">{egp(d.position.marketValue)}</span></div>
            <div className="kpi"><span className="k">Unrealized P&amp;L</span><span className={`v ${sign(d.position.unrealizedPnl)}`}>{egp(d.position.unrealizedPnl)} <small>({pct(d.position.unrealizedPnlPct)})</small></span></div>
          </div>
        ) : <div className="dim">Not in your portfolio.</div>}
      </div>

      <div className="panel panel-pad">
        <div className="section-head">
          <span className="section-label">52-week range</span>
          {d.lastClose !== null ? <span className="range-price">{egp(d.lastClose)}</span> : null}
        </div>
        {hasRange
          ? <RangeBar low={s.low52!} high={s.high52!} last={d.lastClose!} pctFromLow={s.pctFromLow} pctFromHigh={s.pctFromHigh} />
          : <div className="dim">Not enough price history.</div>}
      </div>

      <div className="grid two-col">
        <div className="panel panel-pad">
          <div className="section-label">Returns</div>
          <div className="returns-row">
            {returns.map(([k, v]) => (
              <div className="ret" key={k}><span className="k">{k}</span><span className={`v ${sign(v)}`}>{pct(v)}</span></div>
            ))}
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="section-label">Risk &amp; volume</div>
          <div className="stat-lines">
            <div className="stat-line"><span>Volatility (annualized)</span><span>{s.volatilityAnnual === null ? "—" : `${(s.volatilityAnnual * 100).toFixed(2)}%`}</span></div>
            <div className="stat-line"><span>Max drawdown</span><span className={sign(s.maxDrawdown)}>{pct(s.maxDrawdown)}</span></div>
            <div className="stat-line"><span>Avg volume</span><span>{s.avgVolume === null ? "—" : Math.round(s.avgVolume).toLocaleString()}</span></div>
            <div className="stat-line"><span>Last volume</span><span>{s.lastVolume === null ? "—" : s.lastVolume.toLocaleString()}</span></div>
          </div>
        </div>
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
