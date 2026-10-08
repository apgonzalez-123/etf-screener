import { describe, expect, it } from "vitest";
import { STOCK_FIELDS, fieldMap } from "./fields";
import { evalGroup, uid, type Group } from "./filters";
import { parseQuery } from "./nl";
import type { Stock } from "./types";

const fields = fieldMap(STOCK_FIELDS);

function stock(p: Partial<Stock>): Stock {
  return { symbol: "X:X", ticker: "X", name: "X", ...p } as Stock;
}

describe("natural-language query", () => {
  it("large-cap tech within 5% of 52-week high → same result as the hand-built filter", () => {
    const parsed = parseQuery("large-cap tech within 5% of 52-week high");
    expect(parsed.conds.map((c) => [c.field, c.op])).toEqual([
      ["market_cap", "gte"],
      ["from_high", "gte"],
      ["sector", "in"],
    ]);
    const hand: Group = {
      id: uid(),
      join: "and",
      items: [
        { id: uid(), field: "market_cap", op: "gte", value: 10e9 },
        { id: uid(), field: "from_high", op: "gte", value: -5 },
        { id: uid(), field: "sector", op: "in", value: ["Technology Services", "Electronic Technology"] },
      ],
    };
    const nl: Group = { id: uid(), join: "and", items: parsed.conds };
    const rows = [
      stock({ market_cap: 5e12, from_high: -2, sector: "Electronic Technology" }),
      stock({ market_cap: 5e12, from_high: -9, sector: "Electronic Technology" }),
      stock({ market_cap: 5e9, from_high: -1, sector: "Technology Services" }),
      stock({ market_cap: 50e9, from_high: -1, sector: "Finance" }),
      stock({ market_cap: null, from_high: -1, sector: "Technology Services" }),
    ];
    expect(rows.map((r) => evalGroup(r, nl, fields))).toEqual(rows.map((r) => evalGroup(r, hand, fields)));
    expect(rows.map((r) => evalGroup(r, nl, fields))).toEqual([true, false, false, false, false]);
  });

  it("profitable mid-cap semis, earnings in the next two weeks", () => {
    const p = parseQuery("Profitable mid-cap semis within 5% of 52-week highs, earnings in the next two weeks");
    const byField = Object.fromEntries(p.conds.map((c) => [c.field, c]));
    expect(byField.next_earnings.value).toBe(14);
    expect(byField.market_cap.op).toBe("between");
    expect(byField.industry.value).toEqual(["Semiconductors"]);
    expect(byField.op_margin.op).toBe("gte");
  });

  it("reports words it could not use rather than guessing", () => {
    expect(parseQuery("purple unicorn stocks").ignored).toEqual(["purple", "unicorn"]);
  });

  it("a null never passes a numeric condition", () => {
    const g: Group = { id: uid(), join: "and", items: [{ id: uid(), field: "pe", op: "lte", value: 100 }] };
    expect(evalGroup(stock({ pe: null }), g, fields)).toBe(false);
  });
});
