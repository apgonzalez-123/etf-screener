import type { Bar, EtfHoldings, Fund, HoldingsIndex, Issuer, Stock } from "./types";

export interface HolderRow {
  etf: string;
  name: string | null;
  weight: number;
  weight_drift: number;
  dollars: number | null;
  pct_of_float: number | null;
  aum: number | null;
  expense_ratio: number | null;
  adv: number | null;
  efficiency: number | null;
  as_of: string;
  lines: { line: string | null; weight: number }[];
}

export interface Lookup {
  issuer: Issuer;
  stock: Stock | null;
  holders: HolderRow[];
  totalDollars: number | null;
  pctOfFloat: number | null;
  covered: number;
}

export function findIssuer(index: HoldingsIndex, ticker: string, stocks: Stock[]): { issuer: Issuer; stock: Stock | null } | null {
  const t = ticker.trim().toUpperCase();
  const stock = stocks.find((s) => s.ticker === t) ?? null;
  for (const iss of Object.values(index.issuers)) {
    if (stock && iss.symbols.includes(stock.symbol)) return { issuer: iss, stock };
  }
  for (const iss of Object.values(index.issuers)) {
    if (iss.holders.some((h) => h.lines.some((l) => l.line === t))) return { issuer: iss, stock };
  }
  return null;
}

export function reverseLookup(index: HoldingsIndex, ticker: string, stocks: Stock[], funds: Fund[]): Lookup | null {
  const found = findIssuer(index, ticker, stocks);
  if (!found) return null;
  const { issuer, stock } = found;
  const fundBy = new Map(funds.map((f) => [f.ticker, f]));
  // Float is per share class, so % of float is only shown where the ETF holds just the looked-up line.
  const float = stock?.float_shares ?? null;
  const holders: HolderRow[] = issuer.holders.map((h) => {
    const f = fundBy.get(h.etf);
    const er = f?.expense_ratio ?? null;
    const single = !!stock && h.lines.length === 1 && h.lines[0].line === stock.ticker;
    return {
      etf: h.etf,
      name: f?.name ?? null,
      weight: h.weight,
      weight_drift: h.weight_drift,
      dollars: h.market_value,
      pct_of_float: float && single ? (h.shares / float) * 100 : null,
      aum: f?.aum ?? null,
      expense_ratio: er,
      adv: f?.adv ?? null,
      efficiency: er && er > 0 ? (h.weight * 100) / er : null,
      as_of: h.as_of,
      lines: h.lines,
    };
  });
  holders.sort((a, b) => b.weight - a.weight);
  const dollars = holders.map((h) => h.dollars).filter((x): x is number => x !== null);
  const pf = holders.map((h) => h.pct_of_float).filter((x): x is number => x !== null);
  return {
    issuer,
    stock,
    holders,
    totalDollars: dollars.length ? dollars.reduce((a, b) => a + b, 0) : null,
    pctOfFloat: pf.length ? pf.reduce((a, b) => a + b, 0) : null,
    covered: index.etfs.length,
  };
}

/** Physical equity weights by issuer, renormalised to sum to 1. */
export function issuerWeights(h: EtfHoldings): Map<string, number> {
  const m = new Map<string, number>();
  let total = 0;
  for (const l of h.lines) {
    if (l.is_derivative || l.asset_type !== "equity") continue;
    m.set(l.issuer, (m.get(l.issuer) ?? 0) + l.weight);
    total += l.weight;
  }
  if (total > 0) for (const [k, v] of m) m.set(k, v / total);
  return m;
}

export interface Overlap {
  overlap: number;
  common: { issuer: string; name: string; a: number; b: number }[];
  onlyA: number;
  onlyB: number;
}

/** Overlap = Σ min(w_a, w_b) over common issuers. Symmetric, in [0, 1]. */
export function overlapOf(a: EtfHoldings, b: EtfHoldings): Overlap {
  const wa = issuerWeights(a);
  const wb = issuerWeights(b);
  const names = new Map<string, string>();
  for (const l of [...a.lines, ...b.lines]) names.set(l.issuer, l.name);
  let o = 0;
  const common: Overlap["common"] = [];
  for (const [k, v] of wa) {
    const w = wb.get(k);
    if (w !== undefined) {
      o += Math.min(v, w);
      common.push({ issuer: k, name: names.get(k) ?? k, a: v, b: w });
    }
  }
  common.sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b));
  return { overlap: o, common, onlyA: wa.size - common.length, onlyB: wb.size - common.length };
}

