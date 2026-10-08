import { compact, date, money, num, pct, signedPct, times } from "./format";
import type { Fund, N, Stock } from "./types";

export type Kind = "number" | "text" | "date";

export interface Field<T> {
  key: string;
  label: string;
  /** plain-language label for Client mode */
  plain?: string;
  kind: Kind;
  get: (r: T) => N | string | null;
  fmt: (v: never) => string;
  /** how the figure is derived, shown on hover */
  formula?: string;
  source?: "scanner" | "computed" | "holdings";
  signed?: boolean;
  width?: number;
  align?: "left" | "right";
}

const n = (v: N) => v;
type SF = Field<Stock>;
type FF = Field<Fund>;

export const STOCK_FIELDS: SF[] = [
  { key: "ticker", label: "Ticker", kind: "text", get: (r) => r.ticker, fmt: (v: string) => v, width: 84, align: "left" },
  { key: "name", label: "Name", kind: "text", get: (r) => r.name, fmt: (v: string) => v ?? "—", width: 220, align: "left" },
  { key: "close", label: "Price", kind: "number", get: (r) => n(r.close), fmt: (v: N) => money(v), width: 96 },
  { key: "change", label: "Chg %", plain: "Today", kind: "number", get: (r) => r.change, fmt: (v: N) => signedPct(v), signed: true, width: 84 },
  { key: "market_cap", label: "Mkt cap", plain: "Company size", kind: "number", get: (r) => r.market_cap, fmt: (v: N) => compact(v), width: 92 },
  { key: "adv", label: "ADV $", plain: "Daily trading", kind: "number", get: (r) => r.adv, fmt: (v: N) => compact(v), formula: "30-day average volume × price", source: "computed", width: 88 },
  { key: "rel_volume", label: "Rel vol", kind: "number", get: (r) => r.rel_volume, fmt: (v: N) => times(v, 2), width: 76 },
  { key: "rv20", label: "RV 20d", plain: "Volatility", kind: "number", get: (r) => r.rv20, fmt: (v: N) => pct(v, 1), formula: "√252 × stdev(ln Cₜ/Cₜ₋₁), last 20 daily returns", source: "computed", width: 80 },
  { key: "rv60", label: "RV 60d", kind: "number", get: (r) => r.rv60, fmt: (v: N) => pct(v, 1), formula: "√252 × stdev(ln Cₜ/Cₜ₋₁), last 60 daily returns", source: "computed", width: 80 },
  { key: "beta", label: "Beta 1y", kind: "number", get: (r) => r.beta, fmt: (v: N) => num(v), width: 72 },
  { key: "atr_pct", label: "ATR %", kind: "number", get: (r) => r.atr_pct, fmt: (v: N) => pct(v), formula: "ATR(14) ÷ price", source: "computed", width: 72 },
  { key: "pe", label: "P/E", plain: "Price / earnings", kind: "number", get: (r) => r.pe, fmt: (v: N) => times(v), width: 72 },
  { key: "fwd_pe", label: "Fwd P/E", kind: "number", get: (r) => r.fwd_pe, fmt: (v: N) => times(v), formula: "price ÷ consensus EPS next FY", source: "computed", width: 78 },
  { key: "ev_sales", label: "EV/Sales", kind: "number", get: (r) => r.ev_sales, fmt: (v: N) => times(v), width: 80 },
  { key: "gross_margin", label: "Gross mgn", kind: "number", get: (r) => r.gross_margin, fmt: (v: N) => pct(v, 1), width: 84 },
  { key: "op_margin", label: "Op mgn", kind: "number", get: (r) => r.op_margin, fmt: (v: N) => pct(v, 1), width: 78 },
  { key: "fcf", label: "FCF TTM", kind: "number", get: (r) => r.fcf, fmt: (v: N) => compact(v), width: 88 },
  { key: "div_yield", label: "Div yld", plain: "Dividend", kind: "number", get: (r) => r.div_yield, fmt: (v: N) => pct(v), width: 76 },
  { key: "perf_1m", label: "1M", kind: "number", get: (r) => r.perf_1m, fmt: (v: N) => signedPct(v, 1), signed: true, width: 72 },
  { key: "perf_ytd", label: "YTD", kind: "number", get: (r) => r.perf_ytd, fmt: (v: N) => signedPct(v, 1), signed: true, width: 72 },
  { key: "perf_1y", label: "1Y", plain: "1 year", kind: "number", get: (r) => r.perf_1y, fmt: (v: N) => signedPct(v, 1), signed: true, width: 72 },
  { key: "from_high", label: "From 52w hi", kind: "number", get: (r) => r.from_high, fmt: (v: N) => signedPct(v, 1), formula: "price ÷ 52-week high − 1", source: "computed", signed: true, width: 96 },
  { key: "from_low", label: "From 52w lo", kind: "number", get: (r) => r.from_low, fmt: (v: N) => signedPct(v, 1), formula: "price ÷ 52-week low − 1", source: "computed", signed: true, width: 96 },
  { key: "rsi", label: "RSI 14", kind: "number", get: (r) => r.rsi, fmt: (v: N) => num(v, 0), width: 66 },
  { key: "next_earnings", label: "Earnings", plain: "Next earnings", kind: "date", get: (r) => r.next_earnings, fmt: (v: N) => date(v), width: 104 },
  { key: "etf_holders", label: "ETF holders", kind: "number", get: (r) => r.etf_holders, fmt: (v: N) => num(v, 0), formula: "covered ETFs holding this issuer (look-through)", source: "holdings", width: 90 },
  { key: "top_holder", label: "Top holder", kind: "text", get: (r) => r.top_holder, fmt: (v: string) => v ?? "—", source: "holdings", width: 88, align: "left" },
  { key: "sector", label: "Sector", kind: "text", get: (r) => r.sector, fmt: (v: string) => v ?? "—", width: 170, align: "left" },
  { key: "industry", label: "Industry", kind: "text", get: (r) => r.industry, fmt: (v: string) => v ?? "—", width: 190, align: "left" },
  { key: "country", label: "Country", kind: "text", get: (r) => r.country, fmt: (v: string) => v ?? "—", width: 120, align: "left" },
  { key: "exchange", label: "Exch", kind: "text", get: (r) => r.exchange, fmt: (v: string) => v ?? "—", width: 70, align: "left" },
];

