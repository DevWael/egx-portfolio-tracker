import { data } from "@/lib/data";
import { SummaryBand } from "@/components/SummaryBand";
import { HoldingsTable } from "@/components/HoldingsTable";
import { DigestCard } from "@/components/DigestCard";
import { DataControls } from "@/components/DataControls";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const s = data.summary();
  const d = data.digest();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Portfolio {s.asOf ? <span className="dim" style={{ fontSize: 14 }}>· prices as of {s.asOf}</span> : null}</h1>
        <DataControls />
      </div>
      <SummaryBand s={s} />
      <HoldingsTable holdings={s.holdings} />
      <DigestCard d={d} />
    </div>
  );
}
