import { describe, expect, it } from "vitest";

import {
  averageInteger,
  elapsedMinutesBetween,
  isTrustworthyTimestamp,
  medianInteger,
} from "./numeric";

describe("medianInteger", () => {
  it("returns undefined for empty input", () => {
    expect(medianInteger([])).toBeUndefined();
  });

  it("returns the middle value for an odd count", () => {
    expect(medianInteger([30, 20, 40])).toBe(30);
    expect(medianInteger([10])).toBe(10);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianInteger([20, 30, 40, 50])).toBe(35);
    expect(medianInteger([30, 30])).toBe(30);
  });
});

describe("averageInteger", () => {
  it("returns undefined for empty input", () => {
    expect(averageInteger([])).toBeUndefined();
  });

  it("rounds the arithmetic mean", () => {
    expect(averageInteger([29, 30, 30])).toBe(30);
  });
});

describe("timestamps", () => {
  it("rejects missing or invalid timestamps", () => {
    expect(isTrustworthyTimestamp(undefined)).toBe(false);
    expect(isTrustworthyTimestamp("")).toBe(false);
    expect(isTrustworthyTimestamp("not-a-date")).toBe(false);
    expect(isTrustworthyTimestamp("2026-07-21T08:00:00.000Z")).toBe(true);
  });

  it("calculates elapsed minutes when both timestamps are trustworthy", () => {
    expect(
      elapsedMinutesBetween(
        "2026-07-21T08:00:00.000Z",
        "2026-07-21T20:00:00.000Z",
      ),
    ).toBe(720);
  });

  it("returns undefined when timestamps are missing", () => {
    expect(
      elapsedMinutesBetween("2026-07-21T08:00:00.000Z", undefined),
    ).toBeUndefined();
  });
});
