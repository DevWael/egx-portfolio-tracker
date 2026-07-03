import type { DB } from "../db/connection.js";
import type { TriggeredAlert } from "../types.js";
import { listAlerts, markTriggered } from "../repositories/watchlist.js";
import { getLatestPrice } from "../repositories/prices.js";

export function evaluateAlerts(db: DB): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  for (const alert of listAlerts(db, true)) {
    if (alert.triggeredAt) continue;
    const price = getLatestPrice(db, alert.ticker);
    if (!price) continue;
    const hit =
      alert.direction === "above"
        ? price.close >= alert.targetPrice
        : price.close <= alert.targetPrice;
    if (hit) {
      markTriggered(db, alert.id, price.date);
      triggered.push({ alert: { ...alert, triggeredAt: price.date }, lastClose: price.close, lastCloseDate: price.date });
    }
  }
  return triggered;
}
