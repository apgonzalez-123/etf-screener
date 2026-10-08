import type { Field } from "./fields";
import type { Fund, Stock } from "./types";

export type Op = "gte" | "lte" | "between" | "in" | "contains" | "within_days";

export interface Cond {
  id: string;
  field: string;
  op: Op;
  value: number | [number, number] | string[] | string;
}

export interface Group {
  id: string;
  join: "and" | "or";
  items: (Cond | Group)[];
}

export const isGroup = (x: Cond | Group): x is Group => "items" in x;

let seq = 0;
export const uid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export function evalCond<T>(row: T, c: Cond, fields: Record<string, Field<T>>, now = Date.now()): boolean {
  const f = fields[c.field];
  if (!f) return false;
  const v = f.get(row);
  switch (c.op) {
    case "gte":
      return typeof v === "number" && v >= (c.value as number);
    case "lte":
      return typeof v === "number" && v <= (c.value as number);
    case "between": {
      const [lo, hi] = c.value as [number, number];
      return typeof v === "number" && v >= lo && v <= hi;
    }
    case "in":
      return typeof v === "string" && (c.value as string[]).includes(v);
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(c.value).toLowerCase());
    case "within_days": {
      if (typeof v !== "number") return false;
      const days = (v * 1000 - now) / 86_400_000;
      return days >= -0.5 && days <= (c.value as number);
    }
  }
}

export function evalGroup<T>(row: T, g: Group, fields: Record<string, Field<T>>, now = Date.now()): boolean {
  if (!g.items.length) return true;
  const test = (x: Cond | Group) => (isGroup(x) ? evalGroup(row, x, fields, now) : evalCond(row, x, fields, now));
  return g.join === "and" ? g.items.every(test) : g.items.some(test);
}

export function describe<T>(c: Cond, fields: Record<string, Field<T>>): string {
  const f = fields[c.field];
  const label = f?.label ?? c.field;
  const fmt = (x: number) => (f ? (f.fmt as (v: number) => string)(x) : String(x));
  switch (c.op) {
    case "gte":
      return `${label} ≥ ${fmt(c.value as number)}`;
    case "lte":
      return `${label} ≤ ${fmt(c.value as number)}`;
    case "between": {
      const [lo, hi] = c.value as [number, number];
      return `${label} ${fmt(lo)} to ${fmt(hi)}`;
    }
    case "in":
      return `${label}: ${(c.value as string[]).join(", ")}`;
    case "contains":
      return `${label} contains “${c.value}”`;
    case "within_days":
      return `${label} in next ${c.value} days`;
  }
}

// ---------- universe gates ----------

export interface Gates {
  minPrice: boolean;
  minAdv: boolean;
  minSize: boolean;
  excludeLeveraged: boolean;
}

export const DEFAULT_GATES: Gates = { minPrice: true, minAdv: true, minSize: true, excludeLeveraged: true };

export const GATE_TEXT = {
  listed: "Listed exchange only, no OTC",
  minPrice: "Price ≥ $5",
  minAdvStock: "Avg daily value ≥ $10M",
  minAdvFund: "Avg daily value ≥ $5M",
  minSizeStock: "Market cap ≥ $300M",
  minSizeFund: "AUM ≥ $50M",
  excludeLeveraged: "Leveraged and inverse in their own tab",
};

const LISTED = new Set(["NYSE", "NASDAQ", "AMEX", "CBOE"]);

export function passStockGates(s: Stock, g: Gates): boolean {
  if (!s.exchange || !LISTED.has(s.exchange)) return false;
  if (g.minPrice && !((s.close ?? 0) >= 5)) return false;
  if (g.minAdv && !((s.adv ?? 0) >= 10e6)) return false;
  if (g.minSize && !((s.market_cap ?? 0) >= 300e6)) return false;
  return true;
}

export function passFundGates(f: Fund, g: Gates): boolean {
  if (!f.exchange || !LISTED.has(f.exchange)) return false;
  if (g.minPrice && !((f.close ?? 0) >= 5)) return false;
  if (g.minAdv && !((f.adv ?? 0) >= 5e6)) return false;
  if (g.minSize && !((f.aum ?? 0) >= 50e6)) return false;
  if (g.excludeLeveraged && f.leveraged) return false;
  return true;
}

/** Client mode cannot go below the gates. Desk mode can relax them. */
export function effectiveGates(mode: "client" | "desk", requested: Gates): Gates {
  return mode === "client" ? DEFAULT_GATES : requested;
}
