import { describe, expect, it } from "vitest";

import {
  decimetres,
  isHoleLockedError,
  type Hole,
  type HoleCompletionDisposition,
  type HoleCompletionRecord,
  type SyncMetadata,
} from "@/domain";
import {
  LocalRunRepository,
  type LocalStorageAdapter,
  type RunDraftPayload,
} from "@/infrastructure/drafts";
import { LocalShiftRepository } from "@/infrastructure/shifts";
import { LocalCasingRepository } from "@/infrastructure/casing";
import { LocalComponentRepository } from "@/infrastructure/components";
import { LocalSurveyRepository } from "@/infrastructure/surveys";
import { LocalTrayRepository } from "@/infrastructure/trays";
import { MemoryMediaRepository } from "@/infrastructure/media";
import {
  HoleMutationGuard,
  LocalCompletionRepository,
  type CompletionRepositorySeed,
} from "./completion-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  failNextShiftWrite = false;
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failNextShiftWrite && key.endsWith(":shifts")) {
      this.failNextShiftWrite = false;
      throw new Error("interrupted");
    }
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const ORGANISATION_ID = "organisation-briggs";
const HOLE_ID = "DDH041";
const STARTED_AT = "2026-07-21T10:00:00.000Z";
const COMPLETED_AT = "2026-07-21T12:00:00.000Z";

function metadata(localId: string, updatedAt = STARTED_AT): SyncMetadata {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: STARTED_AT,
    updatedAt,
    deviceId: "test-device",
    version: 1,
  };
}

function hole(status: Hole["status"] = "ACTIVE"): Hole {
  return {
    ...metadata(HOLE_ID),
    projectId: "project-briggs",
    rigId: "rig-10",
    name: HOLE_ID,
    holeSize: "HQ",
    plannedDepth: decimetres(7_500),
    currentDepth: decimetres(6_615),
    status,
    collarEasting: 1,
    collarNorthing: 2,
    collarElevation: 3,
  };
}

function completion(
  reviewId: string,
  operationId: string,
  finalStatus: HoleCompletionDisposition = "COMPLETED",
): HoleCompletionRecord {
  return {
    ...metadata(`completion-${HOLE_ID}`, COMPLETED_AT),
    holeId: HOLE_ID,
    reviewId,
    finalStatus,
    completedAt: COMPLETED_AT,
    completedByUserId: "user-supervisor",
    completedByNameSnapshot: "Morgan Lee",
    operationId,
    snapshot: {
      holeId: HOLE_ID,
      projectId: "project-briggs",
      projectNameSnapshot: "Briggs North Ridge",
      rigId: "rig-10",
      rigNameSnapshot: "Rig 10",
      finalStatus,
      finalDepthDm: decimetres(6_615),
      plannedDepthDm: decimetres(7_500),
      finalRunNumber: 245,
      runIds: ["run-245"],
      finalRodNumber: 118,
      currentRodStringDm: decimetres(6_625),
      measuredStickUpDm: decimetres(10),
      bottomHoleAssemblyLengthDm: decimetres(43),
      constantStickUpDm: decimetres(18),
      baseRodStringDm: decimetres(25),
      rodStringConfigurationId: "rod-config-1",
      casingSummary: null,
      finalPartialTrayConfirmed: true,
      surveyCount: 1,
      trayCount: 1,
      totalRuns: 1,
      totalDrilledDm: decimetres(6_615),
      totalRecoveredDm: decimetres(6_500),
      totalLossDm: decimetres(115),
      totalGainDm: decimetres(0),
      overallRecoveryPercentTenths: 983,
      reason:
        finalStatus === "ABANDONED"
          ? "HOLE_ABANDONED"
          : "PLANNED_DEPTH_REACHED",
      checklist: [],
      componentOutcomes: [],
      warningAcknowledgements: [],
      completedByUserId: "user-supervisor",
      completedByNameSnapshot: "Morgan Lee",
      capturedAt: COMPLETED_AT,
    },
  };
}

