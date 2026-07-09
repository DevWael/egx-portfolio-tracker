import type { DB } from "../db/connection.js";
import type { HoldingValuation, TriggeredAlert } from "../types.js";
import { getPortfolioSummary } from "../portfolio/summary.js";
import { evaluateAlerts } from "../alerts/evaluate.js";

export interface Digest {
  date: string | null;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  triggered: TriggeredAlert[];
  topMovers: HoldingValuation[];
}

export function buildDigest(db: DB): Digest {
  const summary = getPortfolioSummary(db);
  const triggered = evaluateAlerts(db);
  const topMovers = summary.holdings
    .filter((h) => h.unrealizedPnlPct !== null)
    .sort((a, b) => Math.abs(b.unrealizedPnlPct!) - Math.abs(a.unrealizedPnlPct!))
    .slice(0, 3);
  return {
    date: summary.asOf,
    totalMarketValue: summary.totalMarketValue,
    totalUnrealizedPnl: summary.totalUnrealizedPnl,
    totalUnrealizedPnlPct: summary.totalUnrealizedPnlPct,
    triggered,
    topMovers,
  };
}
