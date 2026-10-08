import { describe, expect, it } from "vitest";
import { correlation, overlapOf, parsePositions, portfolioLookThrough } from "./lookthrough";
import type { Bar, EtfHoldings, HoldingLine, Stock } from "./types";

const line = (issuer: string, weight: number, extra: Partial<HoldingLine> = {}): HoldingLine => ({
  name: issuer,
  ticker: issuer,
  cusip: null,
  weight,
  weight_drift: weight,
  shares: null,
  market_value: null,
  asset_type: "equity",
  is_derivative: false,
  symbol: `NASDAQ:${issuer}`,
  issuer,
  ...extra,
});

const etf = (name: string, lines: HoldingLine[]): EtfHoldings =>
  ({ etf: name, as_of: "2026-10-06", lines } as unknown as EtfHoldings);

const SPYlike = etf("A", [line("AAPL", 0.4), line("MSFT", 0.35), line("NVDA", 0.25)]);
const SPYclone = etf("B", [line("AAPL", 0.4), line("MSFT", 0.35), line("NVDA", 0.25)]);
const Treas = etf("T", [line("UST", 1, { asset_type: "equity", symbol: null })]);

describe("overlap", () => {
  it("identical funds overlap 1, disjoint overlap 0, symmetric", () => {
    expect(overlapOf(SPYlike, SPYclone).overlap).toBeCloseTo(1, 10);
    expect(overlapOf(SPYlike, Treas).overlap).toBe(0);
    const C = etf("C", [line("AAPL", 0.1), line("TSLA", 0.9)]);
    expect(overlapOf(SPYlike, C).overlap).toBe(overlapOf(C, SPYlike).overlap);
  });
  it("swap and cash lines are excluded from physical weights", () => {
    const lev = etf("L", [line("NVDA", 0.6), line("SWAP NVDA", 1.4, { is_derivative: true, asset_type: "derivative" }), line("CASH", 0.1, { asset_type: "cash" })]);
    expect(overlapOf(lev, etf("N", [line("NVDA", 1)])).overlap).toBeCloseTo(1, 10);
  });
});

describe("portfolio look-through", () => {
  it("effective exposure = direct + Σ fund contributions, reconciled to the cent", () => {
    const stocks = [{ ticker: "NVDA", symbol: "NASDAQ:NVDA", name: "NVIDIA" } as Stock];
    const holdings = new Map([["A", SPYlike]]);
    const r = portfolioLookThrough(
      [
        { ticker: "NVDA", value: 250_000.37 },
        { ticker: "A", value: 1_000_000.11 },
      ],
      stocks,
      [],
      holdings,
      () => "NVDA",
    );
    const nv = r.exposures.find((e) => e.issuer === "NVDA")!;
    const expected = 250_000.37 + 1_000_000.11 * 0.25;
    expect(Math.round(nv.total * 100)).toBe(Math.round(expected * 100));
    const sum = r.exposures.reduce((a, e) => a + e.total, 0) + r.fundCash;
    expect(Math.round(sum * 100)).toBe(Math.round(r.total * 100));
  });

  it("parses typed positions and reports lines it cannot read", () => {
    const p = parsePositions("NVDA 250,000\nspy $1.2m\nXLK: 300k\nnonsense here");
    expect(p.positions).toEqual([
      { ticker: "NVDA", value: 250000 },
      { ticker: "SPY", value: 1200000 },
      { ticker: "XLK", value: 300000 },
    ]);
    expect(p.errors).toEqual(["nonsense here"]);
  });
});

describe("correlation", () => {
  it("a series is perfectly correlated with itself", () => {
    const bars: Bar[] = Array.from({ length: 80 }, (_, i) => [i * 86400, 1, 1, 1, 100 * Math.exp(Math.sin(i) / 20), 1]);
    expect(correlation(bars, bars)!.r).toBeCloseTo(1, 10);
  });
});
