import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp } from "@/lib/format";
import { TickerChartStats } from "@/components/TickerChartStats";
import { readSettings, RANGE_DAYS } from "../../../lib/core/index.js";

export const dynamic = "force-dynamic";

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let sym = symbol;
  try { sym = decodeURIComponent(symbol); } catch { notFound(); } // malformed URL → 404, not 500
  const d = tickerDetail(sym);
  if (!d) notFound();
  const settings = readSettings();

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="page-title">{d.ticker}</div>
          <div className="page-sub">{d.name}{d.sector ? ` · ${d.sector}` : ""}{d.lastClose !== null ? ` · ${egp(d.lastClose)}` : ""}</div>
        </div>
        <Link href="/" className="btn">← Portfolio</Link>
      </div>

      <TickerChartStats ticker={d.ticker} bars={d.bars} lastClose={d.lastClose} position={d.position} dateFormat={settings.dateFormat} defaultRangeDays={RANGE_DAYS[settings.defaultPriceHistoryRange]} />

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
