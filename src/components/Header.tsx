import { useState } from "react";
import type { Coin } from "../engine/types";
import { actions } from "../engine/store";
import { fmtP, fmtPct, fmtSigned, fmtUsd } from "../lib/format";
import { listChange } from "../lib/derive";
import { cn } from "../utils/cn";

export function Header({
  equity,
  cash,
  pl,
  onAddMoney,
  onCreate,
  onSimulate,
}: {
  equity: number;
  cash: number;
  pl: number;
  onAddMoney: () => void;
  onCreate: () => void;
  onSimulate: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0b0e11]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-orange-500 text-lg font-black text-black shadow-lg shadow-gold/20">N</div>
          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight">
              NOVEX<span className="text-violet-400"> RLC</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Trading Simulator</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 sm:gap-6">
          <Stat label="Total balance" value={fmtUsd(equity)} />
          <div className="hidden sm:block">
            <Stat label="Cash" value={fmtUsd(cash)} />
          </div>
          <div className="hidden md:block">
            <Stat label="Total P/L" value={fmtSigned(pl)} tone={pl} />
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={onAddMoney}
            className="btn-shine flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-up to-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-up/25 hover:brightness-110 active:scale-95 sm:flex-none"
          >
            <span className="text-base leading-none">＋</span> ADD MONEY
          </button>
          <button
            onClick={onCreate}
            className="btn-shine flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold via-amber-300 to-gold px-5 py-2.5 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-gold/25 hover:brightness-110 active:scale-95 sm:flex-none"
          >
            <span className="text-base leading-none">✦</span> CREATE COIN
          </button>
          <button
            onClick={onSimulate}
            className="btn-shine flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 hover:brightness-110 active:scale-95 sm:flex-none"
          >
            <span className="text-base leading-none">⏩</span> SIMULATE
          </button>
          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="rounded-xl border border-white/10 p-2.5 text-muted transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="animate-pop absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-panel p-2 shadow-2xl">
                  <button
                    onClick={() => {
                      setMenu(false);
                      if (window.confirm("Reset the simulator? This deletes your balance, portfolio, created coins and history.")) actions.reset();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-down transition-colors hover:bg-down/10"
                  >
                    ↺ Reset simulator
                  </button>
                  <div className="px-3 pb-1 pt-2 text-[10.5px] leading-snug text-muted">Virtual money only. Prices are 100% simulated.</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("num font-mono text-sm font-extrabold sm:text-base", tone === undefined ? "text-white" : tone >= 0 ? "text-up" : "text-down")}>{value}</div>
    </div>
  );
}

export function Ticker({ coins, onSelect }: { coins: Coin[]; onSelect: (id: string) => void }) {
  const items = coins.filter((c) => !c.rugged);
  const row = (suffix: string) =>
    items.map((c) => {
      const ch = listChange(c);
      return (
        <button key={c.id + suffix} onClick={() => onSelect(c.id)} className="flex shrink-0 items-center gap-2 px-4 transition-colors hover:bg-white/5">
          <span className="text-sm">{c.emoji}</span>
          <span className="font-mono text-xs font-bold">{c.ticker}</span>
          <span className="num font-mono text-xs text-white/70">{fmtP(c.price)}</span>
          <span className={cn("num font-mono text-xs font-bold", ch >= 0 ? "text-up" : "text-down")}>{fmtPct(ch)}</span>
        </button>
      );
    });
  return (
    <div className="overflow-hidden border-b border-white/[0.05] bg-black/30 py-1.5">
      <div className="marquee flex w-max">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
