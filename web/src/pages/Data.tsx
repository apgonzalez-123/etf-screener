import { Disclosure, Skel } from "../components/bits";
import { useUniverses } from "../lib/data";
import { asOf } from "../lib/format";

export function Data() {
  const u = useUniverses();
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>Data and methods</h1>
          <p>Where every number comes from, when it was taken, and how derived figures are computed. Hover any figure in the app to see the same.</p>
        </div>
      </div>
      {!u.data ? (
        <Skel h={200} />
      ) : (
        <div className="stack">
          <div className="panel">
            <h3>Sources in this snapshot</h3>
            <table className="t">
              <thead><tr><th>Use</th><th className="l">Source</th><th>Taken</th></tr></thead>
              <tbody>
                {Object.entries(u.data.meta.sources).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td className="l">{v.name}{v.as_of_dates ? ` (holdings dated ${v.as_of_dates.join(", ")})` : ""}</td><td>{asOf(v.as_of)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 10 }}>
              {u.data.meta.counts.stocks.toLocaleString()} stocks, {u.data.meta.counts.funds.toLocaleString()} funds, daily bars for {u.data.meta.counts.bars.toLocaleString()} symbols,
              holdings for {u.data.meta.counts.holdings_etfs} ETFs covering {u.data.meta.counts.issuers.toLocaleString()} issuers. The snapshot refreshes on a schedule; it is not real-time.
            </p>
            {u.data.meta.warnings.length > 0 && <div className="notice" style={{ marginTop: 10 }}>Pipeline warnings: {u.data.meta.warnings.join("; ")}</div>}
          </div>
          <div className="panel stack">
            <h3>Formulas</h3>
            <p><b>Realized volatility.</b> σ = √252 × stdev(ln Cₜ ⁄ Cₜ₋₁) over the last 20 or 60 daily closes, sample standard deviation, in percent. TradingView’s own Volatility.D/W/M fields measure something else and are not used for vol columns.</p>
            <p><b>Overlap.</b> Σ min(wₐ, w_b) over issuers held by both funds, using physical equity weights renormalised to 1. Symmetric, from 0 to 100%.</p>
            <p><b>Drift-adjusted weight.</b> w′ = w × (1 + r) ⁄ Σ w × (1 + r), where r is each holding’s price return since the holdings as-of date.</p>
            <p><b>Effective exposure.</b> direct position + Σ (fund position × issuer weight in the fund). Share classes (GOOGL and GOOG) roll into one issuer; line detail is kept.</p>
            <p><b>Effective N.</b> 1 ⁄ Σ w². <b>Exposure per fee.</b> weight % ⁄ expense ratio %.</p>
            <p><b>Universe gates.</b> Listed exchange only, price ≥ $5, 30-day average daily value ≥ $10M (stocks) or $5M (ETFs), market cap ≥ $300M or AUM ≥ $50M. Client mode cannot relax them.</p>
          </div>
          <div className="panel stack">
            <h3>Known gaps in this build</h3>
            <p>No EPS beat history. Holdings cover State Street SPDR funds only. Opaque fund codes the mapping table does not know render as “—”. Values that fail range checks (for example an expense ratio above 5%) are withheld and flagged.</p>
          </div>
          <div className="panel">
            <h3>Attribution</h3>
            <p className="small">Charts use TradingView Lightweight Charts™ (Apache-2.0), © TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">tradingview.com</a>. Holdings files © State Street Global Advisors. Market data display rights must be confirmed by Market Data and Compliance before any client-facing use.</p>
          </div>
        </div>
      )}
      <Disclosure />
    </div>
  );
}
