import { describe, expect, it } from "vitest";

import {
  calculateActiveRodInventory,
  calculateCurrentRodString,
  calculateHoleDepth,
  calculateRodNumber,
} from "../../domain";
import {
  DDH041_DEMO_CURRENT_DEPTH_M,
  DDH041_DEMO_PLANNED_DEPTH_M,
} from "./target-lock-ddh041-midhole";
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
  it("uses the mid-hole demo plan and current configuration", () => {
    const currentConfiguration = ddh041RodStringConfigurations.at(-1);

    expect(ddh041.plannedDepth).toBe(DDH041_DEMO_PLANNED_DEPTH_M * 10);
    expect(ddh041.currentDepth).toBe(DDH041_DEMO_CURRENT_DEPTH_M * 10);
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
    const configuration = ddh041RodStringConfigurations.at(-1)!;

    expect(inventory.totalRods).toBe(calculateRodNumber(inputs));
    expect(
      calculateCurrentRodString(configuration.baseRodStringLength, inputs),
    ).toBe(ddh041CurrentState.currentRodString);
    expect(
      ddh041RodEvents.every(
        ({ action, affectedRodNumber, rodNumberAfterEvent }) =>
          action === "add"
            ? affectedRodNumber === rodNumberAfterEvent
            : affectedRodNumber === rodNumberAfterEvent + 1,
      ),
    ).toBe(true);
  });

  it("records an open mid-hole run at ~630 m", () => {
    const currentRun = ddh041Runs.at(-1);

    expect(ddh041CurrentState.currentHoleDepth).toBe(
      DDH041_DEMO_CURRENT_DEPTH_M * 10,
    );
    expect(currentRun).toMatchObject({
      status: "in_progress",
      completedShiftId: null,
      completedAt: null,
      holeDepth: DDH041_DEMO_CURRENT_DEPTH_M * 10,
      activeBitSerialNumberSnapshot: "BIT-HQ-002193",
      activeReamerSerialNumberSnapshot: "REA-HQ-000912",
      casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
    });
    expect(currentRun?.holeDepth).toBe(
      calculateHoleDepth(
        currentRun!.rodStringLength,
        currentRun!.measuredStickUp,
      ),
    );
  });

  it("includes many day/night shifts and historical equipment", () => {
    expect(new Set(ddh041Shifts.map(({ shiftType }) => shiftType))).toEqual(
      new Set(["DAY", "NIGHT"]),
    );
    expect(ddh041Shifts.filter(({ status }) => status === "CLOSED").length).toBeGreaterThanOrEqual(20);
    expect(ddh041Shifts.some(({ status }) => status === "OPEN")).toBe(true);
    expect(
      rig10Components.filter(({ type }) => type === "BIT"),
    ).toHaveLength(4);
    expect(
      rig10Components.filter(({ type }) => type === "REAMER"),
    ).toHaveLength(3);
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
    const photoIds = new Set(ddh041Photos.map(({ localId }) => localId));

    expect(activeBitAssignment).toMatchObject({
      startDepthDm: 4_126,
      endDepthDm: undefined,
      status: "ACTIVE",
    });
    expect(
      ddh041Surveys.every(
        ({ northReference, toolSerialSnapshot }) =>
          ["TRUE", "MAGNETIC", "GRID", "NOT_SPECIFIED"].includes(
            northReference,
          ) && (toolSerialSnapshot?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(ddh041Surveys[0]?.depthDm).toBe(0);
    expect(ddh041Surveys.at(-1)?.depthDm).toBe(
      DDH041_DEMO_CURRENT_DEPTH_M * 10,
    );
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
    expect(targetLockStage1Seed.surveys.length).toBeGreaterThan(15);
    expect(targetLockStage1Seed.photos.length).toBeGreaterThan(1);
    expect(targetLockStage1Seed.corrections.length).toBeGreaterThan(0);
    expect(targetLockStage1Seed.sentReports.length).toBeGreaterThan(0);
    expect(targetLockStage1Seed.syncOperations.length).toBeGreaterThan(0);
  });
});
