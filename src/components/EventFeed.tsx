import type { FeedItem } from "../engine/types";
import { fmtTime } from "../lib/format";
import { cn } from "../utils/cn";
import { Card } from "./ui";

const TONE = {
  good: "border-up/60 bg-up/[0.08] text-emerald-100",
  bad: "border-down/70 bg-down/[0.09] text-rose-100",
  warn: "border-gold/60 bg-gold/[0.08] text-amber-100",
  info: "border-sky-400/50 bg-sky-400/[0.07] text-sky-100",
};

export function EventFeed({ feed, onSelect }: { feed: FeedItem[]; onSelect: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h3 className="text-sm font-bold tracking-wide">LIVE MARKET FEED</h3>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-up">
          <i className="live-dot inline-block h-2 w-2 rounded-full bg-up" /> LIVE
        </span>
      </div>
      <div className="max-h-[420px] space-y-1.5 overflow-y-auto p-2.5 xl:max-h-[360px]">
        {feed.map((f) => (
          <div
            key={f.id}
            onClick={() => f.coinId && onSelect(f.coinId)}
            className={cn(
              "animate-slide-in flex gap-2.5 rounded-lg border-l-[3px] px-3 py-2 text-[12.5px] leading-snug",
              TONE[f.tone],
              f.coinId && "cursor-pointer hover:brightness-125"
            )}
          >
            <span className="text-base leading-none">{f.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{f.text}</div>
              <div className="num mt-0.5 font-mono text-[10px] opacity-60">{fmtTime(f.t)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
