import { useSyncExternalStore } from "react";
import type {
  Alert,
  AppState,
  Coin,
  EngineEvent,
  FeedItem,
  HistoryItem,
  Result,
  Tone,
} from "./types";
import { globalEvent, stepCoin, stepMarket } from "./market";
import { hydrateSeedCoins, launchCoin, randomNpcCoin, seedCoins } from "./coins";
import { simulateDays } from "./simulate";
import { scoreDescription } from "./hype";
import { fmtP, fmtPct, fmtQty, fmtSigned, fmtUsd } from "../lib/format";

const KEY = "novex-crypto-sim-v1";
export const START_BALANCE = 10000;

const H = (h: HistoryItem): HistoryItem => h;
let uidCounter = 0;
const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function initialState(): AppState {
  const now = Date.now();
  return {
    coins: seedCoins(now),
    cash: START_BALANCE,
    deposited: START_BALANCE,
    realized: 0,
    holdings: {},
    history: [
      H({ id: uid(), t: now, kind: "deposit", amount: START_BALANCE, unit: "usd", total: START_BALANCE, note: "Starting balance" }),
    ],
    feed: [
      { id: uid(), t: now, tone: "info", icon: "🚀", text: "Welcome to NOVEX — the market is live!" },
    ],
    watchlist: ["NOVA", "SOLAR", "MCAT"],
    market: { bias: 0, biasTicks: 0, heatTicks: 0, heatMult: 1 },
    tick: Math.floor(Math.random() * 100000),
    alerts: [],
  };
}

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AppState;
    if (!s || !Array.isArray(s.coins) || s.coins.length === 0 || typeof s.cash !== "number") return null;
    return { ...s, alerts: [] };
  } catch {
    return null;
  }
}

let state: AppState = load() ?? initialState();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