export const FUND_FIELDS: FF[] = [
  { key: "ticker", label: "Ticker", kind: "text", get: (r) => r.ticker, fmt: (v: string) => v, width: 84, align: "left" },
  { key: "name", label: "Name", kind: "text", get: (r) => r.name, fmt: (v: string) => v ?? "—", width: 260, align: "left" },
  { key: "close", label: "Price", kind: "number", get: (r) => r.close, fmt: (v: N) => money(v), width: 92 },
  { key: "change", label: "Chg %", plain: "Today", kind: "number", get: (r) => r.change, fmt: (v: N) => signedPct(v), signed: true, width: 84 },
  { key: "aum", label: "AUM", plain: "Fund size", kind: "number", get: (r) => r.aum, fmt: (v: N) => compact(v), width: 88 },
  { key: "expense_ratio", label: "Exp ratio", plain: "Annual fee", kind: "number", get: (r) => r.expense_ratio, fmt: (v: N) => pct(v, 2), width: 84 },
  { key: "adv", label: "ADV $", kind: "number", get: (r) => r.adv, fmt: (v: N) => compact(v), formula: "30-day average volume × price", source: "computed", width: 84 },
  { key: "premium", label: "Prem/disc", kind: "number", get: (r) => r.premium, fmt: (v: N) => signedPct(v), signed: true, width: 84 },
  { key: "asset_class", label: "Asset class", kind: "text", get: (r) => r.asset_class, fmt: (v: string) => v ?? "—", width: 110, align: "left" },
  { key: "focus", label: "Focus", kind: "text", get: (r) => r.focus, fmt: (v: string) => v ?? "—", width: 130, align: "left" },
  { key: "div_yield", label: "Yield", kind: "number", get: (r) => r.div_yield, fmt: (v: N) => pct(v), width: 70 },
  { key: "rv20", label: "RV 20d", kind: "number", get: (r) => r.rv20, fmt: (v: N) => pct(v, 1), formula: "√252 × stdev(ln Cₜ/Cₜ₋₁), last 20 daily returns", source: "computed", width: 78 },
  { key: "perf_1m", label: "1M", kind: "number", get: (r) => r.perf_1m, fmt: (v: N) => signedPct(v, 1), signed: true, width: 70 },
  { key: "perf_ytd", label: "YTD", kind: "number", get: (r) => r.perf_ytd, fmt: (v: N) => signedPct(v, 1), signed: true, width: 70 },
  { key: "perf_1y", label: "1Y", kind: "number", get: (r) => r.perf_1y, fmt: (v: N) => signedPct(v, 1), signed: true, width: 70 },
  { key: "index_tracked", label: "Index", kind: "text", get: (r) => r.index_tracked, fmt: (v: string) => v ?? "—", width: 240, align: "left" },
];

export const CLIENT_STOCK_COLS = ["ticker", "name", "close", "change", "market_cap", "perf_1y", "div_yield", "next_earnings"];
export const DESK_STOCK_COLS = ["ticker", "name", "close", "change", "market_cap", "adv", "rel_volume", "rv20", "rv60", "beta", "pe", "fwd_pe", "ev_sales", "op_margin", "div_yield", "perf_1m", "perf_ytd", "from_high", "next_earnings", "etf_holders", "sector", "industry"];
export const CLIENT_FUND_COLS = ["ticker", "name", "close", "change", "aum", "expense_ratio", "perf_1y", "asset_class"];
export const DESK_FUND_COLS = ["ticker", "name", "close", "change", "aum", "expense_ratio", "adv", "premium", "asset_class", "focus", "div_yield", "rv20", "perf_1m", "perf_ytd", "perf_1y", "index_tracked"];

export function fieldMap<T>(fields: Field<T>[]): Record<string, Field<T>> {
  return Object.fromEntries(fields.map((f) => [f.key, f]));
}
