import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Disclosure, Freshness, Skel } from "../components/bits";
import { Num } from "../components/Num";
import { PriceChart } from "../components/PriceChart";
import { loadBars, loadDetail, loadEtfHoldings, loadHoldingsIndex, useAsync, useUniverses } from "../lib/data";
import { arrow, compact, date, daysUntil, dir, frac, money, num, pct, signedPct, times } from "../lib/format";
import { correlation, overlapOf, reverseLookup } from "../lib/lookthrough";
import type { Bar, Fund, Stock } from "../lib/types";

const TV = "TradingView scanner";
const RANGES: [string, number][] = [["1M", 22], ["3M", 64], ["6M", 127], ["1Y", 260]];

export function TearSheet() {
  const { ticker = "" } = useParams();
  const t = decodeURIComponent(ticker).toUpperCase();
  const u = useUniverses();
  if (!u.data) return <div className="page"><Skel h={420} /></div>;
  const stock = u.data.stocks.rows.find((r) => r.ticker === t);
  const fund = u.data.funds.rows.find((r) => r.ticker === t);
  if (stock) return <StockSheet s={stock} asof={u.data.stocks.as_of} />;
  if (fund) return <FundSheet f={fund} asof={u.data.funds.as_of} />;
  return (
    <div className="page">
      <div className="panel empty">
        <h3>{t} is not in this snapshot</h3>
        <p>The snapshot covers US-listed stocks above $1 and $100M market cap, and US-listed funds above $20M AUM.</p>
        <Link className="btn" to="/">Back to the screener</Link>
      </div>
    </div>
  );
}

