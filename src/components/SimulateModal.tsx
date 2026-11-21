import { useState, useRef } from "react";
import { actions } from "../engine/store";
import type { DaySummary } from "../engine/simulate";
import { cn } from "../utils/cn";

interface Props {
  onClose: () => void;
}

const PRESETS = [
  { label: "1 day", days: 1, icon: "🌅" },
  { label: "7 days", days: 7, icon: "📅" },
  { label: "30 days", days: 30, icon: "🗓️" },
  { label: "90 days", days: 90, icon: "📆" },
  { label: "365 days", days: 365, icon: "🚀" },
];

export function SimulateModal({ onClose }: Props) {
  const [phase, setPhase] = useState<"pick" | "running" | "done">("pick");
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [mode, setMode] = useState<"realistic" | "unrealistic">("realistic");
  const [progress, setProgress] = useState(0);
  const [currentDay, setCurrentDay] = useState(0);
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [topMovers, setTopMovers] = useState<{ ticker: string; pct: number; emoji: string }[]>([]);
  const abortRef = useRef(false);

  const selectedDays = customDays ? parseInt(customDays) || days : days;

  async function run() {
    if (selectedDays < 1 || selectedDays > 3650) return;
    abortRef.current = false;
    setPhase("running");
    setProgress(0);
    setCurrentDay(0);

    try {
      const result = await (actions as any).simulate(selectedDays, (pct: number, day: number) => {
        if (abortRef.current) return;
        setProgress(pct);
        setCurrentDay(day);
      }, mode);

      setSummary(result.summary);

      // compute top movers from final coins vs start
      // result.coins has updated prices; we need to compare
      // We'll use the summary data since we don't have direct access to original prices here
      const movers: { ticker: string; pct: number; emoji: string }[] = [];
      // Pull from feed items which have pct info
      for (const f of result.feedAppend) {
        const m = f.text.match(/([A-Z]+)\s+([\+\-][\d\.]+)%/);
        if (m) {
          // find emoji from coin name in text
          const emoji = f.icon === "📈" ? "📈" : "📉";
          movers.push({ ticker: m[1], pct: parseFloat(m[2]), emoji });
        }
      }
      setTopMovers(movers);
      setPhase("done");
    } catch (e) {
      console.error("Simulation error", e);
      setPhase("pick");
    }
  }

  const pct = Math.round(progress * 100);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && phase !== "running" && onClose()}
    >
      <div className="animate-pop max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#12161c] shadow-[0_30px_100px_rgba(0,0,0,0.9)] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span className="text-2xl">⏩</span> Fast-Forward Simulator
            </h2>
            <p className="mt-0.5 text-xs text-muted">Skip ahead in time and see what happens to your portfolio</p>
          </div>
          {phase !== "running" && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">
          {phase === "pick" && (
            <div className="space-y-5">
              {/* Warning */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                ⚡ Simulation compresses real time. Prices will change, coins may rug, your portfolio value will shift. Live market pauses during sim.
              </div>

              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                <label className="mb-3 block text-sm font-black text-white">Choose simulation mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["realistic", "unrealistic"] as const).map((m) => (
                    <button type="button" key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("rounded-xl border px-3 py-3 text-left transition-all", mode === m ? "border-violet-400 bg-violet-500/30 text-white ring-2 ring-violet-400/40" : "border-white/15 text-muted hover:border-white/35 hover:text-white")}>
                      <div className="flex items-center gap-2 text-sm font-bold"><span className={cn("h-3 w-3 rounded-full border", mode === m ? "border-violet-200 bg-violet-300" : "border-white/40")} />{m === "realistic" ? "Realistic" : "Unrealistic"}</div>
                      <div className="mt-1 text-[10px]">{m === "realistic" ? "Recommended · max $1B" : "Anything can happen"}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-violet-200/80">Selected: {mode === "realistic" ? "Realistic" : "Unrealistic"}</div>
              </div>

              {/* Presets */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-muted">Quick select</label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.days}
                      onClick={() => { setDays(p.days); setCustomDays(""); }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border py-3 text-center transition-all hover:-translate-y-0.5",
                        days === p.days && !customDays
                          ? "border-violet-500/70 bg-violet-500/20 text-violet-200"
                          : "border-white/10 text-muted hover:border-white/25 hover:text-white"
                      )}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <span className="text-[11px] font-bold">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-muted">Custom days (1 – 3650)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={`${days}`}
                    className="num w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-lg font-semibold outline-none focus:border-violet-500/60"
                  />
                  <div className="flex flex-col justify-center text-xs text-muted">
                    <span>= {selectedDays} days</span>
                    <span>≈ {(selectedDays / 365).toFixed(1)}yr</span>
                  </div>
                </div>
              </div>

              {/* Estimate */}
              <div className="flex items-center justify-between rounded-xl bg-black/30 px-4 py-3 text-xs">
                <span className="text-muted">Estimated sim time</span>
                <span className="font-mono font-bold text-violet-300">
                  {selectedDays <= 7 ? "< 1s" : selectedDays <= 90 ? "1–3s" : selectedDays <= 365 ? "3–8s" : "8–20s"}
                </span>
              </div>

              <button
                onClick={run}
                disabled={selectedDays < 1 || selectedDays > 3650}
                className="btn-shine w-full rounded-xl bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-violet-500/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                ⏩ Simulate {selectedDays} day{selectedDays !== 1 ? "s" : ""}
              </button>
            </div>
          )}

          {phase === "running" && (
            <div className="space-y-6 py-4 text-center">
              <div className="text-5xl animate-bounce">⏩</div>
              <div>
                <div className="mb-1 text-sm font-semibold text-muted">Simulating market…</div>
                <div className="mb-2 font-mono text-2xl font-black text-violet-300">
                  Day {currentDay} / {selectedDays}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-muted">{pct}% complete — market running in background</div>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="mb-1 text-4xl">✅</div>
                <div className="text-lg font-black">
                  {selectedDays} day{selectedDays !== 1 ? "s" : ""} simulated
                </div>
                <div className="text-sm text-muted">Market has been updated. Live feed resumes.</div>
              </div>

              {/* Top movers */}
              {topMovers.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-muted">Notable moves</div>
                  <div className="space-y-1.5">
                    {topMovers.slice(0, 5).map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm">
                        <span className="font-mono font-bold">{m.ticker}</span>
                        <span className={cn("num font-mono font-black", m.pct >= 0 ? "text-green-400" : "text-red-400")}>
                          {m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary by day (last 5 or fewer) */}
              {summary.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-muted">
                    Daily breakdown {summary.length > 5 ? "(last 5 days)" : ""}
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {summary.slice(-5).map((d) => (
                      <div key={d.day} className="rounded-lg bg-black/30 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-muted">Day {d.day}</span>
                          <span className="text-muted">
                            <span className="text-green-400">▲{d.gainers}</span>
                            {" / "}
                            <span className="text-red-400">▼{d.losers}</span>
                            {d.rugs > 0 && <span className="text-orange-400 ml-1">☠{d.rugs}</span>}
                          </span>
                        </div>
                        {d.topGainer && (
                          <div className="flex gap-3 text-[11px]">
                            <span>🏆 <span className="font-mono font-bold">{d.topGainer.ticker}</span> <span className="text-green-400">+{d.topGainer.pct.toFixed(1)}%</span></span>
                            {d.topLoser && (
                              <span>💀 <span className="font-mono font-bold">{d.topLoser.ticker}</span> <span className="text-red-400">{d.topLoser.pct.toFixed(1)}%</span></span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setPhase("pick"); setCustomDays(""); setSummary([]); setTopMovers([]); }}
                  className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-bold text-muted transition hover:bg-white/5 hover:text-white"
                >
                  Simulate Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 py-3 text-sm font-black text-white transition hover:brightness-110"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
