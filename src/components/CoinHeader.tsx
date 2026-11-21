import type { Coin } from "../engine/types";
import { PERIODS, changeOver, marketCap, rangeStats } from "../lib/derive";
import { fmtCompact, fmtP } from "../lib/format";
import { Badge, ChangeBar, CoinLogo, PctBadge, Star } from "./ui";
import { cn } from "../utils/cn";
import { fmtPct } from "../lib/format";

export function CoinHeader({
  coin,
  watched,
  onToggleWatch,
}: {
  coin: Coin;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const up = coin.price >= coin.prev;
  const stats = rangeStats(coin);
  const dayChange = changeOver(coin, 900);
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CoinLogo coin={coin} size={52} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{coin.name}</h2>
              <Star on={watched} onClick={onToggleWatch} size={20} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className="font-mono font-bold text-white/80">{coin.ticker}/USD</span>
              {coin.creator === "user" && <Badge tone="gold">★ Created by you</Badge>}
              {coin.rugged && <Badge tone="red">☠ Rugged</Badge>}
              {!coin.rugged && coin.warnTicks > 0 && (
                <Badge tone="gold" className="warn-blink">
                  ⚠ Suspicious activity
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div
            key={coin.price}
            className={cn(
              "num inline-block rounded-lg px-2 font-mono text-3xl font-black tracking-tight sm:text-4xl",
              coin.rugged ? "text-muted" : up ? "text-up flash-up" : "text-down flash-down"
            )}
          >
            {fmtP(coin.price)}
          </div>
          <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted">
            <PctBadge pct={dayChange} />
            <span>15m change</span>
          </div>
        </div>
      </div>

      {!coin.rugged && coin.warnTicks > 0 && (
        <div className="warn-blink rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-medium text-gold">
          ⚠ {coin.warnText}. Trade carefully.
        </div>
      )}

      {/* period changes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PERIODS.map((p) => {
          const v = changeOver(coin, p.secs);
          return (
            <div key={p.label} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted">{p.label}</span>
                <span className={cn("num text-sm font-bold", v >= 0 ? "text-up" : "text-down")}>{fmtPct(v)}</span>
              </div>
              <div className="mt-1.5">
                <ChangeBar pct={v} max={p.secs >= 900 ? 30 : 10} />
              </div>
            </div>
          );
        })}
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <Stat label="Market Cap" value={fmtCompact(marketCap(coin))} />
        <Stat label="Total Supply" value={fmtCompact(coin.supply, false)} />
        <Stat label="50M High / Low" value={`${fmtP(stats.hi)} / ${fmtP(stats.lo)}`} small />
        <Stat label="Volume (50M)" value={fmtCompact(stats.vol)} />
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("num truncate font-mono font-semibold text-white/90", small ? "text-[11px]" : "text-sm")}>{value}</div>
    </div>
  );
}
