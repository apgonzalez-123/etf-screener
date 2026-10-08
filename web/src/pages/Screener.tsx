import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Grid, sortRows, type SortKey } from "../components/Grid";
import { Disclosure, GridSkeleton, PageError } from "../components/bits";
import { useApp } from "../lib/app";
import { useUniverses } from "../lib/data";
import {
  CLIENT_FUND_COLS,
  CLIENT_STOCK_COLS,
  DESK_FUND_COLS,
  DESK_STOCK_COLS,
  FUND_FIELDS,
  STOCK_FIELDS,
  fieldMap,
  type Field,
} from "../lib/fields";
import {
  DEFAULT_GATES,
  GATE_TEXT,
  describe,
  effectiveGates,
  evalGroup,
  passFundGates,
  passStockGates,
  uid,
  type Cond,
  type Gates,
  type Group,
} from "../lib/filters";
import { parseQuery } from "../lib/nl";
import { PRESETS } from "../lib/presets";
import type { Fund, Stock } from "../lib/types";

type U = "stock" | "fund";

interface ScreenState {
  u: U;
  join: "and" | "or";
  conds: Cond[];
  sort: SortKey[];
  gates: Gates;
}

const encode = (s: ScreenState) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
function decode(x: string | null): ScreenState | null {
  if (!x) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(x))));
  } catch {
    return null;
  }
}

