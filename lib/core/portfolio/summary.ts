import type { DB } from "../db/connection.js";
import type { Holding, HoldingValuation, PortfolioSummary } from "../types.js";
import { deriveHoldingsWithRealized } from "./holdings.js";
import { listTransactions } from "../repositories/transactions.js";
import { getLatestPrice, getLatestPriceDate } from "../repositories/prices.js";

export function valueHoldings(db: DB, holdings: Holding[]): HoldingValuation[] {
  return holdings.map((h) => {
    const price = getLatestPrice(db, h.ticker);
    if (!price) {
      return { ...h, lastClose: null, lastCloseDate: null, marketValue: null, unrealizedPnl: null, unrealizedPnlPct: null };
    }
    const marketValue = price.close * h.qty;
    const unrealizedPnl = marketValue - h.costBasis;
    const unrealizedPnlPct = h.costBasis > 0 ? unrealizedPnl / h.costBasis : 0;
    return {
      ...h,
      lastClose: price.close,
      lastCloseDate: price.date,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
    };
  });
}

export function getPortfolioSummary(db: DB): PortfolioSummary {
  const derived = deriveHoldingsWithRealized(listTransactions(db));
  const holdings = valueHoldings(db, derived.holdings);
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  const totalRealizedPnl = derived.totalRealizedPnl;
  for (const h of holdings) {
    if (h.marketValue !== null) {
      totalMarketValue += h.marketValue;
      totalCostBasis += h.costBasis;
    }
  }
  const totalUnrealizedPnl = totalMarketValue - totalCostBasis;
  return {
    asOf: getLatestPriceDate(db),
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct: totalCostBasis > 0 ? totalUnrealizedPnl / totalCostBasis : 0,
    totalRealizedPnl,
    holdings,
  };
}
