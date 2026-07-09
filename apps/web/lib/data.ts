import "server-only";
import {
  getPortfolioSummary,
  listTransactions,
  listSecurities,
  listAlerts,
  evaluateAlerts,
  buildDigest,
} from "./core/index.js";
import { getDb } from "./db.js";

export const data = {
  summary: () => getPortfolioSummary(getDb()),
  transactions: () => listTransactions(getDb()),
  securities: () => listSecurities(getDb()),
  alerts: () => listAlerts(getDb()),
  /** Evaluate active alerts against the latest close, stamping any newly crossed. */
  evaluate: () => evaluateAlerts(getDb()),
  digest: () => buildDigest(getDb()),
};
