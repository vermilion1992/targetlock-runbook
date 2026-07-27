import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import type { BottomHoleAssemblySetup } from "@/infrastructure/components";

import { mapBottomHoleAssemblyTimelineEntries } from "./bha-timeline";

function setup(
  values: Partial<BottomHoleAssemblySetup> &
    Pick<BottomHoleAssemblySetup, "localId" | "effectiveAt">,
): BottomHoleAssemblySetup {
  return {
    holeId: "DDH099",
    effectiveDepthDm: decimetres(0),
    bottomHoleAssemblyLengthDm: decimetres(45),
    constantStickUpDm: decimetres(20),
    baseRodStringLengthDm: decimetres(25),
    reason: "Initial measurement",
    recordedByUserId: "operator-1",
    recordedByNameSnapshot: "Operator One",
    ...values,
  };
}

describe("mapBottomHoleAssemblyTimelineEntries", () => {
  it("maps initial setup and later old-to-new values in effective order", () => {
    const entries = mapBottomHoleAssemblyTimelineEntries([
      setup({
        localId: "second",
        effectiveAt: "2026-07-27T08:00:00.000Z",
        effectiveDepthDm: decimetres(126),
        bottomHoleAssemblyLengthDm: decimetres(43),
        constantStickUpDm: decimetres(18),
        baseRodStringLengthDm: decimetres(25),
        reason: "Remeasured after barrel change",
        recordedByNameSnapshot: "Operator Two",
      }),
      setup({
        localId: "first",
        effectiveAt: "2026-07-27T06:00:00.000Z",
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: "bha-first",
        title: "Initial BHA setup recorded",
        depthDm: 0,
        detail:
          "Initial full BHA 4.5 m · initial constant stick-up 2.0 m · Operator One · Initial measurement",
      }),
      expect.objectContaining({
        id: "bha-second",
        title: "BHA setup updated",
        depthDm: 126,
        occurredAt: "2026-07-27T08:00:00.000Z",
        detail:
          "Full BHA 4.5 m → 4.3 m · constant stick-up 2.0 m → 1.8 m · Operator Two · Remeasured after barrel change",
      }),
    ]);
  });
});
