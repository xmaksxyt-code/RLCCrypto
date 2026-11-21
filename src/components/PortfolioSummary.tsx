import type { AppState } from "../engine/types";
import { portfolioStats } from "../lib/derive";
import { fmtPct, fmtSigned, fmtUsd } from "../lib/format";
import { cn } from "../utils/cn";
import { Card } from "./ui";

export function PortfolioSummary({ s }: { s: AppState }) {
  const st = portfolioStats(s);
  const up = st.pl >= 0;
  const segs = [
    { id: "CASH", value: s.cash, color: "#4b5563" },
    ...Object.entries(s.holdings)
      .map(([id, h]) => {
        const c = s.coins.find((x) => x.id === id);
        return { id, value: h.amount * (c?.price ?? 0), color: c ? `hsl(${c.hue} 70% 50%)` : "#888" };
      })
      .filter((x) => x.value > 0),
  ];
  const tot = segs.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wide">PORTFOLIO</h3>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", up ? "bg-up/15 text-up" : "bg-down/15 text-down")}>
          {up ? "▲" : "▼"} {fmtPct(st.plPct)}
        </span>
      </div>

      <div className="text-xs text-muted">Total account balance</div>
      <div className="num font-mono text-3xl font-black tracking-tight">{fmtUsd(st.equity)}</div>
      <div className={cn("num mt-0.5 font-mono text-sm font-bold", up ? "text-up" : "text-down")}>
        {fmtSigned(st.pl)} <span className="text-xs font-semibold opacity-80">total P/L</span>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {segs.map((sg) => (
          <div key={sg.id} title={`${sg.id}: ${fmtUsd(sg.value)}`} className="h-full transition-all duration-700" style={{ width: `${(sg.value / tot) * 100}%`, background: sg.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {segs.map((sg) => (
          <span key={sg.id} className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: sg.color }} />
            {sg.id} {((sg.value / tot) * 100).toFixed(0)}%
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Available cash" value={fmtUsd(s.cash)} />
        <Metric label="Portfolio value" value={fmtUsd(st.value)} />
        <Metric label="Total invested" value={fmtUsd(st.invested)} />
        <Metric label="Total deposited" value={fmtUsd(s.deposited)} />
        <Metric label="Unrealized P/L" value={fmtSigned(st.unrealized)} tone={st.unrealized} />
        <Metric label="Realized P/L" value={fmtSigned(s.realized)} tone={s.realized} />
      </div>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className={cn("num truncate font-mono text-[13px] font-bold", tone === undefined ? "text-white" : tone >= 0 ? "text-up" : "text-down")}>{value}</div>
    </div>
  );
}
