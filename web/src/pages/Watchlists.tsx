import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Disclosure, Skel } from "../components/bits";
import { loadHoldingsIndex, useAsync, useUniverses } from "../lib/data";
import { buildWatchlists, passesLint } from "../lib/watchlists";

export const AI_ENABLED = false; // feature flag: the AI narrative layer is off in this build

export function Watchlists() {
  const u = useUniverses();
  const idx = useAsync(loadHoldingsIndex, []);
  const lists = useMemo(() => (u.data ? buildWatchlists(u.data.stocks.rows, idx.data) : null), [u.data, idx.data]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Watchlists</h1>
          <p>Rules pick every name from live data; the reason for each list is written from the same evidence. Nothing appears here because a model suggested it.</p>
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 16 }}>
        <b>AI narratives are off.</b> They switch on behind a feature flag once an approved AI environment is in place. Until then each list
        carries a templated one-line reason. AI drafts, when enabled, stay internal until a banker approves them in the review queue.
      </div>
      {!lists ? (
        <Skel h={300} />
      ) : (
        <div className="watch">
          {lists.filter((w) => passesLint(w.rationale)).map((w) => (
            <article key={w.id} className="watch-card" aria-labelledby={`w-${w.id}`}>
              <header>
                <span className="badge goldline">{w.type}</span>
                <h2 id={`w-${w.id}`}>{w.title}</h2>
                <span className="badge" style={{ marginLeft: "auto" }}>{w.status === "rules" ? "Rules-generated" : "Unavailable"}</span>
              </header>
              <p>{w.rationale}</p>
              <p className="small muted">Rule: {w.rule}</p>
              {w.names.length > 0 && (
                <div className="symlist">
                  {w.names.map((n) => (
                    <Link key={n.ticker} to={`/s/${n.ticker}`} title={n.why}>{n.ticker}</Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Disclosure />
    </div>
  );
}
