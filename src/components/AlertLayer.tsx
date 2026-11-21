import { useEffect } from "react";
import { actions } from "../engine/store";
import type { Alert } from "../engine/types";
import { cn } from "../utils/cn";

const TONE = {
  good: "border-up/50 bg-[#0c1f19]/95 text-up",
  bad: "border-down/60 bg-[#240e13]/95 text-down",
  warn: "border-gold/50 bg-[#241d0a]/95 text-gold",
  info: "border-sky-400/40 bg-[#0c1a26]/95 text-sky-300",
};

function Toast({ a, onSelect }: { a: Alert; onSelect: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => actions.dismissAlert(a.id), 6500);
    return () => clearTimeout(t);
  }, [a.id]);
  return (
    <div
      onClick={() => {
        if (a.coinId) onSelect(a.coinId);
        actions.dismissAlert(a.id);
      }}
      className={cn("animate-slide-in pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] cursor-pointer rounded-xl border p-3 shadow-2xl backdrop-blur", TONE[a.tone])}
    >
      <div className="text-sm font-extrabold">{a.title}</div>
      <div className="mt-0.5 text-xs text-white/75">{a.body}</div>
    </div>
  );
}

function RugOverlay({ a }: { a: Alert }) {
  useEffect(() => {
    const t = setTimeout(() => actions.dismissAlert(a.id), 8000);
    return () => clearTimeout(t);
  }, [a.id]);
  return (
    <div
      className="rug-bg fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={() => actions.dismissAlert(a.id)}
    >
      <div className="rug-shake">
        <div className="rug-pulse w-full max-w-xl rounded-3xl border-2 border-down bg-[#14060a] p-8 text-center sm:p-12">
          <div className="text-7xl sm:text-8xl">☠️</div>
          <h1 className="glitch mt-4 text-3xl font-black uppercase tracking-tight text-down sm:text-5xl">{a.title}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-relaxed text-rose-100/90 sm:text-base">{a.body}</p>
          <div className="num mt-5 inline-block rounded-lg bg-down/20 px-5 py-2 font-mono text-2xl font-black text-down">$0.00</div>
          <div className="mt-6 text-xs text-white/40">Click anywhere to dismiss</div>
        </div>
      </div>
    </div>
  );
}

export function AlertLayer({ alerts, onSelect }: { alerts: Alert[]; onSelect: (id: string) => void }) {
  const rug = alerts.find((a) => a.kind === "rug");
  const toasts = alerts.filter((a) => a.kind === "toast").slice(-4);
  return (
    <>
      <div className="pointer-events-none fixed right-4 top-20 z-[90] flex flex-col items-end gap-2">
        {toasts.map((a) => (
          <Toast key={a.id} a={a} onSelect={onSelect} />
        ))}
      </div>
      {rug && <RugOverlay key={rug.id} a={rug} />}
    </>
  );
}
