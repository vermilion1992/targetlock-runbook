import { describe, expect, it } from "vitest";

import type { Run } from "@/domain";
import {
  withDefaultRunCorrectionFields,
  type SavedRunOriginalSnapshot,
  type SavedRunSnapshot,
} from "@/infrastructure/drafts";
import { targetLockStage3Seed } from "@/infrastructure/seed";
import { getShiftRunGroups } from "./queries";

function correctedLocalSnapshot(run: Run): SavedRunSnapshot {
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
    correctionIds: ["correction-run-234-measurements"],
    originalSnapshot: original,
    rodStringDm: 6_655,
    measuredStickUpDm: 3,
    holeDepthDm: 6_652,
    drilledLengthDm: 28,
  };
}

describe("shift-grouped completed Run measurements", () => {
  it("projects the saved Night Shift values for Runs 233–245", () => {
    const groups = getShiftRunGroups({
      holeId: "DDH041",
      shifts: targetLockStage3Seed.shifts,
      seedRuns: targetLockStage3Seed.runs,
      localRuns: [],
    });
    const night = groups.find(
      ({ shift }) =>
        shift.shiftType === "NIGHT" && shift.shiftDate === "2026-07-21",
    );

    expect(night).toBeDefined();
    expect(night?.runs.map(({ runNumber }) => runNumber)).toEqual(
      Array.from({ length: 13 }, (_, index) => 233 + index),
    );
    expect(night?.runs.slice(0, 3)).toMatchObject([
      {
        runNumber: 233,
        shared: true,
        rodStringDm: 6_625,
        measuredStickUpDm: 1,
        holeDepthDm: 6_624,
        drilledLengthDm: 9,
        recoveredLengthDm: 9,
        recoveryPercentage: 100,
        activeBitSerialNumberSnapshot: "BIT-HQ-002193",
        activeReamerSerialNumberSnapshot: "REA-HQ-000912",
      },
      {
        runNumber: 234,
        shared: false,
        rodStringDm: 6_685,
        measuredStickUpDm: 31,
        holeDepthDm: 6_654,
        drilledLengthDm: 30,
        recoveredLengthDm: 30,
        recoveryPercentage: 100,
      },
      {
        runNumber: 235,
        shared: false,
        rodStringDm: 6_685,
        measuredStickUpDm: 1,
        holeDepthDm: 6_684,
        drilledLengthDm: 30,
        recoveredLengthDm: 30,
        recoveryPercentage: 100,
      },
    ]);
    expect(night?.shift).toMatchObject({
      startingDepthDm: 6_615,
      endingDepthDm: 6_984,
    });
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
    const run234 = targetLockStage3Seed.runs.find(
      ({ runNumber }) => runNumber === 234,
    )!;
    const corrected = correctedLocalSnapshot(run234);
    const night = getShiftRunGroups({
      holeId: "DDH041",
      shifts: targetLockStage3Seed.shifts,
      seedRuns: targetLockStage3Seed.runs,
      localRuns: [corrected],
    }).find(
      ({ shift }) =>
        shift.shiftType === "NIGHT" && shift.shiftDate === "2026-07-21",
    );
    const effective = night?.runs.find(({ runNumber }) => runNumber === 234);

    expect(effective).toMatchObject({
      status: "corrected",
      rodStringDm: 6_655,
      measuredStickUpDm: 3,
      holeDepthDm: 6_652,
      drilledLengthDm: 28,
    });
    expect(corrected.originalSnapshot).toMatchObject({
      rodStringDm: 6_685,
      measuredStickUpDm: 31,
      holeDepthDm: 6_654,
      drilledLengthDm: 30,
    });
    expect(effective?.activeBitSerialNumberSnapshot).toBe("BIT-HQ-002193");
    expect(effective?.activeReamerSerialNumberSnapshot).toBe("REA-HQ-000912");
  });
});
