import { asOf, arrow, dir } from "../lib/format";
import type { N } from "../lib/types";

interface Props {
  value: N | undefined;
  fmt: (v: N) => string;
  source: string;
  asof: string | null | undefined;
  formula?: string;
  signed?: boolean;
  className?: string;
}

/**
 * Every rendered number goes through here: it carries its source and as-of
 * time as data attributes (checked by tests) and in the hover title, and a
 * signed value always shows an arrow and sign, never color alone.
 */
export function Num({ value, fmt, source, asof, formula, signed, className }: Props) {
  const v = value ?? null;
  const d = signed ? dir(v) : "flat";
  const title = [`Source: ${source}`, `As of: ${asOf(asof)}`, formula ? `Formula: ${formula}` : null]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      className={["num", d !== "flat" ? d : "", className ?? ""].join(" ").trim()}
      data-source={source}
      data-asof={asof ?? ""}
      data-null={v === null ? "true" : undefined}
      title={title}
    >
      {signed && d !== "flat" ? <span aria-hidden="true">{arrow(v)} </span> : null}
      {fmt(v)}
    </span>
  );
}
