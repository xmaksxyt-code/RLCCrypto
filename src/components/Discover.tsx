import { useMemo } from "react";
import type { Coin } from "../engine/types";
import { listChange, trendScore } from "../lib/derive";
import { fmtP } from "../lib/format";
import { Card, ChangeBar, CoinLogo, PctBadge } from "./ui";

export function Discover({ coins, onSelect }: { coins: Coin[]; onSelect: (id: string) => void }) {
  const { trending, gainers, losers } = useMemo(() => {
    const live = coins.filter((c) => !c.rugged);
    const ch = new Map(live.map((c) => [c.id, listChange(c)]));
    return {
      trending: [...live].sort((a, b) => trendScore(b) - trendScore(a)).slice(0, 4),
      gainers: [...live].sort((a, b) => ch.get(b.id)! - ch.get(a.id)!).slice(0, 4),
      losers: [...live].sort((a, b) => ch.get(a.id)! - ch.get(b.id)!).slice(0, 4),
    };
  }, [coins]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Block title="🔥 Trending" coins={trending} onSelect={onSelect} />
      <Block title="▲ Biggest Gainers" coins={gainers} onSelect={onSelect} />
      <Block title="▼ Biggest Losers" coins={losers} onSelect={onSelect} />
    </div>
  );
}

function Block({ title, coins, onSelect }: { title: string; coins: Coin[]; onSelect: (id: string) => void }) {
  return (
    <Card className="p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className="space-y-1">
        {coins.map((c) => {
          const ch = listChange(c);
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/5"
            >
              <CoinLogo coin={c} size={22} />
              <span className="w-12 font-mono text-xs font-bold">{c.ticker}</span>
              <span className="num hidden flex-1 truncate font-mono text-[11px] text-muted lg:block">{fmtP(c.price)}</span>
              <div className="w-10 flex-1 lg:w-12 lg:flex-none">
                <ChangeBar pct={ch} max={30} height={4} />
              </div>
              <PctBadge pct={ch} className="min-w-[60px] text-[11px]" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
