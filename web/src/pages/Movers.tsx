import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Disclosure, Skel } from "../components/bits";
import { Num } from "../components/Num";
import { Spark } from "../components/Spark";
import { useApp } from "../lib/app";
import { useUniverses } from "../lib/data";
import { DEFAULT_GATES, passFundGates, passStockGates } from "../lib/filters";
import { daysUntil, money, pct, signedPct, times } from "../lib/format";
import type { Fund, Stock } from "../lib/types";

type Tab = "movers" | "volume" | "rv" | "earnings" | "breakouts" | "leveraged";

const TABS: [Tab, string, string][] = [
  ["movers", "Top movers", "Largest moves today, up and down, after universe gates."],
  ["volume", "Unusual volume", "Relative volume at least 2× the 10-day average."],
  ["rv", "High realized vol", "20-day realized volatility at least 60%, annualized."],
  ["earnings", "Earnings this week", "Reporting within 5 sessions."],
  ["breakouts", "Breakouts", "Within 1% of a 52-week high or low on relative volume ≥ 1.5."],
  ["leveraged", "Leveraged ETFs", "Kept apart from every other tab. Daily reset."],
];

const TV = "TradingView scanner";

export function Movers() {
  const u = useUniverses();
  const { mode } = useApp();
  const [tab, setTab] = useState<Tab>("movers");

  const stocks = useMemo(() => (u.data ? u.data.stocks.rows.filter((s) => passStockGates(s, DEFAULT_GATES)) : []), [u.data]);
  const lev = useMemo(
    () => (u.data ? u.data.funds.rows.filter((f) => f.leveraged && passFundGates(f, { ...DEFAULT_GATES, excludeLeveraged: false })) : []),
    [u.data],
  );

  const lists = useMemo(() => {
    const by = (k: (s: Stock) => number | null, desc = true) =>
      [...stocks].filter((s) => k(s) !== null).sort((a, b) => (desc ? 1 : -1) * ((k(b) as number) - (k(a) as number)));
    return {
      up: by((s) => s.change).slice(0, 25),
      down: by((s) => s.change, false).slice(0, 25),
      volume: by((s) => s.rel_volume).filter((s) => (s.rel_volume ?? 0) >= 2),
      rv: by((s) => s.rv20).filter((s) => (s.rv20 ?? 0) >= 60),
      earnings: stocks
        .filter((s) => {
          const d = daysUntil(s.next_earnings);
          return d !== null && d >= 0 && d <= 7;
        })
        .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)),
      breakouts: stocks
        .filter((s) => (s.rel_volume ?? 0) >= 1.5 && ((s.from_high ?? -99) >= -1 || (s.from_low ?? 99) <= 1))
        .sort((a, b) => (b.rel_volume ?? 0) - (a.rel_volume ?? 0)),
      lev: [...lev].sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)),
    };
  }, [stocks, lev]);

  if (!u.data) return <div className="page"><Skel h={400} /></div>;
  const asof = u.data.stocks.as_of;
  const info = TABS.find((t) => t[0] === tab)!;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Movers</h1>
          <p>Names moving the tape that are liquid enough to trade. Tap a card to open the tear sheet.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>{info[2]}</p>

      {tab === "movers" && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <section><h2 style={{ marginBottom: 10 }}>Up</h2><Cards rows={lists.up} asof={asof} mode={mode} /></section>
          <section><h2 style={{ marginBottom: 10 }}>Down</h2><Cards rows={lists.down} asof={asof} mode={mode} /></section>
        </div>
      )}
      {tab === "volume" && <Cards rows={lists.volume} asof={asof} mode={mode} />}
      {tab === "rv" && <Cards rows={lists.rv} asof={asof} mode={mode} />}
      {tab === "earnings" && <Cards rows={lists.earnings} asof={asof} mode={mode} note="Sorted by market cap." />}
      {tab === "breakouts" && <Cards rows={lists.breakouts} asof={asof} mode={mode} />}
      {tab === "leveraged" && <FundCards rows={lists.lev} asof={u.data.funds.as_of} />}
      <Disclosure />
    </div>
  );
}

function Cards({ rows, asof, mode, note }: { rows: Stock[]; asof: string; mode: string; note?: string }) {
  const nav = useNavigate();
  if (!rows.length) return <div className="panel empty"><h3>Nothing qualifies right now</h3><p>No gated name meets this rule in the current snapshot.</p></div>;
  return (
    <>
      {note && <p className="muted small" style={{ marginBottom: 8 }}>{note}</p>}
      <div className="movers">
        {rows.slice(0, 60).map((s) => {
          const d = daysUntil(s.next_earnings);
          return (
            <button key={s.symbol} className="mover" onClick={() => nav(`/s/${s.ticker}`)} aria-label={`${s.ticker}, ${signedPct(s.change)}`}>
              <div style={{ minWidth: 0 }}>
                <div className="t">{s.ticker}</div>
                <div className="n">{s.name}</div>
              </div>
              <Spark data={s.spark} width={88} height={28} />
              <div className="p">
                <b><Num value={s.close} fmt={(v) => money(v)} source={TV} asof={asof} /></b>
                <Num value={s.change} fmt={(v) => signedPct(v)} source={TV} asof={asof} signed />
              </div>
              {mode === "desk" && (
                <div className="meta">
                  <span>Rel vol <Num value={s.rel_volume} fmt={(v) => times(v, 1)} source={TV} asof={asof} /></span>
                  <span>RV20 <Num value={s.rv20} fmt={(v) => pct(v, 0)} source="Computed" asof={asof} formula="√252 × stdev(ln returns), 20d" /></span>
                  <span>Earnings {d !== null && d >= 0 ? `in ${d}d` : "—"}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function FundCards({ rows, asof }: { rows: Fund[]; asof: string }) {
  const nav = useNavigate();
  return (
    <div className="movers">
      {rows.slice(0, 60).map((f) => (
        <button key={f.symbol} className="mover" onClick={() => nav(`/s/${f.ticker}`)}>
          <div style={{ minWidth: 0 }}>
            <div className="t">{f.ticker} <span className="badge" style={{ height: 18, marginLeft: 4 }}>{f.leverage_factor ? `${f.leverage_factor > 0 ? "" : "−"}${Math.abs(f.leverage_factor)}× daily` : "Daily reset"}</span></div>
            <div className="n">{f.name}</div>
          </div>
          <Spark data={f.spark} width={88} height={28} />
          <div className="p">
            <b><Num value={f.close} fmt={(v) => money(v)} source={TV} asof={asof} /></b>
            <Num value={f.change} fmt={(v) => signedPct(v)} source={TV} asof={asof} signed />
          </div>
        </button>
      ))}
    </div>
  );
}
