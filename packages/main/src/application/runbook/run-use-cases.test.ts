import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import { LocalAuditRepository } from "@/infrastructure/audit";
import { LocalCasingRepository } from "@/infrastructure/casing";
import { LocalComponentRepository } from "@/infrastructure/components";
import {
  LocalRunRepository,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import { LocalShiftRepository } from "@/infrastructure/shifts";
import { targetLockStage3Seed } from "@/infrastructure/seed";
import { completeRun, startRun } from "./run-use-cases";

class MemoryStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

async function setup() {
  const storage = new MemoryStorage();
  const runs = new LocalRunRepository(storage);
  const shifts = new LocalShiftRepository(storage);
  const audits = new LocalAuditRepository(storage);
  const components = new LocalComponentRepository(
    storage,
    targetLockStage3Seed.organisation.localId,
    targetLockStage3Seed.components,
    targetLockStage3Seed.componentAssignments,
  );
  const casing = new LocalCasingRepository(
    storage,
    targetLockStage3Seed.casingStrings,
    targetLockStage3Seed.casingEvents,
  );
  const services = {
    runs,
    shifts,
    audits,
    components,
    componentAssignments: components,
    casing,
  };
  const day = await shifts.startShift({
    id: "shift-day",
    holeId: "DDH041",
    rigId: "rig-10",
    shiftType: "DAY",
    shiftDate: "2026-07-21",
    primaryDrillerId: "user-hoffman",
    primaryDrillerNameSnapshot: "M. Hoffman",
    crewMembers: [{ userId: "user-hoffman", name: "M. Hoffman" }],
    startedAt: "2026-07-21T06:00:00.000Z",
    startingState: {
      depthDm: decimetres(6_268),
      rodNumber: 106,
      rodStringDm: decimetres(6_295),
      measuredStickUpDm: decimetres(27),
      runNumber: 221,
    },
  });
  return { ...services, services, day };
}

const completion = {
  localId: "run-221",
  completedAt: "2026-07-21T07:00:00.000Z",
  holeId: "DDH041",
  runNumber: 221,
  rodNumber: 106,
  rodStringDm: 6_295,
  measuredStickUpDm: 0,
  previousCompletedDepthDm: 6_268,
  holeDepthDm: 6_295,
  drilledLengthDm: 27,
  recoveredLengthDm: 27,
  recoveryPercentage: 100,
  rodEvents: [],
  conditionTagIds: [],
  comment: "",
};

describe("shift-aware run use cases", () => {
  it("records ordinary run ownership under the same shift", async () => {
    const { services, runs } = await setup();
    await startRun(
      {
        holeId: "DDH041",
        localId: "run-221",
        startedAt: "2026-07-21T06:10:00.000Z",
        context: {
          runNumber: 221,
          rodNumber: 106,
          currentRodStringDm: 6_295,
          previousCompletedDepthDm: 6_268,
        },
      },
      services,
    );
    await expect(completeRun(completion, services)).resolves.toMatchObject({
      ok: true,
      status: "saved",
    });
    expect(runs.readCompletedRuns("DDH041")).toMatchObject({
      status: "valid",
      snapshots: [
        {
          startedShiftId: "shift-day",
          completedShiftId: "shift-day",
          startedByNameSnapshot: "M. Hoffman",
          completedByNameSnapshot: "M. Hoffman",
          activeBitAssignmentId: "assignment-bit-002193-ddh041",
          activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
          activeBitSerialNumberSnapshot: "BIT-HQ-002193",
          activeReamerSerialNumberSnapshot: "REA-HQ-000912",
        },
      ],
    });
  });

  it("keeps one run and its original owner when Night Shift completes it", async () => {
    const { services, runs, shifts, day } = await setup();
    await startRun(
      {
        holeId: "DDH041",
        localId: "run-221",
        startedAt: "2026-07-21T17:52:00.000Z",
        context: {
          runNumber: 221,
          rodNumber: 106,
          currentRodStringDm: 6_295,
          previousCompletedDepthDm: 6_268,
        },
      },
      services,
    );
    const pending = await shifts.closeForHandover({
      holeId: "DDH041",
      shiftId: day.localId,
      expectedVersion: day.version,
      closedAt: "2026-07-21T18:00:00.000Z",
      endingState: {
        depthDm: decimetres(6_268),
        rodNumber: 106,
        rodStringDm: decimetres(6_295),
        runNumber: 220,
      },
      handoverRunId: "run-221",
      handoverRunNumber: 221,
    });
    await shifts.acceptHandover({
      operationId: "accept-1",
      holeId: "DDH041",
      outgoingShiftId: day.localId,
      expectedVersion: pending.version,
      incomingShiftId: "shift-night",
      incomingShiftType: "NIGHT",
      incomingShiftDate: "2026-07-21",
      incomingDrillerId: "user-smith",
      incomingDrillerNameSnapshot: "J. Smith",
      incomingCrewMembers: [{ userId: "user-smith", name: "J. Smith" }],
      acceptedAt: "2026-07-21T18:02:00.000Z",
    });
    await completeRun(completion, services);
    const result = runs.readCompletedRuns("DDH041");
    expect(result).toMatchObject({
      status: "valid",
      snapshots: [
        {
          localId: "run-221",
          runNumber: 221,
          startedShiftId: "shift-day",
          completedShiftId: "shift-night",
          startedByNameSnapshot: "M. Hoffman",
          completedByNameSnapshot: "J. Smith",
          activeBitAssignmentId: "assignment-bit-002193-ddh041",
          activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
          activeBitSerialNumberSnapshot: "BIT-HQ-002193",
          activeReamerSerialNumberSnapshot: "REA-HQ-000912",
        },
      ],
    });
    if (result.status !== "valid") throw new Error("expected valid runs");
    expect(result.snapshots).toHaveLength(1);
    await expect(completeRun(completion, services)).rejects.toThrow(
      "draft is missing",
    );
  });

  it("keeps earlier component ownership and gives a later run the new bit", async () => {
    const { services, runs, components, day } = await setup();
    await startRun(
      {
        holeId: "DDH041",
        localId: "run-221",
        startedAt: "2026-07-21T06:10:00.000Z",
        context: {
          runNumber: 221,
          rodNumber: 106,
          currentRodStringDm: 6_295,
          previousCompletedDepthDm: 6_268,
        },
      },
      services,
    );
    await completeRun(completion, services);

    await components.changeComponent({
      operationId: "change-bit-between-runs",
      holeId: "DDH041",
      componentType: "BIT",
      outgoingAssignmentId: "assignment-bit-002193-ddh041",
      incomingComponentId: "component-bit-003007",
      changeDepthDm: decimetres(6_295),
      removalReason: "WORN",
      shiftId: day.localId,
      userId: "user-hoffman",
      userNameSnapshot: "M. Hoffman",
      occurredAt: "2026-07-21T07:05:00.000Z",
    });

    await startRun(
      {
        holeId: "DDH041",
        localId: "run-222",
        startedAt: "2026-07-21T07:10:00.000Z",
        context: {
          runNumber: 222,
          rodNumber: 107,
          currentRodStringDm: 6_325,
          previousCompletedDepthDm: 6_295,
        },
      },
      services,
    );
    await completeRun(
      {
        ...completion,
        localId: "run-222",
        runNumber: 222,
        rodNumber: 107,
        rodStringDm: 6_325,
        previousCompletedDepthDm: 6_295,
        holeDepthDm: 6_325,
        drilledLengthDm: 30,
        recoveredLengthDm: 29,
        recoveryPercentage: 96.7,
        completedAt: "2026-07-21T08:00:00.000Z",
      },
      services,
    );

    const result = runs.readCompletedRuns("DDH041");
    if (result.status !== "valid") throw new Error("expected valid runs");
    expect(result.snapshots).toMatchObject([
      {
        runNumber: 221,
        activeBitAssignmentId: "assignment-bit-002193-ddh041",
        activeBitSerialNumberSnapshot: "BIT-HQ-002193",
      },
      {
        runNumber: 222,
        activeBitAssignmentId: "change-bit-between-runs-incoming",
        activeBitSerialNumberSnapshot: "BIT-HQ-003007",
      },
    ]);
  });
});