export function save() {
  // round candle values to 7 significant digits to keep the stored payload small
  const snapshot = {
    ...state,
    alerts: [],
    coins: state.coins.map((c) => ({
      ...c,
      candles: c.candles.map((k) => k.map((v, i) => (i === 0 ? v : Number(v.toPrecision(7)))) as Coin["candles"][number]),
    })),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // quota issue: trim chart history and retry
    try {
      const slim = { ...snapshot, coins: snapshot.coins.map((c) => ({ ...c, candles: c.candles.slice(-240) })) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 600);
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  emit();
  scheduleSave();
}

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useStore = () => useSyncExternalStore(subscribe, getState);

// ---------------------------------------------------------------------------
// Market tick
// ---------------------------------------------------------------------------

const feedItem = (tone: Tone, icon: string, text: string, coinId?: string): FeedItem => ({
  id: uid(),
  t: Date.now(),
  tone,
  icon,
  text,
  coinId,
});

function processEvents(events: EngineEvent[], coins: Coin[], s: AppState) {
  const feed: FeedItem[] = [];
  const history: HistoryItem[] = [];
  const alerts: Alert[] = [];
  const now = Date.now();

  for (const e of events) {
    const c = coins.find((x) => x.id === e.coinId);
    if (!c) continue;
    const NAME = c.name.toUpperCase();
    const held = s.holdings[c.id]?.amount ?? 0;
    const mine = c.creator === "user";
    const base = { id: uid(), t: now, coinId: c.id, coinName: c.name, emoji: c.emoji };

    if (e.type === "pump" || e.type === "mega_pump") {
      const pct = e.pct ?? 0;
      const mega = e.type === "mega_pump";
      feed.push(
        feedItem(
          "good",
          mega ? "🚀" : "📈",
          mega ? `MAJOR PUMP! ${NAME} is skyrocketing +${pct.toFixed(0)}%!` : `${NAME} is pumping! +${pct.toFixed(0)}%`,
          c.id
        )
      );
      const impact = held * ((e.target ?? 0) - (e.oldPrice ?? 0));
      history.push({
        ...base,
        kind: "pump",
        amount: pct,
        unit: "pct",
        price: e.target,
        note: (mega ? "Major pump" : "Sudden pump") + (held > 0 ? ` · your holdings ≈ ${fmtSigned(impact)}` : ""),
      });
      if (mega || held > 0 || mine)
        alerts.push({
          id: uid(),
          kind: "toast",
          tone: "good",
          title: `${c.emoji} ${c.ticker} ${mega ? "MAJOR PUMP" : "pumping"} +${pct.toFixed(0)}%`,
          body: held > 0 ? `Your ${fmtQty(held)} ${c.ticker} may gain ≈ ${fmtSigned(impact)}` : `${c.name} is on the move!`,
          coinId: c.id,
        });
    } else if (e.type === "crash" || e.type === "mega_crash") {
      const pct = e.pct ?? 0;
      const mega = e.type === "mega_crash";
      const text = e.dump
        ? `${NAME} creator is dumping supply! ${pct.toFixed(0)}%`
        : mega
          ? `MAJOR CRASH! ${NAME} collapses ${pct.toFixed(0)}%!`
          : `${NAME} just crashed ${pct.toFixed(0)}%!`;
      feed.push(feedItem("bad", e.dump ? "🧨" : "📉", text, c.id));
      const impact = held * ((e.target ?? 0) - (e.oldPrice ?? 0));
      history.push({
        ...base,
        kind: "crash",
        amount: pct,
        unit: "pct",
        price: e.target,
        note: (e.dump ? "Creator dump" : mega ? "Major crash" : "Sudden crash") + (held > 0 ? ` · your holdings ≈ ${fmtSigned(impact)}` : ""),
      });
      if (mega || held > 0 || mine)
        alerts.push({
          id: uid(),
          kind: "toast",
          tone: "bad",
          title: `${c.emoji} ${c.ticker} ${e.dump ? "CREATOR DUMP" : "CRASH"} ${pct.toFixed(0)}%`,
          body: held > 0 ? `Your ${fmtQty(held)} ${c.ticker} may lose ≈ ${fmtSigned(impact)}` : `${c.name} is plummeting!`,
          coinId: c.id,
        });
    } else if (e.type === "rug") {
      const lost = held * (e.oldPrice ?? 0);
      feed.push(feedItem("bad", "☠️", `RUG PULL DETECTED! ${NAME} value dropped to $0!`, c.id));
      history.push({
        ...base,
        kind: "rug",
        amount: -100,
        unit: "pct",
        price: 0,
        note: held > 0 ? `Rug pull · you lost ${fmtUsd(lost)}` : "Rug pull · price dropped to $0",
      });
      alerts.push({
        id: uid(),
        kind: "rug",
        tone: "bad",
        title: "RUG PULL DETECTED!",
        body:
          held > 0
            ? `${c.name} (${c.ticker}) collapsed to $0. Your ${fmtQty(held)} ${c.ticker} lost ${fmtUsd(lost)}.`
            : `${c.name} (${c.ticker}) just dropped to $0. Trading is halted.`,
        coinId: c.id,
      });
    } else if (e.type === "warning") {
      feed.push(feedItem("warn", "⚠️", `${NAME}: ${e.text}`, c.id));
      if (held > 0)
        alerts.push({
          id: uid(),
          kind: "toast",
          tone: "warn",
          title: `⚠️ Warning on ${c.ticker}`,
          body: e.text ?? "Suspicious activity detected",
          coinId: c.id,
        });
    } else if (e.type === "volatile") {
      feed.push(feedItem("warn", "⚡", `${NAME} is entering a period of extreme volatility`, c.id));
    }
  }
  return { feed, history, alerts };
}

function tickMarket() {
  const now = Date.now();
  const tick = state.tick + 1;
  const market = { ...state.market };
  stepMarket(market);

  const events: EngineEvent[] = [];
  // stepCoin mutates a coin. Reusing the objects avoids 500 spreads per tick;
  // the store snapshot is still replaced below when React is notified.
  let coins = state.coins;
  for (const c of coins) {
    if (!c.rugged) stepCoin(c, market, now, tick, events, false);
  }

  const extraFeed: FeedItem[] = [];
  const extraAlerts: Alert[] = [];

  if (Math.random() < 1 / 75) {
    const g = globalEvent(coins, market);
    if (g) extraFeed.push(feedItem(g.tone, g.icon, g.text, g.coinId));
  }

  // NPC coin launches (rare, capped)
  const npc = coins.filter((c) => c.creator === "system" && c.pattern === "launch").length;
  if (npc < 10 && Math.random() < 1 / 900) {
    const nc = randomNpcCoin(new Set(coins.map((c) => c.ticker)), now);
    if (nc) {
      coins = [...coins, nc];
      extraFeed.push(feedItem("info", "🆕", `New coin launched! ${nc.emoji} ${nc.name.toUpperCase()} ($${nc.ticker}) just hit the market`, nc.id));
      extraAlerts.push({ id: uid(), kind: "toast", tone: "info", title: `🆕 New coin launched`, body: `${nc.emoji} ${nc.name} ($${nc.ticker}) at ${fmtP(nc.price)}`, coinId: nc.id });
    }
  }

  const ev = processEvents(events, coins, state);
  const patch: Partial<AppState> = { coins, market, tick };
  if (ev.feed.length || extraFeed.length) patch.feed = [...extraFeed, ...ev.feed, ...state.feed].slice(0, 80);
  if (ev.history.length) patch.history = [...ev.history, ...state.history].slice(0, 1000);
  const allAlerts = [...ev.alerts, ...extraAlerts];
  if (allAlerts.length) patch.alerts = [...state.alerts, ...allAlerts].slice(-8);
  state = { ...state, ...patch };
  // Market data does not need a React render every second. Keep simulation
  // cadence at 1s, but publish at 2Hz to reduce tree-wide rerenders.
  if (tick % 2 === 0 || ev.feed.length || extraFeed.length || allAlerts.length) emit();
  // persisted by the 5s periodic save (user actions save immediately via set())
}

let timer: ReturnType<typeof setInterval> | null = null;
let periodic: ReturnType<typeof setInterval> | null = null;

export function startEngine() {
  if (timer) return () => {};
  // Hydrate only newly seeded coins, yielding between small batches so the UI
  // can render immediately and the main thread remains responsive.
  if (state.coins.some((c) => c.candles.length === 0)) {
    hydrateSeedCoins(state.coins.filter((c) => c.candles.length === 0), Date.now(), () => emit());
  }
  timer = setInterval(tickMarket, 1000);
  periodic = setInterval(save, 5000);
  const onHide = () => save();
  window.addEventListener("beforeunload", onHide);
  document.addEventListener("visibilitychange", onHide);
  return () => {
    if (timer) clearInterval(timer);
    if (periodic) clearInterval(periodic);
    timer = null;
    periodic = null;
    window.removeEventListener("beforeunload", onHide);
    document.removeEventListener("visibilitychange", onHide);
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actions = {
  addMoney(amount: number): Result {
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount greater than $0." };
    if (amount > 1e9) return { ok: false, error: "Maximum single deposit is $1,000,000,000." };
    amount = Math.round(amount * 100) / 100;
    set({
      cash: state.cash + amount,
      deposited: state.deposited + amount,
      history: [
        H({ id: uid(), t: Date.now(), kind: "deposit", amount, unit: "usd", total: amount, note: "Virtual deposit" }),
        ...state.history,
      ].slice(0, 1000),
      feed: [feedItem("good", "💰", `${fmtUsd(amount)} of virtual money added to your account`), ...state.feed].slice(0, 80),
    });
    return { ok: true, message: `${fmtUsd(amount)} added to your balance` };
  },

  buy(coinId: string, q: { amount?: number; usd?: number }): Result {
    const coin = state.coins.find((c) => c.id === coinId);
    if (!coin) return { ok: false, error: "Coin not found." };
    if (coin.rugged || coin.price <= 0) return { ok: false, error: "Trading halted — this coin was rugged." };
    let amount = q.amount ?? 0;
    let cost = 0;
    if (q.usd !== undefined) {
      cost = q.usd;
      amount = cost / coin.price;
    } else cost = amount * coin.price;
    if (!isFinite(amount) || amount <= 0 || !isFinite(cost) || cost <= 0) return { ok: false, error: "Enter a valid amount." };
    if (cost < 0.01) return { ok: false, error: "Minimum order is $0.01." };
    if (cost > state.cash * (1 + 1e-9) + 1e-9) return { ok: false, error: `Insufficient funds. You have ${fmtUsd(state.cash)}.` };
    cost = Math.min(cost, state.cash);
    const h = state.holdings[coinId] ?? { amount: 0, invested: 0 };
    set({
      cash: Math.max(0, state.cash - cost),
      holdings: { ...state.holdings, [coinId]: { amount: h.amount + amount, invested: h.invested + cost } },
      history: [
        H({ id: uid(), t: Date.now(), kind: "buy", coinId, coinName: coin.name, emoji: coin.emoji, amount, unit: "coins", price: coin.price, total: cost }),
        ...state.history,
      ].slice(0, 1000),
    });
    return { ok: true, message: `Bought ${fmtQty(amount)} ${coin.ticker} for ${fmtUsd(cost)}` };
  },

  sell(coinId: string, q: { amount?: number; usd?: number }): Result {
    const coin = state.coins.find((c) => c.id === coinId);
    if (!coin) return { ok: false, error: "Coin not found." };
    if (coin.rugged || coin.price <= 0) return { ok: false, error: "Trading halted — this coin was rugged." };
    const h = state.holdings[coinId];
    if (!h || h.amount <= 0) return { ok: false, error: `You don't own any ${coin.ticker}.` };
    let amount = q.amount ?? 0;
    if (q.usd !== undefined) amount = q.usd / coin.price;
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };
    if (amount > h.amount * (1 + 1e-9)) return { ok: false, error: `You only own ${fmtQty(h.amount)} ${coin.ticker}.` };
    amount = Math.min(amount, h.amount);
    const proceeds = amount * coin.price;
    if (proceeds < 0.005) return { ok: false, error: "Order value is too small." };
    const basis = h.invested * (amount / h.amount);
    const remaining = h.amount - amount;
    const holdings = { ...state.holdings };
    if (remaining <= h.amount * 1e-9 || remaining < 1e-12) delete holdings[coinId];
    else holdings[coinId] = { amount: remaining, invested: h.invested - basis };
    set({
      cash: state.cash + proceeds,
      realized: state.realized + (proceeds - basis),
      holdings,
      history: [
        H({
          id: uid(), t: Date.now(), kind: "sell", coinId, coinName: coin.name, emoji: coin.emoji, amount, unit: "coins", price: coin.price, total: proceeds,
          note: `Realized ${fmtSigned(proceeds - basis)} (${fmtPct(basis > 0 ? ((proceeds - basis) / basis) * 100 : 0)})`,
        }),
        ...state.history,
      ].slice(0, 1000),
    });
    return { ok: true, message: `Sold ${fmtQty(amount)} ${coin.ticker} for ${fmtUsd(proceeds)}` };
  },

  toggleWatch(coinId: string) {
    const w = state.watchlist.includes(coinId) ? state.watchlist.filter((x) => x !== coinId) : [...state.watchlist, coinId];
    set({ watchlist: w });
  },

  createCoin(input: { name: string; ticker: string; emoji: string; price: number; supply: number; description: string }): Result & { id?: string } {
    const name = input.name.trim();
    const ticker = input.ticker.trim().toUpperCase();
    if (name.length < 2) return { ok: false, error: "Coin name must be at least 2 characters." };
    if (!/^[A-Z0-9]{2,6}$/.test(ticker)) return { ok: false, error: "Ticker must be 2–6 letters or numbers." };
    if (state.coins.some((c) => c.ticker === ticker)) return { ok: false, error: `Ticker ${ticker} is already taken.` };
    if (!isFinite(input.price) || input.price < 1e-8 || input.price > 1e9) return { ok: false, error: "Initial price must be between $0.00000001 and $1,000,000,000." };
    if (!isFinite(input.supply) || input.supply < 1 || input.supply > 1e15) return { ok: false, error: "Total supply must be between 1 and 1,000,000,000,000,000." };
    const now = Date.now();
    const coin = launchCoin(
      {
        name,
        ticker,
        emoji: input.emoji.trim() || "🪙",
        price: input.price,
        supply: Math.floor(input.supply),
        description: input.description.trim() || `${name} is a brand new community coin.`,
      },
      now,
      "user"
    );
    set({
      coins: [...state.coins, coin],
      history: [
        H({ id: uid(), t: now, kind: "create", coinId: ticker, coinName: name, emoji: coin.emoji, amount: coin.supply, unit: "coins", price: coin.price, total: coin.price * coin.supply, note: "Coin created by you" }),
        ...state.history,
      ].slice(0, 1000),
      feed: [feedItem("info", "🆕", `New coin launched! ${coin.emoji} ${name.toUpperCase()} ($${ticker}) — created by you`, ticker), ...state.feed].slice(0, 80),
    });
    const hype = scoreDescription(coin.description);
    const hypeMsg = hype.tier !== "none"
      ? ` 🔥 ${hype.tier.toUpperCase()} HYPE detected (${hype.reason})!`
      : "";
    return { ok: true, id: ticker, message: `${name} launched!${hypeMsg}` };
  },

  dismissAlert(id: string) {
    state = { ...state, alerts: state.alerts.filter((a) => a.id !== id) };
    emit();
  },

  async simulate(days: number, onProgress?: (pct: number, day: number) => void, mode: "realistic" | "unrealistic" = "realistic"): Promise<import("./simulate").SimulateResult> {
    // pause the live ticker while simulating
    const wasRunning = !!timer;
    if (timer) { clearInterval(timer); timer = null; }
    if (periodic) { clearInterval(periodic); periodic = null; }

    const result = await simulateDays(state, { days, mode, onProgress, chunkSize: 2400 });

    // merge results back into state
    const now = Date.now();
    const uid2 = () => `${now.toString(36)}${Math.random().toString(36).slice(2)}`;
    const feedAppend: FeedItem[] = [
      {
        id: uid2(), t: now, tone: "info", icon: "⏩",
        text: `Fast-forwarded ${days} day${days !== 1 ? "s" : ""}. Market resumed.`,
      },
      ...result.feedAppend,
    ];

    // recalculate holdings value after price changes
    const newHoldings = { ...state.holdings };
    for (const coinId of Object.keys(newHoldings)) {
      const newCoin = result.coins.find((c) => c.id === coinId);
      if (!newCoin || newCoin.rugged) {
        // rugged during sim — holdings remain but price = 0
      }
    }

    state = {
      ...state,
      coins: result.coins,
      market: result.market,
      tick: result.tick,
      feed: [...feedAppend, ...state.feed].slice(0, 80),
    };

    emit();
    save();

    // restart engine if it was running
    if (wasRunning) {
      timer = setInterval(tickMarket, 1000);
      periodic = setInterval(save, 5000);
    }

    return result;
  },

  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    state = initialState();
    emit();
    scheduleSave();
  },
};
export type { SimulateResult, DaySummary } from "./simulate";
