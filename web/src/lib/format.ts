import type { N } from "./types";

export const DASH = "—";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Intl formatters are expensive to construct; the grid formats thousands of cells per second while scrolling.
const nfCache = new Map<string, Intl.NumberFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", opts);
    nfCache.set(key, f);
  }
  return f;
}

export function money(v: N | undefined, digits = 2): string {
  if (!isNum(v)) return DASH;
  return nf(`usd${digits}`, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v).replace("-", "−");
}

export function compact(v: N | undefined, prefix = "$"): string {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  const [d, s] = a >= 1e12 ? [1e12, "T"] : a >= 1e9 ? [1e9, "B"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
  const x = a / d;
  return `${sign}${prefix}${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}${s}`;
}

export function num(v: N | undefined, digits = 2): string {
  if (!isNum(v)) return DASH;
  return nf(`n${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v).replace("-", "−");
}

/** Signed percent: always carries a sign so color never carries meaning alone. */
export function signedPct(v: N | undefined, digits = 2): string {
  if (!isNum(v)) return DASH;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(digits)}%`;
}

export function pct(v: N | undefined, digits = 2): string {
  if (!isNum(v)) return DASH;
  return `${v.toFixed(digits).replace("-", "−")}%`;
}

export function frac(v: N | undefined, digits = 2): string {
  return isNum(v) ? pct(v * 100, digits) : DASH;
}

export function times(v: N | undefined, digits = 1): string {
  return isNum(v) ? `${num(v, digits)}×` : DASH;
}

export function dir(v: N | undefined): "up" | "down" | "flat" {
  if (!isNum(v) || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}

export function arrow(v: N | undefined): string {
  const d = dir(v);
  return d === "up" ? "▲" : d === "down" ? "▼" : "";
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const asOfFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
const asOfCache = new Map<string, string>();

export function date(unix: N | undefined): string {
  if (!isNum(unix)) return DASH;
  return dateFmt.format(new Date(unix * 1000));
}

export function daysUntil(unix: N | undefined, now = Date.now()): number | null {
  if (!isNum(unix)) return null;
  return Math.ceil((unix * 1000 - now) / 86_400_000);
}

export function asOf(iso: string | null | undefined): string {
  if (!iso) return DASH;
  let s = asOfCache.get(iso);
  if (!s) {
    s = asOfFmt.format(new Date(iso));
    asOfCache.set(iso, s);
  }
  return s;
}

export function age(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return DASH;
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
