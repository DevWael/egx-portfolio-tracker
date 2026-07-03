"use client";
import { useState } from "react";
import { egp, pct } from "@/lib/format";
import { computeStats, type StatBar } from "@/lib/stats";
import { PriceChart } from "@/components/PriceChart";
import type { HoldingValuation } from "@egx/core";

const sign = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");
const rangeLabel = (p: number | null) => (p === 7 ? "1-week" : p === 30 ? "1-month" : p === 90 ? "3-month" : p === 180 ? "6-month" : p === 365 ? "52-week" : "All-time");

function RangeBar({ low, high, last, pctFromLow, pctFromHigh }: { low: number; high: number; last: number; pctFromLow: number | null; pctFromHigh: number | null }) {
  const pos = high > low ? Math.min(100, Math.max(0, ((last - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="range-track">
        <div className="range-fill" style={{ width: `${pos}%` }} />
        <div className="range-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="range-ends">
        <span><span className="muted">Period low</span><b>{egp(low)}</b></span>
        <span><span className="muted">Period high</span><b>{egp(high)}</b></span>
      </div>
      {pctFromLow !== null && pctFromHigh !== null ? (
        <div className="range-caption">Current <b>{egp(last)}</b> — <span className="gain">{pct(pctFromLow)}</span> from low · <span className="loss">{pct(pctFromHigh)}</span> from high</div>
      ) : null}
    </div>
  );
}

export function TickerChartStats({ ticker, bars, lastClose, position }: { ticker: string; bars: StatBar[]; lastClose: number | null; position: HoldingValuation | null }) {
  const [period, setPeriod] = useState<number | null>(null); // null = Max; synced from the chart's period buttons
  const windowBars = period ? bars.slice(-period) : bars;
  const w = computeStats(windowBars);
  const full = computeStats(bars);
  const chartPoints = bars.map((b) => ({ date: b.date, close: b.close }));
  const hasRange = w.high52 !== null && w.low52 !== null && lastClose !== null && w.high52 > w.low52;
  const posPct = hasRange ? Math.round(((lastClose! - w.low52!) / (w.high52! - w.low52!)) * 100) : null;
  const returns: [string, number | null][] = [["1M", full.returns.m1], ["3M", full.returns.m3], ["6M", full.returns.m6], ["YTD", full.returns.ytd], ["1Y", full.returns.y1]];

  return (
    <>
      <div className="panel panel-pad">
        <PriceChart points={chartPoints} id={ticker.replace(/\W/g, "")} height={320} onPeriodChange={setPeriod} />
      </div>

      <div className="panel panel-pad">
        <div className="section-label">Your position</div>
        {position ? (
          <div className="kpi-row">
            <div className="kpi"><span className="k">Quantity</span><span className="v">{position.qty.toLocaleString()}</span></div>
            <div className="kpi"><span className="k">Avg cost</span><span className="v">{egp(position.avgCost)}</span></div>
            <div className="kpi"><span className="k">Market value</span><span className="v">{egp(position.marketValue)}</span></div>
            <div className="kpi"><span className="k">Unrealized P&amp;L</span><span className={`v ${sign(position.unrealizedPnl)}`}>{egp(position.unrealizedPnl)} <small>({pct(position.unrealizedPnlPct)})</small></span></div>
          </div>
        ) : <div className="dim">Not in your portfolio.</div>}
      </div>

      <div className="panel panel-pad">
        <div className="section-head">
          <span className="section-label">{rangeLabel(period)} range</span>
          {posPct !== null ? <span className="range-pct">{posPct}% of range</span> : null}
        </div>
        {hasRange
          ? <RangeBar low={w.low52!} high={w.high52!} last={lastClose!} pctFromLow={w.pctFromLow} pctFromHigh={w.pctFromHigh} />
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
          <div className="section-head">
            <span className="section-label">Risk &amp; volume</span>
            <span className="range-pct">{rangeLabel(period)}</span>
          </div>
          <div className="stat-lines">
            <div className="stat-line"><span>Volatility (annualized)</span><span>{w.volatilityAnnual === null ? "—" : `${(w.volatilityAnnual * 100).toFixed(2)}%`}</span></div>
            <div className="stat-line"><span>Max drawdown</span><span className={sign(w.maxDrawdown)}>{pct(w.maxDrawdown)}</span></div>
            <div className="stat-line"><span>Avg volume</span><span>{w.avgVolume === null ? "—" : Math.round(w.avgVolume).toLocaleString()}</span></div>
            <div className="stat-line"><span>Last volume</span><span>{w.lastVolume === null ? "—" : w.lastVolume.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
