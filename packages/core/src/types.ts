/** Integer minor units of EGP. 1 EGP = 100 piasters. */
export type Piasters = number;

export type Side = "buy" | "sell";
export type AlertDirection = "above" | "below";

export interface Security {
  ticker: string; // e.g. "COMI.EGX"
  name: string;
  sector: string | null;
  currency: string; // "EGP"
}

export interface Transaction {
  id: number;
  ticker: string;
  side: Side;
  qty: number; // integer shares
  price: Piasters; // per share
  fee: Piasters;
  tradedAt: string; // "YYYY-MM-DD"
  note: string | null;
}

export interface NewTransaction {
  ticker: string;
  side: Side;
  qty: number;
  price: Piasters;
  fee?: Piasters; // default 0
  tradedAt?: string; // default today
  note?: string | null;
}

export interface PriceBar {
  ticker: string;
  date: string; // "YYYY-MM-DD"
  open: Piasters;
  high: Piasters;
  low: Piasters;
  close: Piasters;
  volume: number;
  source: string; // "eodhd"
}

export interface Holding {
  ticker: string;
  qty: number; // net shares held (>= 0)
  avgCost: Piasters; // weighted avg cost per remaining share
  costBasis: Piasters; // total cost of remaining shares
  realizedPnl: Piasters; // realized from sells to date
}

export interface HoldingValuation extends Holding {
  lastClose: Piasters | null;
  lastCloseDate: string | null;
  marketValue: Piasters | null;
  unrealizedPnl: Piasters | null;
  unrealizedPnlPct: number | null; // decimal fraction
}

export interface PortfolioSummary {
  asOf: string | null; // latest price date across holdings
  totalMarketValue: Piasters;
  totalCostBasis: Piasters;
  totalUnrealizedPnl: Piasters;
  totalUnrealizedPnlPct: number; // decimal fraction
  totalRealizedPnl: Piasters;
  holdings: HoldingValuation[];
}

export interface Alert {
  id: number;
  ticker: string;
  targetPrice: Piasters;
  direction: AlertDirection;
  active: boolean;
  note: string | null;
  createdAt: string;
  triggeredAt: string | null;
}

export interface NewAlert {
  ticker: string;
  targetPrice: Piasters;
  direction: AlertDirection;
  note?: string | null;
}

export interface TriggeredAlert {
  alert: Alert;
  lastClose: Piasters;
  lastCloseDate: string;
}
