import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Disclosure, Skel } from "../components/bits";
import { Num } from "../components/Num";
import { loadBars, loadEtfHoldings, loadHoldingsIndex, useAsync, useUniverses } from "../lib/data";
import { compact, frac, num, pct, times } from "../lib/format";
import {
  correlation,
  overlapOf,
  parsePositions,
  portfolioLookThrough,
  reverseLookup,
  type HolderRow,
} from "../lib/lookthrough";
import type { EtfHoldings, HoldingsIndex, Stock } from "../lib/types";

type Tab = "who" | "ex" | "overlap" | "portfolio";
const SRC = "SSGA daily holdings × TradingView AUM";
const PALETTE = ["var(--gold)", "#7FA7D9", "#8FC7B2", "#C48FB8", "#D9B27F", "#9AA8BD", "#6E8FBF", "#B5C98F"];

export function LookThrough() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "who";
  const idx = useAsync(loadHoldingsIndex, []);
  const u = useUniverses();
  const setTab = (t: Tab) => {
    params.set("tab", t);
    setParams(params);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Look-through</h1>
          <p>
            See the companies inside the funds. Search a name to find every covered ETF that holds it, compare two funds, or load a
            portfolio to see what it really owns.
          </p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {(
          [
            ["who", "Who holds it"],
            ["ex", "Exposure without the name"],
            ["overlap", "Overlap"],
            ["portfolio", "Portfolio look-through"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {!idx.data || !u.data ? (
        <Skel h={260} />
      ) : (
        <>
          <Coverage idx={idx.data} />
          {tab === "who" && <WhoHolds idx={idx.data} />}
          {tab === "ex" && <ExName idx={idx.data} stocks={u.data.stocks.rows} />}
          {tab === "overlap" && <OverlapTool idx={idx.data} />}
          {tab === "portfolio" && <Portfolio idx={idx.data} />}
        </>
      )}
      <Disclosure />
    </div>
  );
}

function Coverage({ idx }: { idx: HoldingsIndex }) {
  const dates = [...new Set(idx.etfs.map((e) => e.as_of))].sort();
  return (
    <p className="small muted" style={{ marginBottom: 14 }}>
      Holdings coverage: {idx.etfs.length} State Street SPDR ETFs, as of {dates.join(" and ")}. Other issuers (iShares, Vanguard,
      Invesco and more) arrive as their parsers are added; until then they are absent, never estimated.
    </p>
  );
}

function WhoHolds({ idx }: { idx: HoldingsIndex }) {
  const u = useUniverses();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = (params.get("q") || "NVDA").toUpperCase();
  const [draft, setDraft] = useState(q);
  const [rank, setRank] = useState<"weight" | "dollars" | "efficiency">("weight");
  useEffect(() => setDraft(q), [q]);

  const res = useMemo(() => (u.data ? reverseLookup(idx, q, u.data.stocks.rows, u.data.funds.rows) : null), [idx, q, u.data]);
  const holders = useMemo(() => {
    if (!res) return [];
    const key = (h: HolderRow) => (rank === "weight" ? h.weight : rank === "dollars" ? h.dollars ?? -1 : h.efficiency ?? -1);
    return [...res.holders].sort((a, b) => key(b) - key(a));
  }, [res, rank]);

  const asof = idx.etfs[0]?.as_of;

  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          params.set("q", draft.toUpperCase());
          setParams(params);
        }}
      >
        <input className="input" style={{ width: 200, height: 40, fontSize: 16 }} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Ticker" />
        <button className="btn primary" style={{ height: 40 }}>Look through</button>
        <span className="muted small">Try NVDA, GOOGL, JPM, XOM, LLY</span>
      </form>

      {!res ? (
        <div className="panel empty">
          <h3>No covered ETF holds {q}</h3>
          <p>Either the name is not in any of the {idx.etfs.length} covered funds, or the ticker is not a US-listed stock.</p>
        </div>
      ) : (
        <>
          <section className="glass" aria-label={`${q} look-through summary`} data-testid="hero-card">
            <div className="row" style={{ alignItems: "baseline", position: "relative" }}>
              <h2 style={{ fontSize: 15, color: "var(--ink-2)", fontWeight: 500 }}>
                {res.stock?.name ?? res.issuer.name}
                {res.issuer.holders.some((h) => h.lines.length > 1) ? " (all share classes)" : ""}
              </h2>
            </div>
            <div className="glass-figure" style={{ marginTop: 6, position: "relative" }}>
              Held by {res.holders.length} ETF{res.holders.length === 1 ? "" : "s"}
              <small>of {res.covered} covered</small>
            </div>
            <div className="glass-stats">
              <div>
                <b>
                  <Num value={res.totalDollars} fmt={(v) => compact(v)} source={SRC} asof={asof} formula="Σ weight × fund AUM" />
                </b>
                <span>held in these funds</span>
              </div>
              <div>
                <b>
                  <Num value={res.pctOfFloat} fmt={(v) => pct(v, 2)} source={SRC} asof={asof} formula="Σ shares held ÷ float shares" />
                </b>
                <span>of float</span>
              </div>
              <div>
                <b>
                  <Num value={holders[0]?.weight ?? null} fmt={(v) => frac(v)} source={SRC} asof={asof} />
                </b>
                <span>largest weight ({holders[0]?.etf})</span>
              </div>
              {res.stock && (
                <div>
                  <b>
                    <Link to={`/s/${res.stock.ticker}`} style={{ textDecoration: "none" }}>
                      <Num value={res.stock.close} fmt={(v) => (v === null ? "—" : `$${num(v)}`)} source="TradingView scanner" asof={u.data!.stocks.as_of} />
                    </Link>
                  </b>
                  <span>last price</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 20, position: "relative" }}>
              <div className="stackbar" role="img" aria-label="Dollars held by fund">
                {holders
                  .filter((h) => h.dollars)
                  .sort((a, b) => (b.dollars ?? 0) - (a.dollars ?? 0))
                  .slice(0, 8)
                  .map((h, i) => (
                    <i key={h.etf} title={`${h.etf}: ${compact(h.dollars)}`} style={{ flex: h.dollars ?? 0, background: PALETTE[i % PALETTE.length] }} />
                  ))}
              </div>
              <div className="legend">
                {holders
                  .filter((h) => h.dollars)
                  .sort((a, b) => (b.dollars ?? 0) - (a.dollars ?? 0))
                  .slice(0, 8)
                  .map((h, i) => (
                    <span key={h.etf}>
                      <i style={{ background: PALETTE[i % PALETTE.length] }} />
                      {h.etf} {compact(h.dollars)}
                    </span>
                  ))}
              </div>
            </div>
          </section>

          <div className="panel">
            <div className="panel-head">
              <h3>Holders</h3>
              <div className="seg" role="group" aria-label="Rank by">
                <button aria-pressed={rank === "weight"} onClick={() => setRank("weight")}>Purest play</button>
                <button aria-pressed={rank === "dollars"} onClick={() => setRank("dollars")}>Most dollars</button>
                <button aria-pressed={rank === "efficiency"} onClick={() => setRank("efficiency")}>Exposure per fee</button>
              </div>
              <span className="src">Weights as of each fund’s holdings date; drift-adjusted to the latest close</span>
            </div>
            <div className="table-wrap">
              <table className="t" data-testid="holders-table">
                <thead>
                  <tr>
                    <th>ETF</th>
                    <th className="l hide-sm">Name</th>
                    <th>Weight</th>
                    <th title="w × (1 + r since as-of), renormalised">Drift-adj.</th>
                    <th>$ held</th>
                    <th>% of float</th>
                    <th>AUM</th>
                    <th>Exp ratio</th>
                    <th title="weight ÷ expense ratio">Per fee</th>
                    <th>ADV $</th>
                    <th>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h) => (
                    <tr key={h.etf} className="link" onClick={() => nav(`/s/${h.etf}`)}>
                      <td><b>{h.etf}</b></td>
                      <td className="l hide-sm muted" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {h.name ?? "—"}
                        {h.lines.length > 1 ? ` (${h.lines.map((l) => l.line).join(" + ")})` : ""}
                      </td>
                      <td><Num value={h.weight} fmt={(v) => frac(v)} source={SRC} asof={h.as_of} /></td>
                      <td><Num value={h.weight_drift} fmt={(v) => frac(v)} source={SRC} asof={h.as_of} formula="w × (1 + r) ÷ Σ w × (1 + r)" /></td>
                      <td><Num value={h.dollars} fmt={(v) => compact(v)} source={SRC} asof={h.as_of} formula="weight × AUM" /></td>
                      <td><Num value={h.pct_of_float} fmt={(v) => pct(v, 3)} source={SRC} asof={h.as_of} formula="shares held ÷ float" /></td>
                      <td><Num value={h.aum} fmt={(v) => compact(v)} source="TradingView scanner" asof={u.data!.funds.as_of} /></td>
                      <td><Num value={h.expense_ratio} fmt={(v) => pct(v)} source="TradingView scanner" asof={u.data!.funds.as_of} /></td>
                      <td><Num value={h.efficiency} fmt={(v) => times(v, 0)} source="Computed" asof={h.as_of} formula="weight % ÷ expense ratio %" /></td>
                      <td><Num value={h.adv} fmt={(v) => compact(v)} source="Computed" asof={u.data!.funds.as_of} /></td>
                      <td className="muted">{h.as_of}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {res.stock && <HedgeFinder ticker={res.stock.ticker} holders={res.holders} idx={idx} />}
        </>
      )}
    </div>
  );
}