const SAVED_KEY = "ses.screens";
interface Saved {
  name: string;
  state: ScreenState;
  version: number;
  saved_at: string;
}
function readSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function Screener() {
  const u = useUniverses();
  const { mode } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const initial = decode(params.get("s"));
  const [st, setSt] = useState<ScreenState>(
    initial ?? { u: "stock", join: "and", conds: [], sort: [{ key: "market_cap", desc: true }], gates: DEFAULT_GATES },
  );
  const [nl, setNl] = useState("");
  const [nlNote, setNlNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<Saved[]>(readSaved);
  const [toast, setToast] = useState<string | null>(null);

  // presets and NL from the URL (command palette)
  useEffect(() => {
    const pid = params.get("preset");
    const q = params.get("q");
    if (pid) {
      const p = PRESETS.find((x) => x.id === pid);
      if (p) applyPreset(p.id);
      params.delete("preset");
      setParams(params, { replace: true });
    } else if (q) {
      setNl(q);
      runNl(q);
      params.delete("q");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const isStock = st.u === "stock";
  const allFields = (isStock ? STOCK_FIELDS : FUND_FIELDS) as Field<Stock | Fund>[];
  const fmap = useMemo(() => fieldMap(allFields), [allFields]);
  const colKey = `${st.u}-${mode}`;
  const colList = cols[colKey] ?? (isStock ? (mode === "client" ? CLIENT_STOCK_COLS : DESK_STOCK_COLS) : mode === "client" ? CLIENT_FUND_COLS : DESK_FUND_COLS);
  const visible = useMemo(() => colList.map((k) => fmap[k]).filter(Boolean), [colList, fmap]);
  const gridFields = useMemo(() => visible.map((f) => (mode === "client" && f.plain ? { ...f, label: f.plain } : f)), [visible, mode]);
  const gates = effectiveGates(mode, st.gates);

  const rows = useMemo(() => {
    if (!u.data) return [];
    const g: Group = { id: "root", join: st.join, items: st.conds };
    const base = isStock
      ? u.data.stocks.rows.filter((r) => passStockGates(r, gates))
      : u.data.funds.rows.filter((r) => passFundGates(r, gates));
    const hit = (base as (Stock | Fund)[]).filter((r) => evalGroup(r, g, fmap));
    return sortRows(hit, fmap, st.sort);
  }, [u.data, st, gates, fmap, isStock]);

  const universeSize = u.data ? (isStock ? u.data.stocks.rows.length : u.data.funds.rows.length) : 0;

  function set(p: Partial<ScreenState>) {
    setSt((s) => ({ ...s, ...p }));
  }

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSt((s) => ({ ...s, u: p.universe, join: "and", conds: p.conds.map((c) => ({ ...c, id: uid() })), sort: p.sort ? [p.sort] : s.sort }));
    setNlNote(`Preset: ${p.name}. ${p.blurb}.`);
  }

  function runNl(q = nl) {
    const parsed = parseQuery(q);
    if (!parsed.conds.length) {
      setNlNote(`No filters recognised in “${q}”. Try a cap size, a sector, “within 5% of 52-week high”, or “earnings in the next two weeks”.`);
      return;
    }
    setSt((s) => ({ ...s, u: parsed.universe ?? s.u, join: "and", conds: parsed.conds }));
    setNlNote(
      `Turned your phrase into ${parsed.conds.length} filter${parsed.conds.length > 1 ? "s" : ""}. Edit them below; the grid updates as you go.` +
        (parsed.ignored.length ? ` Not understood: ${parsed.ignored.join(", ")}.` : ""),
    );
  }

  function exportCsv() {
    const head = visible.map((f) => f.label);
    const lines = rows.map((r) =>
      visible
        .map((f) => {
          const v = f.get(r);
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screen-${st.u}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function share() {
    const url = new URL(window.location.href);
    url.hash = `#/?s=${encode(st)}`;
    navigator.clipboard?.writeText(url.toString()).then(
      () => flash("Link copied. Anyone with it sees this exact screen."),
      () => flash("Copy failed. Your browser blocked clipboard access."),
    );
  }

  function save() {
    const name = window.prompt("Name this screen");
    if (!name) return;
    const prev = saved.find((s) => s.name === name);
    const next = [
      ...saved.filter((s) => s.name !== name),
      { name, state: st, version: (prev?.version ?? 0) + 1, saved_at: new Date().toISOString() },
    ];
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      flash(`Saved “${name}” (version ${(prev?.version ?? 0) + 1}).`);
    } catch {
      flash("Saved for this session only. Browser storage is unavailable.");
    }
  }

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }

  function updateCond(id: string, value: Cond["value"]) {
    set({ conds: st.conds.map((c) => (c.id === id ? { ...c, value } : c)) });
  }

  const toggle = (sym: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(sym)) n.delete(sym);
      else if (n.size < 8) n.add(sym);
      return n;
    });

  if (u.error) return <PageError msg={u.error} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Screener</h1>
          <p>Ask a question of the market in plain words, or start from a preset. Every filter stays visible and editable before it shapes the results.</p>
        </div>
        <div className="seg" role="group" aria-label="Universe" style={{ marginLeft: "auto" }}>
          <button aria-pressed={isStock} onClick={() => set({ u: "stock", conds: [], sort: [{ key: "market_cap", desc: true }] })}>Stocks</button>
          <button aria-pressed={!isStock} onClick={() => set({ u: "fund", conds: [], sort: [{ key: "aum", desc: true }] })}>ETFs</button>
        </div>
      </div>

      <div className="stack">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            runNl();
          }}
        >
          <input
            className="input"
            style={{ flex: 1, minWidth: 260, height: 40 }}
            value={nl}
            onChange={(e) => setNl(e.target.value)}
            placeholder="Profitable mid-cap semis within 5% of 52-week highs, earnings in the next two weeks"
            aria-label="Describe a screen"
          />
          <button className="btn primary" style={{ height: 40 }} type="submit">Build filters</button>
          <select className="input" style={{ height: 40 }} value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Presets">
            <option value="">Presets</option>
            {PRESETS.filter((p) => p.universe === st.u).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {saved.length > 0 && (
            <select
              className="input"
              style={{ height: 40 }}
              value=""
              aria-label="Saved screens"
              onChange={(e) => {
                const s = saved.find((x) => x.name === e.target.value);
                if (s) setSt(s.state);
              }}
            >
              <option value="">Saved screens</option>
              {saved.map((s) => (
                <option key={s.name} value={s.name}>{s.name} (v{s.version})</option>
              ))}
            </select>
          )}
        </form>
        {nlNote && <p className="muted small" role="status">{nlNote}</p>}

        <div className="chips" aria-label="Filters">
          {st.conds.length > 1 && (
            <div className="seg" role="group" aria-label="Combine filters with">
              <button aria-pressed={st.join === "and"} onClick={() => set({ join: "and" })}>All of</button>
              <button aria-pressed={st.join === "or"} onClick={() => set({ join: "or" })}>Any of</button>
            </div>
          )}
          {st.conds.map((c) => (
            <CondChip key={c.id} c={c} fmap={fmap} onChange={(v) => updateCond(c.id, v)} onRemove={() => set({ conds: st.conds.filter((x) => x.id !== c.id) })} />
          ))}
          <AddFilter fields={allFields} onAdd={(c) => set({ conds: [...st.conds, c] })} />
          {st.conds.length > 0 && (
            <button className="btn" onClick={() => set({ conds: [] })}>Clear filters</button>
          )}
        </div>

        <div className="chips" aria-label="Universe gates">
          <span className="chip gate on" title="Always on">{GATE_TEXT.listed}</span>
          {(
            [
              ["minPrice", GATE_TEXT.minPrice],
              ["minAdv", isStock ? GATE_TEXT.minAdvStock : GATE_TEXT.minAdvFund],
              ["minSize", isStock ? GATE_TEXT.minSizeStock : GATE_TEXT.minSizeFund],
              ...(isStock ? [] : [["excludeLeveraged", GATE_TEXT.excludeLeveraged]]),
            ] as [keyof Gates, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className="chip gate"
              aria-pressed={gates[k]}
              disabled={mode === "client"}
              title={mode === "client" ? "Locked in Client mode" : "Desk mode: click to relax"}
              onClick={() => set({ gates: { ...st.gates, [k]: !st.gates[k] } })}
            >
              {mode === "client" ? "🔒 " : ""}
              {label}
            </button>
          ))}
        </div>

        <div className="row small muted" aria-live="polite">
          <span>
            <b className="gold" style={{ fontSize: 15 }}>{rows.length.toLocaleString()}</b> matches of {universeSize.toLocaleString()} listed {isStock ? "stocks" : "funds"}
          </span>
          <span style={{ marginLeft: "auto" }} className="row">
            {selected.size > 0 && (
              <>
                <span>{selected.size} selected</span>
                <button className="btn" onClick={() => nav(`/compare?s=${[...selected].map((x) => x.split(":")[1]).join(",")}`)} disabled={selected.size < 2}>
                  Compare
                </button>
                <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
              </>
            )}
            <button className="btn" onClick={() => setShowCols((x) => !x)} aria-expanded={showCols}>Columns</button>
            <button className="btn" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
            <button className="btn" onClick={share}>Copy link</button>
            <button className="btn" onClick={save}>Save screen</button>
          </span>
        </div>

        {showCols && (
          <div className="panel chips" role="group" aria-label="Columns">
            {allFields.map((f) => (
              <label key={f.key} className="chip" style={{ paddingRight: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={colList.includes(f.key)}
                  onChange={() =>
                    setCols((c) => ({
                      ...c,
                      [colKey]: colList.includes(f.key) ? colList.filter((k) => k !== f.key) : [...colList, f.key],
                    }))
                  }
                />
                {mode === "client" && f.plain ? f.plain : f.label}
              </label>
            ))}
          </div>
        )}

        {!u.data ? (
          <GridSkeleton />
        ) : rows.length === 0 ? (
          <div className="panel empty">
            <h3>No names pass these filters</h3>
            <p>Loosen a filter, or start from a preset.</p>
            <div className="chips" style={{ justifyContent: "center" }}>
              {PRESETS.filter((p) => p.universe === st.u).slice(0, 4).map((p) => (
                <button key={p.id} className="btn" onClick={() => applyPreset(p.id)}>{p.name}</button>
              ))}
            </div>
          </div>
        ) : (
          <Grid<Stock | Fund>
            rows={rows}
            fields={gridFields}
            sourceName={u.data.stocks.source}
            asof={u.data.stocks.as_of}
            rowHeight={mode === "client" ? 52 : 34}
            height="calc(100vh - 330px)"
            sort={st.sort}
            onSort={(s) => set({ sort: s })}
            onOpen={(r) => nav(`/s/${encodeURIComponent(r.ticker)}`)}
            selected={selected}
            onToggle={toggle}
            showSpark
          />
        )}
      </div>
      {toast && (
        <div role="status" className="badge goldline" style={{ position: "fixed", bottom: 20, right: 20, height: 36, background: "var(--bg-1)", zIndex: 40 }}>
          {toast}
        </div>
      )}
      <Disclosure />
    </div>
  );
}

function CondChip({ c, fmap, onChange, onRemove }: { c: Cond; fmap: Record<string, Field<Stock | Fund>>; onChange: (v: Cond["value"]) => void; onRemove: () => void }) {
  const f = fmap[c.field];
  const label = f?.label ?? c.field;
  const scale = c.field === "market_cap" || c.field === "aum" || c.field === "adv" || c.field === "fcf" ? 1e9 : 1;
  const unit = scale === 1e9 ? "$B" : "";
  if (c.op === "gte" || c.op === "lte" || c.op === "within_days") {
    const v = c.value as number;
    return (
      <span className="chip edit">
        {label} {c.op === "gte" ? "≥" : c.op === "lte" ? "≤" : "in next"}
        <input
          type="number"
          aria-label={`${label} value`}
          value={Number((v / scale).toPrecision(6))}
          step="any"
          onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value) * scale)}
        />
        {c.op === "within_days" ? "days" : unit}
        <button aria-label={`Remove ${label} filter`} onClick={onRemove}>×</button>
      </span>
    );
  }
  if (c.op === "between") {
    const [lo, hi] = c.value as [number, number];
    return (
      <span className="chip edit">
        {label}
        <input type="number" aria-label={`${label} minimum`} value={Number((lo / scale).toPrecision(6))} step="any" onChange={(e) => onChange([Number(e.target.value) * scale, hi])} />
        to
        <input type="number" aria-label={`${label} maximum`} value={Number((hi / scale).toPrecision(6))} step="any" onChange={(e) => onChange([lo, Number(e.target.value) * scale])} />
        {unit}
        <button aria-label={`Remove ${label} filter`} onClick={onRemove}>×</button>
      </span>
    );
  }
  return (
    <span className="chip">
      {describe(c, fmap)}
      <button aria-label={`Remove ${label} filter`} onClick={onRemove}>×</button>
    </span>
  );
}

