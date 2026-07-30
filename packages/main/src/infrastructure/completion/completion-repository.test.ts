import { describe, expect, it } from "vitest";

import {
  decimetres,
  type Hole,
  type HoleCompletionDisposition,
  type HoleCompletionRecord,
  type HoleCompletionReview,
  type SyncMetadata,
} from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  CompletionRepositoryError,
  HoleMutationGuard,
  LocalCompletionRepository,
  completionStorageKey,
  type CompletionRepositorySeed,
} from "./completion-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class UnavailableStorage implements LocalStorageAdapter {
  getItem(): string | null {
    throw new Error("unavailable");
  }
  setItem(): void {
    throw new Error("unavailable");
  }
  removeItem(): void {
    throw new Error("unavailable");
  }
}

const ORGANISATION_ID = "organisation-briggs";
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

function hole(
  localId: string,
  name: string,
  status: Hole["status"] = "drilling",
  projectId = "project-briggs",
): Hole {
  return {
    ...metadata(localId),
    projectId,
    rigId: "rig-10",
    name,
    holeSize: "HQ",
    plannedDepth: decimetres(7_500),
    currentDepth: decimetres(6_615),
    status,
    collarEasting: 500_000,
    collarNorthing: 7_500_000,
    collarElevation: 350,
  };
}

function review(
  localId: string,
  holeId: string,
  status: HoleCompletionReview["reviewStatus"] = "READY",
): HoleCompletionReview {
  return {
    ...metadata(localId),
    holeId,
    reviewStatus: status,
    disposition: "COMPLETED",
    reason: "PLANNED_DEPTH_REACHED",
    comment: "Final checks complete.",
    checklist: [],
    componentOutcomes: [],
    warningAcknowledgements: [],
    startedByUserId: "user-supervisor",
    startedByNameSnapshot: "Morgan Lee",
    startedAt: STARTED_AT,
  };
}

function completion(
  localId: string,
  holeId: string,
  reviewId: string,
  operationId: string,
  finalStatus: HoleCompletionDisposition = "COMPLETED",
  completedAt = COMPLETED_AT,
): HoleCompletionRecord {
  return {
    ...metadata(localId, completedAt),
    holeId,
    reviewId,
    finalStatus,
    completedAt,
    completedByUserId: "user-supervisor",
    completedByNameSnapshot: "Morgan Lee",
    operationId,
    snapshot: {
      holeId,
      projectId: "project-briggs",
      projectNameSnapshot: "Briggs North Ridge",
      rigId: "rig-10",
      rigNameSnapshot: "Rig 10",
      finalStatus,
      finalDepthDm: decimetres(6_615),
      plannedDepthDm: decimetres(7_500),
      finalRunNumber: 232,
      runIds: ["run-232"],
      finalRodNumber: 112,
      currentRodStringDm: decimetres(6_625),
      measuredStickUpDm: decimetres(10),
      bottomHoleAssemblyLengthDm: decimetres(30),
      constantStickUpDm: decimetres(10),
      baseRodStringDm: decimetres(20),
      rodStringConfigurationId: "rod-config-1",
      finalShiftId: "shift-1",
      finalShiftLabel: "Day shift",
      casingSummary: "HQ to 20.0 m",
      finalBitSummary: "BIT-HQ-001842",
      finalSurveyId: "survey-final",
      finalTrayId: "tray-final",
      finalPartialTrayConfirmed: true,
      surveyCount: 27,
      trayCount: 111,
      totalRuns: 232,
      totalDrilledDm: decimetres(6_615),
      totalRecoveredDm: decimetres(6_500),
      totalLossDm: decimetres(115),
      totalGainDm: decimetres(0),
      overallRecoveryPercentTenths: 983,
      reason:
        finalStatus === "ABANDONED"
          ? "GROUND_CONDITIONS"
          : "PLANNED_DEPTH_REACHED",
      comment: "Final checks complete.",
      checklist: [],
      componentOutcomes: [],
      warningAcknowledgements: [],
      completedByUserId: "user-supervisor",
      completedByNameSnapshot: "Morgan Lee",
      capturedAt: completedAt,
    },
  };
}

