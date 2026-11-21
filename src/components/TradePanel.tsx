import { useEffect, useState } from "react";
import type { Coin, Holding } from "../engine/types";
import { actions } from "../engine/store";
import { fmtP, fmtQty, fmtSigned, fmtPct, fmtUsd } from "../lib/format";
import { cn } from "../utils/cn";
import { Card } from "./ui";

export function TradePanel({
  coin,
  cash,
  holding,
  onAddMoney,
}: {
  coin: Coin;
  cash: number;
  holding?: Holding;
  onAddMoney: () => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [mode, setMode] = useState<"coins" | "usd">("coins");
  const [val, setVal] = useState("");
  const [frac, setFrac] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setVal("");
    setFrac(0);
    setMsg(null);
  }, [coin.id]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4500);
    return () => clearTimeout(t);
  }, [msg]);

  const owned = holding?.amount ?? 0;
  const buy = side === "buy";
  // When a quick-% button is used, the order is recomputed live from the fraction so that
  // price ticks between clicking and submitting can never invalidate it.
  const num = frac > 0 ? 1 : parseFloat(val) || 0;
  const amount =
    frac > 0
      ? buy
        ? (cash * frac) / coin.price
        : owned * frac
      : mode === "coins"
        ? num
        : coin.price > 0
          ? num / coin.price
          : 0;
  const total = frac > 0 ? (buy ? cash * frac : owned * frac * coin.price) : mode === "coins" ? num * coin.price : num;

  let problem: string | null = null;
  if (coin.rugged) problem = "Trading halted — this coin was rugged.";
  else if (num > 0) {
    if (buy && total > cash * (1 + 1e-9) + 1e-9) problem = `Insufficient funds — you have ${fmtUsd(cash)}.`;
    if (!buy && amount > owned * (1 + 1e-9)) problem = owned > 0 ? `You only own ${fmtQty(owned)} ${coin.ticker}.` : `You don't own any ${coin.ticker}.`;
  }
  const disabled = coin.rugged || num <= 0 || !!problem;

  function pctFill(f: number) {
    if (coin.rugged) return;
    setFrac(f);
    if (buy) {
      if (mode === "usd") setVal((Math.floor(cash * f * 100) / 100).toString());
      else setVal(f === 1 ? String(cash / coin.price) : String(Number((((cash * f) / coin.price)).toPrecision(6))));
    } else {
      if (mode === "usd") setVal((Math.floor(owned * f * coin.price * 100) / 100).toString());
      else setVal(f === 1 ? String(owned) : String(Number((owned * f).toPrecision(6))));
    }
  }

  function submit() {
    let q: { amount?: number; usd?: number } = mode === "usd" ? { usd: num } : { amount: num };
    if (frac > 0) q = buy ? { usd: cash * frac } : { amount: owned * frac };
    const r = buy ? actions.buy(coin.id, q) : actions.sell(coin.id, q);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Failed" });
    if (r.ok) {
      setVal("");
      setFrac(0);
    }
  }

  const posValue = owned * coin.price;
  const posPl = holding ? posValue - holding.invested : 0;
  const posPlPct = holding && holding.invested > 0 ? (posPl / holding.invested) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setVal("");
              setFrac(0);
              setMsg(null);
            }}
            className={cn(
              "py-3 text-sm font-extrabold uppercase tracking-wider transition-all",
              side === s
                ? s === "buy"
                  ? "bg-up/15 text-up shadow-[inset_0_-2px_0_#0ecb81]"
                  : "bg-down/15 text-down shadow-[inset_0_-2px_0_#f6465d]"
                : "text-muted hover:bg-white/5 hover:text-white"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{buy ? "Available cash" : `Your ${coin.ticker}`}</span>
          <span className="num font-mono font-semibold">{buy ? fmtUsd(cash) : `${fmtQty(owned)} ${coin.ticker}`}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Market price</span>
          <span className="num font-mono font-semibold">{fmtP(coin.price)}</span>
        </div>

        <div className="relative">
          <input
            inputMode="decimal"
            value={val}
            disabled={coin.rugged}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".");
              if (/^\d*\.?\d*(e-?\d+)?$/i.test(v)) {
                setVal(v);
                setFrac(0);
              }
            }}
            placeholder={mode === "coins" ? "Amount of coins" : "Amount in USD"}
            className={cn(
              "num w-full rounded-xl border bg-black/40 py-3.5 pl-4 pr-24 font-mono text-lg font-semibold outline-none transition-colors placeholder:text-sm placeholder:font-normal placeholder:text-muted disabled:opacity-40",
              problem ? "border-down/60" : buy ? "border-white/10 focus:border-up/60" : "border-white/10 focus:border-down/60"
            )}
          />
          <button
            onClick={() => {
              setMode((m) => (m === "coins" ? "usd" : "coins"));
              setVal("");
              setFrac(0);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-gold transition-colors hover:bg-white/20"
            title="Switch between coin amount and USD amount"
          >
            {mode === "coins" ? coin.ticker : "USD"} ⇄
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <button
              key={f}
              onClick={() => pctFill(f)}
              disabled={coin.rugged}
              className="rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-xs font-bold text-muted transition-all hover:border-white/30 hover:text-white active:scale-95 disabled:opacity-30"
            >
              {f === 1 ? "MAX" : `${f * 100}%`}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 rounded-xl bg-black/25 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">{mode === "coins" ? "Total cost" : "You get"}</span>
            <span className="num font-mono font-semibold">
              {mode === "coins" ? fmtUsd(total) : `${fmtQty(amount)} ${coin.ticker}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{buy ? "Cash after" : "Cash after sale"}</span>
            <span className="num font-mono font-semibold">{fmtUsd(Math.max(0, buy ? cash - total : cash + total))}</span>
          </div>
        </div>

        {problem && <div className="animate-fade rounded-lg bg-down/10 px-3 py-2 text-xs font-medium text-down">{problem}</div>}
        {msg && (
          <div
            className={cn(
              "animate-pop rounded-lg px-3 py-2 text-xs font-semibold",
              msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down"
            )}
          >
            {msg.ok ? "✓ " : "✕ "}
            {msg.text}
          </div>
        )}

        <button
          onClick={submit}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35",
            buy ? "bg-gradient-to-r from-emerald-500 to-up shadow-up/20" : "bg-gradient-to-r from-rose-500 to-down shadow-down/20"
          )}
        >
          {coin.rugged ? "Trading halted" : `${buy ? "BUY" : "SELL"} ${coin.ticker}`}
        </button>

        {buy && cash < 1 && !coin.rugged && (
          <button onClick={onAddMoney} className="w-full text-center text-xs font-semibold text-gold hover:underline">
            Out of cash? Add virtual money →
          </button>
        )}

        {holding && holding.amount > 0 && (
          <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-xs">
            <div className="mb-1.5 font-bold uppercase tracking-wide text-muted">Your position</div>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted">Holding</span>
              <span className="num text-right font-mono">{fmtQty(owned)}</span>
              <span className="text-muted">Avg buy price</span>
              <span className="num text-right font-mono">{fmtP(holding.invested / holding.amount)}</span>
              <span className="text-muted">Value</span>
              <span className="num text-right font-mono">{fmtUsd(posValue)}</span>
              <span className="text-muted">P/L</span>
              <span className={cn("num text-right font-mono font-bold", posPl >= 0 ? "text-up" : "text-down")}>
                {fmtSigned(posPl)} ({fmtPct(posPlPct)})
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
