import { useEffect, useState } from "react";
import type { Bars, Detail, EtfHoldings, Fund, HoldingsIndex, Meta, Stock, Universe } from "./types";

/**
 * Static provider: reads the snapshot written by pipeline/snapshot.py.
 * Same shape a live MarketDataProvider (TradingView MCP or a licensed vendor feed) would return,
 * so swapping the source is a change here, not in the UI.
 */
const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

export function load<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export const loadMeta = () => load<Meta>("meta.json");
export const loadStocks = () => load<Universe<Stock>>("stocks.json");
export const loadFunds = () => load<Universe<Fund>>("funds.json");
export const loadHoldingsIndex = () => load<HoldingsIndex>("holdings/index.json");
export const loadEtfHoldings = (t: string) => load<EtfHoldings>(`holdings/${t}.json`);
export const loadBars = (t: string) => load<Bars>(`bars/${t}.json`);
export const loadDetail = (t: string) => load<Detail>(`detail/${t}.json`);

export type Async<T> = { data: T | null; error: string | null; loading: boolean };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, set] = useState<Async<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    // Clear on every input change: never show one symbol's data under another's name.
    set({ data: null, loading: true, error: null });
    fn()
      .then((data) => live && set({ data, error: null, loading: false }))
      .catch((e: Error) => live && set({ data: null, error: e.message, loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export interface Universes {
  meta: Meta;
  stocks: Universe<Stock>;
  funds: Universe<Fund>;
}

export function useUniverses(): Async<Universes> {
  return useAsync(async () => {
    const [meta, stocks, funds] = await Promise.all([loadMeta(), loadStocks(), loadFunds()]);
    return { meta, stocks, funds };
  }, []);
}
