import { describe, expect, it } from "vitest";

import type { Run } from "@/domain";
import {
  withDefaultRunCorrectionFields,
  type SavedRunOriginalSnapshot,
  type SavedRunSnapshot,
} from "@/infrastructure/drafts";
import { targetLockStage3Seed } from "@/infrastructure/seed";
import { getShiftRunGroups } from "./queries";

function correctedLocalSnapshot(
  run: Run,
  overrides: Partial<
    Pick<
      SavedRunSnapshot,
      "rodStringDm" | "measuredStickUpDm" | "holeDepthDm" | "drilledLengthDm"
    >
  > = {},
): SavedRunSnapshot {
  const original: SavedRunOriginalSnapshot = {
    localId: run.localId,
    startedAt: run.startedAt,
    completedAt: run.completedAt!,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId!,
    startedByUserId: run.startedByUserId,
    startedByNameSnapshot: run.startedByNameSnapshot,
    completedByUserId: run.completedByUserId!,
    completedByNameSnapshot: run.completedByNameSnapshot!,
    holeId: "DDH041",
    syncStatus: "local-only",
    runNumber: run.runNumber,
    rodNumber: run.rodNumber,
    rodStringDm: run.rodStringLength,
    measuredStickUpDm: run.measuredStickUp,
    previousCompletedDepthDm: run.previousCompletedDepth,
    holeDepthDm: run.holeDepth,
    drilledLengthDm: run.drilledLength,
    recoveredLengthDm: run.recoveredLength,
    recoveryPercentage: run.recoveryPercentage,
    rodEvents: [],
    conditionTagIds: [...run.conditionTagIds],
    comment: run.comment ?? "",
    activeBitAssignmentId: run.activeBitAssignmentId,
    activeReamerAssignmentId: run.activeReamerAssignmentId,
    activeBitSerialNumberSnapshot: run.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: run.activeReamerSerialNumberSnapshot,
    casingSummarySnapshot: run.casingSummarySnapshot,
  };

  return {
    ...withDefaultRunCorrectionFields(original),
    version: 2,
    status: "corrected",
    correctionIds: ["correction-demo-measurements"],
    originalSnapshot: original,
    rodStringDm: overrides.rodStringDm ?? Number(run.rodStringLength),
    measuredStickUpDm: overrides.measuredStickUpDm ?? Number(run.measuredStickUp),
    holeDepthDm: overrides.holeDepthDm ?? Number(run.holeDepth) - 2,
    drilledLengthDm: overrides.drilledLengthDm ?? Number(run.drilledLength) - 2,
  };
}

describe("shift-grouped completed Run measurements", () => {
  it("projects saved night-shift runs from the mid-hole sandbox", () => {
    const groups = getShiftRunGroups({
      holeId: "DDH041",
      shifts: targetLockStage3Seed.shifts,
      seedRuns: targetLockStage3Seed.runs,
      localRuns: [],
    });
    const night = groups.find(
      ({ shift }) => shift.shiftType === "NIGHT" && shift.status === "CLOSED",
    );

    expect(night).toBeDefined();
    expect(night!.runs.length).toBeGreaterThan(0);
    expect(
      night!.runs.every(
        (run) =>
          run.holeDepthDm ===
            run.rodStringDm - run.measuredStickUpDm &&
          run.activeBitSerialNumberSnapshot === "BIT-HQ-002193",
      ),
    ).toBe(true);
    expect(night?.shift).toMatchObject({
      shiftType: "NIGHT",
      status: "CLOSED",
    });
    expect(Number(night!.shift.endingDepthDm)).toBeGreaterThan(
      Number(night!.shift.startingDepthDm),
    );
  });

  it("does not merge foreign runs when shift identifiers collide", () => {
    const seedShift = targetLockStage3Seed.shifts[0]!;
    const seedRun = targetLockStage3Seed.runs[0]!;
    const groups = getShiftRunGroups({
      holeId: "DDH999",
      shifts: [{ ...seedShift, holeId: "DDH999" }],
      seedRuns: targetLockStage3Seed.runs,
      localRuns: [correctedLocalSnapshot(seedRun)],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.runs).toEqual([]);
  });

  it("uses effective corrected measurements without mutating the original snapshot", () => {
    const sampleRun = targetLockStage3Seed.runs.find(
      ({ status, completedAt }) => status === "completed" && completedAt !== null,
    )!;
    const corrected = correctedLocalSnapshot(sampleRun, {
      rodStringDm: Number(sampleRun.rodStringLength),
      measuredStickUpDm: Number(sampleRun.measuredStickUp) + 2,
      holeDepthDm: Number(sampleRun.holeDepth) - 2,
      drilledLengthDm: Number(sampleRun.drilledLength) - 2,
    });
    const group = getShiftRunGroups({
      holeId: "DDH041",
      shifts: targetLockStage3Seed.shifts,
      seedRuns: targetLockStage3Seed.runs,
      localRuns: [corrected],
    }).find(({ shift }) => shift.localId === sampleRun.startedShiftId);
    const effective = group?.runs.find(
      ({ runNumber }) => runNumber === sampleRun.runNumber,
    );

    expect(effective).toMatchObject({
      status: "corrected",
      rodStringDm: corrected.rodStringDm,
      measuredStickUpDm: corrected.measuredStickUpDm,
      holeDepthDm: corrected.holeDepthDm,
      drilledLengthDm: corrected.drilledLengthDm,
    });
    expect(corrected.originalSnapshot).toMatchObject({
      rodStringDm: sampleRun.rodStringLength,
      measuredStickUpDm: sampleRun.measuredStickUp,
      holeDepthDm: sampleRun.holeDepth,
      drilledLengthDm: sampleRun.drilledLength,
    });
    expect(effective?.activeBitSerialNumberSnapshot).toBe("BIT-HQ-002193");
    expect(effective?.activeReamerSerialNumberSnapshot).toBe("REA-HQ-000912");
  });
});
