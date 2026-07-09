import { dashboard } from "@/lib/metrics";
import { StatCards } from "@/components/StatCards";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AllocationDonut } from "@/components/AllocationDonut";
import { TopMovers } from "@/components/TopMovers";
import { readSettings, RANGE_DAYS } from "../lib/core/index.js";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const vm = dashboard();
  const settings = readSettings();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Portfolio</div>
        <div className="page-sub">Your EGX positions, valued at the last market close.</div>
      </div>
      <StatCards vm={vm} />
      <div className="grid dash-grid">
        <HoldingsTable holdings={vm.holdings} dateFormat={settings.dateFormat} defaultRangeDays={RANGE_DAYS[settings.defaultPriceHistoryRange]} />
        <div className="grid" style={{ gap: 18 }}>
          <AllocationDonut allocation={vm.allocation} />
          <TopMovers movers={vm.topMovers} />
        </div>
      </div>
    </div>
  );
}
