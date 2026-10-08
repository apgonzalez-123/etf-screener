import { type Cond, uid } from "./filters";

/**
 * Deterministic natural-language → filter parser (the AI-off path).
 * It only emits conditions over registered fields; the user sees and edits the
 * chips before anything runs. Unrecognised words are returned so the UI can
 * say what was ignored instead of guessing.
 */

export interface Parsed {
  conds: Cond[];
  universe: "stock" | "fund" | null;
  ignored: string[];
}

const SECTOR_WORDS: [RegExp, Cond["field"], string[]][] = [
  [/\bsemis?\b|\bsemiconductors?\b|\bchips?\b/, "industry", ["Semiconductors"]],
  [/\btech(nology)?\b/, "sector", ["Technology Services", "Electronic Technology"]],
  [/\bsoftware\b/, "industry", ["Packaged Software", "Information Technology Services"]],
  [/\bbanks?\b/, "industry", ["Major Banks", "Regional Banks"]],
  [/\bfinancials?\b|\bfinance\b/, "sector", ["Finance"]],
  [/\benergy\b|\boil\b/, "sector", ["Energy Minerals", "Industrial Services"]],
  [/\bhealth ?care\b|\bpharma\b|\bbiotech\b/, "sector", ["Health Technology", "Health Services"]],
  [/\butilit(y|ies)\b/, "sector", ["Utilities"]],
  [/\bretail(ers)?\b/, "sector", ["Retail Trade"]],
  [/\breits?\b|\breal estate\b/, "industry", ["Real Estate Investment Trusts"]],
];

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };

export function parseQuery(input: string): Parsed {
  let q = ` ${input.toLowerCase().replace(/[,;]/g, " ")} `;
  for (const [w, n] of Object.entries(WORDNUM)) q = q.replace(new RegExp(`\\b${w}\\b`, "g"), String(n));
  const conds: Cond[] = [];
  const used: string[] = [];
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = q.match(re);
    if (m) {
      fn(m);
      used.push(m[0]);
      q = q.replace(m[0], " ");
    }
  };
  const add = (field: string, op: Cond["op"], value: Cond["value"]) => conds.push({ id: uid(), field, op, value });

  let universe: Parsed["universe"] = null;
  take(/\b(etfs?|funds?)\b/, () => (universe = "fund"));
  take(/\b(stocks?|names|companies|equities)\b/, () => (universe ??= "stock"));

  take(/\bmega[- ]?caps?\b/, () => add("market_cap", "gte", 200e9));
  take(/\blarge[- ]?caps?\b/, () => add("market_cap", "gte", 10e9));
  take(/\bmid[- ]?caps?\b/, () => add("market_cap", "between", [2e9, 10e9]));
  take(/\bsmall[- ]?caps?\b/, () => add("market_cap", "between", [300e6, 2e9]));

  take(new RegExp(`within ${NUM} ?%? (of|from) (the )?52[- ]?w(ee)?k highs?`), (m) => add("from_high", "gte", -Number(m[1])));
  take(/\b(at|near) (new )?52[- ]?w(ee)?k highs?\b|\bnew highs\b/, () => add("from_high", "gte", -2));
  take(new RegExp(`${NUM} ?%? (or more )?(below|off|under) (the )?52[- ]?w(ee)?k highs?`), (m) => add("from_high", "lte", -Number(m[1])));

  take(new RegExp(`earnings (in|within) (the )?next ${NUM} (day|week)s?`), (m) => add("next_earnings", "within_days", Number(m[3]) * (m[4] === "week" ? 7 : 1)));
  take(/earnings (this|next) week/, () => add("next_earnings", "within_days", 7));

  take(/\bprofitable\b/, () => add("op_margin", "gte", 0.0001));
  take(new RegExp(`p/?e (under|below|<) ${NUM}`), (m) => add("pe", "between", [0.01, Number(m[2])]));
  take(new RegExp(`(yield|dividend)s? (above|over|>) ${NUM} ?%?`), (m) => add("div_yield", "gte", Number(m[3])));
  take(/\bdividend payers?\b|\bpays? (a )?dividends?\b/, () => add("div_yield", "gte", 0.01));
  take(new RegExp(`beta (above|over|>) ${NUM}`), (m) => add("beta", "gte", Number(m[2])));
  take(/\bunusual volume\b/, () => add("rel_volume", "gte", 2));
  take(/\bhigh[- ]vol(atility)?\b/, () => add("rv20", "gte", 40));
  take(/\blow[- ]vol(atility)?\b/, () => add("rv20", "lte", 20));
  take(new RegExp(`(fees?|expense ratio) (under|below|<|≤) ${NUM} ?%?`), (m) => add("expense_ratio", "lte", Number(m[3])));
  take(new RegExp(`aum (above|over|>) \\$?${NUM} ?(b|bn|billion)`), (m) => add("aum", "gte", Number(m[2]) * 1e9));

  for (const [re, field, values] of SECTOR_WORDS) take(re, () => add(field, "in", values));

  const ignored = q
    .split(/\s+/)
    .filter((w) => w && !/^(and|with|the|of|a|in|that|are|is|show|me|find|all|me|which|who|have|within|near|%)$/.test(w));
  void used;
  return { conds, universe, ignored };
}