export interface Position {
  ticker: string;
  value: number;
}

export interface Exposure {
  issuer: string;
  name: string;
  symbol: string | null;
  direct: number;
  viaFunds: { etf: string; value: number }[];
  total: number;
  pctOfPortfolio: number;
}

export interface PortfolioResult {
  total: number;
  exposures: Exposure[];
  uncoveredFunds: string[];
  unknown: string[];
  fundCash: number;
}

/**
 * Effective exposure per issuer = direct + Σ (ETF position $ × issuer weight in ETF).
 * Weights are the issuer's as-of weights; cash and derivative lines are reported apart.
 */
export function portfolioLookThrough(
  positions: Position[],
  stocks: Stock[],
  funds: Fund[],
  holdings: Map<string, EtfHoldings>,
  issuerOf: (s: Stock) => string,
): PortfolioResult {
  const total = positions.reduce((a, p) => a + p.value, 0);
  const stockBy = new Map(stocks.map((s) => [s.ticker, s]));
  const fundBy = new Map(funds.map((f) => [f.ticker, f]));
  const ex = new Map<string, Exposure>();
  const get = (issuer: string, name: string, symbol: string | null) => {
    let e = ex.get(issuer);
    if (!e) {
      e = { issuer, name, symbol, direct: 0, viaFunds: [], total: 0, pctOfPortfolio: 0 };
      ex.set(issuer, e);
    }
    if (!e.symbol && symbol) e.symbol = symbol;
    return e;
  };
  const uncoveredFunds: string[] = [];
  const unknown: string[] = [];
  let fundCash = 0;
  for (const p of positions) {
    const t = p.ticker.toUpperCase();
    const h = holdings.get(t);
    if (h) {
      for (const l of h.lines) {
        const v = p.value * l.weight;
        if (l.asset_type !== "equity" || l.is_derivative) {
          fundCash += v;
          continue;
        }
        const e = get(l.issuer, l.name, l.symbol);
        const prior = e.viaFunds.find((x) => x.etf === t);
        if (prior) prior.value += v;
        else e.viaFunds.push({ etf: t, value: v });
      }
      continue;
    }
    const s = stockBy.get(t);
    if (s) {
      get(issuerOf(s), s.name ?? t, s.symbol).direct += p.value;
      continue;
    }
    if (fundBy.has(t)) uncoveredFunds.push(t);
    else unknown.push(t);
  }
  const exposures = [...ex.values()].map((e) => {
    const tot = e.direct + e.viaFunds.reduce((a, b) => a + b.value, 0);
    return { ...e, total: tot, pctOfPortfolio: total > 0 ? (tot / total) * 100 : 0 };
  });
  exposures.sort((a, b) => b.total - a.total);
  return { total, exposures, uncoveredFunds, unknown, fundCash };
}

export function parsePositions(text: string): { positions: Position[]; errors: string[] } {
  const positions: Position[] = [];
  const errors: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z.\-]{1,8})[\s,:=]+\$?([\d,]+(?:\.\d+)?)\s*([kKmM])?$/);
    if (!m) {
      errors.push(line);
      continue;
    }
    const mult = m[3] ? (m[3].toLowerCase() === "k" ? 1e3 : 1e6) : 1;
    positions.push({ ticker: m[1].toUpperCase(), value: Number(m[2].replace(/,/g, "")) * mult });
  }
  return { positions, errors };
}

/** Pearson correlation of daily log returns over the last `n` common dates. */
export function correlation(a: Bar[], b: Bar[], n = 60): { r: number; n: number } | null {
  const day = (t: number) => Math.floor(t / 86400);
  const mb = new Map(b.map((x) => [day(x[0]), x[4]]));
  const pairs: [number, number][] = [];
  for (const x of a) {
    const y = mb.get(day(x[0]));
    if (y !== undefined) pairs.push([x[4], y]);
  }
  const tail = pairs.slice(-(n + 1));
  if (tail.length < Math.min(n, 30) + 1) return null;
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    ra.push(Math.log(tail[i][0] / tail[i - 1][0]));
    rb.push(Math.log(tail[i][1] / tail[i - 1][1]));
  }
  const m = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = m(ra);
  const mb2 = m(rb);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb2);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb2) ** 2;
  }
  if (va === 0 || vb === 0) return null;
  return { r: cov / Math.sqrt(va * vb), n: ra.length };
}