async function lockHole(
  repository: LocalCompletionRepository,
  finalStatus: HoleCompletionDisposition = "COMPLETED",
): Promise<void> {
  const begun = await repository.beginReview({
    operationId: `begin-${finalStatus}`,
    reviewId: `review-${finalStatus}`,
    holeId: HOLE_ID,
    expectedHoleVersion: 1,
    startedAt: STARTED_AT,
    startedByUserId: "user-supervisor",
    startedByNameSnapshot: "Morgan Lee",
  });
  const ready = await repository.saveReviewDraft({
    operationId: `save-${finalStatus}`,
    reviewId: begun.localId,
    holeId: HOLE_ID,
    expectedVersion: begun.version,
    savedAt: "2026-07-21T11:00:00.000Z",
    reviewStatus: "READY",
    disposition: finalStatus,
    reason:
      finalStatus === "ABANDONED"
        ? "HOLE_ABANDONED"
        : "PLANNED_DEPTH_REACHED",
    comment: "Locked for enforcement tests.",
  });
  const operationId = `complete-${finalStatus}`;
  const record = completion(ready.localId, operationId, finalStatus);
  await repository.beginCompletionOperation({
    operationId,
    holeId: HOLE_ID,
    reviewId: ready.localId,
    startedAt: COMPLETED_AT,
  });
  await repository.persistCompletionRecord(record);
  await repository.advanceCompletionOperation({
    operationId,
    stage: "COMPONENTS_CLOSED",
    updatedAt: COMPLETED_AT,
  });
  await repository.lockHole({
    operationId,
    holeId: HOLE_ID,
    completionRecordId: record.localId,
    expectedHoleVersion: 2,
  });
  await repository.advanceCompletionOperation({
    operationId,
    stage: "TIMELINE_APPENDED",
    updatedAt: "2026-07-21T12:01:00.000Z",
  });
  await repository.advanceCompletionOperation({
    operationId,
    stage: "AUDIT_APPENDED",
    updatedAt: "2026-07-21T12:02:00.000Z",
  });
  await repository.commitCompletion({
    operationId,
    holeId: HOLE_ID,
    completionRecordId: record.localId,
  });
}

async function expectLocked(action: () => Promise<unknown> | unknown) {
  try {
    await action();
    throw new Error("Expected HOLE_LOCKED.");
  } catch (error) {
    expect(isHoleLockedError(error)).toBe(true);
  }
}

const draftPayload: RunDraftPayload = {
  localId: "run-locked",
  startedAt: COMPLETED_AT,
  startedShiftId: "shift-1",
  startedByUserId: "user-1",
  startedByNameSnapshot: "Driller",
  context: {
    runNumber: 246,
    rodNumber: 118,
    currentRodStringDm: 6_625,
    previousCompletedDepthDm: 6_615,
  },
  pendingRodEvents: [],
  stickUpMetresInput: "",
  recoveredMetresInput: "",
  conditionTagIds: [],
  comment: "",
  activeBitAssignmentId: null,
  activeReamerAssignmentId: null,
  activeBitSerialNumberSnapshot: null,
  activeReamerSerialNumberSnapshot: null,
  casingSummarySnapshot: null,
};

