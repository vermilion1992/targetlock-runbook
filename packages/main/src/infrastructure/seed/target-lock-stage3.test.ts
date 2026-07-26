import { describe, expect, it } from "vitest";

import { targetLockStage3Seed } from "./target-lock-stage3";

describe("TargetLock Stage 3 seed", () => {
  it("uses one canonical identifier for DDH041 and its owned records", () => {
    expect(targetLockStage3Seed.hole.localId).toBe("DDH041");
    expect(targetLockStage3Seed.hole.name).toBe("DDH041");

    const holeOwnedRecords = [
      ...targetLockStage3Seed.holeConfigurations,
      ...targetLockStage3Seed.rodStringConfigurations,
      ...targetLockStage3Seed.rodEvents,
      ...targetLockStage3Seed.shifts,
      ...targetLockStage3Seed.runs,
      ...targetLockStage3Seed.casingStrings,
      ...targetLockStage3Seed.casingEvents,
      ...targetLockStage3Seed.surveys,
      ...targetLockStage3Seed.holeEvents,
      ...targetLockStage3Seed.trays,
      ...targetLockStage3Seed.photos,
      ...targetLockStage3Seed.sentReports,
    ];

    expect(new Set(holeOwnedRecords.map(({ holeId }) => holeId))).toEqual(
      new Set(["DDH041"]),
    );
  });

  it("provides nested casing with an immutable advancement event", () => {
    expect(
      targetLockStage3Seed.casingStrings.map(
        ({ casingSize, startDepthDm, currentEndDepthDm }) => ({
          casingSize,
          startDepthDm,
          currentEndDepthDm,
        }),
      ),
    ).toEqual([
      { casingSize: "PQ", startDepthDm: 0, currentEndDepthDm: 180 },
      { casingSize: "HQ", startDepthDm: 0, currentEndDepthDm: 420 },
    ]);
    expect(
      targetLockStage3Seed.casingEvents.some(
        ({ eventType, previousEndDepthDm, newEndDepthDm }) =>
          eventType === "ADVANCE" &&
          previousEndDepthDm === 60 &&
          newEndDepthDm === 180,
      ),
    ).toBe(true);
  });

  it("backs active component strings with exact assignment intervals", () => {
    const bitAssignments = targetLockStage3Seed.componentAssignments.filter(
      ({ holeId, componentType }) =>
        holeId === "DDH041" && componentType === "BIT",
    );
    expect(bitAssignments).toMatchObject([
      {
        componentId: "component-bit-001842",
        startDepthDm: 0,
        endDepthDm: 4_126,
        removalReason: "WORN",
        status: "CLOSED",
      },
      {
        componentId: "component-bit-002193",
        startDepthDm: 4_126,
        status: "ACTIVE",
      },
    ]);
    expect(
      targetLockStage3Seed.componentAssignments.some(
        ({ holeId, status }) => holeId === "DDH040" && status === "ACTIVE",
      ),
    ).toBe(true);
  });

  it("preserves Stage 2 run and shift continuity", () => {
    expect(targetLockStage3Seed.runs).toHaveLength(25);
    expect(targetLockStage3Seed.shifts).toHaveLength(2);
    expect(
      targetLockStage3Seed.runs.every(
        (run) =>
          run.activeBitAssignmentId === "assignment-bit-002193-ddh041" &&
          run.activeReamerAssignmentId ===
            "assignment-reamer-000912-ddh041",
      ),
    ).toBe(true);
  });
});
