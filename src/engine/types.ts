export type Pattern = "stable" | "steady" | "wave" | "moon" | "crash" | "meme" | "shady" | "launch";

/** [bucketStartMs, open, high, low, close, volumeUsd] */
export type Candle = [number, number, number, number, number, number];

export type RegimeKind = "none" | "volatile" | "bull" | "bear";
export type HypeTier = "none" | "low" | "medium" | "high" | "viral";

export interface Coin {
  id: string; // = ticker
  name: string;
  ticker: string;
  emoji: string;
  hue: number;
  description: string;
  price: number;
  prev: number;
  supply: number;
  startPrice: number;
  pattern: Pattern;
  creator: "system" | "user";
  createdAt: number;

  // --- hidden engine parameters (per-tick, tick = 1s) ---
  drift: number;
  vol: number;
  revert: number;
  eventRate: number;
  pumpBias: number;
  jumpP: number;
  jumpSize: number;
  waveAmp: number;
  wavePeriod: number;
  wavePhase: number;
  beta: number;
  ref: number;
  rugRisk: number; // HIDDEN — never shown to the player

  // --- dynamic state ---
  regimeKind: RegimeKind;
  regimeTicks: number;
  shockTicks: number;
  shockPer: number;
  cooldown: number;
  warnTicks: number;
  warnText: string;
  warnReal: boolean;
  rugCountdown: number;
  rugged: boolean;
  ruggedAt: number;

  // --- hype / description scoring (user coins only) ---
  hypeTier: HypeTier;
  hypeScore: number;
  hypeReason: string;

  candles: Candle[];
}

export interface MarketState {
  bias: number;
  biasTicks: number;
  heatTicks: number;
  heatMult: number;
}

export interface Holding {
  amount: number;
  invested: number;
}

export type HistoryKind = "buy" | "sell" | "create" | "deposit" | "pump" | "crash" | "rug";

export interface HistoryItem {
  id: string;
  t: number;
  kind: HistoryKind;
  coinId?: string;
  coinName?: string;
  emoji?: string;
  amount?: number;
  unit?: "coins" | "pct" | "usd";
  price?: number;
  total?: number;
  note?: string;
}

export type Tone = "good" | "bad" | "warn" | "info";

export interface FeedItem {
  id: string;
  t: number;
  tone: Tone;
  icon: string;
  text: string;
  coinId?: string;
}

export interface Alert {
  id: string;
  kind: "toast" | "rug";
  tone: Tone;
  title: string;
  body: string;
  coinId?: string;
}

export interface AppState {
  coins: Coin[];
  cash: number;
  deposited: number;
  realized: number;
  holdings: Record<string, Holding>;
  history: HistoryItem[];
  feed: FeedItem[];
  watchlist: string[];
  market: MarketState;
  tick: number;
  alerts: Alert[];
}

export type EngineEventType = "pump" | "mega_pump" | "crash" | "mega_crash" | "rug" | "warning" | "volatile";

export interface EngineEvent {
  type: EngineEventType;
  coinId: string;
  pct?: number;
  oldPrice?: number;
  target?: number;
  dump?: boolean;
  text?: string;
}

export interface Result {
  ok: boolean;
  error?: string;
  message?: string;
}
