import { egp, pct } from "@/lib/format";
import type { DashboardVM } from "@/lib/metrics";

function Signed({ piasters }: { piasters: number }) {
  const up = piasters >= 0;
  return (
    <span className={up ? "gain" : "loss"}>
      {up ? "▲" : "▼"} {up ? "+" : "−"}{egp(Math.abs(piasters))}
    </span>
  );
}

export function StatCards({ vm }: { vm: DashboardVM }) {
  return (
    <div className="grid stat-grid">
      <div className="panel stat">
        <div className="k">Market value</div>
        <div className="v">{egp(vm.totalMarketValue)}</div>
        <div className="foot">Total invested {egp(vm.totalCostBasis)}</div>
      </div>
      <div className="panel stat">
        <div className="k">Unrealized P&amp;L</div>
        <div className="v"><Signed piasters={vm.totalUnrealizedPnl} /></div>
        <div className="foot">{pct(vm.totalUnrealizedPnlPct)} all-time</div>
      </div>
      <div className="panel stat">
        <div className="k">Day change</div>
        <div className="v"><Signed piasters={vm.dayChange} /></div>
        <div className="foot">{pct(vm.dayChangePct)} since prev. close</div>
      </div>
      <div className="panel stat">
        <div className="k">Positions</div>
        <div className="v">{vm.positions}</div>
        <div className="foot">across {vm.sectors} sector{vm.sectors === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}
