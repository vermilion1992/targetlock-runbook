import { beforeEach, describe, expect, it, vi } from "vitest";

import { configurePilotBrowserRuntime } from "./pilot-runtime";
import {
  completionStorageKey,
  HoleMutationGuard,
  LocalCompletionRepository,
} from "@/infrastructure/completion";
import {
  BrowserCoreRecoveryCoordinator,
  type CoreRestoreDryRun,
} from "./core-recovery";

const ORGANISATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANISATION_ID = "22222222-2222-4222-8222-222222222222";
const SERVER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const SERVER_RIG_ID = "44444444-4444-4444-8444-444444444444";
const SERVER_HOLE_ID = "55555555-5555-4555-8555-555555555555";
const GENERATED_AT = "2026-07-29T10:00:00.000Z";

class MemoryStorage {
  readonly values = new Map<string, string>();
  failOn: string | null = null;

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOn && key.includes(this.failOn)) {
      throw new DOMException("Quota exhausted", "QuotaExceededError");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function syncedMetadata(localId: string, serverId: string) {
  return {
    localId,
    serverId,
    syncStatus: "synced",
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    deviceId: "device-a",
    version: 1,
  };
}

function directory(organisationId = ORGANISATION_ID) {
  return {
    schemaVersion: 1 as const,
    generatedAt: GENERATED_AT,
    organisationId,
    assignment: { projectRef: "project-pilot", rigRef: "rig-pilot" },
    source: "AUTHORITATIVE_SERVER" as const,
    projects: [
      {
        serverId: SERVER_PROJECT_ID,
        localId: "project-pilot",
        version: 1,
        state: {
          ...syncedMetadata("project-pilot", SERVER_PROJECT_ID),
          organisationId,
          code: "PILOT-01",
          name: "Pilot Project",
          clientName: "Pilot Client",
          location: "Western Australia",
          status: "active",
        },
      },
    ],
    rigs: [
      {
        serverId: SERVER_RIG_ID,
        localId: "rig-pilot",
        projectLocalId: "project-pilot",
        version: 1,
        state: {
          ...syncedMetadata("rig-pilot", SERVER_RIG_ID),
          organisationId,
          projectId: "project-pilot",
          name: "Pilot Rig",
          serialNumber: "RIG-001",
          model: "Pilot model",
          status: "operating",
        },
      },
    ],
    holes: [
      {
        serverId: SERVER_HOLE_ID,
        localId: "PILOT001",
        projectLocalId: "project-pilot",
        rigLocalId: "rig-pilot",
        version: 1,
        state: {
          ...syncedMetadata("PILOT001", SERVER_HOLE_ID),
          projectId: "project-pilot",
          rigId: "rig-pilot",
          name: "PILOT001",
          holeSize: "HQ",
          plannedDepth: 5_000,
          currentDepth: 300,
          status: "drilling",
        },
        lastCursor: "8",
      },
    ],
    cursor: "8",
  };
}

function holeSnapshot(organisationId = ORGANISATION_ID) {
  const source = directory(organisationId);
  return {
    schemaVersion: 1 as const,
    generatedAt: GENERATED_AT,
    organisationId,
    source: "AUTHORITATIVE_SERVER" as const,
    cursor: "8",
    aggregateRevision: 5,
    project: source.projects[0]!,
    rig: source.rigs[0]!,
    hole: source.holes[0]!,
    configurations: [],
    bhaSetups: [
      {
        serverId: "66666666-6666-4666-8666-666666666666",
        localId: "bha-pilot-1",
        version: 1,
        state: {
          ...syncedMetadata(
            "bha-pilot-1",
            "66666666-6666-4666-8666-666666666666",
          ),
          holeId: "PILOT001",
          effectiveAt: GENERATED_AT,
          bottomHoleAssemblyLength: 45,
          constantStickUp: 20,
          baseRodStringLength: 65,
          reason: "Initial assembly",
        },
      },
    ],
    shifts: [
      {
        serverId: "77777777-7777-4777-8777-777777777777",
        localId: "shift-pilot-1",
        version: 1,
        state: {
          ...syncedMetadata(
            "shift-pilot-1",
            "77777777-7777-4777-8777-777777777777",
          ),
          holeId: "PILOT001",
          rigId: "rig-pilot",
          shiftType: "DAY",
          shiftDate: "2026-07-29",
          primaryDrillerId: "operator-a",
          primaryDrillerNameSnapshot: "Pilot Operator",
          crewMembers: [],
          startedAt: GENERATED_AT,
          closedAt: null,
          startingDepthDm: 300,
          endingDepthDm: null,
          startingRodNumber: 1,
          endingRodNumber: null,
          startingRodStringDm: 365,
          endingRodStringDm: null,
          startingMeasuredStickUpDm: 20,
          endingMeasuredStickUpDm: null,
          startingRunNumber: 1,
          endingRunNumber: null,
          handoverNote: null,
          handoverAcceptedBy: null,
          handoverAcceptedByNameSnapshot: null,
          handoverAcceptedAt: null,
          status: "ACTIVE",
        },
      },
    ],
    handovers: [],
    runs: [
      {
        serverId: "88888888-8888-4888-8888-888888888888",
        localId: "run-pilot-1",
        version: 1,
        state: {
          ...syncedMetadata(
            "run-pilot-1",
            "88888888-8888-4888-8888-888888888888",
          ),
          holeId: "PILOT001",
          shiftIds: ["shift-pilot-1"],
          runNumber: 1,
          rodNumber: 1,
          startedAt: GENERATED_AT,
          completedAt: "2026-07-29T11:00:00.000Z",
          startedByUserId: "operator-a",
          startedByNameSnapshot: "Pilot Operator",
          rodAddedLength: null,
          previousCompletedDepthDm: 300,
          measuredStickUpDm: 10,
          rodStringDm: 365,
          recoveredLengthDm: 29,
          conditionTagIds: [],
          comment: null,
          correctionIds: [],
          status: "completed",
        },
      },
    ],
    rodEvents: [],
    runCorrections: [],
    completionReviews: [],
    completionRecords: [],
    reopenRecords: [],
    media: [],
  };
}

function completedHoleSnapshot() {
  const source = holeSnapshot();
  const reviewId = "88888888-8888-4888-8888-888888888888";
  const completionId = "99999999-9999-4999-8999-999999999999";
  const completion = {
    ...syncedMetadata("completion-pilot-1", completionId),
    holeId: "PILOT001",
    reviewId: "review-pilot-1",
    finalStatus: "COMPLETED",
    completedAt: "2026-07-29T12:00:00.000Z",
    completedByUserId: "supervisor-1",
    completedByNameSnapshot: "Pilot Supervisor",
    operationId: "complete-operation-1",
    snapshot: {
      holeId: "PILOT001",
      projectId: "project-pilot",
      projectNameSnapshot: "Pilot Project",
      rigId: "rig-pilot",
      rigNameSnapshot: "Pilot Rig",
      finalStatus: "COMPLETED",
      finalDepthDm: 355,
      plannedDepthDm: 5_000,
      finalRunNumber: 1,
      runIds: ["run-pilot-1"],
      finalRodNumber: 2,
      currentRodStringDm: 365,
      measuredStickUpDm: 10,
      bottomHoleAssemblyLengthDm: 45,
      constantStickUpDm: 20,
      baseRodStringDm: 25,
      rodStringConfigurationId: "bha-pilot-1",
      finalShiftId: "shift-pilot-1",
      finalShiftLabel: "Day shift",
      casingSummary: null,
      finalPartialTrayConfirmed: true,
      surveyCount: 0,
      trayCount: 0,
      totalRuns: 1,
      totalDrilledDm: 55,
      totalRecoveredDm: 55,
      totalLossDm: 0,
      totalGainDm: 0,
      overallRecoveryPercentTenths: 1_000,
      reason: "PLANNED_DEPTH_REACHED",
      comment: "Validated completion fixture.",
      checklist: [],
      componentOutcomes: [],
      warningAcknowledgements: [],
      completedByUserId: "supervisor-1",
      completedByNameSnapshot: "Pilot Supervisor",
      capturedAt: "2026-07-29T12:00:00.000Z",
    },
  };
  return {
    ...source,
    aggregateRevision: 6,
    hole: {
      ...source.hole,
      version: 2,
      state: {
        ...source.hole.state,
        version: 2,
        status: "COMPLETED",
        updatedAt: "2026-07-29T12:00:00.000Z",
      },
    },
    completionReviews: [
      {
        serverId: reviewId,
        localId: "review-pilot-1",
        version: 1,
        state: {
          ...syncedMetadata("review-pilot-1", reviewId),
          holeId: "PILOT001",
          reviewStatus: "COMPLETED",
          disposition: "COMPLETED",
          reason: "PLANNED_DEPTH_REACHED",
          comment: "Validated completion fixture.",
          checklist: [],
          componentOutcomes: [],
          warningAcknowledgements: [],
          startedByUserId: "supervisor-1",
          startedByNameSnapshot: "Pilot Supervisor",
          startedAt: "2026-07-29T11:00:00.000Z",
        },
      },
    ],
    completionRecords: [
      {
        serverId: completionId,
        localId: completion.localId,
        version: completion.version,
        state: completion,
      },
    ],
  };
}

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function recoveryFetcher(
  organisationId = ORGANISATION_ID,
  snapshot:
    | ReturnType<typeof holeSnapshot>
    | ReturnType<typeof completedHoleSnapshot> = holeSnapshot(organisationId),
) {
  return vi.fn<typeof fetch>((input, init) => {
    const path = String(input);
    if (path.endsWith("/directory")) {
      const authoritativeDirectory = directory(organisationId);
      return response({
        directory: {
          ...authoritativeDirectory,
          holes: authoritativeDirectory.holes.map((hole) =>
            hole.localId === snapshot.hole.localId
              ? {
                  ...hole,
                  version: snapshot.hole.version,
                  state: snapshot.hole.state,
                }
              : hole,
          ),
        },
      });
    }
    if (path.includes("/snapshot")) {
      return response({ snapshot });
    }
    if (path.endsWith("/restore") && init?.method === "POST") {
      return response({ recorded: true });
    }
    throw new Error(`Unexpected request ${path}`);
  });
}

describe("BrowserCoreRecoveryCoordinator", () => {
  beforeEach(() => {
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: ORGANISATION_ID,
      operatorId: "operator-a",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: "device-a",
        projectRef: "project-pilot",
        rigRef: "rig-pilot",
      },
      sessionExpiresAt: "2026-07-30T10:00:00.000Z",
    });
  });

  it("reconstructs authoritative directory, BHA, shift and run state without demo seeds or outbox writes", async () => {
    const storage = new MemoryStorage();
    const fetcher = recoveryFetcher();
    const pendingOperations = vi.fn(() => 0);
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher,
      pendingOperations,
      now: () => new Date(GENERATED_AT),
    });

    const preview = await coordinator.inspectRestore();
    await coordinator.restore(preview, {
      confirmed: true,
      reason: "Replacement tablet after field hardware failure",
    });

    const values = [...storage.values.values()].join("\n");
    expect(values).toContain("PILOT001");
    expect(values).toContain("bha-pilot-1");
    expect(values).toContain("shift-pilot-1");
    expect(values).toContain("run-pilot-1");
    expect(values).not.toContain("DDH041");
    expect(values).not.toContain("organisation-briggs");
    expect(coordinator.getSnapshot()).toMatchObject({
      status: "server-current",
      cursor: "8",
      aggregateRevisions: { PILOT001: 5 },
    });
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(pendingOperations).toHaveBeenCalled();
  });

  it("restores a completed hole through the real repository, keeps it locked, and permits an authorized reopen", async () => {
    const storage = new MemoryStorage();
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(
        ORGANISATION_ID,
        completedHoleSnapshot(),
      ),
      pendingOperations: () => 0,
      now: () => new Date(GENERATED_AT),
    });
    const preview = await coordinator.inspectRestore();
    await coordinator.restore(preview, {
      confirmed: true,
      reason: "Restore completed hole on an authorized replacement tablet",
    });

    const completion = new LocalCompletionRepository(
      storage,
      ORGANISATION_ID,
      { holes: [] },
    );
    await expect(completion.listCompletedHoles()).resolves.toMatchObject([
      {
        hole: { localId: "PILOT001", status: "COMPLETED" },
        completion: {
          localId: "completion-pilot-1",
          completedByUserId: "supervisor-1",
        },
      },
    ]);
    const guard = new HoleMutationGuard(completion);
    expect(() => guard.assertHoleMutable("PILOT001")).toThrowError(
      expect.objectContaining({ code: "HOLE_LOCKED" }),
    );

    const reopened = await completion.reopenHole({
      operationId: "reopen-operation-1",
      reopenRecordId: "reopen-record-1",
      holeId: "PILOT001",
      completionRecordId: "completion-pilot-1",
      expectedHoleVersion: 2,
      reason: "Additional drilling authorized after supervisor review.",
      reopenedAt: "2026-07-29T13:00:00.000Z",
      reopenedByUserId: "supervisor-2",
      reopenedByNameSnapshot: "Relief Supervisor",
    });
    expect(reopened.status).toBe("reopened");
    await expect(
      completion.getLifecycleState("PILOT001"),
    ).resolves.toMatchObject({
      status: "ACTIVE",
      completionHistory: [
        {
          completion: { localId: "completion-pilot-1" },
          reopened: true,
          reopenRecord: { localId: "reopen-record-1" },
        },
      ],
    });
  });

  it("blocks restore when unsynced local work exists", async () => {
    const storage = new MemoryStorage();
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(),
      pendingOperations: () => 2,
    });

    const preview = await coordinator.inspectRestore();

    expect(preview.canRestore).toBe(false);
    await expect(
      coordinator.restore(preview, {
        confirmed: true,
        reason: "Attempted restore with unsynced local work",
      }),
    ).rejects.toThrow(/pending local operations/i);
    expect(coordinator.getSnapshot().status).toBe("conflict");
    expect(storage.length).toBe(0);
  });

  it("holds the recovery lock and rechecks pending operations immediately before storage commit", async () => {
    const storage = new MemoryStorage();
    let checks = 0;
    let lockHeld = false;
    let lockCalls = 0;
    const runExclusive = async <T>(
      operation: () => Promise<T>,
    ): Promise<T> => {
      lockCalls += 1;
      expect(lockHeld).toBe(false);
      lockHeld = true;
      try {
        return await operation();
      } finally {
        lockHeld = false;
      }
    };
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(),
      pendingOperations: () => {
        checks += 1;
        return checks >= 7 ? 1 : 0;
      },
      runExclusive,
    });
    const preview = await coordinator.inspectRestore();

    await expect(
      coordinator.restore(preview, {
        confirmed: true,
        reason: "Concurrent mutation race regression coverage",
      }),
    ).rejects.toThrow(/queued before the storage commit/i);
    expect(lockCalls).toBe(2);
    expect(lockHeld).toBe(false);
    expect(
      [...storage.values.keys()].some((key) => key.endsWith(":completion")),
    ).toBe(false);
  });

  it("quarantines prior assignment data and never marks an empty server directory current", async () => {
    const storage = new MemoryStorage();
    const initial = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(),
      pendingOperations: () => 0,
    });
    const preview = await initial.inspectRestore();
    await initial.restore(preview, {
      confirmed: true,
      reason: "Seed accepted assignment state for reassignment test",
    });

    const emptyCurrentAssignment = {
      ...directory(),
      projects: [],
      rigs: [],
      holes: [],
      cursor: "9",
    };
    const emptyCurrent = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: vi.fn<typeof fetch>((input) => {
        if (String(input).endsWith("/directory")) {
          return response({ directory: emptyCurrentAssignment });
        }
        throw new Error(`Unexpected request ${String(input)}`);
      }),
      pendingOperations: () => 0,
    });
    await expect(emptyCurrent.pullAfterPush()).resolves.toMatchObject({
      status: "stale-assignment",
      message: expect.stringMatching(/assignment is empty/i),
    });

    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: ORGANISATION_ID,
      operatorId: "operator-a",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: "device-a",
        projectRef: "project-reassigned",
        rigRef: "rig-reassigned",
      },
      sessionExpiresAt: "2026-07-30T10:00:00.000Z",
    });
    const emptyDirectory = {
      ...directory(),
      assignment: {
        projectRef: "project-reassigned",
        rigRef: "rig-reassigned",
      },
      projects: [],
      rigs: [],
      holes: [],
      cursor: "9",
    };
    const reassigned = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: vi.fn<typeof fetch>((input) => {
        if (String(input).endsWith("/directory")) {
          return response({ directory: emptyDirectory });
        }
        throw new Error(`Unexpected request ${String(input)}`);
      }),
      pendingOperations: () => 0,
    });

    await expect(reassigned.pullAfterPush()).resolves.toMatchObject({
      status: "stale-assignment",
      message: expect.stringMatching(/assignment changed/i),
    });
    expect(
      [...storage.values.entries()]
        .filter(([key]) => key.endsWith(":core-pull-cursor"))
        .every(([, value]) => value !== "9"),
    ).toBe(true);
    expect(
      storage.getItem(completionStorageKey(ORGANISATION_ID)),
    ).not.toBeNull();
  });

  it("rolls back all local writes when hydration storage fails", async () => {
    const storage = new MemoryStorage();
    storage.setItem("existing", "preserved");
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(),
      pendingOperations: () => 0,
    });
    const preview = await coordinator.inspectRestore();
    storage.failOn = ":saved-runs";

    await expect(
      coordinator.restore(preview, {
        confirmed: true,
        reason: "Test atomic rollback after local quota failure",
      }),
    ).rejects.toThrow("Quota exhausted");

    expect(storage.getItem("existing")).toBe("preserved");
    expect(
      [...storage.values.keys()].some((key) =>
        key.endsWith(":core-restore-audit-pending"),
      ),
    ).toBe(true);
  });

  it("retains a failed restore-audit commit durably and retries it idempotently before Server current", async () => {
    const storage = new MemoryStorage();
    const delegate = recoveryFetcher();
    let commitAttempts = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      if (path.endsWith("/restore") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { phase?: string };
        if (body.phase === "COMMIT") {
          commitAttempts += 1;
          if (commitAttempts === 1) {
            return response(
              {
                error: {
                  code: "AUDIT_TEMPORARILY_UNAVAILABLE",
                  message: "Audit commit was not persisted.",
                },
              },
              503,
            );
          }
        }
      }
      if (path.includes("/changes?")) {
        return response({
          schemaVersion: 1,
          changes: [],
          nextCursor: "8",
          hasMore: false,
        });
      }
      return delegate(input, init);
    });
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher,
      pendingOperations: () => 0,
    });
    const preview = await coordinator.inspectRestore();
    await expect(
      coordinator.restore(preview, {
        confirmed: true,
        reason: "Retry mandatory restore audit commit evidence",
      }),
    ).rejects.toThrow(/audit commit was not persisted/i);
    expect(
      [...storage.values.keys()].some((key) =>
        key.endsWith(":core-restore-audit-pending"),
      ),
    ).toBe(true);
    expect(
      [...storage.values.keys()].some((key) => key.endsWith(":completion")),
    ).toBe(true);

    const reloaded = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher,
      pendingOperations: () => 0,
    });
    await expect(reloaded.pullAfterPush()).resolves.toMatchObject({
      status: "server-current",
    });
    expect(commitAttempts).toBe(2);
    expect(
      [...storage.values.keys()].some((key) =>
        key.endsWith(":core-restore-audit-pending"),
      ),
    ).toBe(false);
  });

  it("rolls back an interrupted restore before exposing local state", () => {
    const storage = new MemoryStorage();
    const completionKey = `targetlock:prototype:v2:organisation:${ORGANISATION_ID}:completion`;
    const transactionKey = `targetlock:pilot:v1:org:${ORGANISATION_ID}:core-restore-transaction`;
    storage.setItem(completionKey, "partial-server-write");
    storage.setItem(
      transactionKey,
      JSON.stringify({
        version: 1,
        startedAt: GENERATED_AT,
        previous: [[completionKey, "original-local-state"]],
      }),
    );

    new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(),
      pendingOperations: () => 0,
    });

    expect(storage.getItem(completionKey)).toBe("original-local-state");
    expect(storage.getItem(transactionKey)).toBeNull();
  });

  it("rejects a cross-organisation snapshot before changing local records", async () => {
    const storage = new MemoryStorage();
    const coordinator = new BrowserCoreRecoveryCoordinator({
      storage,
      fetcher: recoveryFetcher(OTHER_ORGANISATION_ID),
      pendingOperations: () => 0,
    });
    const preview: CoreRestoreDryRun = {
      directory: directory(OTHER_ORGANISATION_ID),
      snapshots: [holeSnapshot(OTHER_ORGANISATION_ID)],
      localRecordCount: 0,
      serverRecordCount: 5,
      pendingOperationCount: 0,
      assignmentChanged: false,
      wouldReplaceLocalData: false,
      canRestore: true,
    };

    await expect(
      coordinator.restore(preview, {
        confirmed: true,
        reason: "Cross organisation restore must be rejected",
      }),
    ).rejects.toThrow(/another organisation/i);
    expect(storage.length).toBe(0);
  });
});
