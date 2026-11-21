import type { AppState, Coin } from "../engine/types";

export const PERIODS = [
  { label: "1M", secs: 60 },
  { label: "5M", secs: 300 },
  { label: "15M", secs: 900 },
  { label: "50M", secs: 3000 },
];

/** % change over the last `secs` seconds */
export function changeOver(c: Coin, secs: number): number {
  const n = Math.round(secs / 5);
  const len = c.candles.length;
  if (len === 0) return 0;
  const idx = len - 1 - n;
  const ref = idx >= 0 ? c.candles[idx][4] : c.candles[0][1];
  if (!ref || ref <= 0) return 0;
  return (c.price / ref - 1) * 100;
}

/** Headline change used in lists */
export const listChange = (c: Coin) => changeOver(c, 900);

export function rangeStats(c: Coin) {
  let hi = 0;
  let lo = Infinity;
  let vol = 0;
  for (const k of c.candles) {
    if (k[2] > hi) hi = k[2];
    if (k[3] < lo) lo = k[3];
    vol += k[5];
  }
  if (!isFinite(lo)) lo = 0;
  return { hi, lo, vol };
}

export const marketCap = (c: Coin) => c.price * c.supply;

export function trendScore(c: Coin): number {
  if (c.rugged) return -1;
  return Math.abs(changeOver(c, 300)) + Math.abs(changeOver(c, 60)) * 2 + Math.abs(changeOver(c, 900)) * 0.4;
}

export function portfolioStats(s: AppState) {
  const priceOf = (id: string) => s.coins.find((c) => c.id === id)?.price ?? 0;
  let value = 0;
  let invested = 0;
  for (const [id, h] of Object.entries(s.holdings)) {
    value += h.amount * priceOf(id);
    invested += h.invested;
  }
  const equity = s.cash + value;
  const pl = equity - s.deposited;
  const plPct = s.deposited > 0 ? (pl / s.deposited) * 100 : 0;
  return { value, invested, equity, pl, plPct, unrealized: value - invested };
}
