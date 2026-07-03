import "server-only";
import {
  getPortfolioSummary,
  listTransactions,
  listSecurities,
  listAlerts,
  buildDigest,
} from "@egx/core";
import { getDb } from "./db.js";

export const data = {
  summary: () => getPortfolioSummary(getDb()),
  transactions: () => listTransactions(getDb()),
  securities: () => listSecurities(getDb()),
  alerts: () => listAlerts(getDb()),
  digest: () => buildDigest(getDb()),
};
