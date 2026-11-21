import type { Coin, EngineEvent, MarketState } from "./types";

export const BASE_MS = 5000; // one stored candle = 5 seconds
export const MAX_CANDLES = 200; // ~16 minutes of history

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function recordPrice(c: Coin, now: number, volume: number) {
  const bucket = Math.floor(now / BASE_MS) * BASE_MS;
  const last = c.candles[c.candles.length - 1];
  if (last && last[0] >= bucket) {
    if (c.price > last[2]) last[2] = c.price;
    if (c.price < last[3]) last[3] = c.price;
    last[4] = c.price;
    last[5] += volume;
  } else {
    const open = last ? last[4] : c.price;
    c.candles.push([bucket, open, Math.max(open, c.price), Math.min(open, c.price), c.price, volume]);
    if (c.candles.length > MAX_CANDLES) c.candles.shift();
  }
}

const WARN_TEXTS = [
  "Creator wallet moved a large share of supply",
  "Liquidity pool unlock detected",
  "Suspicious wallet activity detected",
  "Dev wallet is sending tokens to an exchange",
  "Unusual sell pressure from top holders",
];

export function applyShock(c: Coin, pct: number, ticks = 3) {
  const mult = Math.max(0.02, 1 + pct / 100);
  c.shockTicks = ticks;
  c.shockPer = Math.log(mult) / ticks;
}

function doRug(c: Coin, now: number, out: EngineEvent[] | null) {
  const old = c.price;
  c.price = 0;
  c.rugged = true;
  c.ruggedAt = now;
  c.warnTicks = 0;
  c.rugCountdown = 0;
  c.shockTicks = 0;
  recordPrice(c, now, c.supply * old * 0.01);
  out?.push({ type: "rug", coinId: c.id, pct: -100, oldPrice: old, target: 0 });
}

function triggerExtreme(c: Coin, out: EngineEvent[] | null) {
  const up = Math.random() < c.pumpBias;
  const major = Math.random() < 0.15; // major moves are rarer than sudden ones
  let pct: number;
  let type: EngineEvent["type"];
  if (up) {
    type = major ? "mega_pump" : "pump";
    pct = major ? rand(60, 150) : rand(20, 60);
  } else {
    type = major ? "mega_crash" : "crash";
    pct = -(major ? rand(50, 85) : rand(20, 50));
  }
  applyShock(c, pct, up ? 3 : 4);
  c.cooldown = Math.floor(rand(180, 520));
  const dump = !up && major && (c.creator === "user" || c.rugRisk > 4e-5 || c.pattern === "shady" || c.pattern === "launch");
  out?.push({ type, coinId: c.id, pct, oldPrice: c.price, target: c.price * (1 + pct / 100), dump });
}

/**
 * Advance a single coin by one second. Mutates `c` (caller passes a shallow clone).
 * `quiet` disables rug pulls and warnings (used while generating back-history).
 */
