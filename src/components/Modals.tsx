import { useEffect, useState, useMemo, type ReactNode } from "react";
import { scoreDescription } from "../engine/hype";
import { actions } from "../engine/store";
import type { Coin } from "../engine/types";
import { fmtCompact, fmtP, fmtUsd } from "../lib/format";
import { cn } from "../utils/cn";

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-pop max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#12161c] shadow-[0_30px_100px_rgba(0,0,0,0.8)] sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const PRESETS = [100, 500, 1000, 5000, 10000];

export function AddMoneyModal({ cash, onClose }: { cash: number; onClose: () => void }) {
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function add(n: number) {
    const r = actions.addMoney(n);
    setMsg({ ok: r.ok, text: r.ok ? `✓ ${r.message}` : r.error ?? "Failed" });
    if (r.ok) setCustom("");
  }

  return (
    <Modal title="Add Money" subtitle="Virtual money only — no real funds are involved." onClose={onClose}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-black/30 px-4 py-3">
        <span className="text-xs text-muted">Available cash</span>
        <span className="num font-mono text-lg font-black text-up">{fmtUsd(cash)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => add(p)}
            className="group rounded-xl border border-up/25 bg-up/[0.07] px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-up/60 hover:bg-up/15 active:scale-95"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-up/70">Add</div>
            <div className="num font-mono text-xl font-black text-up">${p.toLocaleString()}</div>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <label className="mb-1.5 block text-xs font-semibold text-muted">Custom amount</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted">$</span>
            <input
              inputMode="decimal"
              value={custom}
              onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add(parseFloat(custom))}
              placeholder="0.00"
              className="num w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-8 pr-3 font-mono text-lg font-semibold outline-none focus:border-up/60"
            />
          </div>
          <button
            onClick={() => add(parseFloat(custom))}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-up px-6 text-sm font-black uppercase tracking-wide text-black transition-all hover:brightness-110 active:scale-95"
          >
            Add
          </button>
        </div>
      </div>
      {msg && (
        <div className={cn("animate-pop mt-4 rounded-lg px-3 py-2 text-sm font-semibold", msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{msg.text}</div>
      )}
    </Modal>
  );
}

const EMOJI_PICKS = ["🪙", "🚀", "🦄", "🐸", "🐱", "🐶", "🦊", "💎", "🔥", "🌙", "⚡", "🍕", "👽", "🤖", "🦁", "🌈"];

export function CreateCoinModal({
  coins,
  onClose,
  onCreated,
}: {
  coins: Coin[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [emoji, setEmoji] = useState("🪙");
  const [price, setPrice] = useState("");
  const [supply, setSupply] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hype = useMemo(() => scoreDescription(desc), [desc]);

  const t = ticker.trim().toUpperCase();
  const dup = t.length > 0 && coins.some((c) => c.ticker === t);
  const p = parseFloat(price) || 0;
  const sp = parseFloat(supply) || 0;

  function submit() {
    if (dup) return setError(`Ticker ${t} is already taken.`);
    const r = actions.createCoin({ name, ticker, emoji, price: p, supply: sp, description: desc });
    if (!r.ok) return setError(r.error ?? "Could not create coin.");
    onCreated(r.id!);
    onClose();
  }

  const field = "w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-gold/60";
  const label = "mb-1 block text-xs font-semibold text-muted";

  return (
    <Modal title="Create Coin" subtitle="Launch your own coin into the simulated market. It could moon — or rug." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label className={label}>Coin name</label>
            <input className={field} value={name} maxLength={24} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. Pixel Panda" />
          </div>
          <div>
            <label className={label}>Ticker</label>
            <input
              className={cn(field, "font-mono uppercase", dup && "border-down/70")}
              value={ticker}
              maxLength={6}
              onChange={(e) => { setTicker(e.target.value.replace(/[^a-zA-Z0-9]/g, "")); setError(null); }}
              placeholder="PNDA"
            />
          </div>
        </div>
        {dup && <p className="-mt-2 text-xs font-medium text-down">Ticker {t} is already taken.</p>}

        <div>
          <label className={label}>Logo / emoji</label>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/40 to-orange-900/40 text-2xl ring-1 ring-white/10">{emoji || "🪙"}</div>
            <input className={cn(field, "w-20 text-center text-lg")} value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {EMOJI_PICKS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn("rounded-md px-1 text-lg transition-transform hover:scale-125", emoji === e && "bg-white/15")}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Initial price (USD)</label>
            <input className={cn(field, "num font-mono")} inputMode="decimal" value={price} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && (setPrice(e.target.value), setError(null))} placeholder="0.05" />
          </div>
          <div>
            <label className={label}>Initial total supply</label>
            <input className={cn(field, "num font-mono")} inputMode="numeric" value={supply} onChange={(e) => /^\d*$/.test(e.target.value) && (setSupply(e.target.value), setError(null))} placeholder="1000000000" />
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea className={cn(field, "h-20 resize-none")} value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} placeholder="What makes your coin special?" />
        </div>

        {/* Hype preview */}
        {hype.tier !== "none" && (
          <div className={`animate-pop rounded-xl border px-4 py-3 text-xs ${
            hype.tier === "viral" ? "border-red-500/50 bg-red-500/10 text-red-300" :
            hype.tier === "high"  ? "border-orange-500/50 bg-orange-500/10 text-orange-300" :
            hype.tier === "medium"? "border-amber-500/50 bg-amber-500/10 text-amber-300" :
                                    "border-green-500/30 bg-green-500/8 text-green-400"
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1">
              {hype.tier === "viral" ? "🚨 VIRAL HYPE DETECTED" :
               hype.tier === "high"  ? "🔥 HIGH HYPE" :
               hype.tier === "medium"? "📈 MEDIUM HYPE" : "✨ LOW HYPE"}
              <span className="ml-auto font-mono opacity-70">{Math.round(hype.score * 100)}%</span>
            </div>
            {hype.reason && <div className="opacity-80">Trigger: {hype.reason}</div>}
            <div className="mt-1 opacity-70">
              {hype.tier === "viral"  && "This coin will EXPLODE at launch and attract massive attention."}
              {hype.tier === "high"   && "Strong cultural relevance — expect a significant launch pump."}
              {hype.tier === "medium" && "Decent buzz — better drift and event rate than a plain launch."}
              {hype.tier === "low"    && "Mild interest — slight edge over a generic coin."}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-black/30 px-4 py-3 text-xs">
          <span className="text-muted">Initial market cap</span>
          <span className="num font-mono text-sm font-black text-gold">{p > 0 && sp > 0 ? fmtCompact(p * sp) : "—"}</span>
          <span className="num font-mono text-muted">{p > 0 ? fmtP(p) : ""}</span>
        </div>

        {error && <div className="animate-pop rounded-lg bg-down/10 px-3 py-2 text-sm font-semibold text-down">{error}</div>}

        <button
          onClick={submit}
          className="btn-shine w-full rounded-xl bg-gradient-to-r from-gold via-amber-300 to-gold py-3.5 text-sm font-black uppercase tracking-wider text-black shadow-lg shadow-gold/20 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          🚀 Launch coin
        </button>
      </div>
    </Modal>
  );
}
