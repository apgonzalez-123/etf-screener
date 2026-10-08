import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";
import { useUniverses } from "../lib/data";
import { PRESETS } from "../lib/presets";

interface Item {
  id: string;
  label: string;
  sub: string;
  kind: string;
  go: string;
}

const PAGES: Item[] = [
  { id: "p-screener", label: "Screener", sub: "Filter stocks and ETFs", kind: "Page", go: "/" },
  { id: "p-look", label: "Look-through", sub: "Who holds a name, overlap, portfolio exposure", kind: "Page", go: "/look-through" },
  { id: "p-movers", label: "Movers", sub: "Names moving the tape", kind: "Page", go: "/movers" },
  { id: "p-watch", label: "Watchlists", sub: "Rules-generated lists", kind: "Page", go: "/watchlists" },
  { id: "p-data", label: "Data and methods", sub: "Sources, as-of times, formulas", kind: "Page", go: "/data" },
];

export function CommandK() {
  const { paletteOpen, setPaletteOpen } = useApp();
  const nav = useNavigate();
  const u = useUniverses();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const out: Item[] = [];
    const who = s.match(/^(who holds|holders of|held by)\s+(\S+)/);
    if (who) {
      const t = who[2].toUpperCase();
      out.push({ id: "who", label: `Who holds ${t}?`, sub: "Reverse look-through across covered ETFs", kind: "Look-through", go: `/look-through?q=${encodeURIComponent(t)}` });
    }
    if (!s) return [...PAGES, ...PRESETS.slice(0, 5).map((p) => ({ id: p.id, label: p.name, sub: p.blurb, kind: "Preset", go: `/?preset=${p.id}` }))];
    if (u.data) {
      const all = [
        ...u.data.stocks.rows.map((r) => ({ t: r.ticker, n: r.name ?? "", kind: "Stock", cap: r.market_cap ?? 0 })),
        ...u.data.funds.rows.map((r) => ({ t: r.ticker, n: r.name ?? "", kind: r.leveraged ? "Leveraged ETF" : "ETF", cap: r.aum ?? 0 })),
      ];
      const exact = all.filter((x) => x.t.toLowerCase() === s);
      const pre = all.filter((x) => x.t.toLowerCase().startsWith(s) && x.t.toLowerCase() !== s).sort((a, b) => b.cap - a.cap);
      const name = all.filter((x) => !x.t.toLowerCase().startsWith(s) && x.n.toLowerCase().includes(s)).sort((a, b) => b.cap - a.cap);
      for (const x of [...exact, ...pre, ...name].slice(0, 9)) out.push({ id: x.t, label: x.t, sub: x.n, kind: x.kind, go: `/s/${encodeURIComponent(x.t)}` });
      if (exact[0]?.kind === "Stock" && !who)
        out.push({ id: "who-auto", label: `Who holds ${exact[0].t}?`, sub: "Reverse look-through", kind: "Look-through", go: `/look-through?q=${exact[0].t}` });
    }
    for (const p of PRESETS) if (p.name.toLowerCase().includes(s)) out.push({ id: p.id, label: p.name, sub: p.blurb, kind: "Preset", go: `/?preset=${p.id}` });
    for (const p of PAGES) if (p.label.toLowerCase().includes(s)) out.push(p);
    if (!out.length) out.push({ id: "nl", label: `Screen for “${q.trim()}”`, sub: "Turn this phrase into filters you can edit", kind: "Screen", go: `/?q=${encodeURIComponent(q.trim())}` });
    return out;
  }, [q, u.data]);

  if (!paletteOpen) return null;
  const go = (it: Item) => {
    setPaletteOpen(false);
    nav(it.go);
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={() => setPaletteOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          placeholder="Ticker, ETF, preset, or “who holds NVDA”"
          aria-label="Search"
          aria-controls="cmdk-list"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPaletteOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((x) => Math.min(x + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((x) => Math.max(x - 1, 0));
            } else if (e.key === "Enter" && items[sel]) go(items[sel]);
          }}
        />
        <ul id="cmdk-list" role="listbox">
          {items.map((it, i) => (
            <li key={it.id + i} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
              <b>{it.label}</b>
              <span className="muted">{it.sub}</span>
              <span className="k">{it.kind}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
