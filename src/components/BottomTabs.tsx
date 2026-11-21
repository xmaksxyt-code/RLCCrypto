import { useState } from "react";
import type { AppState, Coin, HistoryItem } from "../engine/types";
import { marketCap } from "../lib/derive";
import { fmtCompact, fmtDate, fmtP, fmtPct, fmtQty, fmtSigned, fmtTime, fmtUsd } from "../lib/format";
import { cn } from "../utils/cn";
import { Badge, Card, CoinLogo } from "./ui";

type Tab = "positions" | "orders" | "activity" | "about";

export function BottomTabs({
  s,
  coin,
  onSelect,
}: {
  s: AppState;
  coin: Coin;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("positions");
  const tabs: [Tab, string][] = [
    ["positions", `Positions (${Object.keys(s.holdings).length})`],
    ["orders", `${coin.ticker} Trades`],
    ["activity", "All Activity"],
    ["about", `About ${coin.ticker}`],
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex overflow-x-auto border-b border-white/5 px-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors",
              tab === id ? "border-gold text-gold" : "border-transparent text-muted hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="animate-fade" key={tab}>
        {tab === "positions" && <Positions s={s} onSelect={onSelect} />}
        {tab === "orders" && <Orders items={s.history.filter((h) => (h.kind === "buy" || h.kind === "sell") && h.coinId === coin.id)} coin={coin} />}
        {tab === "activity" && <Activity items={s.history} />}
        {tab === "about" && <About coin={coin} />}
      </div>
    </Card>
  );
}

const th = "px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted whitespace-nowrap";
const td = "px-3 py-2.5 whitespace-nowrap";

function Positions({ s, onSelect }: { s: AppState; onSelect: (id: string) => void }) {
  const rows = Object.entries(s.holdings)
    .map(([id, h]) => ({ coin: s.coins.find((c) => c.id === id)!, h }))
    .filter((r) => r.coin);
  if (rows.length === 0)
    return <div className="p-10 text-center text-sm text-muted">No open positions yet. Pick a coin and hit BUY to get started.</div>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel">
          <tr>
            <th className={th}>Coin</th>
            <th className={cn(th, "text-right")}>Amount</th>
            <th className={cn(th, "text-right")}>Avg buy price</th>
            <th className={cn(th, "text-right")}>Invested</th>
            <th className={cn(th, "text-right")}>Price</th>
            <th className={cn(th, "text-right")}>Value</th>
            <th className={cn(th, "text-right")}>P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ coin, h }) => {
            const value = h.amount * coin.price;
            const pl = value - h.invested;
            const pct = h.invested > 0 ? (pl / h.invested) * 100 : 0;
            return (
              <tr key={coin.id} onClick={() => onSelect(coin.id)} className="cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.04]">
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <CoinLogo coin={coin} size={26} />
                    <div>
                      <div className="font-mono font-bold">{coin.ticker}</div>
                      {coin.rugged && <Badge tone="red">Rugged</Badge>}
                    </div>
                  </div>
                </td>
                <td className={cn(td, "num text-right font-mono")}>{fmtQty(h.amount)}</td>
                <td className={cn(td, "num text-right font-mono")}>{fmtP(h.invested / h.amount)}</td>
                <td className={cn(td, "num text-right font-mono")}>{fmtUsd(h.invested)}</td>
                <td className={cn(td, "num text-right font-mono")}>{fmtP(coin.price)}</td>
                <td className={cn(td, "num text-right font-mono font-semibold")}>{fmtUsd(value)}</td>
                <td className={cn(td, "num text-right font-mono font-bold", pl >= 0 ? "text-up" : "text-down")}>
                  {fmtSigned(pl)}
                  <div className="text-[10.5px] opacity-80">{fmtPct(pct)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Orders({ items, coin }: { items: HistoryItem[]; coin: Coin }) {
  if (items.length === 0)
    return <div className="p-10 text-center text-sm text-muted">No trades for {coin.name} yet. Your buy (green) and sell (red) markers will show on the chart.</div>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel">
          <tr>
            <th className={th}>Time</th>
            <th className={th}>Side</th>
            <th className={cn(th, "text-right")}>Price</th>
            <th className={cn(th, "text-right")}>Amount</th>
            <th className={cn(th, "text-right")}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t border-white/[0.04]">
              <td className={cn(td, "num font-mono text-muted")}>
                {fmtDate(t.t)} {fmtTime(t.t)}
              </td>
              <td className={td}>
                <Badge tone={t.kind === "buy" ? "green" : "red"}>{t.kind}</Badge>
              </td>
              <td className={cn(td, "num text-right font-mono")}>{fmtP(t.price ?? 0)}</td>
              <td className={cn(td, "num text-right font-mono")}>{fmtQty(t.amount ?? 0)}</td>
              <td className={cn(td, "num text-right font-mono font-semibold")}>{fmtUsd(t.total ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KIND: Record<string, { label: string; tone: "green" | "red" | "gold" | "blue" | "gray" }> = {
  buy: { label: "Buy", tone: "green" },
  sell: { label: "Sell", tone: "red" },
  deposit: { label: "Deposit", tone: "blue" },
  create: { label: "Created", tone: "gold" },
  pump: { label: "Pump", tone: "green" },
  crash: { label: "Crash", tone: "red" },
  rug: { label: "Rug pull", tone: "red" },
};

const FILTERS: [string, string, (h: HistoryItem) => boolean][] = [
  ["all", "All", () => true],
  ["trades", "Trades", (h) => h.kind === "buy" || h.kind === "sell"],
  ["money", "Deposits", (h) => h.kind === "deposit"],
  ["create", "Created", (h) => h.kind === "create"],
  ["market", "Market events", (h) => h.kind === "pump" || h.kind === "crash" || h.kind === "rug"],
];

function Activity({ items }: { items: HistoryItem[] }) {
  const [f, setF] = useState("all");
  const filt = FILTERS.find((x) => x[0] === f)![2];
  const list = items.filter(filt).slice(0, 250);
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setF(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
              f === id ? "border-gold/50 bg-gold/15 text-gold" : "border-white/10 text-muted hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted">Nothing here yet.</div>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel">
              <tr>
                <th className={th}>Date / Time</th>
                <th className={th}>Type</th>
                <th className={th}>Coin</th>
                <th className={cn(th, "text-right")}>Amount</th>
                <th className={cn(th, "text-right")}>Price</th>
                <th className={cn(th, "text-right")}>Total</th>
                <th className={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {list.map((h) => {
                const k = KIND[h.kind];
                return (
                  <tr key={h.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                    <td className={cn(td, "num font-mono text-muted")}>
                      {fmtDate(h.t)} {fmtTime(h.t)}
                    </td>
                    <td className={td}>
                      <Badge tone={k.tone}>{k.label}</Badge>
                    </td>
                    <td className={td}>{h.coinName ? `${h.emoji ?? ""} ${h.coinName}` : "—"}</td>
                    <td
                      className={cn(
                        td,
                        "num text-right font-mono",
                        h.unit === "pct" && (h.amount! >= 0 ? "text-up" : "text-down")
                      )}
                    >
                      {h.amount === undefined ? "—" : h.unit === "pct" ? fmtPct(h.amount) : h.unit === "usd" ? fmtUsd(h.amount) : `${fmtQty(h.amount)}`}
                    </td>
                    <td className={cn(td, "num text-right font-mono")}>{h.price !== undefined ? fmtP(h.price) : "—"}</td>
                    <td className={cn(td, "num text-right font-mono")}>{h.total !== undefined && h.kind !== "create" ? fmtUsd(h.total) : h.kind === "create" ? `MC ${fmtCompact(h.total ?? 0)}` : "—"}</td>
                    <td className={cn(td, "max-w-[260px] truncate text-muted")} title={h.note}>
                      {h.note ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function About({ coin }: { coin: Coin }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <CoinLogo coin={coin} size={44} />
        <div>
          <div className="text-base font-bold">{coin.name}</div>
          <div className="flex gap-1.5">
            <Badge tone="gray">{coin.ticker}</Badge>
            {coin.creator === "user" ? <Badge tone="gold">★ Created by you</Badge> : <Badge tone="gray">Listed asset</Badge>}
            {coin.rugged && <Badge tone="red">Rugged</Badge>}
          </div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-white/75">{coin.description}</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Info label="Market cap" value={fmtCompact(marketCap(coin))} />
        <Info label="Total supply" value={fmtCompact(coin.supply, false)} />
        <Info label="Launch price" value={fmtP(coin.startPrice)} />
        <Info label="Listed" value={`${fmtDate(coin.createdAt)} ${fmtTime(coin.createdAt, false)}`} />
      </div>
      <p className="text-[11px] text-muted">
        ⚠ Every coin carries hidden risk. Watch the feed for warning signs — but not every crash gives one.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className="num font-mono text-[13px] font-bold">{value}</div>
    </div>
  );
}
