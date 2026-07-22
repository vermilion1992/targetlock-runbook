import { describe, expect, it } from "vitest";

import {
  addDecimetres,
  decimetres,
  decimetresToMetres,
  formatMetres,
  metresToDecimetres,
  parseMetreInput,
  roundToNearestDecimetre,
  subtractDecimetres,
} from "./measurements";

describe("decimetre measurements", () => {
  it("converts and formats exact one-decimal metre values", () => {
    const value = metresToDecimetres(14.5);

    expect(value).toBe(145);
    expect(decimetresToMetres(value)).toBe(14.5);
    expect(formatMetres(value)).toBe("14.5 m");
  });

  it("rejects finer precision rather than silently rounding", () => {
    expect(() => metresToDecimetres(1.25)).toThrow(
      "at most one decimal place",
    );
    expect(roundToNearestDecimetre(1.25)).toBe(13);
  });

  it("keeps arithmetic integer-only", () => {
    expect(
      addDecimetres(metresToDecimetres(2.5), metresToDecimetres(3)),
    ).toBe(55);
    expect(
      subtractDecimetres(
        metresToDecimetres(14.5),
        metresToDecimetres(1.2),
      ),
    ).toBe(133);
  });

  it("rejects invalid and negative measurements", () => {
    expect(() => decimetres(1.5)).toThrow("safe integer");
    expect(() => decimetres(-1)).toThrow("cannot be negative");
    expect(() =>
      subtractDecimetres(decimetres(1), decimetres(2)),
    ).toThrow("cannot produce a negative length");
  });

  it("parses typed and pasted metre values without implicit rounding", () => {
    expect(parseMetreInput("4.3")).toEqual({ ok: true, value: 43 });
    expect(parseMetreInput("4,3")).toEqual({ ok: true, value: 43 });
    expect(parseMetreInput(" 4.30 ")).toEqual({ ok: true, value: 43 });
    expect(parseMetreInput("4.35")).toEqual({
      ok: false,
      reason: "precision",
    });
    expect(parseMetreInput("-0.1")).toEqual({
      ok: false,
      reason: "negative",
    });
    expect(parseMetreInput("")).toEqual({ ok: false, reason: "empty" });
    expect(parseMetreInput("four")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
