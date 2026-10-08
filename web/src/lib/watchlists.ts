import { DEFAULT_GATES, passStockGates } from "./filters";
import { daysUntil, pct, signedPct } from "./format";
import type { HoldingsIndex, Stock } from "./types";

export type WatchType = "Thematic" | "Event" | "Exposure" | "Volatility" | "Rebalance";

export interface Watchlist {
  id: string;
  type: WatchType;
  title: string;
  rule: string;
  rationale: string;
  names: { ticker: string; why: string }[];
  status: "rules" | "unavailable";
}

/**
 * Deterministic rules pick the names. With the AI flag off, the rationale is a
 * template filled from the same evidence; no symbol appears because a model
 * suggested it.
 */
export function buildWatchlists(stocks: Stock[], index: HoldingsIndex | null, now = Date.now()): Watchlist[] {
  const g = stocks.filter((s) => passStockGates(s, DEFAULT_GATES));
  const out: Watchlist[] = [];

  const semis = g
    .filter((s) => s.industry === "Semiconductors" || s.industry === "Electronic Production Equipment" || s.industry === "Electrical Products")
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 12);
  out.push({
    id: "ai-supply-chain",
    type: "Thematic",
    title: "AI compute supply chain",
    rule: "Industry in Semiconductors, Electronic Production Equipment or Electrical Products; top 12 by market cap after universe gates",
    rationale: `${semis.length} liquid names across chips, chip equipment and power equipment; median 1-year move ${signedPct(median(semis.map((s) => s.perf_1y)), 0)}.`,
    names: semis.map((s) => ({ ticker: s.ticker, why: `${s.industry}, 1Y ${signedPct(s.perf_1y, 0)}` })),
    status: "rules",
  });

  const earn = g
    .filter((s) => {
      const d = daysUntil(s.next_earnings, now);
      return d !== null && d >= 0 && d <= 7 && (s.market_cap ?? 0) >= 10e9;
    })
    .sort((a, b) => (a.next_earnings ?? 0) - (b.next_earnings ?? 0))
    .slice(0, 15);
  out.push({
    id: "earnings-week",
    type: "Event",
    title: "Large caps reporting this week",
    rule: "Market cap ≥ $10B, earnings within 7 days",
    rationale: earn.length
      ? `${earn.length} large caps report in the next week. Implied-move ranking switches on with the options feed.`
      : "No large caps report in the next seven days.",
    names: earn.map((s) => ({ ticker: s.ticker, why: `reports in ${daysUntil(s.next_earnings, now)}d, RV20 ${pct(s.rv20, 0)}` })),
    status: "rules",
  });

  if (index) {
    const top = Object.values(index.issuers)
      .filter((i) => i.symbols.length)
      .map((i) => ({ i, n: i.holders.length, dollars: i.holders.reduce((a, h) => a + (h.market_value ?? 0), 0) }))
      .sort((a, b) => b.n - a.n || b.dollars - a.dollars)
      .slice(0, 12);
    out.push({
      id: "most-owned",
      type: "Exposure",
      title: "Names you own many times over",
      rule: "Issuers held by the most covered ETFs, by count then dollars",
      rationale: `Each of these sits inside at least ${top[top.length - 1]?.n ?? 0} of the ${index.etfs.length} covered funds. A client holding several of those funds owns them repeatedly.`,
      names: top.map(({ i, n }) => ({ ticker: i.symbols[0].split(":")[1], why: `in ${n} covered ETFs` })),
      status: "rules",
    });
  }

  const regime = g
    .filter((s) => s.rv20 !== null && s.rv60 !== null && (s.rv60 as number) > 0 && (s.rv20 as number) / (s.rv60 as number) >= 1.5 && (s.adv ?? 0) >= 50e6)
    .sort((a, b) => (b.rv20 as number) / (b.rv60 as number) - (a.rv20 as number) / (a.rv60 as number))
    .slice(0, 12);
  out.push({
    id: "vol-regime",
    type: "Volatility",
    title: "Volatility regime shift",
    rule: "20-day realized vol ≥ 1.5× 60-day realized vol, ADV ≥ $50M",
    rationale: regime.length ? `${regime.length} liquid names where the last month is far more volatile than the last quarter.` : "No liquid name shows a regime shift today.",
    names: regime.map((s) => ({ ticker: s.ticker, why: `RV20 ${pct(s.rv20, 0)} vs RV60 ${pct(s.rv60, 0)}` })),
    status: "rules",
  });

  out.push({
    id: "rebalance",
    type: "Rebalance",
    title: "Drift vs. model portfolio",
    rule: "Overweights vs. the client’s model through fund overlap",
    rationale: "Needs client model portfolios. Not available in this build.",
    names: [],
    status: "unavailable",
  });
  return out;
}

function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const BLOCKED = /\b(buy|sell|hold|strong buy|price target|will (rise|fall|go up|go down)|guaranteed|outperform|underperform|to the moon)\b/i;

/** Guardrail in code: any recommendation language blocks render. */
export function passesLint(text: string): boolean {
  return !BLOCKED.test(text);
}