export function stepCoin(
  c: Coin,
  m: MarketState,
  now: number,
  tick: number,
  out: EngineEvent[] | null,
  quiet = false
) {
  if (c.rugged) return;
  c.prev = c.price;
  const heat = m.heatTicks > 0 ? m.heatMult : 1;

  // ---------- creator dump / rug pull logic (hidden risk) ----------
  if (!quiet) {
    if (c.rugCountdown > 0) {
      c.rugCountdown--;
      if (c.rugCountdown <= 0) {
        doRug(c, now, out);
        return;
      }
    } else if (Math.random() < c.rugRisk * (heat > 1 ? 1.4 : 1)) {
      if (Math.random() < 0.55) {
        // warning signs, then the rug
        c.rugCountdown = Math.floor(rand(30, 80));
        c.warnTicks = c.rugCountdown + 25;
        c.warnText = pick(WARN_TEXTS);
        c.warnReal = true;
        out?.push({ type: "warning", coinId: c.id, text: c.warnText });
      } else {
        doRug(c, now, out); // no warning at all
        return;
      }
    } else if (c.warnTicks <= 0 && Math.random() < c.rugRisk * 3) {
      // false alarm — looks scary but nothing happens
      c.warnTicks = Math.floor(rand(40, 90));
      c.warnText = pick(WARN_TEXTS);
      c.warnReal = false;
      out?.push({ type: "warning", coinId: c.id, text: c.warnText });
    }
  }
  if (c.warnTicks > 0) c.warnTicks--;

  // ---------- regimes (periods of extreme volatility, bull / bear runs) ----------
  let volMult = 1;
  let regimeDrift = 0;
  if (c.regimeTicks > 0) {
    c.regimeTicks--;
    if (c.regimeKind === "volatile") volMult = 3;
    else if (c.regimeKind === "bull") {
      regimeDrift = c.vol * 0.35;
      volMult = 1.3;
    } else if (c.regimeKind === "bear") {
      regimeDrift = -c.vol * 0.35;
      volMult = 1.3;
    }
  } else if (Math.random() < 0.0015 * (c.pattern === "stable" ? 0.1 : 1) * heat) {
    const r = Math.random();
    c.regimeKind = r < 0.34 ? "volatile" : r < 0.67 ? "bull" : "bear";
    c.regimeTicks = Math.floor(rand(25, 80));
    if (c.regimeKind === "volatile" && c.vol >= 0.002 && !quiet && Math.random() < 0.3) {
      out?.push({ type: "volatile", coinId: c.id });
    }
  }

  // ---------- base return ----------
  let ret = c.drift + regimeDrift + m.bias * c.beta;
  if (c.waveAmp) ret += c.waveAmp * Math.cos((2 * Math.PI * tick) / c.wavePeriod + c.wavePhase);
  ret -= c.revert * Math.log(c.price / c.ref);
  const lr = Math.log(c.price / c.startPrice);
  if (lr > 5.7) ret -= 0.003;
  else if (lr < -5.7) ret += 0.003;
  if (c.rugCountdown > 0) {
    ret -= 0.0012; // slow bleed while insiders exit
    volMult *= 2;
  }
  ret += gauss() * c.vol * volMult * Math.sqrt(heat);
  if (Math.random() < c.jumpP * heat) {
    const bias = c.drift > 0 ? 0.58 : c.drift < 0 ? 0.42 : 0.5;
    ret += (Math.random() < bias ? 1 : -1) * c.jumpSize * rand(0.5, 2.2);
  }
  ret = Math.max(-0.2, Math.min(0.2, ret));

  // ---------- extreme events (pump / crash) ----------
  if (c.shockTicks > 0) {
    ret += c.shockPer;
    c.shockTicks--;
  } else if (c.cooldown > 0) {
    c.cooldown--;
  } else if (c.eventRate > 0 && c.rugCountdown <= 0 && Math.random() < c.eventRate * heat) {
    triggerExtreme(c, out);
  }

  c.price = Math.max(1e-9, c.price * Math.exp(ret));
  if (c.pattern !== "stable") c.ref *= Math.exp(0.0008 * Math.log(c.price / c.ref));

  const volume =
    c.supply * c.price * 0.00002 * (1 + Math.abs(ret) * 80) * rand(0.4, 1.6) * (c.shockTicks > 0 ? 6 : 1);
  recordPrice(c, now, volume);
}

// ---------------------------------------------------------------------------
// Market-wide events
// ---------------------------------------------------------------------------

export interface GlobalEvent {
  tone: "good" | "bad" | "warn" | "info";
  icon: string;
  text: string;
  coinId?: string;
}

export function stepMarket(m: MarketState) {
  if (m.biasTicks > 0) {
    m.biasTicks--;
    if (m.biasTicks === 0) m.bias = 0;
  }
  if (m.heatTicks > 0) {
    m.heatTicks--;
    if (m.heatTicks === 0) m.heatMult = 1;
  }
}

export function globalEvent(coins: Coin[], m: MarketState): GlobalEvent | null {
  const live = coins.filter((c) => !c.rugged && c.pattern !== "stable");
  if (live.length === 0) return null;
  const r = Math.random();
  const name = (c: Coin) => c.name.toUpperCase();

  if (r < 0.42) {
    const c = pick(live);
    const buy = Math.random() < 0.55;
    const pct = rand(2, 11);
    applyShock(c, buy ? pct : -pct, 2);
    return {
      tone: buy ? "good" : "bad",
      icon: "🐋",
      text: buy
        ? `Whale activity detected! A whale bought ${name(c)} (+${pct.toFixed(1)}%)`
        : `Whale activity detected! A whale dumped ${name(c)} (−${pct.toFixed(1)}%)`,
      coinId: c.id,
    };
  }
  if (r < 0.54) {
    m.heatTicks = Math.floor(rand(100, 190));
    m.heatMult = rand(1.7, 2.4);
    return { tone: "warn", icon: "⚡", text: "Market volatility is increasing!" };
  }
  if (r < 0.68) {
    m.bias = rand(0.0005, 0.0009);
    m.biasTicks = Math.floor(rand(60, 110));
    for (let i = 0; i < 3; i++) {
      const c = pick(live);
      if (c.shockTicks === 0) applyShock(c, rand(1.5, 5), 2);
    }
    return { tone: "good", icon: "🏦", text: "A new major investor entered the market!" };
  }
  if (r < 0.82) {
    m.bias = rand(0.0006, 0.001);
    m.biasTicks = Math.floor(rand(70, 130));
    live
      .filter((c) => Math.log(c.price / c.ref) < -0.12 && c.shockTicks === 0)
      .slice(0, 5)
      .forEach((c) => applyShock(c, rand(3, 10), 3));
    return { tone: "good", icon: "📈", text: "Unexpected market recovery!" };
  }
  m.bias = -rand(0.0006, 0.001);
  m.biasTicks = Math.floor(rand(60, 110));
  return { tone: "bad", icon: "📉", text: "Panic selling spreads across the market!" };
}
