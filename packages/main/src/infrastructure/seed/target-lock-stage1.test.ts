import { describe, expect, it } from "vitest";

import {
  calculateActiveRodInventory,
  calculateCurrentRodString,
  calculateRodNumber,
} from "../../domain";
import {
  ddh041,
  ddh041Photos,
  ddh041CurrentState,
  ddh041RodEvents,
  ddh041RodStringConfigurations,
  ddh041Runs,
  ddh041SentReports,
  ddh041Shifts,
  ddh041Surveys,
  ddh041Trays,
  rig10ComponentAssignments,
  rig10Components,
  targetLockStage1Seed,
} from "./target-lock-stage1";

describe("TargetLock Stage 1 seed", () => {
  it("uses the authoritative DDH041 plan and current configuration", () => {
    const currentConfiguration = ddh041RodStringConfigurations.at(-1);

    expect(ddh041.plannedDepth).toBe(7_500);
    expect(ddh041.holeSize).toBe("HQ");
    expect(
      targetLockStage1Seed.holeConfigurations.every(
        ({ holeSize }) => holeSize === "HQ",
      ),
    ).toBe(true);
    expect(currentConfiguration).toMatchObject({
      bottomHoleAssemblyLength: 43,
      constantStickUp: 18,
      baseRodStringLength: 25,
    });
  });

  it("has a mathematically consistent active rod inventory", () => {
    const inputs = ddh041RodEvents.map(({ action, rodLength }) => ({
      action,
      rodLength,
    }));
    const inventory = calculateActiveRodInventory(inputs);

    expect(inventory).toEqual({
      threeMetreRods: 4,
      sixMetreRods: 108,
      totalRods: 112,
      totalLength: 6_600,
    });
    expect(calculateRodNumber(inputs)).toBe(112);
    expect(
      calculateCurrentRodString(
        ddh041CurrentState.baseRodStringLength,
        inputs,
      ),
    ).toBe(6_625);
    expect(
      ddh041RodEvents.every(
        ({ action, affectedRodNumber, rodNumberAfterEvent }) =>
          action === "add"
            ? affectedRodNumber === rodNumberAfterEvent
            : affectedRodNumber === rodNumberAfterEvent + 1,
      ),
    ).toBe(true);
  });

  it("records the authoritative current run context", () => {
    const currentRun = ddh041Runs.at(-1);

    expect(ddh041CurrentState).toMatchObject({
      rodNumber: 112,
      currentRodString: 6_625,
      measuredStickUp: 10,
      currentHoleDepth: 6_615,
      previousCompletedDepth: 6_586,
      drilledLength: 29,
      recoveredLength: 28,
      recoveryPercentage: 96.6,
    });
    expect(currentRun).toMatchObject({
      localId: "run-ddh041-220",
      startedShiftId: "shift-ddh041-day-20",
      completedShiftId: null,
      rodNumber: 112,
      rodStringLength: 6_625,
      measuredStickUp: 10,
      holeDepth: 6_615,
      previousCompletedDepth: 6_586,
      drilledLength: 29,
      recoveredLength: 28,
      recoveryPercentage: 96.6,
      startedByUserId: "user-driller-hayes",
      startedByNameSnapshot: "Jordan Hayes",
      completedByUserId: null,
      completedByNameSnapshot: null,
      rodAddedLength: null,
      activeBitSerialNumberSnapshot: "BIT-HQ-002193",
      activeReamerSerialNumberSnapshot: "REA-HQ-000912",
      activeBitAssignmentId: "assignment-bit-002193-ddh041",
      activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
      casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
      correctionIds: [],
    });
    expect(
      ddh041RodEvents.some(({ runId }) => runId === "run-ddh041-220"),
    ).toBe(false);
  });

  it("includes day/night shifts, a shared run, and historical equipment", () => {
    expect(new Set(ddh041Shifts.map(({ shiftType }) => shiftType))).toEqual(
      new Set(["DAY", "NIGHT"]),
    );
    expect(
      ddh041Shifts.filter(
        ({ handoverRunId }) => handoverRunId === "run-ddh041-220",
      ),
    ).toHaveLength(2);
    expect(
      rig10Components.filter(({ type }) => type === "BIT"),
    ).toHaveLength(4);
    expect(
      rig10Components.filter(
        ({ type }) => type === "REAMER",
      ),
    ).toHaveLength(3);
    expect(
      rig10Components.every(({ size, normalizedSerialNumber }) =>
        size === "HQ" && normalizedSerialNumber.length > 0,
      ),
    ).toBe(true);
    expect(
      ddh041Shifts.every(
        ({ primaryDrillerId, primaryDrillerNameSnapshot }) =>
          primaryDrillerId.length > 0 &&
          primaryDrillerNameSnapshot.length > 0,
      ),
    ).toBe(true);
    expect(
      ddh041Shifts
        .filter(({ status }) => status === "CLOSED")
        .every(
          ({ handoverNote, handoverAcceptedBy, handoverAcceptedAt }) =>
            handoverNote !== undefined &&
            handoverAcceptedBy !== undefined &&
            handoverAcceptedAt !== undefined,
        ),
    ).toBe(true);
  });

  it("links operational component, survey, tray, and run snapshots", () => {
    const activeBitAssignment = rig10ComponentAssignments.find(
      ({ componentId }) => componentId === "component-bit-002193",
    );
    const runWithRod = ddh041Runs.find(
      ({ localId }) => localId === "run-ddh041-217",
    );
    const correctedRun = ddh041Runs.find(
      ({ localId }) => localId === "run-ddh041-216",
    );
    const photoIds = new Set(ddh041Photos.map(({ localId }) => localId));

    expect(activeBitAssignment).toMatchObject({
      startDepthDm: 4_126,
      endDepthDm: undefined,
      status: "ACTIVE",
    });
    expect(runWithRod).toMatchObject({
      rodAddedLength: 60,
      conditionTagLabelsSnapshot: ["Competent ground"],
    });
    expect(runWithRod?.rodEventIds).toHaveLength(1);
    expect(correctedRun?.correctionIds).toEqual([
      "correction-ddh041-run-216",
    ]);
    expect(
      ddh041Surveys.every(
        ({ northReference, toolSerialSnapshot }) =>
          ["TRUE", "MAGNETIC", "GRID", "NOT_SPECIFIED"].includes(
            northReference,
          ) && (toolSerialSnapshot?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(
      ddh041Trays.every(
        ({ primaryPhotoId, comment }) =>
          photoIds.has(primaryPhotoId) && comment !== undefined,
      ),
    ).toBe(true);
  });

  it("preserves immutable sent-report delivery snapshots", () => {
    expect(ddh041SentReports).toHaveLength(2);
    expect(
      ddh041SentReports.every(
        ({
          reportVersion,
          sentByNameSnapshot,
          holeDepthSnapshot,
          attachmentsSnapshot,
          deliveryStatus,
        }) =>
          reportVersion === 1 &&
          sentByNameSnapshot === "Morgan Lee" &&
          holeDepthSnapshot > 0 &&
          attachmentsSnapshot.length > 0 &&
          deliveryStatus === "sent",
      ),
    ).toBe(true);
  });

  it("exports all Stage 1 aggregate collections", () => {
    expect(targetLockStage1Seed.casingStrings).toHaveLength(2);
    expect(targetLockStage1Seed.casingEvents.length).toBeGreaterThan(2);
    expect(targetLockStage1Seed.surveys.length).toBeGreaterThan(1);
    expect(targetLockStage1Seed.photos.length).toBeGreaterThan(1);
    expect(targetLockStage1Seed.corrections.length).toBeGreaterThan(0);
    expect(targetLockStage1Seed.sentReports.length).toBeGreaterThan(0);
    expect(targetLockStage1Seed.syncOperations.length).toBeGreaterThan(0);
  });
});
