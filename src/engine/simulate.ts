/**
 * RLC Patch — Fast-forward simulation fix.
 * 
 * Root cause of mass rugs: stepCoin with quiet=false fires rug logic every tick.
 * Over 86400 ticks/day even a rugRisk of 1e-5 gives P(rug) = 1-(1-1e-5)^86400 ≈ 58% per day.
 * Fix: run ticks in quiet mode (no rug/warn logic), then apply a single
 * end-of-day rug lottery using realistic daily probabilities.
 */
import type { AppState, Coin, FeedItem, HistoryItem } from "./types";
import { stepCoin, stepMarket, globalEvent } from "./market";
import type { MarketState } from "./types";

// Candles are recorded in 5-second buckets, so simulating every real-time
// second adds work without adding observable chart detail.
const SIM_STEP_SECONDS = 5;
const TICKS_PER_DAY = 86400 / SIM_STEP_SECONDS;

// Max daily rug probability regardless of rugRisk value.
// Even the shadiest coins shouldn't rug >15% chance per simulated day.
const MAX_DAILY_RUG_PROB = 0.15;
const MAX_SIM_PRICE = 1e9;

export interface SimulateOptions {
  days: number;
  mode?: "realistic" | "unrealistic";
  onProgress?: (pct: number, day: number) => void;
  chunkSize?: number;
}

export interface SimulateResult {
  coins: Coin[];
  market: MarketState;
  tick: number;
  feedAppend: FeedItem[];
  historyAppend: HistoryItem[];
  summary: DaySummary[];
}

export interface DaySummary {
  day: number;
  gainers: number;
  losers: number;
  rugs: number;
  topGainer: { ticker: string; pct: number } | null;
  topLoser: { ticker: string; pct: number } | null;
}

