import "server-only";
import {
  getPortfolioSummary,
  listSecurities,
  listTransactions,
  getPriceHistory,
  type HoldingValuation,
  type Transaction,
} from "./core/index.js";
import { getDb } from "./db.js";

export interface SparkPoint {
  date: string;
  close: number; // piasters
}

export interface HoldingRow extends HoldingValuation {
  sector: string | null;
  dayChangePct: number | null; // fraction, vs previous close
  spark: SparkPoint[]; // recent closes (piasters), oldest -> newest
  txns: Transaction[]; // this ticker's transactions
}

export interface SectorSlice {
  sector: string;
  value: number;
  pct: number;
  color: string;
}

export interface DashboardVM {
  asOf: string | null;
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  totalRealizedPnl: number;
  dayChange: number; // piasters
  dayChangePct: number; // fraction vs previous market value
  positions: number;
  sectors: number;
  holdings: HoldingRow[];
  allocation: SectorSlice[];
  topMovers: HoldingRow[];
}

// Distinct hues in fixed order (not shades of one hue) so sectors are told apart at a glance —
// defined as CSS vars in globals.css so each mode uses its own validated (CVD-checked) steps.
const SECTOR_COLORS = [
  "var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)",
  "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)",
];

export function dashboard(): DashboardVM {
  const db = getDb();
  const s = getPortfolioSummary(db);
  const sectorByTicker = new Map(listSecurities(db).map((x) => [x.ticker, x.sector]));

  let dayChange = 0;
  let prevMarketValue = 0;

  const holdings: HoldingRow[] = s.holdings.map((h) => {
    const hist = getPriceHistory(db, h.ticker, "0000-01-01", "9999-12-31");
    const last = hist[hist.length - 1];
    const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
    let dayChangePct: number | null = null;
    if (last && prev && prev.close > 0) {
      dayChangePct = (last.close - prev.close) / prev.close;
      dayChange += (last.close - prev.close) * h.qty;
      prevMarketValue += prev.close * h.qty;
    } else if (h.marketValue !== null) {
      prevMarketValue += h.marketValue;
    }
    return {
      ...h,
      sector: sectorByTicker.get(h.ticker) ?? null,
      dayChangePct,
      spark: hist.slice(-365).map((b) => ({ date: b.date, close: b.close })), // up to ~1 year
      txns: listTransactions(db, h.ticker),
    };
  });

  const bySector = new Map<string, number>();
  for (const h of holdings) {
    if (h.marketValue !== null) {
      const key = h.sector ?? "Other";
      bySector.set(key, (bySector.get(key) ?? 0) + h.marketValue);
    }
  }
  const totalVal = s.totalMarketValue || 1;
  const allocation: SectorSlice[] = [...bySector.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value], i) => ({
      sector,
      value,
      pct: value / totalVal,
      color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    }));

  const topMovers = holdings
    .filter((h) => h.dayChangePct !== null)
    .sort((a, b) => Math.abs(b.dayChangePct!) - Math.abs(a.dayChangePct!))
    .slice(0, 4);

  return {
    asOf: s.asOf,
    totalMarketValue: s.totalMarketValue,
    totalCostBasis: s.totalCostBasis,
    totalUnrealizedPnl: s.totalUnrealizedPnl,
    totalUnrealizedPnlPct: s.totalUnrealizedPnlPct,
    totalRealizedPnl: s.totalRealizedPnl,
    dayChange,
    dayChangePct: prevMarketValue > 0 ? dayChange / prevMarketValue : 0,
    positions: holdings.length,
    sectors: new Set(holdings.map((h) => h.sector ?? "Other")).size,
    holdings,
    allocation,
    topMovers,
  };
}