function AddFilter({ fields, onAdd }: { fields: Field<Stock | Fund>[]; onAdd: (c: Cond) => void }) {
  const u = useUniverses();
  const [key, setKey] = useState("");
  const f = fields.find((x) => x.key === key);
  const options = useMemo(() => {
    if (!f || f.kind !== "text" || !u.data) return [];
    const rows = (u.data.stocks.rows as (Stock | Fund)[]).concat(u.data.funds.rows);
    const set = new Map<string, number>();
    for (const r of rows) {
      const v = f.get(r);
      if (typeof v === "string") set.set(v, (set.get(v) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([v]) => v);
  }, [f, u.data]);

  return (
    <span className="row" style={{ gap: 6 }}>
      <select className="input" style={{ height: 28 }} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Add a filter">
        <option value="">Add filter</option>
        {fields.filter((x) => x.key !== "ticker" && x.key !== "name").map((x) => (
          <option key={x.key} value={x.key}>{x.label}</option>
        ))}
      </select>
      {f && f.kind === "number" && (
        <>
          <button className="btn" style={{ height: 28 }} onClick={() => (onAdd({ id: uid(), field: f.key, op: "gte", value: 0 }), setKey(""))}>At least</button>
          <button className="btn" style={{ height: 28 }} onClick={() => (onAdd({ id: uid(), field: f.key, op: "lte", value: 0 }), setKey(""))}>At most</button>
        </>
      )}
      {f && f.kind === "date" && (
        <button className="btn" style={{ height: 28 }} onClick={() => (onAdd({ id: uid(), field: f.key, op: "within_days", value: 14 }), setKey(""))}>Within days</button>
      )}
      {f && f.kind === "text" && (
        <select
          className="input"
          style={{ height: 28, maxWidth: 260 }}
          multiple={false}
          value=""
          aria-label={`${f.label} value`}
          onChange={(e) => {
            if (e.target.value) {
              onAdd({ id: uid(), field: f.key, op: "in", value: [e.target.value] });
              setKey("");
            }
          }}
        >
          <option value="">Choose {f.label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
    </span>
  );
}