function cloneCoins(coins: Coin[]): Coin[] {
  return coins.map((c) => ({ ...c, candles: c.candles.slice() }));
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Convert per-tick rugRisk to a daily probability, capped at MAX_DAILY_RUG_PROB.
 * P(survives day) = (1 - rugRisk)^86400
 * P(rugs in day)  = 1 - P(survives day)
 */
function dailyRugProb(rugRisk: number): number {
  const p = 1 - Math.pow(Math.max(0, 1 - rugRisk), TICKS_PER_DAY);
  return Math.min(p, MAX_DAILY_RUG_PROB);
}

function doSimRug(c: Coin, now: number) {
  c.price = 0;
  c.rugged = true;
  c.ruggedAt = now;
  c.warnTicks = 0;
  c.rugCountdown = 0;
  c.shockTicks = 0;
}

export function simulateDays(
  state: AppState,
  opts: SimulateOptions
): Promise<SimulateResult> {
  const { days, mode = "realistic", onProgress, chunkSize = 2400 } = opts;

  return new Promise((resolve) => {
    const totalTicks = days * TICKS_PER_DAY;
    const coins = cloneCoins(state.coins);
    const market: MarketState = { ...state.market };
    let tick = state.tick;
    let done = 0;

    const summary: DaySummary[] = [];
    let dayStart = coins.map((c) => ({ id: c.id, price: c.price }));
    let dayRugCount = 0;

    function runChunk() {
      const chunkEnd = Math.min(done + chunkSize, totalTicks);

      for (let i = done; i < chunkEnd; i++) {
        tick += SIM_STEP_SECONDS;
        const now = Date.now() + i * SIM_STEP_SECONDS * 1000;

        stepMarket(market);

        // global market events every ~75 simulated seconds
        if (i % 15 === 0 && Math.random() < 0.5) {
          globalEvent(coins, market);
        }

        for (const c of coins) {
          if (c.rugged) continue;
          // quiet=true: disables per-tick rug logic, warnings, and event feed output.
          // We handle rugs ourselves at day boundaries below.
          stepCoin(c, market, now, tick, null, true);
          // Keep fast-forwarded launch coins within the same $1B ceiling used
          // by coin creation. This also prevents runaway values from making
          // chart scales and volumes overflow after long simulations.
          if (mode === "realistic") {
            if (!Number.isFinite(c.price)) c.price = MAX_SIM_PRICE;
            else if (c.price > MAX_SIM_PRICE) c.price = MAX_SIM_PRICE;
            c.ref = Math.min(Math.max(c.ref, 1e-9), MAX_SIM_PRICE);
          }
        }

        // ── Day boundary ──────────────────────────────────────────────────────
        if ((i + 1) % TICKS_PER_DAY === 0) {
          const dayNum = Math.floor((i + 1) / TICKS_PER_DAY);
          const dayNow = Date.now() + i * SIM_STEP_SECONDS * 1000;

          // End-of-day rug lottery — realistic daily probability
          dayRugCount = 0;
          for (const c of coins) {
            if (c.rugged) continue;
            const p = dailyRugProb(c.rugRisk);
            if (Math.random() < p) {
              doSimRug(c, dayNow);
              dayRugCount++;
            }
          }

          // Collect stats
          let gainers = 0, losers = 0;
          let topGainerPct = -Infinity, topLoserPct = Infinity;
          let topGainerTicker = "", topLoserTicker = "";

          for (const c of coins) {
            if (c.rugged) continue;
            const start = dayStart.find((x) => x.id === c.id);
            if (!start || start.price <= 0) continue;
            const pct = ((c.price - start.price) / start.price) * 100;
            if (pct > 0) gainers++; else losers++;
            if (pct > topGainerPct) { topGainerPct = pct; topGainerTicker = c.ticker; }
            if (pct < topLoserPct) { topLoserPct = pct; topLoserTicker = c.ticker; }
          }

          summary.push({
            day: dayNum,
            gainers,
            losers,
            rugs: dayRugCount,
            topGainer: topGainerTicker ? { ticker: topGainerTicker, pct: topGainerPct } : null,
            topLoser: topLoserTicker ? { ticker: topLoserTicker, pct: topLoserPct } : null,
          });

          dayStart = coins.map((c) => ({ id: c.id, price: c.price }));
        }
      }

      done = chunkEnd;
      onProgress?.(done / totalTicks, Math.floor(done / TICKS_PER_DAY));

      if (done < totalTicks) {
        setTimeout(runChunk, 0);
      } else {
        // Sanitize the retained chart history as well, including coins that
        // were saved before the simulation guard was added.
        if (mode === "realistic") for (const c of coins) {
          c.price = Math.min(Math.max(Number.isFinite(c.price) ? c.price : MAX_SIM_PRICE, 1e-9), MAX_SIM_PRICE);
          for (const candle of c.candles) for (let j = 1; j <= 4; j++)
            candle[j] = Math.min(Math.max(Number.isFinite(candle[j]) ? candle[j] : MAX_SIM_PRICE, 1e-9), MAX_SIM_PRICE);
        }
        const feedAppend: FeedItem[] = [];
        const historyAppend: HistoryItem[] = [];
        const now = Date.now();

        // Rugged during sim
        const newlyRugged = coins.filter(
          (c) => c.rugged && !state.coins.find((x) => x.id === c.id && x.rugged)
        );
        for (const c of newlyRugged) {
          feedAppend.push({
            id: uid(), t: now, tone: "bad", icon: "☠️",
            text: `After ${days}d sim: ${c.name.toUpperCase()} (${c.ticker}) was rugged!`,
            coinId: c.id,
          });
        }

        // Biggest movers
        const movers = coins
          .filter((c) => !c.rugged)
          .map((c) => {
            const orig = state.coins.find((x) => x.id === c.id);
            const startP = orig?.price ?? c.startPrice;
            return { c, pct: startP > 0 ? ((c.price - startP) / startP) * 100 : 0 };
          })
          .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
          .slice(0, 5);

        for (const { c, pct } of movers) {
          if (Math.abs(pct) > 5) {
            feedAppend.push({
              id: uid(), t: now,
              tone: pct > 0 ? "good" : "bad",
              icon: pct > 0 ? "📈" : "📉",
              text: `${days}d sim: ${c.emoji} ${c.ticker} ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
              coinId: c.id,
            });
          }
        }

        resolve({ coins, market, tick, feedAppend, historyAppend, summary });
      }
    }

    setTimeout(runChunk, 0);
  });
}
