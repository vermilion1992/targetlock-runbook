import { describe, expect, it } from "vitest";

import { metresToDecimetres } from "./measurements";
import {
  calculateCoreLossOrGain,
  calculateRecoveryPercentage,
  classifyRunBoundary,
  formatRecoveryPercentage,
} from "./run-results";

describe("run result calculations", () => {
  it("rounds recovery to one decimal display precision", () => {
    const recovery = calculateRecoveryPercentage(
      metresToDecimetres(2.9),
      metresToDecimetres(2.8),
    );

    expect(recovery).toBe(96.6);
    expect(formatRecoveryPercentage(recovery)).toBe("96.6%");
  });

  it("retains recovery above 100 percent as measured core gain", () => {
    expect(
      calculateRecoveryPercentage(
        metresToDecimetres(3),
        metresToDecimetres(3.2),
      ),
    ).toBe(106.7);
    expect(
      calculateCoreLossOrGain(
        metresToDecimetres(3),
        metresToDecimetres(3.2),
      ),
    ).toEqual({ kind: "gain", amount: 2 });
  });

  it("classifies core loss and exact recovery", () => {
    expect(
      calculateCoreLossOrGain(
        metresToDecimetres(3),
        metresToDecimetres(2.8),
      ),
    ).toEqual({ kind: "loss", amount: 2 });
    expect(
      calculateCoreLossOrGain(
        metresToDecimetres(3),
        metresToDecimetres(3),
      ),
    ).toEqual({ kind: "exact", amount: 0 });
  });

  it("classifies contiguous, gap, and overlap boundaries", () => {
    const previousDepth = metresToDecimetres(100);

    expect(
      classifyRunBoundary(previousDepth, metresToDecimetres(100)),
    ).toEqual({ kind: "contiguous", amount: 0 });
    expect(
      classifyRunBoundary(previousDepth, metresToDecimetres(100.3)),
    ).toEqual({ kind: "gap", amount: 3 });
    expect(
      classifyRunBoundary(previousDepth, metresToDecimetres(99.8)),
    ).toEqual({ kind: "overlap", amount: 2 });
  });

  it("rejects recovery percentage when nothing was drilled", () => {
    expect(() =>
      calculateRecoveryPercentage(
        metresToDecimetres(0),
        metresToDecimetres(0),
      ),
    ).toThrow("undefined");
  });
});
