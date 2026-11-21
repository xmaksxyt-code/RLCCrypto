import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, Coin, HistoryItem } from "../engine/types";
import { BASE_MS } from "../engine/market";
import { fmtCompact, fmtPct, fmtPrice, fmtQty, fmtTime } from "../lib/format";
import { cn } from "../utils/cn";

const TFS = [
  { label: "5s", k: 1 },
  { label: "15s", k: 3 },
  { label: "30s", k: 6 },
  { label: "1m", k: 12 },
];

function aggregate(candles: Candle[], k: number): Candle[] {
  if (k === 1) return candles;
  const span = BASE_MS * k;
  const out: Candle[] = [];
  for (const c of candles) {
    const b = Math.floor(c[0] / span) * span;
    const last = out[out.length - 1];
    if (last && last[0] === b) {
      last[2] = Math.max(last[2], c[2]);
      last[3] = Math.min(last[3], c[3]);
      last[4] = c[4];
      last[5] += c[5];
    } else out.push([b, c[1], c[2], c[3], c[4], c[5]]);
  }
  return out;
}

const UP = "#0ecb81";
const DOWN = "#f6465d";

export function PriceChart({
  coin,
  trades,
  avgPrice,
}: {
  coin: Coin;
  trades: HistoryItem[];
  avgPrice: number;
}) {
  const [tfIdx, setTfIdx] = useState(0);
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [hover, setHover] = useState<{ i: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const tf = TFS[tfIdx];
  const h = w < 520 ? 320 : 440;
  const padL = 8;
  const padR = w < 520 ? 62 : 74;
  const padT = 12;
  const padB = 22;
  const volH = h * 0.14;
  const bottom = h - padB - volH - 8; // bottom of price pane
  const volBase = h - padB;

  const agg = useMemo(() => aggregate(coin.candles, tf.k), [coin, tf.k]);
  const maxVisible = Math.max(20, Math.floor((w - padL - padR) / (mode === "candles" ? 9 : 6)));
  const vis = agg.slice(-maxVisible);
  const slots = Math.max(vis.length + 2, Math.min(maxVisible, 40));
  const plotW = w - padL - padR;
  const slotW = plotW / slots;
  const xAt = (i: number) => padL + (i + 0.5) * slotW;

  // markers mapped to candle index
  const markers = useMemo(() => {
    if (vis.length === 0) return [];
    const first = vis[0][0];
    const res: { x: number; price: number; side: "buy" | "sell"; item: HistoryItem }[] = [];
    for (const tr of trades) {
      if (tr.t < first || !tr.price) continue;
      let idx = -1;
      for (let i = vis.length - 1; i >= 0; i--) {
        if (vis[i][0] <= tr.t) {
          idx = i;
          break;
        }
      }
      if (idx < 0) continue;
      res.push({ x: idx, price: tr.price, side: tr.kind === "buy" ? "buy" : "sell", item: tr });
    }
    return res;
  }, [vis, trades]);

  let lo = Infinity;
  let hi = -Infinity;
  for (const c of vis) {
    if (c[3] < lo) lo = c[3];
    if (c[2] > hi) hi = c[2];
  }
  for (const m of markers) {
    if (m.price < lo) lo = m.price;
    if (m.price > hi) hi = m.price;
  }
  if (!isFinite(lo)) {
    lo = coin.price * 0.99;
    hi = coin.price * 1.01;
  }
  const rawSpan = hi - lo || hi * 0.01 || 1;
  const pad = rawSpan * 0.1;
  hi += pad;
  lo = Math.max(0, lo - pad);
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (bottom - padT);
  const priceAt = (py: number) => hi - ((py - padT) / (bottom - padT)) * (hi - lo);

  let maxV = 0;
  for (const c of vis) if (c[5] > maxV) maxV = c[5];

  const last = vis[vis.length - 1];
  const lastUp = last ? last[4] >= last[1] : true;
  const lastColor = coin.rugged ? "#6b7280" : lastUp ? UP : DOWN;
  const hc = hover ? vis[Math.min(hover.i, vis.length - 1)] : null;
  const shown = hc ?? last;

  const gridVals = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xLabels = vis.length
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.min(vis.length - 1, Math.round(f * (vis.length - 1))))
    : [];

  function onMove(clientX: number, clientY: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    if (vis.length === 0) return;
    const i = Math.max(0, Math.min(vis.length - 1, Math.floor((px - padL) / slotW)));
    setHover({ i, y: py });
  }

  const linePts = vis.map((c, i) => `${xAt(i).toFixed(1)},${y(c[4]).toFixed(1)}`).join(" ");
  const lineUp = vis.length > 1 ? vis[vis.length - 1][4] >= vis[0][1] : true;
  const lineColor = coin.rugged ? "#6b7280" : lineUp ? UP : DOWN;
  const bw = Math.min(slotW * 0.7, 14);
  const lastY = Math.max(padT, Math.min(bottom, y(coin.price)));

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 sm:px-4">
        <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
          {TFS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTfIdx(i)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                i === tfIdx ? "bg-white/10 text-gold shadow" : "text-muted hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-[11px] text-muted sm:flex">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-up" /> Buy
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-down" /> Sell
            </span>
            {avgPrice > 0 && (
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-3 bg-gold" /> Avg entry
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
            {(["candles", "line"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-all",
                  mode === m ? "bg-white/10 text-gold shadow" : "text-muted hover:text-white"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative w-full select-none">
        {/* OHLC legend */}
        {shown && (
          <div className="num pointer-events-none absolute left-3 top-1 z-10 flex flex-wrap gap-x-3 gap-y-0.5 rounded bg-black/40 px-2 py-1 font-mono text-[10.5px] text-muted backdrop-blur-sm sm:left-4">
            <span>{fmtTime(shown[0])}</span>
            <span>
              O <b className="text-white/90">{fmtPrice(shown[1])}</b>
            </span>
            <span>
              H <b className="text-white/90">{fmtPrice(shown[2])}</b>
            </span>
            <span>
              L <b className="text-white/90">{fmtPrice(shown[3])}</b>
            </span>
            <span>
              C <b className="text-white/90">{fmtPrice(shown[4])}</b>
            </span>
            <b style={{ color: shown[4] >= shown[1] ? UP : DOWN }}>
              {fmtPct(shown[1] > 0 ? (shown[4] / shown[1] - 1) * 100 : 0)}
            </b>
            <span>
              Vol <b className="text-white/90">{fmtCompact(shown[5])}</b>
            </span>
          </div>
        )}

        {coin.rugged && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center">
            <div className="warn-blink rounded-lg border border-down/50 bg-down/15 px-4 py-2 text-center text-sm font-black tracking-widest text-down backdrop-blur">
              ☠ RUG PULL — TRADING HALTED
            </div>
          </div>
        )}

        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="block touch-pan-y"
          onMouseMove={(e) => onMove(e.clientX, e.clientY, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => e.touches[0] && onMove(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* grid */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={0.05} />
              <text x={w - padR + 6} y={y(v) + 3.5} fontSize={10} fill="#7d8794" className="num font-mono">
                {fmtPrice(v)}
              </text>
            </g>
          ))}
          <line x1={padL} x2={w - padR} y1={volBase} y2={volBase} stroke="#ffffff" strokeOpacity={0.07} />

          {/* x labels */}
          {xLabels.map((i, k) => (
            <text
              key={k}
              x={Math.max(padL + 14, Math.min(w - padR - 20, xAt(i)))}
              y={h - 6}
              fontSize={10}
              fill="#7d8794"
              textAnchor="middle"
              className="num font-mono"
            >
              {fmtTime(vis[i][0], tf.k < 12)}
            </text>
          ))}

          {/* volume */}
          {maxV > 0 &&
            vis.map((c, i) => {
              const vh = Math.max(1, (c[5] / maxV) * (volH - 4));
              return (
                <rect
                  key={c[0]}
                  x={xAt(i) - bw / 2}
                  y={volBase - vh}
                  width={bw}
                  height={vh}
                  fill={c[4] >= c[1] ? UP : DOWN}
                  opacity={0.35}
                />
              );
            })}

          {/* series */}
          {mode === "candles" ? (
            vis.map((c, i) => {
              const up = c[4] >= c[1];
              const col = up ? UP : DOWN;
              const yo = y(c[1]);
              const yc = y(c[4]);
              return (
                <g key={c[0]}>
                  <line x1={xAt(i)} x2={xAt(i)} y1={y(c[2])} y2={y(c[3])} stroke={col} strokeWidth={1.2} />
                  <rect
                    x={xAt(i) - bw / 2}
                    y={Math.min(yo, yc)}
                    width={bw}
                    height={Math.max(1.5, Math.abs(yo - yc))}
                    fill={col}
                    rx={1}
                  />
                </g>
              );
            })
          ) : vis.length > 1 ? (
            <>
              <polygon points={`${xAt(0)},${bottom} ${linePts} ${xAt(vis.length - 1)},${bottom}`} fill="url(#areaFill)" />
              <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
            </>
          ) : null}

          {/* avg entry */}
          {avgPrice > 0 && avgPrice >= lo && avgPrice <= hi && (
            <g>
              <line x1={padL} x2={w - padR} y1={y(avgPrice)} y2={y(avgPrice)} stroke="#f0b90b" strokeDasharray="2 4" strokeOpacity={0.8} />
              <rect x={padL + 4} y={y(avgPrice) - 9} width={74} height={16} rx={4} fill="#f0b90b" fillOpacity={0.18} />
              <text x={padL + 8} y={y(avgPrice) + 2.5} fontSize={9.5} fill="#f0b90b" fontWeight={700}>
                AVG {fmtPrice(avgPrice)}
              </text>
            </g>
          )}

          {/* last price line */}
          {vis.length > 0 && (
            <g>
              <line x1={padL} x2={w - padR} y1={lastY} y2={lastY} stroke={lastColor} strokeDasharray="4 4" strokeOpacity={0.7} />
              <rect x={w - padR} y={lastY - 9} width={padR - 2} height={18} rx={3} fill={lastColor} />
              <text x={w - padR + 5} y={lastY + 3.5} fontSize={10} fill="#fff" fontWeight={700} className="num font-mono">
                {fmtPrice(coin.price)}
              </text>
            </g>
          )}

          {/* buy / sell markers */}
          {markers.map((m, i) => {
            const mx = xAt(m.x);
            const my = y(m.price);
            const buy = m.side === "buy";
            const col = buy ? UP : DOWN;
            const dir = buy ? 1 : -1;
            return (
              <g key={i}>
                <title>
                  {buy ? "BUY" : "SELL"} {fmtQty(m.item.amount ?? 0)} {coin.ticker} @ ${fmtPrice(m.price)} · {fmtTime(m.item.t)}
                </title>
                <line x1={mx} x2={mx} y1={my} y2={my + dir * 12} stroke={col} strokeWidth={1.5} />
                <path d={`M${mx},${my} L${mx - 5},${my + dir * 9} L${mx + 5},${my + dir * 9} Z`} fill={col} />
                <circle cx={mx} cy={my + dir * 19} r={9} fill={col} stroke="#0b0e11" strokeWidth={2} />
                <text x={mx} y={my + dir * 19 + 3.6} fontSize={10} fontWeight={800} fill="#fff" textAnchor="middle">
                  {buy ? "B" : "S"}
                </text>
              </g>
            );
          })}

          {/* crosshair */}
          {hover && hc && (
            <g pointerEvents="none">
              <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={padT} y2={volBase} stroke="#fff" strokeOpacity={0.25} strokeDasharray="3 3" />
              {hover.y >= padT && hover.y <= bottom && (
                <>
                  <line x1={padL} x2={w - padR} y1={hover.y} y2={hover.y} stroke="#fff" strokeOpacity={0.25} strokeDasharray="3 3" />
                  <rect x={w - padR} y={hover.y - 9} width={padR - 2} height={18} rx={3} fill="#2b3340" />
                  <text x={w - padR + 5} y={hover.y + 3.5} fontSize={10} fill="#fff" className="num font-mono">
                    {fmtPrice(priceAt(hover.y))}
                  </text>
                </>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
