export interface StatBar { date: string; close: number; volume: number }
export interface TickerStats {
  high52: number | null; low52: number | null;
  pctFromHigh: number | null; pctFromLow: number | null;
  returns: { m1: number | null; m3: number | null; m6: number | null; ytd: number | null; y1: number | null };
  volatilityAnnual: number | null;
  maxDrawdown: number | null;
  avgVolume: number | null; lastVolume: number | null;
}

export function returnOver(closes: number[], n: number): number | null {
  const L = closes.length - 1;
  const base = closes[L - n];
  if (L - n < 0 || !base) return null;
  return (closes[L] - base) / base;
}

export function annualizedVol(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function maxDrawdown(closes: number[]): number | null {
  if (closes.length === 0) return null;
  let peak = closes[0], mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) mdd = Math.min(mdd, (c - peak) / peak);
  }
  return mdd;
}

export function computeStats(bars: StatBar[]): TickerStats {
  const empty: TickerStats = {
    high52: null, low52: null, pctFromHigh: null, pctFromLow: null,
    returns: { m1: null, m3: null, m6: null, ytd: null, y1: null },
    volatilityAnnual: null, maxDrawdown: null, avgVolume: null, lastVolume: null,
  };
  if (bars.length === 0) return empty;

  const closes = bars.map((b) => b.close);
  const L = closes.length - 1;
  const last = closes[L];

  const win = bars.slice(-252);
  const wCloses = win.map((b) => b.close);
  const high52 = Math.max(...wCloses);
  const low52 = Math.min(...wCloses);

  // YTD: baseline = last close of the previous year, else the first bar
  const year = bars[L].date.slice(0, 4);
  let ytdBase = closes[0];
  for (let i = L; i >= 0; i--) { if (bars[i].date.slice(0, 4) < year) { ytdBase = closes[i]; break; } }
  const ytd = ytdBase > 0 ? (last - ytdBase) / ytdBase : null;

  const vols = win.map((b) => b.volume);
  return {
    high52, low52,
    pctFromHigh: high52 > 0 ? (last - high52) / high52 : null,
    pctFromLow: low52 > 0 ? (last - low52) / low52 : null,
    returns: {
      m1: returnOver(closes, 21), m3: returnOver(closes, 63),
      m6: returnOver(closes, 126), y1: returnOver(closes, 252), ytd,
    },
    volatilityAnnual: annualizedVol(closes),
    maxDrawdown: maxDrawdown(closes),
    avgVolume: vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null,
    lastVolume: bars[L].volume,
  };
}
