export function fmtUsd(n: number, digits = 2): string {
  if (!isFinite(n)) return "$0.00";
  const v = Math.abs(n) < 0.005 && digits === 2 ? 0 : n;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSigned(n: number, digits = 2): string {
  const s = fmtUsd(Math.abs(n), digits);
  if (Math.abs(n) < 0.005) return s;
  return (n > 0 ? "+" : "−") + s;
}

/** Price number formatted according to magnitude (no currency symbol) */
export function fmtPrice(p: number): string {
  if (!isFinite(p) || p === 0) return "0.00";
  const a = Math.abs(p);
  if (a >= 1e12) return `${(p / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(p / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(p / 1e6).toFixed(2)}M`;
  let d = 2;
  if (a >= 100) d = 2;
  else if (a >= 10) d = 3;
  else if (a >= 1) d = 4;
  else if (a >= 0.01) d = 5;
  else if (a >= 0.0001) d = 6;
  else d = 8;
  return p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const fmtP = (p: number) => "$" + fmtPrice(p);

export function fmtCompact(n: number, dollar = true): string {
  const a = Math.abs(n);
  const pre = dollar ? "$" : "";
  if (a >= 1e12) return `${pre}${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${pre}${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${pre}${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${pre}${(n / 1e3).toFixed(2)}K`;
  return `${pre}${n.toFixed(2)}`;
}

export function fmtQty(n: number): string {
  if (!isFinite(n)) return "0";
  const a = Math.abs(n);
  if (a >= 1e6) return fmtCompact(n, false);
  if (a >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (a >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function fmtPct(p: number, digits = 2): string {
  if (!isFinite(p)) return "0.00%";
  const a = Math.abs(p);
  let s: string;
  if (a >= 10000) s = (a / 1000).toFixed(1) + "K";
  else s = a.toFixed(digits);
  if (a < 0.005) return "0.00%";
  return (p > 0 ? "+" : "−") + s + "%";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtTime(t: number, seconds = true): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? ":" + pad(d.getSeconds()) : ""}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
