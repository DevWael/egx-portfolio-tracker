import { dashboard } from "@/lib/metrics";
import { StatCards } from "@/components/StatCards";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AllocationDonut } from "@/components/AllocationDonut";
import { TopMovers } from "@/components/TopMovers";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const vm = dashboard();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Portfolio</div>
        <div className="page-sub">Your EGX positions, valued at the last market close.</div>
      </div>
      <StatCards vm={vm} />
      <div className="grid dash-grid">
        <HoldingsTable holdings={vm.holdings} />
        <div className="grid" style={{ gap: 18 }}>
          <AllocationDonut allocation={vm.allocation} />
          <TopMovers movers={vm.topMovers} />
        </div>
      </div>
    </div>
  );
}
