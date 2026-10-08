import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useMemo, useRef, useState } from "react";
import type { Field } from "../lib/fields";
import { Num } from "./Num";
import { Spark } from "./Spark";

export interface SortKey {
  key: string;
  desc: boolean;
}

interface Props<T extends { symbol: string; spark: number[] | null }> {
  rows: T[];
  fields: Field<T>[];
  sourceName: string;
  asof: string;
  rowHeight: number;
  height: number | string;
  sort: SortKey[];
  onSort: (s: SortKey[]) => void;
  onOpen: (row: T) => void;
  selected?: Set<string>;
  onToggle?: (symbol: string) => void;
  showSpark?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  computed: "Computed from snapshot",
  holdings: "Look-through (SSGA holdings)",
};

export function sortRows<T>(rows: T[], fields: Record<string, Field<T>>, sort: SortKey[]): T[] {
  if (!sort.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const f = fields[s.key];
      if (!f) continue;
      const va = f.get(a);
      const vb = f.get(b);
      // nulls always last, whatever the direction
      if (va === null || va === undefined) {
        if (vb === null || vb === undefined) continue;
        return 1;
      }
      if (vb === null || vb === undefined) return -1;
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      if (c !== 0) return s.desc ? -c : c;
    }
    return 0;
  });
}

export function Grid<T extends { symbol: string; spark: number[] | null }>(p: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(0);
  const v = useVirtualizer({ count: p.rows.length, getScrollElement: () => ref.current, estimateSize: () => p.rowHeight, overscan: 12 });
  const width = useMemo(
    () => p.fields.reduce((s, f) => s + (f.width ?? 90), 0) + (p.showSpark ? 96 : 0) + (p.onToggle ? 36 : 0),
    [p.fields, p.showSpark, p.onToggle],
  );

  const clickSort = (key: string, shift: boolean) => {
    const cur = p.sort.find((s) => s.key === key);
    const next: SortKey = { key, desc: cur ? !cur.desc : true };
    if (shift) {
      const rest = p.sort.filter((s) => s.key !== key);
      p.onSort([...rest, next]);
    } else p.onSort([next]);
  };

  const actions = useRef({ open: (_r: T, _i: number) => {}, toggle: (_s: string) => {} });
  actions.current.open = (r: T, i: number) => {
    setFocus(i);
    p.onOpen(r);
  };
  actions.current.toggle = (sym: string) => p.onToggle?.(sym);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      const n = Math.min(focus + 1, p.rows.length - 1);
      setFocus(n);
      v.scrollToIndex(n);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      const n = Math.max(focus - 1, 0);
      setFocus(n);
      v.scrollToIndex(n);
    } else if (e.key === "Enter" && p.rows[focus]) {
      p.onOpen(p.rows[focus]);
    } else if (e.key === "x" && p.onToggle && p.rows[focus]) {
      p.onToggle(p.rows[focus].symbol);
    }
  };

  return (
    <div className="dgrid" style={{ height: p.height }}>
      <div
        className="dgrid-scroll"
        ref={ref}
        style={{ flex: 1 }}
        tabIndex={0}
        role="grid"
        aria-rowcount={p.rows.length}
        aria-label="Screen results. Arrow keys move, Enter opens, x selects."
        onKeyDown={onKey}
      >
        <div className="dgrid-head" role="row" style={{ width }}>
          {p.onToggle && <div className="cell check" role="columnheader"><span className="sr-only">Select</span></div>}
          {p.fields.map((f, i) => {
            const s = p.sort.find((x) => x.key === f.key);
            const idx = p.sort.length > 1 && s ? p.sort.indexOf(s) + 1 : null;
            return (
              <div key={f.key} role="columnheader" style={{ width: f.width ?? 90 }} aria-sort={s ? (s.desc ? "descending" : "ascending") : "none"}>
                <button
                  className={f.align === "left" ? "left" : ""}
                  style={{ width: "100%" }}
                  title={f.formula ? `${f.label}: ${f.formula}. Shift-click to add a sort.` : "Shift-click to add a sort."}
                  onClick={(e) => clickSort(f.key, e.shiftKey)}
                >
                  {f.label}
                  {s ? <span aria-hidden="true">{s.desc ? "↓" : "↑"}{idx ?? ""}</span> : null}
                </button>
              </div>
            );
            void i;
          })}
          {p.showSpark && <div className="cell" role="columnheader" style={{ width: 96, fontSize: 12, color: "var(--ink-2)" }}>30d</div>}
        </div>
        <div style={{ height: v.getTotalSize(), position: "relative", width }}>
          {v.getVirtualItems().map((vi) => {
            const r = p.rows[vi.index];
            return (
              <Row
                key={r.symbol}
                r={r}
                index={vi.index}
                start={vi.start}
                width={width}
                selected={!!p.selected?.has(r.symbol)}
                focused={vi.index === focus}
                fields={p.fields}
                sourceName={p.sourceName}
                asof={p.asof}
                showSpark={!!p.showSpark}
                toggleable={!!p.onToggle}
                actions={actions}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RowProps<T> {
  r: T;
  index: number;
  start: number;
  width: number;
  selected: boolean;
  focused: boolean;
  fields: Field<T>[];
  sourceName: string;
  asof: string;
  showSpark: boolean;
  toggleable: boolean;
  actions: React.MutableRefObject<{ open: (r: T, i: number) => void; toggle: (s: string) => void }>;
}

function RowImpl<T extends { symbol: string; spark: number[] | null }>(p: RowProps<T>) {
  const { r } = p;
  return (
    <div
      className="dgrid-row"
      role="row"
      aria-rowindex={p.index + 2}
      aria-selected={p.selected || p.focused ? "true" : "false"}
      style={{ transform: `translateY(${p.start}px)`, width: p.width }}
      onClick={() => p.actions.current.open(r, p.index)}
    >
      {p.toggleable && (
        <div className="cell check" role="gridcell" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" aria-label={`Select ${r.symbol}`} checked={p.selected} onChange={() => p.actions.current.toggle(r.symbol)} />
        </div>
      )}
      {p.fields.map((f) => {
        const val = f.get(r);
        const cls = ["cell", f.align === "left" ? "left" : "", f.key === "ticker" ? "tick" : ""].join(" ");
        return (
          <div key={f.key} className={cls} role="gridcell" style={{ width: f.width ?? 90 }}>
            {f.kind === "text" ? (
              <span title={String(val ?? "")}>{(f.fmt as (v: unknown) => string)(val)}</span>
            ) : (
              <Num
                value={val as number | null}
                fmt={f.fmt as (v: number | null) => string}
                source={f.source ? SOURCE_LABEL[f.source] : p.sourceName}
                asof={p.asof}
                formula={f.formula}
                signed={f.signed}
              />
            )}
          </div>
        );
      })}
      {p.showSpark && (
        <div className="cell" role="gridcell" style={{ width: 96 }}>
          <Spark data={r.spark} />
        </div>
      )}
    </div>
  );
}

const Row = memo(RowImpl) as typeof RowImpl;
