import type { Transaction, Holding } from "../types.js";

interface Acc {
  qty: number;
  totalCost: number; // integer piasters
  realizedPnl: number; // integer piasters
}

export function deriveHoldings(transactions: Transaction[]): Holding[] {
  const sorted = [...transactions].sort(
    (a, b) => (a.tradedAt < b.tradedAt ? -1 : a.tradedAt > b.tradedAt ? 1 : a.id - b.id)
  );
  const acc = new Map<string, Acc>();

  for (const t of sorted) {
    const a = acc.get(t.ticker) ?? { qty: 0, totalCost: 0, realizedPnl: 0 };
    if (t.side === "buy") {
      a.qty += t.qty;
      a.totalCost += t.qty * t.price + t.fee;
    } else {
      const avgCost = a.qty > 0 ? a.totalCost / a.qty : 0;
      const costRemoved = Math.round(avgCost * t.qty);
      a.realizedPnl += t.qty * t.price - t.fee - Math.round(avgCost * t.qty);
      a.qty -= t.qty;
      a.totalCost -= costRemoved;
      if (a.qty <= 0) {
        a.qty = 0;
        a.totalCost = 0;
      }
    }
    acc.set(t.ticker, a);
  }

  const holdings: Holding[] = [];
  for (const [ticker, a] of acc) {
    if (a.qty > 0) {
      holdings.push({
        ticker,
        qty: a.qty,
        avgCost: Math.round(a.totalCost / a.qty),
        costBasis: a.totalCost,
        realizedPnl: a.realizedPnl,
      });
    }
  }
  return holdings.sort((x, y) => (x.ticker < y.ticker ? -1 : 1));
}
