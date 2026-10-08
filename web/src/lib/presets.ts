import type { Cond } from "./filters";

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  universe: "stock" | "fund";
  conds: Omit<Cond, "id">[];
  sort?: { key: string; desc: boolean };
}

// Built only from registered columns. Every preset is a plain filter the user can edit.
export const PRESETS: Preset[] = [
  {
    id: "quality-compounders",
    name: "Quality compounders",
    blurb: "Large caps with operating margin ≥ 20% and positive free cash flow",
    universe: "stock",
    conds: [
      { field: "market_cap", op: "gte", value: 10e9 },
      { field: "op_margin", op: "gte", value: 20 },
      { field: "fcf", op: "gte", value: 1 },
    ],
    sort: { key: "market_cap", desc: true },
  },
  {
    id: "earnings-this-week",
    name: "Earnings this week",
    blurb: "Reporting within 7 days",
    universe: "stock",
    conds: [{ field: "next_earnings", op: "within_days", value: 7 }],
    sort: { key: "market_cap", desc: true },
  },
  {
    id: "unusual-volume",
    name: "Unusual volume",
    blurb: "Relative volume ≥ 2× the 10-day average",
    universe: "stock",
    conds: [{ field: "rel_volume", op: "gte", value: 2 }],
    sort: { key: "rel_volume", desc: true },
  },
  {
    id: "high-vol-liquid",
    name: "High-vol, liquid",
    blurb: "20-day realized vol ≥ 60% with ≥ $50M daily value traded",
    universe: "stock",
    conds: [
      { field: "rv20", op: "gte", value: 60 },
      { field: "adv", op: "gte", value: 50e6 },
    ],
    sort: { key: "rv20", desc: true },
  },
  {
    id: "dividend-payers",
    name: "Dividend payers",
    blurb: "Yield ≥ 3% with positive free cash flow",
    universe: "stock",
    conds: [
      { field: "div_yield", op: "gte", value: 3 },
      { field: "fcf", op: "gte", value: 1 },
    ],
    sort: { key: "div_yield", desc: true },
  },
  {
    id: "fallen-angels",
    name: "Fallen angels",
    blurb: "≥ 30% below the 52-week high with positive free cash flow",
    universe: "stock",
    conds: [
      { field: "from_high", op: "lte", value: -30 },
      { field: "fcf", op: "gte", value: 1 },
    ],
    sort: { key: "market_cap", desc: true },
  },
  {
    id: "new-highs",
    name: "New highs",
    blurb: "Within 1% of the 52-week high",
    universe: "stock",
    conds: [{ field: "from_high", op: "gte", value: -1 }],
    sort: { key: "rel_volume", desc: true },
  },
  {
    id: "brazil-adrs",
    name: "Brazil ADRs",
    blurb: "US-listed Brazilian companies",
    universe: "stock",
    conds: [{ field: "country", op: "in", value: ["Brazil"] }],
    sort: { key: "market_cap", desc: true },
  },
  {
    id: "cheap-core",
    name: "Low-cost core ETFs",
    blurb: "Equity ETFs with fees ≤ 0.10% and AUM ≥ $10B",
    universe: "fund",
    conds: [
      { field: "asset_class", op: "in", value: ["Equity"] },
      { field: "expense_ratio", op: "lte", value: 0.1 },
      { field: "aum", op: "gte", value: 10e9 },
    ],
    sort: { key: "aum", desc: true },
  },
  {
    id: "income-etfs",
    name: "Income ETFs",
    blurb: "Distribution yield ≥ 4%",
    universe: "fund",
    conds: [{ field: "div_yield", op: "gte", value: 4 }],
    sort: { key: "aum", desc: true },
  },
];
