import { useMemo, useState } from "react";
import type { Coin } from "../engine/types";
import { actions } from "../engine/store";
import { listChange, marketCap, trendScore } from "../lib/derive";
import { fmtCompact, fmtP } from "../lib/format";
import { cn } from "../utils/cn";
import { Badge, Card, ChangeBar, CoinLogo, PctBadge, Sparkline, Star } from "./ui";

type Tab = "all" | "watch" | "trending" | "gainers" | "losers" | "mine" | "rugged";
type Sort = "mcap" | "price" | "change" | "name";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "watch", label: "★ Watchlist" },
  { id: "trending", label: "🔥 Trending" },
  { id: "gainers", label: "▲ Gainers" },
  { id: "losers", label: "▼ Losers" },
  { id: "mine", label: "My Coins" },
  { id: "rugged", label: "☠ Rugged" },
];

export function MarketList({
  coins,
  watchlist,
  holdings,
  selectedId,
  onSelect,
}: {
  coins: Coin[];
  watchlist: string[];
  holdings: Record<string, { amount: number }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("mcap");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = coins.filter((c) => !term || c.name.toLowerCase().includes(term) || c.ticker.toLowerCase().includes(term));
    if (tab === "watch") list = list.filter((c) => watchlist.includes(c.id));
    if (tab === "mine") list = list.filter((c) => c.creator === "user");
    if (tab === "rugged") list = list.filter((c) => c.rugged);
    if (tab === "gainers" || tab === "losers" || tab === "trending") list = list.filter((c) => !c.rugged);

    const chg = new Map(list.map((c) => [c.id, listChange(c)]));
    const dir = desc ? -1 : 1;
    const cmp = (a: Coin, b: Coin) => {
      if (tab === "gainers") return chg.get(b.id)! - chg.get(a.id)!;
      if (tab === "losers") return chg.get(a.id)! - chg.get(b.id)!;
      if (tab === "trending") return trendScore(b) - trendScore(a);
      switch (sort) {
        case "price":
          return (a.price - b.price) * dir;
        case "change":
          return (chg.get(a.id)! - chg.get(b.id)!) * dir;
        case "name":
          return a.name.localeCompare(b.name) * (desc ? -1 : 1);
        default:
          return (marketCap(a) - marketCap(b)) * dir;
      }
    };
    const sorted = [...list].sort(cmp);
    if (tab !== "rugged") sorted.sort((a, b) => Number(a.rugged) - Number(b.rugged));
    return sorted;
  }, [coins, q, tab, sort, desc, watchlist]);

  const sortLocked = tab === "gainers" || tab === "losers" || tab === "trending";

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="space-y-3 border-b border-white/5 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wide">MARKETS</h3>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-up">
            <i className="live-dot inline-block h-2 w-2 rounded-full bg-up" /> LIVE · {coins.length} coins
          </span>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or ticker…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-gold/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                tab === t.id ? "border-gold/50 bg-gold/15 text-gold" : "border-white/10 text-muted hover:border-white/25 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={cn("flex items-center gap-2 text-xs transition-opacity", sortLocked && "pointer-events-none opacity-40")}>
          <span className="text-muted">Sort</span>
          <div className="flex flex-1 gap-1 rounded-lg bg-black/30 p-1">
            {(
              [
                ["mcap", "Mkt Cap"],
                ["price", "Price"],
                ["change", "Change"],
                ["name", "Name"],
              ] as [Sort, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setSort(id);
                  setDesc(id !== "name");
                }}
                className={cn(
                  "flex-1 rounded-md px-1 py-1 font-semibold transition-all",
                  sort === id ? "bg-white/10 text-gold" : "text-muted hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDesc((d) => !d)}
            className="rounded-lg bg-black/30 px-2.5 py-1.5 font-bold text-muted transition-colors hover:text-white"
            title={desc ? "Descending" : "Ascending"}
          >
            {desc ? "↓" : "↑"}
          </button>
        </div>
      </div>

      <div className="max-h-[68vh] overflow-y-auto xl:max-h-[640px]">
        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">
            {tab === "mine" ? "You haven't created any coins yet. Hit CREATE COIN!" : tab === "watch" ? "Star a coin to add it to your watchlist." : "No coins found."}
          </div>
        )}
        {rows.map((c) => (
          <Row
            key={c.id}
            coin={c}
            selected={c.id === selectedId}
            watched={watchlist.includes(c.id)}
            owned={(holdings[c.id]?.amount ?? 0) > 0}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>
    </Card>
  );
}

function Row({ coin, selected, watched, owned, onSelect }: { coin: Coin; selected: boolean; watched: boolean; owned: boolean; onSelect: () => void }) {
  const ch = listChange(coin);
  const up = coin.price >= coin.prev;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 border-b border-white/[0.04] px-3 py-2.5 transition-colors hover:bg-white/[0.04]",
        selected && "bg-gold/[0.07] shadow-[inset_3px_0_0_#f0b90b]",
        coin.rugged && "opacity-60"
      )}
    >
      <Star on={watched} onClick={(e) => { e.stopPropagation(); actions.toggleWatch(coin.id); }} size={15} />
      <CoinLogo coin={coin} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-bold">{coin.ticker}</span>
          {coin.creator === "user" && <Badge tone="gold">Yours</Badge>}
          {owned && <Badge tone="blue">Held</Badge>}
          {coin.rugged ? <Badge tone="red">Rugged</Badge> : coin.warnTicks > 0 ? <span className="warn-blink text-xs" title="Suspicious activity">⚠️</span> : null}
        </div>
        <div className="truncate text-[11px] text-muted">
          {coin.name} · {fmtCompact(marketCap(coin))}
        </div>
      </div>
      <Sparkline candles={coin.candles} dead={coin.rugged} />
      <div className="w-[88px] shrink-0 text-right">
        <div
          key={coin.price}
          className={cn(
            "num -mr-1 rounded px-1 font-mono text-[13px] font-semibold",
            coin.rugged ? "text-muted" : up ? "text-up flash-up" : "text-down flash-down"
          )}
        >
          {fmtP(coin.price)}
        </div>
        <div className="mt-0.5 flex justify-end">
          <PctBadge pct={ch} className="min-w-[62px] text-[11px]" />
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-0.5">
        <ChangeBar pct={ch} max={30} height={2} />
      </div>
    </div>
  );
}