function HedgeFinder({ ticker, holders, idx }: { ticker: string; holders: HolderRow[]; idx: HoldingsIndex }) {
  const r = useAsync(async () => {
    const base = await loadBars(ticker);
    const out = await Promise.all(
      idx.etfs.map(async (e) => {
        try {
          const b = await loadBars(e.etf);
          const c = correlation(base.bars, b.bars, 60);
          return { etf: e.etf, corr: c?.r ?? null, n: c?.n ?? 0, weight: holders.find((h) => h.etf === e.etf)?.weight ?? 0 };
        } catch {
          return { etf: e.etf, corr: null, n: 0, weight: 0 };
        }
      }),
    );
    return { rows: out.filter((x) => x.corr !== null).sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0)).slice(0, 8), asof: base.as_of };
  }, [ticker]);
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Hedge finder</h3>
        <span className="muted small">Covered ETFs ranked by 60-day correlation of daily log returns with {ticker}</span>
      </div>
      {!r.data ? (
        <Skel h={120} />
      ) : (
        <table className="t">
          <thead>
            <tr>
              <th>ETF</th>
              <th>Correlation 60d</th>
              <th>{ticker} weight inside</th>
              <th title="Shorting the ETF also shorts the name itself at this weight">Residual note</th>
            </tr>
          </thead>
          <tbody>
            {r.data.rows.map((x) => (
              <tr key={x.etf}>
                <td><b>{x.etf}</b></td>
                <td><Num value={x.corr} fmt={(v) => num(v, 2)} source="Computed from daily bars" asof={r.data!.asof} formula="Pearson ρ of ln returns, last 60 sessions" /></td>
                <td><Num value={x.weight || null} fmt={(v) => frac(v)} source={SRC} asof={idx.etfs[0]?.as_of} /></td>
                <td className="muted">{x.weight > 0.05 ? "Hedge also removes direct exposure" : "Mostly other names"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function useAllHoldings(idx: HoldingsIndex) {
  return useAsync(async () => {
    const all = await Promise.all(idx.etfs.map((e) => loadEtfHoldings(e.etf)));
    return new Map(all.map((h) => [h.etf, h]));
  }, [idx]);
}

function ExName({ idx, stocks }: { idx: HoldingsIndex; stocks: Stock[] }) {
  const h = useAllHoldings(idx);
  const [industry, setIndustry] = useState("Semiconductors");
  const [name, setName] = useState("NVDA");
  const [minTheme, setMinTheme] = useState(20);
  const [maxName, setMaxName] = useState(5);
  const indBy = useMemo(() => new Map(stocks.map((s) => [s.symbol, s.industry])), [stocks]);
  const industries = useMemo(() => [...new Set(stocks.map((s) => s.industry).filter(Boolean) as string[])].sort(), [stocks]);
  const res = useMemo(() => {
    if (!h.data) return [];
    const t = name.trim().toUpperCase();
    return [...h.data.values()]
      .map((e: EtfHoldings) => {
        let theme = 0;
        let nameW = 0;
        for (const l of e.lines) {
          if (l.asset_type !== "equity") continue;
          if (l.symbol && indBy.get(l.symbol) === industry) theme += l.weight;
          if (l.ticker === t) nameW += l.weight;
        }
        return { etf: e.etf, theme, nameW, as_of: e.as_of };
      })
      .filter((x) => x.theme * 100 >= minTheme && x.nameW * 100 <= maxName)
      .sort((a, b) => b.theme - a.theme);
  }, [h.data, industry, name, minTheme, maxName, indBy]);
  return (
    <div className="stack">
      <div className="row">
        <label className="row small">Industry
          <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {industries.map((i) => <option key={i}>{i}</option>)}
          </select>
        </label>
        <label className="row small">at least <input className="input" type="number" style={{ width: 70 }} value={minTheme} onChange={(e) => setMinTheme(Number(e.target.value))} />%</label>
        <label className="row small">without <input className="input" style={{ width: 90 }} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="row small">above <input className="input" type="number" style={{ width: 70 }} value={maxName} onChange={(e) => setMaxName(Number(e.target.value))} />%</label>
      </div>
      {!h.data ? (
        <Skel h={160} />
      ) : res.length === 0 ? (
        <div className="panel empty">
          <h3>No covered ETF fits</h3>
          <p>Lower the industry threshold or raise the cap on {name.toUpperCase()}.</p>
        </div>
      ) : (
        <div className="panel">
          <table className="t">
            <thead>
              <tr><th>ETF</th><th>{industry}</th><th>{name.toUpperCase()} weight</th><th>As of</th></tr>
            </thead>
            <tbody>
              {res.map((x) => (
                <tr key={x.etf}>
                  <td><Link to={`/s/${x.etf}`}><b>{x.etf}</b></Link></td>
                  <td><Num value={x.theme} fmt={(v) => frac(v, 1)} source={SRC} asof={x.as_of} formula="Σ weights of holdings in this industry" /></td>
                  <td><Num value={x.nameW} fmt={(v) => frac(v)} source={SRC} asof={x.as_of} /></td>
                  <td className="muted">{x.as_of}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverlapTool({ idx }: { idx: HoldingsIndex }) {
  const [a, setA] = useState("XLK");
  const [b, setB] = useState("SPYG");
  const r = useAsync(async () => {
    const [ha, hb] = await Promise.all([loadEtfHoldings(a), loadEtfHoldings(b)]);
    return { ha, hb, o: overlapOf(ha, hb) };
  }, [a, b]);
  const opts = idx.etfs.map((e) => e.etf).sort();
  return (
    <div className="stack">
      <div className="row">
        <select className="input" value={a} onChange={(e) => setA(e.target.value)} aria-label="First ETF">{opts.map((o) => <option key={o}>{o}</option>)}</select>
        <span className="muted">versus</span>
        <select className="input" value={b} onChange={(e) => setB(e.target.value)} aria-label="Second ETF">{opts.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      {!r.data || r.data.ha.etf !== a || r.data.hb.etf !== b ? (
        <Skel h={200} />
      ) : (
        <>
          <section className="glass">
            <div className="glass-figure" data-testid="overlap-figure">
              <Num value={r.data.o.overlap * 100} fmt={(v) => pct(v, 1)} source={SRC} asof={r.data.ha.as_of} formula="Σ min(wₐ, w_b) over common issuers" />
              <small>overlap between {a} and {b}</small>
            </div>
            <div className="glass-stats">
              <div><b>{r.data.o.common.length}</b><span>names in both</span></div>
              <div><b>{r.data.o.onlyA}</b><span>only in {a}</span></div>
              <div><b>{r.data.o.onlyB}</b><span>only in {b}</span></div>
            </div>
          </section>
          <div className="panel">
            <h3>Largest shared positions</h3>
            <table className="t">
              <thead><tr><th>Holding</th><th>{a}</th><th>{b}</th><th>Difference</th></tr></thead>
              <tbody>
                {r.data.o.common.slice(0, 20).map((c) => (
                  <tr key={c.issuer}>
                    <td className="l">{c.name}</td>
                    <td>{frac(c.a)}</td>
                    <td>{frac(c.b)}</td>
                    <td className={c.a - c.b > 0 ? "up" : c.a - c.b < 0 ? "down" : ""}>{c.a - c.b > 0 ? "+" : c.a - c.b < 0 ? "−" : ""}{frac(Math.abs(c.a - c.b))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const EXAMPLE = "SPY 1,000,000\nXLK 400,000\nSPYG 250,000\nNVDA 300,000\nAAPL 150,000\nXLF 200,000";

function Portfolio({ idx }: { idx: HoldingsIndex }) {
  const u = useUniverses();
  const h = useAllHoldings(idx);
  const [text, setText] = useState(EXAMPLE);
  const [threshold, setThreshold] = useState(10);
  const parsed = useMemo(() => parsePositions(text), [text]);
  const issuerBySymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of Object.values(idx.issuers)) for (const s of i.symbols) m.set(s, i.issuer);
    return m;
  }, [idx]);
  const res = useMemo(() => {
    if (!h.data || !u.data) return null;
    return portfolioLookThrough(parsed.positions, u.data.stocks.rows, u.data.funds.rows, h.data, (s) => issuerBySymbol.get(s.symbol) ?? s.ticker);
  }, [h.data, u.data, parsed, issuerBySymbol]);
  const asof = idx.etfs[0]?.as_of;
  const held = parsed.positions.filter((p) => h.data?.has(p.ticker));

  return (
    <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)" }}>
      <div className="panel stack">
        <h3>Positions</h3>
        <p className="small muted">One per line: ticker and market value. The example below is illustrative input, not a client account. In production this loads from the client’s account holdings.</p>
        <textarea className="input" rows={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="Positions" />
        {parsed.errors.length > 0 && <p className="small down">Could not read: {parsed.errors.join("; ")}</p>}
        <label className="row small">Flag any issuer above <input className="input" type="number" style={{ width: 70 }} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />% of the portfolio</label>
      </div>
      {!res ? (
        <Skel h={300} />
      ) : (
        <div className="stack">
          {res.exposures.filter((e) => e.pctOfPortfolio >= threshold).map((e) => (
            <div key={e.issuer} className="notice" role="alert">
              <b>Concentration: {e.name} is {pct(e.pctOfPortfolio, 1)} of this portfolio</b> once funds are looked through.
              {e.viaFunds.length > 0 && ` ${compact(e.viaFunds.reduce((a, b) => a + b.value, 0))} of it comes through ${e.viaFunds.map((v) => v.etf).join(", ")}.`}
            </div>
          ))}
          <div className="panel">
            <div className="panel-head">
              <h3>Top 25 effective exposures</h3>
              <span className="src">Total {compact(res.total)}{res.fundCash ? `, fund cash and derivatives ${compact(res.fundCash)}` : ""}</span>
            </div>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Issuer</th><th>Direct</th><th>Through funds</th><th>Total</th><th>% of portfolio</th><th className="l" style={{ width: "34%" }}>Split</th></tr></thead>
                <tbody>
                  {res.exposures.slice(0, 25).map((e) => {
                    const via = e.viaFunds.reduce((a, b) => a + b.value, 0);
                    return (
                      <tr key={e.issuer}>
                        <td className="l">{e.symbol ? <Link to={`/s/${e.symbol.split(":")[1]}`}>{e.name}</Link> : e.name}</td>
                        <td><Num value={e.direct || null} fmt={(v) => compact(v)} source="Your input" asof={null} /></td>
                        <td><Num value={via || null} fmt={(v) => compact(v)} source={SRC} asof={asof} formula="Σ position $ × weight in fund" /></td>
                        <td><b>{compact(e.total)}</b></td>
                        <td>{pct(e.pctOfPortfolio, 2)}</td>
                        <td className="l">
                          <div className="stackbar" style={{ height: 10 }} title={[e.direct ? `Direct ${compact(e.direct)}` : "", ...e.viaFunds.map((v) => `${v.etf} ${compact(v.value)}`)].filter(Boolean).join(", ")}>
                            {e.direct > 0 && <i style={{ flex: e.direct, background: "var(--ink)" }} />}
                            {e.viaFunds.map((v) => (
                              <i key={v.etf} style={{ flex: v.value, background: PALETTE[held.findIndex((p) => p.ticker === v.etf) % PALETTE.length] }} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="legend">
              <span><i style={{ background: "var(--ink)" }} />Direct</span>
              {held.map((p, i) => <span key={p.ticker}><i style={{ background: PALETTE[i % PALETTE.length] }} />{p.ticker}</span>)}
            </div>
            {(res.uncoveredFunds.length > 0 || res.unknown.length > 0) && (
              <p className="small muted" style={{ marginTop: 10 }}>
                {res.uncoveredFunds.length > 0 && `No holdings file yet for ${res.uncoveredFunds.join(", ")}; counted in the total but not looked through. `}
                {res.unknown.length > 0 && `Not recognised: ${res.unknown.join(", ")}.`}
              </p>
            )}
          </div>
          {h.data && held.length > 1 && <OverlapMatrix etfs={held.map((p) => p.ticker)} all={h.data} />}
        </div>
      )}
    </div>
  );
}

function OverlapMatrix({ etfs, all }: { etfs: string[]; all: Map<string, EtfHoldings> }) {
  return (
    <div className="panel">
      <h3>Overlap between held funds</h3>
      <table className="t">
        <thead><tr><th />{etfs.map((e) => <th key={e}>{e}</th>)}</tr></thead>
        <tbody>
          {etfs.map((a) => (
            <tr key={a}>
              <td><b>{a}</b></td>
              {etfs.map((b) => {
                const o = a === b ? 1 : overlapOf(all.get(a)!, all.get(b)!).overlap;
                return <td key={b} style={{ background: `color-mix(in srgb, var(--gold) ${Math.round(o * 45)}%, transparent)` }}>{pct(o * 100, 0)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