describe("hole lock enforcement", () => {
  it.each(["COMPLETED", "ABANDONED"] as const)(
    "blocks direct repository mutations on a %s hole",
    async (finalStatus) => {
      const storage = new MemoryStorage();
      const seed: CompletionRepositorySeed = { holes: [hole("ACTIVE")] };
      const completionRepository = new LocalCompletionRepository(
        storage,
        ORGANISATION_ID,
        seed,
      );
      await lockHole(completionRepository, finalStatus);
      const guard = new HoleMutationGuard(completionRepository);

      const runs = new LocalRunRepository(storage, [], guard);
      const shifts = new LocalShiftRepository(storage, [], guard);
      const casing = new LocalCasingRepository(storage, [], [], guard);
      const components = new LocalComponentRepository(
        storage,
        ORGANISATION_ID,
        [],
        [],
        undefined,
        guard,
      );
      const surveys = new LocalSurveyRepository(
        storage,
        ORGANISATION_ID,
        [],
        [],
        guard,
      );
      const trays = new LocalTrayRepository(
        storage,
        new MemoryMediaRepository(),
        [],
        [],
        guard,
      );

      await expectLocked(() =>
        runs.writeDraft(HOLE_ID, { ...draftPayload, localId: "run-locked" }),
      );

      await expectLocked(() =>
        shifts.startShift({
          id: "shift-locked",
          holeId: HOLE_ID,
          rigId: "rig-10",
          shiftType: "DAY",
          shiftDate: "2026-07-22",
          primaryDrillerId: "user-1",
          primaryDrillerNameSnapshot: "Driller",
          crewMembers: [],
          startedAt: COMPLETED_AT,
          startingState: {
            depthDm: decimetres(6_615),
            rodNumber: 118,
            rodStringDm: decimetres(6_625),
            measuredStickUpDm: decimetres(10),
            runNumber: 246,
          },
        }),
      );

      await expectLocked(() =>
        casing.install({
          operationId: "casing-locked",
          casingStringId: "casing-locked",
          holeId: HOLE_ID,
          casingSize: "HQ",
          startDepthDm: decimetres(0),
          endDepthDm: decimetres(10),
          currentHoleDepthDm: decimetres(6_615),
          recordedByUserId: "user-1",
          recordedByNameSnapshot: "Driller",
          recordedAt: COMPLETED_AT,
        }),
      );

      await expectLocked(() =>
        components.assignInitial({
          operationId: "bit-locked",
          assignmentId: "assignment-locked",
          componentId: "component-locked",
          holeId: HOLE_ID,
          componentType: "BIT",
          startDepthDm: decimetres(6_615),
          userId: "user-1",
          userNameSnapshot: "Driller",
          occurredAt: COMPLETED_AT,
        }),
      );

      await expectLocked(() =>
        surveys.create({
          operationId: "survey-locked",
          surveyId: "survey-locked",
          holeId: HOLE_ID,
          depthDm: decimetres(6_615),
          dipTenths: -600,
          azimuthTenths: 420,
          northReference: "NOT_SPECIFIED",
          recordedByUserId: "user-1",
          recordedByNameSnapshot: "Driller",
          recordedAt: COMPLETED_AT,
        }),
      );

      await expectLocked(() =>
        trays.createWithPhoto({
          operationId: "tray-locked",
          trayId: "tray-locked",
          photoId: "photo-locked",
          holeId: HOLE_ID,
          trayNumber: 999,
          isFinalPartial: false,
          original: new Blob(["tray"], { type: "image/jpeg" }),
          capturedAt: COMPLETED_AT,
          userId: "user-1",
          userNameSnapshot: "Driller",
        }),
      );

      await expect(
        completionRepository.getLifecycleState(HOLE_ID),
      ).resolves.toMatchObject({
        status: finalStatus,
      });
      await expect(
        completionRepository.listCompletedHoles({ status: finalStatus }),
      ).resolves.toHaveLength(1);
    },
  );

  it("does not finish a prepared handover into a new shift after lock", async () => {
    const storage = new MemoryStorage();
    const completionRepository = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      { holes: [hole("ACTIVE")] },
    );
    const guard = new HoleMutationGuard(completionRepository);
    const shifts = new LocalShiftRepository(storage, [], guard);

    const started = await shifts.startShift({
      id: "shift-outgoing",
      holeId: HOLE_ID,
      rigId: "rig-10",
      shiftType: "DAY",
      shiftDate: "2026-07-21",
      primaryDrillerId: "user-1",
      primaryDrillerNameSnapshot: "Driller",
      crewMembers: [],
      startedAt: STARTED_AT,
      startingState: {
        depthDm: decimetres(6_615),
        rodNumber: 118,
        rodStringDm: decimetres(6_625),
        measuredStickUpDm: decimetres(10),
        runNumber: 246,
      },
    });
    const pending = await shifts.closeForHandover({
      holeId: HOLE_ID,
      shiftId: started.localId,
      expectedVersion: started.version,
      closedAt: COMPLETED_AT,
      endingState: {
        depthDm: decimetres(6_615),
        rodNumber: 118,
        rodStringDm: decimetres(6_625),
        measuredStickUpDm: decimetres(10),
        runNumber: 245,
      },
      handoverNote: "Lock test handover",
    });

    storage.failNextShiftWrite = true;
    await expect(
      shifts.acceptHandover({
        operationId: "handover-lock-test",
        holeId: HOLE_ID,
        outgoingShiftId: pending.localId,
        expectedVersion: pending.version,
        incomingShiftId: "shift-incoming-locked",
        acceptedAt: COMPLETED_AT,
        incomingShiftType: "NIGHT",
        incomingShiftDate: "2026-07-21",
        incomingDrillerId: "user-2",
        incomingDrillerNameSnapshot: "Night Driller",
        incomingCrewMembers: [],
      }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });

    await lockHole(completionRepository, "COMPLETED");

    const operationKey = `targetlock:prototype:v1:hole:${encodeURIComponent(HOLE_ID)}:handover-operation`;
    await expect(shifts.recoverInterruptedAcceptance(HOLE_ID)).resolves.toBeNull();
    await expect(shifts.getActiveShift(HOLE_ID)).resolves.toBeNull();
    expect(storage.getItem(operationKey)).toBeNull();
    const listed = await shifts.listByHole(HOLE_ID);
    expect(listed.some(({ localId }) => localId === "shift-incoming-locked")).toBe(
      false,
    );
  });

  it("allows ACTIVE mutations and reopen after lock", async () => {
    const storage = new MemoryStorage();
    const completionRepository = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      { holes: [hole("ACTIVE")] },
    );
    const guard = new HoleMutationGuard(completionRepository);
    const runs = new LocalRunRepository(storage, [], guard);

    expect(() =>
      runs.writeDraft(HOLE_ID, { ...draftPayload, localId: "run-active" }),
    ).not.toThrow();

    await lockHole(completionRepository, "COMPLETED");
    const lifecycle = await completionRepository.getLifecycleState(HOLE_ID);
    expect(lifecycle?.status).toBe("COMPLETED");

    const reopened = await completionRepository.reopenHole({
      operationId: "reopen-1",
      reopenRecordId: "reopen-1",
      holeId: HOLE_ID,
      expectedHoleVersion: lifecycle!.hole.version,
      reason: "Client requested hole extension",
      reopenedAt: "2026-07-22T01:00:00.000Z",
      reopenedByUserId: "user-supervisor",
      reopenedByNameSnapshot: "Morgan Lee",
    });
    expect(reopened.hole.status).toBe("ACTIVE");
    expect(reopened.completion.finalStatus).toBe("COMPLETED");

    expect(() =>
      runs.writeDraft(HOLE_ID, { ...draftPayload, localId: "run-reopened" }),
    ).not.toThrow();
  });
});