function activeSeed(holeId = "hole-ddh041"): CompletionRepositorySeed {
  return { holes: [hole(holeId, "DDH041")] };
}

async function readyRepository(
  storage = new MemoryStorage(),
  holeId = "hole-ddh041",
) {
  const repository = new LocalCompletionRepository(
    storage,
    ORGANISATION_ID,
    activeSeed(holeId),
  );
  const begun = await repository.beginReview({
    operationId: `begin-${holeId}`,
    reviewId: `review-${holeId}`,
    holeId,
    expectedHoleVersion: 1,
    startedAt: STARTED_AT,
    startedByUserId: "user-supervisor",
    startedByNameSnapshot: "Morgan Lee",
  });
  const ready = await repository.saveReviewDraft({
    operationId: `save-${holeId}`,
    reviewId: begun.localId,
    holeId,
    expectedVersion: begun.version,
    savedAt: "2026-07-21T11:00:00.000Z",
    reviewStatus: "READY",
    disposition: "COMPLETED",
    reason: "PLANNED_DEPTH_REACHED",
    comment: "Final checks complete.",
  });
  return { repository, storage, ready };
}

async function finishHole(
  repository: LocalCompletionRepository,
  ready: HoleCompletionReview,
  finalStatus: HoleCompletionDisposition = "COMPLETED",
) {
  if (ready.disposition !== finalStatus) {
    ready = await repository.saveReviewDraft({
      operationId: `save-${finalStatus.toLocaleLowerCase()}-${ready.holeId}`,
      reviewId: ready.localId,
      holeId: ready.holeId,
      expectedVersion: ready.version,
      savedAt: "2026-07-21T11:30:00.000Z",
      reviewStatus: "READY",
      disposition: finalStatus,
      reason:
        finalStatus === "ABANDONED"
          ? "GROUND_CONDITIONS"
          : "PLANNED_DEPTH_REACHED",
    });
  }
  const operationId = `complete-${ready.holeId}`;
  const record = completion(
    `completion-${ready.holeId}`,
    ready.holeId,
    ready.localId,
    operationId,
    finalStatus,
  );
  await repository.beginCompletionOperation({
    operationId,
    holeId: ready.holeId,
    reviewId: ready.localId,
    startedAt: COMPLETED_AT,
    fingerprint: `fingerprint-${ready.holeId}`,
  });
  await repository.persistCompletionRecord(record);
  await repository.advanceCompletionOperation({
    operationId,
    stage: "COMPONENTS_CLOSED",
    updatedAt: COMPLETED_AT,
  });
  const locked = await repository.lockHole({
    operationId,
    holeId: ready.holeId,
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
  const committed = await repository.commitCompletion({
    operationId,
    holeId: ready.holeId,
    completionRecordId: record.localId,
    committedAt: "2026-07-21T12:03:00.000Z",
  });
  return { record, locked, committed };
}

describe("LocalCompletionRepository", () => {
  it("creates a project-owned draft hole with explicit design values", async () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [] },
    );

    const created = await repository.createHole({
      operationId: "create-ddh050",
      holeId: "DDH050",
      name: "DDH050",
      projectId: "project-briggs",
      rigId: "rig-10",
      holeSize: "NQ",
      plannedDepthDm: 8_250,
      collarEasting: 100,
      collarNorthing: 200,
      collarElevation: 300,
      planReference: "CLIENT-WI-041",
      planRevision: "Rev B",
      createdAt: STARTED_AT,
    });

    expect(created).toMatchObject({
      localId: "DDH050",
      projectId: "project-briggs",
      rigId: "rig-10",
      holeSize: "NQ",
      plannedDepth: 8_250,
      status: "DRAFT",
      planReference: "CLIENT-WI-041",
      planRevision: "Rev B",
    });
  });

  it("rejects mutations for holes outside the completion registry", () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [] },
    );
    const guard = new HoleMutationGuard(repository);

    let thrown: unknown;
    try {
      guard.assertHoleMutable("UNKNOWN");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CompletionRepositoryError);
    expect(thrown).toMatchObject({
      code: "NOT_FOUND",
      message: "Hole UNKNOWN was not found.",
    });
  });

  it("activates a draft hole idempotently when drilling starts", async () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [hole("DDH050", "DDH050", "DRAFT")] },
    );

    const activated = await repository.activateDraftHole(
      "DDH050",
      COMPLETED_AT,
    );
    const repeated = await repository.activateDraftHole(
      "DDH050",
      COMPLETED_AT,
    );

    expect(activated).toMatchObject({
      localId: "DDH050",
      status: "ACTIVE",
      updatedAt: COMPLETED_AT,
      version: 2,
    });
    expect(repeated).toEqual(activated);
  });

  it("uses local ID, not display name, as the unique hole identity", async () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [hole("DDH050", "North target")] },
    );

    await expect(
      repository.createHole({
        operationId: "create-ddh051-same-label",
        holeId: "DDH051",
        name: "North target",
        projectId: "project-briggs",
        rigId: "rig-10",
        createdAt: STARTED_AT,
      }),
    ).resolves.toMatchObject({
      localId: "DDH051",
      name: "North target",
    });
  });

  it("preserves missing collar coordinates instead of inventing zero values", async () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [] },
    );

    const created = await repository.createHole({
      operationId: "create-ddh051",
      holeId: "DDH051",
      name: "DDH051",
      projectId: "project-briggs",
      rigId: "rig-10",
      createdAt: STARTED_AT,
    });

    expect(created.collarEasting).toBeUndefined();
    expect(created.collarNorthing).toBeUndefined();
    expect(created.collarElevation).toBeUndefined();
  });

  it("rejects static route names as hole identities", async () => {
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      { holes: [] },
    );

    await expect(
      repository.createHole({
        operationId: "create-reserved",
        holeId: "completed",
        name: "completed",
        projectId: "project-briggs",
        rigId: "rig-10",
        createdAt: STARTED_AT,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("normalizes only supported legacy statuses and remains read-only until write", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      {
        holes: [
          hole("hole-ddh041", "DDH041", "drilling"),
          hole("hole-old", "DDH001", "completed"),
        ],
        reviews: [review("review-old", "hole-old", "COMPLETED")],
        completions: [
          completion(
            "completion-old",
            "hole-old",
            "review-old",
            "operation-old",
          ),
        ],
      },
    );

    await expect(repository.getStatus("hole-ddh041")).resolves.toBe("ACTIVE");
    await expect(repository.getStatus("hole-old")).resolves.toBe("COMPLETED");
    expect(storage.writes).toBe(0);

    await repository.beginReview({
      operationId: "begin-ddh041",
      reviewId: "review-ddh041",
      holeId: "hole-ddh041",
      expectedHoleVersion: 1,
      startedAt: STARTED_AT,
      startedByUserId: "user-supervisor",
      startedByNameSnapshot: "Morgan Lee",
    });
    const persisted = JSON.parse(
      storage.values.get(completionStorageKey(ORGANISATION_ID))!,
    ) as { holes: Array<{ localId: string; status: string }> };
    expect(persisted.holes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ localId: "hole-ddh041", status: "COMPLETION_REVIEW" }),
        expect.objectContaining({ localId: "hole-old", status: "COMPLETED" }),
      ]),
    );
  });

  it("begins and saves review drafts with optimistic versions and idempotency", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      activeSeed(),
    );
    const input = {
      operationId: "begin-1",
      reviewId: "review-1",
      holeId: "hole-ddh041",
      expectedHoleVersion: 1,
      startedAt: STARTED_AT,
      startedByUserId: "user-supervisor",
      startedByNameSnapshot: "Morgan Lee",
    } as const;
    const first = await repository.beginReview(input);
    const repeated = await repository.beginReview(input);
    expect(repeated.localId).toBe(first.localId);
    expect(await repository.getStatus(input.holeId)).toBe("COMPLETION_REVIEW");

    const saved = await repository.saveReviewDraft({
      operationId: "save-1",
      reviewId: first.localId,
      holeId: input.holeId,
      expectedVersion: 1,
      savedAt: "2026-07-21T11:00:00.000Z",
      reviewStatus: "READY",
      disposition: "COMPLETED",
      reason: "PLANNED_DEPTH_REACHED",
    });
    expect(saved).toMatchObject({ version: 2, reviewStatus: "READY" });
    await expect(
      repository.saveReviewDraft({
        operationId: "save-stale",
        reviewId: first.localId,
        holeId: input.holeId,
        expectedVersion: 1,
        savedAt: "2026-07-21T11:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(
      repository.beginReview({ ...input, reviewId: "different-review" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it.each(["COMPLETED", "ABANDONED"] as const)(
    "persists and commits a %s snapshot exactly once",
    async (finalStatus) => {
      const { repository, ready } = await readyRepository();
      const { record, locked, committed } = await finishHole(
        repository,
        ready,
        finalStatus,
      );

      expect(locked.hole.status).toBe(finalStatus);
      expect(committed.transaction?.stage).toBe("COMPLETED");
      expect(committed.completion.completedAt).toBe(COMPLETED_AT);
      expect((await repository.getLatestCompletion(ready.holeId))?.completedAt).toBe(
        COMPLETED_AT,
      );
      const retried = await repository.commitCompletion({
        operationId: record.operationId,
        holeId: ready.holeId,
        completionRecordId: record.localId,
      });
      expect(retried.status).toBe("already-committed");
      expect(await repository.getCompletionHistory(ready.holeId)).toHaveLength(1);
    },
  );

  it("keeps completion snapshots immutable and detects operation conflicts", async () => {
    const { repository, ready } = await readyRepository();
    const operationId = "complete-immutable";
    const record = completion(
      "completion-immutable",
      ready.holeId,
      ready.localId,
      operationId,
    );
    await repository.beginCompletionOperation({
      operationId,
      holeId: ready.holeId,
      reviewId: ready.localId,
      startedAt: COMPLETED_AT,
    });
    await repository.persistCompletionRecord(record);

    (record.snapshot.runIds as string[]).push("mutated-after-save");
    expect((await repository.getLatestCompletion(ready.holeId))?.snapshot.runIds).toEqual([
      "run-232",
    ]);
    await expect(
      repository.persistCompletionRecord({
        ...completion(
          "completion-immutable",
          ready.holeId,
          ready.localId,
          operationId,
        ),
        completedAt: "2026-07-21T12:05:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("hydrates staged work without advancing it or replaying external stages", async () => {
    const { repository, storage, ready } = await readyRepository();
    const operationId = "complete-recovery";
    await repository.beginCompletionOperation({
      operationId,
      holeId: ready.holeId,
      reviewId: ready.localId,
      startedAt: COMPLETED_AT,
    });
    await repository.persistCompletionRecord(
      completion(
        "completion-recovery",
        ready.holeId,
        ready.localId,
        operationId,
      ),
    );

    const hydrated = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      activeSeed(),
    );
    const beforeReads = storage.writes;
    await expect(
      hydrated.inspectPendingCompletionOperation(ready.holeId),
    ).resolves.toMatchObject({
      operationId,
      stage: "SNAPSHOT_PERSISTED",
    });
    await hydrated.getLifecycleState(ready.holeId);
    expect(storage.writes).toBe(beforeReads);
    await expect(
      hydrated.advanceCompletionOperation({
        operationId,
        stage: "AUDIT_APPENDED",
        updatedAt: "2026-07-21T12:02:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("lists and filters all locked holes from the organisation envelope", async () => {
    const completedReview = review("review-completed", "hole-completed", "COMPLETED");
    const abandonedReview = {
      ...review("review-abandoned", "hole-abandoned", "COMPLETED"),
      disposition: "ABANDONED" as const,
      reason: "GROUND_CONDITIONS" as const,
    };
    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      ORGANISATION_ID,
      {
        holes: [
          hole("hole-active", "DDH041", "drilling"),
          hole("hole-completed", "DDH040", "COMPLETED"),
          hole("hole-abandoned", "DDH039", "ABANDONED", "project-other"),
        ],
        reviews: [completedReview, abandonedReview],
        completions: [
          completion(
            "completion-completed",
            "hole-completed",
            completedReview.localId,
            "operation-completed",
          ),
          completion(
            "completion-abandoned",
            "hole-abandoned",
            abandonedReview.localId,
            "operation-abandoned",
            "ABANDONED",
            "2026-07-20T12:00:00.000Z",
          ),
        ],
      },
    );

    expect(await repository.listCompletedHoles()).toHaveLength(2);
    expect(await repository.listCompletedHoles({ status: "ABANDONED" })).toEqual([
      expect.objectContaining({
        status: "ABANDONED",
        hole: expect.objectContaining({ localId: "hole-abandoned" }),
      }),
    ]);
    expect(
      await repository.listCompletedHoles({ projectId: "project-briggs", search: "040" }),
    ).toHaveLength(1);
    expect(await repository.getCompletionHistory("hole-active")).toEqual([]);
  });

  it("reopens exactly once while preserving and marking the original completion", async () => {
    const { repository, ready } = await readyRepository();
    const { record } = await finishHole(repository, ready);
    const original = await repository.getLatestCompletion(ready.holeId);
    const input = {
      operationId: "reopen-1",
      reopenRecordId: "reopen-record-1",
      holeId: ready.holeId,
      completionRecordId: record.localId,
      expectedHoleVersion: 3,
      reason: "Client approved a daughter extension",
      reopenedAt: "2026-07-22T01:00:00.000Z",
      reopenedByUserId: "user-supervisor",
      reopenedByNameSnapshot: "Morgan Lee",
    } as const;
    const first = await repository.reopenHole(input);
    const repeated = await repository.reopenHole(input);

    expect(first.hole.status).toBe("ACTIVE");
    expect(repeated.status).toBe("already-reopened");
    expect(await repository.listCompletedHoles()).toEqual([]);
    expect(await repository.getLatestCompletion(ready.holeId)).toEqual(original);
    expect(await repository.getReopenHistory(ready.holeId)).toHaveLength(1);
    expect(await repository.getCompletionHistoryEntries(ready.holeId)).toEqual([
      expect.objectContaining({
        superseded: true,
        reopened: true,
        completion: original,
      }),
    ]);
    await expect(
      repository.reopenHole({ ...input, reason: "Different reason" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rejects corrupt, cross-organisation, unknown-status, and unavailable storage", async () => {
    const key = completionStorageKey(ORGANISATION_ID);
    for (const raw of [
      "{invalid",
      JSON.stringify({
        version: 1,
        organisationId: "another-organisation",
        revision: 0,
        updatedAt: STARTED_AT,
        holes: [],
        reviews: [],
        completions: [],
        reopens: [],
        transactions: [],
        operations: [],
      }),
      JSON.stringify({
        version: 1,
        organisationId: ORGANISATION_ID,
        revision: 0,
        updatedAt: STARTED_AT,
        holes: [{ ...hole("hole-1", "DDH001"), status: "active" }],
        reviews: [],
        completions: [],
        reopens: [],
        transactions: [],
        operations: [],
      }),
    ]) {
      const storage = new MemoryStorage();
      storage.values.set(key, raw);
      await expect(
        new LocalCompletionRepository(
          storage,
          ORGANISATION_ID,
        ).getLifecycleState("hole-1"),
      ).rejects.toMatchObject({ code: "CORRUPTED_STORAGE" });
    }
    await expect(
      new LocalCompletionRepository(
        new UnavailableStorage(),
        ORGANISATION_ID,
      ).getStatus("hole-1"),
    ).rejects.toBeInstanceOf(CompletionRepositoryError);
  });
});
