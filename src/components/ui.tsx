import type { ReactNode } from "react";
import type { Candle } from "../engine/types";
import { cn } from "../utils/cn";
import { fmtPct } from "../lib/format";

export function CoinLogo({
  coin,
  size = 36,
}: {
  coin: { emoji: string; hue: number; rugged?: boolean };
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full leading-none shadow-inner ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: `linear-gradient(135deg, hsl(${coin.hue} 70% 42%), hsl(${(coin.hue + 50) % 360} 70% 20%))`,
        filter: coin.rugged ? "grayscale(1) brightness(0.7)" : undefined,
      }}
    >
      {coin.emoji}
    </div>
  );
}

export function Sparkline({
  candles,
  n = 48,
  w = 64,
  h = 26,
  dead = false,
}: {
  candles: Candle[];
  n?: number;
  w?: number;
  h?: number;
  dead?: boolean;
}) {
  const pts = candles.slice(-n).map((c) => c[4]);
  if (pts.length < 2) pts.push(pts[0] ?? 0, pts[0] ?? 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const up = pts[pts.length - 1] >= pts[0];
  const color = dead ? "#6b7280" : up ? "#0ecb81" : "#f6465d";
  const coords = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - 2 - ((p - min) / span) * (h - 4)]);
  const line = coords.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity={0.12} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Centered bar: green grows right, red grows left */
export function ChangeBar({ pct, max = 25, height = 4 }: { pct: number; max?: number; height?: number }) {
  const w = Math.min(Math.abs(pct) / max, 1) * 50;
  const up = pct >= 0;
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-white/5" style={{ height }}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      <div
        className={cn("absolute inset-y-0 rounded-full transition-all duration-700", up ? "bg-up" : "bg-down")}
        style={{ [up ? "left" : "right"]: "50%", width: `${w}%`, boxShadow: `0 0 8px ${up ? "#0ecb8166" : "#f6465d66"}` }}
      />
    </div>
  );
}

export function PctBadge({ pct, className }: { pct: number; className?: string }) {
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "num inline-flex min-w-[68px] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold transition-colors",
        up ? "bg-up/15 text-up" : "bg-down/15 text-down",
        className
      )}
    >
      {fmtPct(pct)}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-panel/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = "gold", className }: { children: ReactNode; tone?: "gold" | "red" | "green" | "gray" | "blue"; className?: string }) {
  const tones = {
    gold: "bg-gold/15 text-gold border-gold/30",
    red: "bg-down/15 text-down border-down/30",
    green: "bg-up/15 text-up border-up/30",
    gray: "bg-white/5 text-muted border-white/10",
    blue: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Star({ on, onClick, size = 16 }: { on: boolean; onClick: (e: React.MouseEvent) => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      className={cn("shrink-0 transition-all hover:scale-125 active:scale-90", on ? "text-gold" : "text-white/25 hover:text-gold/70")}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
      </svg>
    </button>
  );
}
