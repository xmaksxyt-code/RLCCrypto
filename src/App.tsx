import { useEffect, useMemo, useState } from "react";
import { actions, startEngine, useStore } from "./engine/store";
import { portfolioStats } from "./lib/derive";
import { Header, Ticker } from "./components/Header";
import { MarketList } from "./components/MarketList";
import { Discover } from "./components/Discover";
import { CoinHeader } from "./components/CoinHeader";
import { PriceChart } from "./components/PriceChart";
import { TradePanel } from "./components/TradePanel";
import { PortfolioSummary } from "./components/PortfolioSummary";
import { EventFeed } from "./components/EventFeed";
import { BottomTabs } from "./components/BottomTabs";
import { AddMoneyModal, CreateCoinModal } from "./components/Modals";
import { SimulateModal } from "./components/SimulateModal";
import { AlertLayer } from "./components/AlertLayer";
import { Card } from "./components/ui";
import { cn } from "./utils/cn";

type MobileTab = "markets" | "trade" | "portfolio" | "feed";

const NAV: { id: MobileTab; label: string; icon: string }[] = [
  { id: "markets", label: "Markets", icon: "📊" },
  { id: "trade", label: "Trade", icon: "💹" },
  { id: "portfolio", label: "Portfolio", icon: "💼" },
  { id: "feed", label: "Feed", icon: "📡" },
];

export default function App() {
  const s = useStore();
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem("novex-selected") || "NOVA");
  const [tab, setTab] = useState<MobileTab>("trade");
  const [showAdd, setShowAdd] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);

  useEffect(() => startEngine(), []);
  useEffect(() => {
    localStorage.setItem("novex-selected", selectedId);
  }, [selectedId]);

  const coin = s.coins.find((c) => c.id === selectedId) ?? s.coins[0];
  const stats = portfolioStats(s);

  const trades = useMemo(
    () => s.history.filter((h) => (h.kind === "buy" || h.kind === "sell") && h.coinId === coin.id),
    [s.history, coin.id]
  );
  const holding = s.holdings[coin.id];
  const avgPrice = holding && holding.amount > 0 ? holding.invested / holding.amount : 0;

  const select = (id: string) => {
    setSelectedId(id);
    setTab("trade");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const show = (t: MobileTab) => (tab === t ? "block" : "hidden") + " xl:block";

  return (
    <div className="min-h-screen pb-20 xl:pb-6">
      <Header equity={stats.equity} cash={s.cash} pl={stats.pl} onAddMoney={() => setShowAdd(true)} onCreate={() => setShowCreate(true)} onSimulate={() => setShowSimulate(true)} />
      <Ticker coins={s.coins} onSelect={select} />

      <main className="mx-auto grid max-w-[1800px] gap-4 p-3 sm:p-5 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
        {/* LEFT: markets */}
        <section className={cn("space-y-4", show("markets"))}>
          <div className="xl:hidden">
            <Discover coins={s.coins} onSelect={select} />
          </div>
          <MarketList coins={s.coins} watchlist={s.watchlist} holdings={s.holdings} selectedId={coin.id} onSelect={select} />
        </section>

        {/* CENTER: chart + tables */}
        <section className="min-w-0 space-y-4">
          <div className="hidden xl:block">
            <Discover coins={s.coins} onSelect={select} />
          </div>
          <div className={show("trade")}>
            <Card className="overflow-hidden pb-2">
              <CoinHeader coin={coin} watched={s.watchlist.includes(coin.id)} onToggleWatch={() => actions.toggleWatch(coin.id)} />
              <PriceChart coin={coin} trades={trades} avgPrice={avgPrice} />
            </Card>
          </div>
          <div className={show("portfolio")}>
            <BottomTabs s={s} coin={coin} onSelect={select} />
          </div>
        </section>

        {/* RIGHT: trade, portfolio, feed */}
        <section className="space-y-4">
          <div className={show("trade")}>
            <TradePanel coin={coin} cash={s.cash} holding={holding} onAddMoney={() => setShowAdd(true)} />
          </div>
          <div className={show("portfolio")}>
            <PortfolioSummary s={s} />
          </div>
          <div className={show("feed")}>
            <EventFeed feed={s.feed} onSelect={select} />
          </div>
        </section>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#0b0e11]/95 backdrop-blur-xl xl:hidden">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              setTab(n.id);
              window.scrollTo({ top: 0 });
            }}
            className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors", tab === n.id ? "text-gold" : "text-muted")}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {showSimulate && <SimulateModal onClose={() => setShowSimulate(false)} />}
      {showAdd && <AddMoneyModal cash={s.cash} onClose={() => setShowAdd(false)} />}
      {showCreate && <CreateCoinModal coins={s.coins} onClose={() => setShowCreate(false)} onCreated={select} />}
      <AlertLayer alerts={s.alerts} onSelect={select} />
    </div>
  );
}
