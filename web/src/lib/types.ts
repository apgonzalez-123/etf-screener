export type N = number | null;

export interface Stock {
  symbol: string;
  ticker: string;
  name: string | null;
  exchange: string | null;
  subtype: string | null;
  typespecs: string[];
  country: string | null;
  sector: string | null;
  industry: string | null;
  close: N;
  change: N;
  pre_change: N;
  post_change: N;
  volume: N;
  rel_volume: N;
  adv: N;
  market_cap: N;
  float_shares: N;
  beta: N;
  atr_pct: N;
  tv_vol_m: N;
  rv20: N;
  rv60: N;
  pe: N;
  ps: N;
  ev_sales: N;
  fwd_pe: N;
  gross_margin: N;
  op_margin: N;
  fcf: N;
  net_debt: N;
  revenue: N;
  roe: N;
  div_yield: N;
  perf_1w: N;
  perf_1m: N;
  perf_3m: N;
  perf_ytd: N;
  perf_1y: N;
  high_52w: N;
  low_52w: N;
  from_high: N;
  from_low: N;
  sma50: N;
  sma200: N;
  rsi: N;
  next_earnings: N;
  pt_avg: N;
  pt_high: N;
  pt_low: N;
  ratings: (number | null)[];
  eps_next_fq: N;
  rev_next_fq: N;
  eps_next_fy: N;
  spark: number[] | null;
  etf_holders: N;
  top_holder: string | null;
}

export interface Fund {
  symbol: string;
  ticker: string;
  name: string | null;
  exchange: string | null;
  typespecs: string[];
  close: N;
  change: N;
  volume: N;
  rel_volume: N;
  adv: N;
  aum: N;
  expense_ratio: N;
  nav: N;
  premium: N;
  index_tracked: string | null;
  asset_class: string | null;
  focus: string | null;
  div_yield: N;
  perf_1m: N;
  perf_ytd: N;
  perf_1y: N;
  high_52w: N;
  low_52w: N;
  from_high: N;
  tv_vol_m: N;
  rv20: N;
  rv60: N;
  spark: number[] | null;
  leveraged: boolean;
  leverage_factor: N;
  flags: string[];
}

export type Asset = (Stock & { kind: "stock" }) | (Fund & { kind: "fund" });

export interface Universe<T> {
  as_of: string;
  source: string;
  rows: T[];
}

export interface Meta {
  generated_at: string;
  sources: Record<string, { name: string; as_of: string; as_of_dates?: string[] }>;
  counts: Record<string, number>;
  warnings: string[];
}

export interface Holder {
  etf: string;
  line: string | null;
  weight: number;
  weight_drift: number;
  market_value: number | null;
  shares: number;
  as_of: string;
  lines: { line: string | null; weight: number }[];
}

export interface Issuer {
  issuer: string;
  name: string;
  symbols: string[];
  holders: Holder[];
}

export interface EtfHoldingsMeta {
  etf: string;
  as_of: string;
  source: string;
  source_url: string;
  aum: N;
  lines: number;
  equity_lines: number;
  mapped_pct: number;
  top10_weight: number;
  effective_n: N;
  sectors: Record<string, number>;
  drift_coverage: number;
}

export interface HoldingsIndex {
  as_of_run: string;
  etfs: EtfHoldingsMeta[];
  issuers: Record<string, Issuer>;
}

export interface HoldingLine {
  name: string;
  ticker: string | null;
  cusip: string | null;
  weight: number;
  weight_drift: number | null;
  shares: N;
  market_value: N;
  asset_type: "equity" | "cash" | "derivative";
  is_derivative: boolean;
  symbol: string | null;
  issuer: string;
}

export interface EtfHoldings extends Omit<EtfHoldingsMeta, "lines"> {
  lines: HoldingLine[];
}

export type Bar = [number, number, number, number, number, number];

export interface Bars {
  symbol: string;
  source: string;
  as_of: string;
  bars: Bar[];
}

export interface Detail {
  symbol: string;
  as_of: string;
  source: string;
  history: Record<string, (number | null)[]>;
  news: { title: string; source: string | null; published: number | null; url: string | null }[] | null;
  news_as_of: string | null;
}