function Header({ symbol, name, close, change, asof, extra, scrub }: { symbol: string; name: string | null; close: number | null; change: number | null; asof: string; extra?: React.ReactNode; scrub: Bar | null }) {
  const shown = scrub ? scrub[4] : close;
  return (
    <div className="page-head" style={{ alignItems: "flex-start" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>{symbol}</p>
        <h1>{name ?? symbol}</h1>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>
          <Num value={shown} fmt={(v) => money(v)} source={scrub ? "Yahoo Finance daily bar" : TV} asof={scrub ? new Date(scrub[0] * 1000).toISOString() : asof} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {scrub ? (
            <span className="muted">{date(scrub[0])} close</span>
          ) : (
            <>
              <Num value={change} fmt={(v) => signedPct(v)} source={TV} asof={asof} signed />
              {extra}
              <Freshness iso={asof} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ ticker, earnings, onScrub }: { ticker: string; earnings?: number | null; onScrub: (b: Bar | null) => void }) {
  const bars = useAsync(() => loadBars(ticker), [ticker]);
  const [range, setRange] = useState(260);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map(([l, n]) => (
            <button key={l} aria-pressed={range === n} onClick={() => setRange(n)}>{l}</button>
          ))}
        </div>
        <span className="src">Daily bars, {bars.data ? bars.data.source : "loading"}. Intraday and 5Y+ ranges need the live provider.</span>
      </div>
      {bars.data ? <PriceChart bars={bars.data.bars} range={range} earnings={earnings} onScrub={onScrub} /> : bars.error ? <p className="muted">No daily bars in this snapshot.</p> : <Skel h={320} />}
    </div>
  );
}

function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function StockSheet({ s, asof }: { s: Stock; asof: string }) {
  const [scrub, setScrub] = useState<Bar | null>(null);
  const onScrub = useCallback((b: Bar | null) => setScrub(b), []);
  const detail = useAsync(() => loadDetail(s.ticker), [s.ticker]);
  const d2e = daysUntil(s.next_earnings);
  const n = (v: number | null, f: (x: number | null) => string, formula?: string, source = TV) => <Num value={v} fmt={f} source={source} asof={asof} formula={formula} />;

  return (
    <div className="page">
      <Header
        symbol={s.symbol}
        name={s.name}
        close={s.close}
        change={s.change}
        asof={asof}
        scrub={scrub}
        extra={
          s.pre_change !== null || s.post_change !== null ? (
            <span className="muted small">
              {s.pre_change !== null && <>Pre <Num value={s.pre_change} fmt={(v) => signedPct(v)} source={TV} asof={asof} signed /> </>}
              {s.post_change !== null && <>Post <Num value={s.post_change} fmt={(v) => signedPct(v)} source={TV} asof={asof} signed /></>}
            </span>
          ) : null
        }
      />
      <div className="stack">
        <ChartPanel ticker={s.ticker} earnings={s.next_earnings} onScrub={onScrub} />
        <KV
          items={[
            ["Market cap", n(s.market_cap, (v) => compact(v))],
            ["P/E TTM", n(s.pe, (v) => times(v))],
            ["Forward P/E", n(s.fwd_pe, (v) => times(v), "price ÷ consensus EPS next FY", "Computed")],
            ["EV / Sales", n(s.ev_sales, (v) => times(v))],
            ["Beta 1y", n(s.beta, (v) => num(v))],
            ["Realized vol 20d", n(s.rv20, (v) => pct(v, 1), "√252 × stdev(ln Cₜ/Cₜ₋₁), 20 returns", "Computed")],
            ["ATM implied vol", <span className="muted" title="Options provider not connected in this build">—</span>],
            ["Next earnings", <span title={`Source: ${TV}`}>{date(s.next_earnings)}{d2e !== null && d2e >= 0 ? <span className="muted small"> in {d2e}d</span> : null}</span>],
          ]}
        />
        <div className="grid-2">
          <Fundamentals detail={detail.data} asof={asof} s={s} />
          <Street s={s} asof={asof} />
        </div>
        <div className="grid-2">
          <Technicals s={s} asof={asof} />
          <Options />
        </div>
        <div className="grid-2">
          <EtfOwnership ticker={s.ticker} />
          <Peers s={s} />
        </div>
        <News detail={detail.data} />
      </div>
      <Disclosure />
    </div>
  );
}

function Fundamentals({ detail, s, asof }: { detail: Awaited<ReturnType<typeof loadDetail>> | null; s: Stock; asof: string }) {
  const h = detail?.history ?? {};
  const series: [string, (number | null)[], (v: number | null) => string][] = [
    ["Revenue", h.total_revenue_fq_h ?? [], (v) => compact(v)],
    [
      "Gross margin",
      (h.total_revenue_fq_h ?? []).map((r, i) => (r && h.gross_profit_fq_h?.[i] != null ? ((h.gross_profit_fq_h[i] as number) / r) * 100 : null)),
      (v) => pct(v, 1),
    ],
    ["Net income", h.net_income_fq_h ?? [], (v) => compact(v)],
    ["Free cash flow", h.free_cash_flow_fq_h ?? [], (v) => compact(v)],
    ["EBITDA", h.ebitda_fq_h ?? [], (v) => compact(v)],
    ["EPS diluted", h.earnings_per_share_diluted_fq_h ?? [], (v) => money(v)],
  ];
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Fundamentals</h3>
        <span className="src">Last 8 quarters, oldest to newest. TTM: revenue {compact(s.revenue)}, op. margin {pct(s.op_margin, 1)}, net debt {compact(s.net_debt)}</span>
      </div>
      {!detail ? (
        <Skel h={160} />
      ) : (
        <div className="multiples">
          {series.map(([label, vals, f]) => {
            const v = [...vals].slice(0, 8).reverse();
            const finite = v.filter((x): x is number => x !== null);
            const max = Math.max(...finite.map(Math.abs), 1e-9);
            return (
              <div className="multiple" key={label}>
                <div className="muted small">{label}</div>
                <div className="v"><Num value={v[v.length - 1] ?? null} fmt={f} source={TV} asof={asof} formula={label === "Gross margin" ? "gross profit ÷ revenue" : undefined} /></div>
                <div className="bars8" aria-hidden="true">
                  {v.map((x, i) => (
                    <i key={i} className={x !== null && x < 0 ? "neg" : ""} style={{ height: x === null ? 1 : `${(Math.abs(x) / max) * 100}%` }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Street({ s, asof }: { s: Stock; asof: string }) {
  const labels = ["Buy", "Outperform", "Hold", "Underperform", "Sell"];
  const total = s.ratings.reduce<number>((a, b) => a + (b ?? 0), 0);
  const lo = s.pt_low;
  const hi = s.pt_high;
  const pos = (v: number | null) => (v === null || lo === null || hi === null || hi === lo ? null : Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)));
  return (
    <div className="panel">
      <div className="panel-head"><h3>Street view</h3><span className="src">Consensus snapshot, {TV}</span></div>
      {total === 0 ? (
        <p className="muted">No analyst coverage in the feed.</p>
      ) : (
        <>
          <div className="stackbar" role="img" aria-label="Rating distribution">
            {s.ratings.map((r, i) => (r ? <i key={i} style={{ flex: r, background: ["var(--up)", "#8FC7B2", "var(--ink-2)", "#D9A07F", "var(--down)"][i] }} /> : null))}
          </div>
          <div className="legend">
            {s.ratings.map((r, i) => <span key={i}>{labels[i]} {r ?? "—"}</span>)}
          </div>
        </>
      )}
      {lo !== null && hi !== null && (
        <>
          <div className="range" aria-label="Price target range">
            <div className="fill" style={{ left: 0, right: 0 }} />
            {pos(s.pt_avg) !== null && <span className="tag muted" style={{ left: `${pos(s.pt_avg)}%` }}>avg {money(s.pt_avg, 0)}</span>}
            {pos(s.close) !== null && <div className="dot" style={{ left: `${pos(s.close)}%` }} title={`Price ${money(s.close)}`} />}
          </div>
          <div className="row small muted" style={{ justifyContent: "space-between" }}>
            <span>Low <Num value={lo} fmt={(v) => money(v, 0)} source={TV} asof={asof} /></span>
            <span>Price {money(s.close)}</span>
            <span>High <Num value={hi} fmt={(v) => money(v, 0)} source={TV} asof={asof} /></span>
          </div>
        </>
      )}
      <KV
        items={[
          ["EPS est. next Q", <Num value={s.eps_next_fq} fmt={(v) => money(v)} source={TV} asof={asof} />],
          ["Revenue est. next Q", <Num value={s.rev_next_fq} fmt={(v) => compact(v)} source={TV} asof={asof} />],
          ["EPS beat rate, 8Q", <span className="muted" title="Needs get_earnings_history from the live provider">—</span>],
        ]}
      />
    </div>
  );
}

function Technicals({ s, asof }: { s: Stock; asof: string }) {
  const lo = s.low_52w;
  const hi = s.high_52w;
  const p = s.close !== null && lo !== null && hi !== null && hi > lo ? ((s.close - lo) / (hi - lo)) * 100 : null;
  const vs = (ma: number | null) => (s.close !== null && ma ? (s.close / ma - 1) * 100 : null);
  return (
    <div className="panel">
      <div className="panel-head"><h3>Technicals</h3></div>
      <div className="range" aria-label="Position in 52-week range">
        <div className="fill" style={{ left: 0, width: `${p ?? 0}%` }} />
        {p !== null && <div className="dot" style={{ left: `${p}%` }} />}
      </div>
      <div className="row small muted" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <span>52w low {money(lo)}</span>
        <span>{p !== null ? `${p.toFixed(0)}% of range` : "—"}</span>
        <span>52w high {money(hi)}</span>
      </div>
      <KV
        items={[
          ["vs 50-day avg", <Num value={vs(s.sma50)} fmt={(v) => signedPct(v, 1)} source="Computed" asof={asof} formula="price ÷ SMA50 − 1" signed />],
          ["vs 200-day avg", <Num value={vs(s.sma200)} fmt={(v) => signedPct(v, 1)} source="Computed" asof={asof} formula="price ÷ SMA200 − 1" signed />],
          ["RSI 14", <Num value={s.rsi} fmt={(v) => num(v, 0)} source={TV} asof={asof} />],
          ["ATR % of price", <Num value={s.atr_pct} fmt={(v) => pct(v)} source="Computed" asof={asof} formula="ATR14 ÷ price" />],
          ["Rel. volume", <Num value={s.rel_volume} fmt={(v) => times(v, 2)} source={TV} asof={asof} />],
          ["Trend 1W / 1M / 3M", <span>{[s.perf_1w, s.perf_1m, s.perf_3m].map((x, i) => <span key={i} className={dir(x)}>{arrow(x)}</span>)}</span>],
        ]}
      />
    </div>
  );
}

function Options() {
  return (
    <div className="panel">
      <div className="panel-head"><h3>Options</h3></div>
      <p className="muted">
        ATM implied vol, 25-delta skew, term structure and the implied earnings move come from the live options chain
        (get_option_chain). This static build has no options feed, so those figures are left blank rather than estimated.
      </p>
      <p className="small muted" style={{ marginTop: 10 }}>Unusual options activity also needs contract volume and open interest, which the current provider does not carry.</p>
    </div>
  );
}

function EtfOwnership({ ticker }: { ticker: string }) {
  const u = useUniverses();
  const idx = useAsync(loadHoldingsIndex, []);
  const res = useMemo(() => (idx.data && u.data ? reverseLookup(idx.data, ticker, u.data.stocks.rows, u.data.funds.rows) : null), [idx.data, u.data, ticker]);
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>ETF ownership</h3>
        <Link className="src" to={`/look-through?q=${ticker}`}>Open look-through</Link>
      </div>
      {!idx.data ? (
        <Skel h={140} />
      ) : !res ? (
        <p className="muted">Not held by any of the {idx.data.etfs.length} covered ETFs.</p>
      ) : (
        <>
          <p style={{ marginBottom: 10 }}>
            Held by <b>{res.holders.length}</b> of {res.covered} covered ETFs, <b>{compact(res.totalDollars)}</b> in total.
          </p>
          <table className="t">
            <thead><tr><th>ETF</th><th>Weight</th><th>$ held</th></tr></thead>
            <tbody>
              {res.holders.slice(0, 10).map((h) => (
                <tr key={h.etf}><td><Link to={`/s/${h.etf}`}><b>{h.etf}</b></Link></td><td>{frac(h.weight)}</td><td>{compact(h.dollars)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Peers({ s }: { s: Stock }) {
  const u = useUniverses();
  const nav = useNavigate();
  const peers = useMemo(
    () => (u.data ? u.data.stocks.rows.filter((r) => r.industry === s.industry && r.ticker !== s.ticker && (r.adv ?? 0) >= 10e6).sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)).slice(0, 6) : []),
    [u.data, s],
  );
  const corr = useAsync(async () => {
    const base = await loadBars(s.ticker).catch(() => null);
    if (!base) return {} as Record<string, number | null>;
    const out: Record<string, number | null> = {};
    await Promise.all(
      peers.map(async (p) => {
        const b = await loadBars(p.ticker).catch(() => null);
        out[p.ticker] = b ? correlation(base.bars, b.bars, 60)?.r ?? null : null;
      }),
    );
    return out;
  }, [s.ticker, peers.map((p) => p.ticker).join()]);
  return (
    <div className="panel">
      <div className="panel-head"><h3>Peers</h3><span className="src">{s.industry ?? "—"}</span></div>
      {peers.length === 0 ? (
        <p className="muted">No liquid same-industry peers in the snapshot.</p>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Ticker</th><th>Mkt cap</th><th>P/E</th><th>Op mgn</th><th>RV 20d</th><th title="Pearson ρ of daily log returns, 60 sessions">Corr 60d</th></tr></thead>
            <tbody>
              {[s, ...peers].map((p) => (
                <tr key={p.ticker} className="link" onClick={() => nav(`/s/${p.ticker}`)} style={p.ticker === s.ticker ? { background: "var(--bg-2)" } : undefined}>
                  <td><b>{p.ticker}</b></td>
                  <td>{compact(p.market_cap)}</td>
                  <td>{times(p.pe)}</td>
                  <td>{pct(p.op_margin, 1)}</td>
                  <td>{pct(p.rv20, 1)}</td>
                  <td>{p.ticker === s.ticker ? "1.00" : corr.data ? num(corr.data[p.ticker] ?? null) : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function News({ detail }: { detail: Awaited<ReturnType<typeof loadDetail>> | null }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Headlines</h3>
        <span className="src">TradingView headlines. An AI summary of what changed this week is off in this build.</span>
      </div>
      {!detail ? (
        <Skel h={100} />
      ) : !detail.news || detail.news.length === 0 ? (
        <p className="muted">Headlines are collected for the 250 largest stocks and 60 largest funds; none for this name in the snapshot.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          {detail.news.map((n, i) => (
            <li key={i}>
              {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : n.title}{" "}
              <span className="muted small">{n.source}{n.published ? `, ${new Date(n.published * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FundSheet({ f, asof }: { f: Fund; asof: string }) {
  const [scrub, setScrub] = useState<Bar | null>(null);
  const onScrub = useCallback((b: Bar | null) => setScrub(b), []);
  const idx = useAsync(loadHoldingsIndex, []);
  const covered = idx.data?.etfs.some((e) => e.etf === f.ticker);
  const hold = useAsync(() => (covered ? loadEtfHoldings(f.ticker) : Promise.resolve(null)), [f.ticker, covered]);
  const similar = useAsync(async () => {
    if (!hold.data || !idx.data) return [];
    const others = await Promise.all(idx.data.etfs.filter((e) => e.etf !== f.ticker).map((e) => loadEtfHoldings(e.etf)));
    return others.map((o) => ({ etf: o.etf, o: overlapOf(hold.data!, o).overlap })).sort((a, b) => b.o - a.o).slice(0, 5);
  }, [hold.data, idx.data]);
  const meta = idx.data?.etfs.find((e) => e.etf === f.ticker);
  const n = (v: number | null, fm: (x: number | null) => string, formula?: string, source = TV) => <Num value={v} fmt={fm} source={source} asof={asof} formula={formula} />;

  return (
    <div className="page">
      <Header symbol={f.symbol} name={f.name} close={f.close} change={f.change} asof={asof} scrub={scrub} />
      {f.leveraged && (
        <div className="notice" style={{ marginBottom: 14 }}>
          <b>Leveraged or inverse product{f.leverage_factor ? ` (${f.leverage_factor > 0 ? "" : "−"}${Math.abs(f.leverage_factor)}× daily)` : ""}.</b> Resets daily;
          returns over longer periods can differ sharply from the stated multiple of the index. Kept out of default screens and watchlists.
        </div>
      )}
      {f.flags.length > 0 && <div className="notice" style={{ marginBottom: 14 }}>Data check: {f.flags.join("; ")}.</div>}
      <div className="stack">
        <ChartPanel ticker={f.ticker} onScrub={onScrub} />
        <KV
          items={[
            ["AUM", n(f.aum, (v) => compact(v))],
            ["Expense ratio", n(f.expense_ratio, (v) => pct(v))],
            ["NAV", n(f.nav, (v) => money(v))],
            ["Premium / discount", n(f.premium, (v) => signedPct(v))],
            ["Holdings", meta ? <span>{meta.equity_lines}</span> : <span className="muted" title="No holdings file for this issuer yet">—</span>],
            ["Top-10 weight", meta ? n(meta.top10_weight, (v) => frac(v, 1), undefined, "SSGA holdings") : <span className="muted">—</span>],
            ["Effective N", meta ? n(meta.effective_n, (v) => num(v, 0), "1 ÷ Σ w²", "Computed") : <span className="muted">—</span>],
            ["ADV $", n(f.adv, (v) => compact(v), "30-day avg volume × price", "Computed")],
            ["Asset class", <span>{f.asset_class ?? "—"}</span>],
            ["Focus", <span>{f.focus ?? "—"}</span>],
            ["Realized vol 20d", n(f.rv20, (v) => pct(v, 1), "√252 × stdev(ln Cₜ/Cₜ₋₁), 20 returns", "Computed")],
            ["Distribution yield", n(f.div_yield, (v) => pct(v))],
          ]}
        />
        <p className="small muted">Tracks: {f.index_tracked ?? "—"}</p>
        {!covered ? (
          <div className="panel">
            <h3>Holdings</h3>
            <p className="muted" style={{ marginTop: 8 }}>No holdings file for this fund’s issuer yet. Look-through covers State Street SPDR ETFs in this build.</p>
          </div>
        ) : !hold.data ? (
          <Skel h={240} />
        ) : (
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head"><h3>Top 10 holdings</h3><span className="src">As of {hold.data.as_of}, {hold.data.source}</span></div>
              <table className="t">
                <thead><tr><th>Holding</th><th>Weight</th><th>Drift-adj.</th><th>$ value</th></tr></thead>
                <tbody>
                  {hold.data.lines.filter((l) => l.asset_type === "equity").sort((a, b) => b.weight - a.weight).slice(0, 10).map((l) => (
                    <tr key={l.name}>
                      <td className="l">{l.symbol ? <Link to={`/s/${l.ticker}`}><b>{l.ticker}</b></Link> : <b>{l.ticker ?? "—"}</b>} <span className="muted small">{l.name}</span></td>
                      <td>{frac(l.weight)}</td>
                      <td>{frac(l.weight_drift)}</td>
                      <td>{compact(l.market_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hold.data.lines.some((l) => l.is_derivative) && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  Futures or swaps: {hold.data.lines.filter((l) => l.is_derivative).map((l) => `${l.name} ${frac(l.weight)}`).join(", ")}. Shown as synthetic exposure, excluded from physical weights.
                </p>
              )}
            </div>
            <div className="stack">
              <div className="panel">
                <h3>Sector look-through</h3>
                <div className="stack" style={{ gap: 6 }}>
                  {Object.entries(meta?.sectors ?? {}).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <span style={{ width: 180, flex: "none" }} className="small">{k}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--bg-2)", borderRadius: 4 }}>
                        <div style={{ width: `${v * 100}%`, height: "100%", background: "var(--gold)", borderRadius: 4 }} />
                      </div>
                      <span className="small num" style={{ width: 54, textAlign: "right" }}>{frac(v, 1)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3>Most similar covered ETFs</h3>
                {!similar.data ? <Skel h={80} /> : (
                  <table className="t">
                    <thead><tr><th>ETF</th><th>Overlap</th></tr></thead>
                    <tbody>{similar.data.map((x) => <tr key={x.etf}><td><Link to={`/s/${x.etf}`}><b>{x.etf}</b></Link></td><td>{pct(x.o * 100, 1)}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <Disclosure />
    </div>
  );
}
