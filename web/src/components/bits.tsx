import { age, asOf } from "../lib/format";

export function Disclosure() {
  return (
    <p className="disclosure">
      Investing involves risk, including loss of principal. This screen is general research, not a recommendation to buy or sell any
      security. Tickers shown are illustrative. Market data is a delayed snapshot from the sources listed under Data and methods; it is
      not real-time. Prototype for internal review. Not approved for client use.
    </p>
  );
}

export function GridSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="dgrid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk" style={{ height: 22, margin: "8px 12px", width: `${90 - (i % 4) * 8}%` }} />
      ))}
    </div>
  );
}

export function Skel({ h = 120 }: { h?: number }) {
  return <div className="sk" style={{ height: h }} aria-busy="true" />;
}

export function PageError({ msg }: { msg: string }) {
  return (
    <div className="page">
      <div className="notice">
        <b>Data could not load.</b> {msg}. The snapshot files may be missing; run <code>python -m pipeline.snapshot</code> and reload.
      </div>
    </div>
  );
}

/** Grey/amber badge with the snapshot's age. Static builds are always delayed. */
export function Freshness({ iso, ttlMinutes = 0 }: { iso: string | null | undefined; ttlMinutes?: number }) {
  if (!iso) return null;
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  const stale = mins > ttlMinutes;
  return (
    <span className={`badge ${stale ? "delayed" : ""}`} title={`Snapshot taken ${asOf(iso)}`}>
      {stale ? `Delayed ${age(iso)}` : "Live"}
    </span>
  );
}
