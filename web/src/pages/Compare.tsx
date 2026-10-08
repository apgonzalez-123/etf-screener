import { Link, useSearchParams } from "react-router-dom";
import { Disclosure, Skel } from "../components/bits";
import { Num } from "../components/Num";
import { Spark } from "../components/Spark";
import { useUniverses } from "../lib/data";
import { FUND_FIELDS, STOCK_FIELDS, type Field } from "../lib/fields";
import type { Fund, Stock } from "../lib/types";

export function Compare() {
  const [params] = useSearchParams();
  const u = useUniverses();
  const tickers = (params.get("s") ?? "").split(",").filter(Boolean).slice(0, 8);
  if (!u.data) return <div className="page"><Skel h={300} /></div>;
  const rows = tickers
    .map((t) => u.data!.stocks.rows.find((r) => r.ticker === t) ?? u.data!.funds.rows.find((r) => r.ticker === t))
    .filter(Boolean) as (Stock | Fund)[];
  const isFund = rows.length > 0 && "aum" in rows[0];
  const fields = ((isFund ? FUND_FIELDS : STOCK_FIELDS) as Field<Stock | Fund>[]).filter((f) => f.key !== "ticker" && f.key !== "name");
  return (
    <div className="page">
      <div className="page-head"><div><h1>Compare</h1><p>Up to eight names side by side.</p></div></div>
      {rows.length < 2 ? (
        <div className="panel empty"><h3>Pick at least two names</h3><p>Select rows in the screener, then choose Compare.</p><Link className="btn" to="/">Open the screener</Link></div>
      ) : (
        <div className="panel table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th />
                {rows.map((r) => <th key={r.symbol}><Link to={`/s/${r.ticker}`}><b style={{ color: "var(--ink)", fontSize: 14 }}>{r.ticker}</b></Link></th>)}
              </tr>
            </thead>
            <tbody>
              <tr><td className="muted">30-day trend</td>{rows.map((r) => <td key={r.symbol}><Spark data={r.spark} /></td>)}</tr>
              {fields.map((f) => (
                <tr key={f.key}>
                  <td className="muted">{f.label}</td>
                  {rows.map((r) => {
                    const v = f.get(r);
                    return (
                      <td key={r.symbol}>
                        {f.kind === "text" ? (f.fmt as (x: unknown) => string)(v) : <Num value={v as number | null} fmt={f.fmt as (x: number | null) => string} source={f.source === "computed" ? "Computed" : "TradingView scanner"} asof={u.data!.stocks.as_of} formula={f.formula} signed={f.signed} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Disclosure />
    </div>
  );
}
