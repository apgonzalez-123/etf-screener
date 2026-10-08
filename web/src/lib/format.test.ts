import { describe, expect, it } from "vitest";
import { compact, DASH, money, num, pct, signedPct } from "./format";

describe("missing values render as a dash, never zero", () => {
  it.each([null, undefined, NaN, Infinity])("%s", (v) => {
    expect(money(v as never)).toBe(DASH);
    expect(compact(v as never)).toBe(DASH);
    expect(num(v as never)).toBe(DASH);
    expect(pct(v as never)).toBe(DASH);
    expect(signedPct(v as never)).toBe(DASH);
  });
  it("real zero is still zero", () => {
    expect(num(0)).toBe("0.00");
  });
});

describe("signed changes always carry a sign", () => {
  it("positive", () => expect(signedPct(1.234)).toBe("+1.23%"));
  it("negative uses a true minus", () => expect(signedPct(-0.5)).toBe("−0.50%"));
});

describe("compact", () => {
  it("scales", () => {
    expect(compact(5.72e12)).toBe("$5.72T");
    expect(compact(814e9)).toBe("$814B");
    expect(compact(12.3e6)).toBe("$12.3M");
  });
});
