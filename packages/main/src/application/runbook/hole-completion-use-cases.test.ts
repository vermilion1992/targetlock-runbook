import { describe, expect, it } from "vitest";

import {
  decimetres,
  evaluateHoleCompletion,
  THREE_METRE_ROD_LENGTH,
  type AuditEntry,
  type Component,
  type ComponentAssignment,
  type Hole,
  type HoleCompletionComponentOutcome,
  type HoleCompletionReview,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type SyncMetadata,
  type Tray,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type { ComponentCompletionResolutionResult } from "@/infrastructure/components";
import {
  LocalCompletionRepository,
  type CompletionRepository,
} from "@/infrastructure/completion";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  closeFinalCompletionShift,
  completeHole,
  dispositionForCompletionReason,
  evaluateCompletionContext,
  getCompletedHoleStatistics,
  recoverInterruptedCompletion,
  reopenHole,
  type CompletionComponentAssignmentRepository,
  type CompletionShiftRepository,
  type HoleCompletionApplicationServices,
  type HoleCompletionContext,
  type ResolveAtHoleCompletionInput,
} from "./hole-completion-use-cases";

const STARTED_AT = "2026-07-21T08:00:00.000Z";
const COMPLETED_AT = "2026-07-21T12:00:00.000Z";
const REOPENED_AT = "2026-07-22T01:00:00.000Z";
const ACTOR = { id: "supervisor-1", name: "Morgan Lee" } as const;

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class MemoryAudits implements AuditRepository {
  readonly entries = new Map<string, AuditEntry>();

  async listByHole(holeId: string): Promise<readonly AuditEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.holeId === holeId);
  }

  async listByEntity(
    holeId: string,
    entityType: string,
    entityId: string,
  ): Promise<readonly AuditEntry[]> {
    return (await this.listByHole(holeId)).filter(
      (entry) =>
        entry.entityType === entityType && entry.entityId === entityId,
    );
  }

  async append(entry: AuditEntry): Promise<"saved" | "already-saved"> {
    const existing = this.entries.get(entry.localId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(entry)) {
        throw new Error("Conflicting audit identifier.");
      }
      return "already-saved";
    }
    this.entries.set(entry.localId, entry);
    return "saved";
  }
}

function metadata(localId: string, version = 1): SyncMetadata {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
    deviceId: "test-device",
    version,
  };
}

const HOLE_ID = "H1";

const HOLE: Hole = {
  ...metadata(HOLE_ID, 2),
  projectId: "project-1",
  rigId: "rig-1",
  name: HOLE_ID,
  holeSize: "HQ",
  plannedDepth: decimetres(40),
  currentDepth: decimetres(40),
  status: "COMPLETION_REVIEW",
  collarEasting: 1,
  collarNorthing: 2,
  collarElevation: 3,
};

const ROD_CONFIGURATION: RodStringConfiguration = {
  ...metadata("rod-config-1"),
  holeId: HOLE_ID,
  effectiveAt: STARTED_AT,
  bottomHoleAssemblyLength: decimetres(30),
  constantStickUp: decimetres(10),
  baseRodStringLength: decimetres(20),
  reason: "Initial configuration",
};

const ROD_EVENT: RodAddition = {
  ...metadata("rod-event-1"),
  holeId: HOLE_ID,
  runId: "run-1",
  shiftId: "shift-1",
  sequence: 1,
  action: "add",
  rodLength: THREE_METRE_ROD_LENGTH,
  affectedRodNumber: 1,
  rodNumberAfterEvent: 1,
  occurredAt: STARTED_AT,
  recordedByUserId: ACTOR.id,
  recordedByNameSnapshot: ACTOR.name,
};

const RUN: Run = {
  ...metadata("run-1"),
  holeId: HOLE_ID,
  startedShiftId: "shift-1",
  completedShiftId: "shift-1",
  runNumber: 1,
  rodNumber: 1,
  startedAt: STARTED_AT,
  startedByUserId: ACTOR.id,
  startedByNameSnapshot: ACTOR.name,
  completedAt: COMPLETED_AT,
  completedByUserId: ACTOR.id,
  completedByNameSnapshot: ACTOR.name,
  rodEventIds: [ROD_EVENT.localId],
  rodAddedLength: THREE_METRE_ROD_LENGTH,
  previousCompletedDepth: decimetres(0),
  startDepth: decimetres(0),
  measuredStickUp: decimetres(10),
  rodStringLength: decimetres(50),
  holeDepth: decimetres(40),
  drilledLength: decimetres(40),
  recoveredLength: decimetres(38),
  recoveryPercentage: 95,
  conditionTagIds: [],
  conditionTagLabelsSnapshot: [],
  comment: null,
  correctionIds: [],
  activeBitSerialNumberSnapshot: "BIT-1",
  activeReamerSerialNumberSnapshot: null,
  activeBitAssignmentId: "assignment-bit-1",
  activeReamerAssignmentId: null,
  casingSummarySnapshot: null,
  status: "completed",
  holeNameSnapshot: HOLE_ID,
  rigNameSnapshot: "Rig 1",
};

const SHIFT: RunbookShift = {
  ...metadata("shift-1"),
  holeId: HOLE_ID,
  rigId: "rig-1",
  shiftType: "DAY",
  shiftDate: "2026-07-21",
  primaryDrillerId: ACTOR.id,
  primaryDrillerNameSnapshot: ACTOR.name,
  crewMembers: [],
  startedAt: STARTED_AT,
  closedAt: COMPLETED_AT,
  startingDepthDm: decimetres(0),
  endingDepthDm: decimetres(40),
  startingRodNumber: 0,
  endingRodNumber: 1,
  startingRodStringDm: decimetres(20),
  endingRodStringDm: decimetres(50),
  startingRunNumber: 1,
  endingRunNumber: 1,
  status: "CLOSED",
};

const COMPONENT: Component = {
  ...metadata("component-bit-1"),
  organisationId: "organisation-1",
  type: "BIT",
  serialNumber: "BIT-1",
  normalizedSerialNumber: "BIT-1",
  size: "HQ",
  status: "ACTIVE",
  createdByUserId: ACTOR.id,
  createdByNameSnapshot: ACTOR.name,
};

const ASSIGNMENT: ComponentAssignment = {
  ...metadata("assignment-bit-1"),
  componentId: COMPONENT.localId,
  holeId: HOLE_ID,
  componentType: "BIT",
  startDepthDm: decimetres(0),
  installedShiftId: SHIFT.localId,
  installedAt: STARTED_AT,
  installedByUserId: ACTOR.id,
  installedByNameSnapshot: ACTOR.name,
  status: "ACTIVE",
};

const OUTCOME: HoleCompletionComponentOutcome = {
  assignmentId: ASSIGNMENT.localId,
  componentId: COMPONENT.localId,
  componentType: "BIT",
  outcome: "SERVICEABLE",
  comment: "Ready for inspection.",
};

const SURVEY: Survey = {
  ...metadata("survey-1"),
  holeId: HOLE_ID,
  shiftId: SHIFT.localId,
  depthDm: decimetres(40),
  dipTenths: -600,
  azimuthTenths: 1200,
  northReference: "GRID",
  recordedByUserId: ACTOR.id,
  recordedByNameSnapshot: ACTOR.name,
  recordedAt: COMPLETED_AT,
};

const TRAY: Tray = {
  ...metadata("tray-1"),
  holeId: HOLE_ID,
  shiftId: SHIFT.localId,
  trayNumber: 1,
  startDepthDm: decimetres(0),
  endDepthDm: decimetres(40),
  isFinalPartial: false,
  primaryPhotoId: "photo-1",
  recordedByUserId: ACTOR.id,
  recordedByNameSnapshot: ACTOR.name,
  recordedAt: COMPLETED_AT,
};

function context(): HoleCompletionContext {
  return {
    holeId: HOLE_ID,
    hole: { ...HOLE, status: "COMPLETION_REVIEW" },
    projectId: "project-1",
    projectName: "Project 1",
    rigId: "rig-1",
    rigName: "Rig 1",
    currentState: {
      draft: { status: "empty" },
    } as HoleCompletionContext["currentState"],
    runs: [RUN],
    completedRuns: [RUN],
    finalRun: RUN,
    rodConfiguration: ROD_CONFIGURATION,
    rodEvents: [ROD_EVENT],
    rodProjection: {
      rodNumber: 1,
      rodStringDm: decimetres(50),
      measuredStickUpDm: decimetres(10),
      authoritativeFinalDepthDm: decimetres(40),
      projectedHoleDepthDm: decimetres(40),
      configuration: ROD_CONFIGURATION,
      events: [ROD_EVENT],
    },
    shifts: [SHIFT],
    casingStrings: [],
    components: [COMPONENT],
    componentAssignments: [ASSIGNMENT],
    surveys: [SURVEY],
    trays: [TRAY],
    pendingOperations: { rodEvents: 0, media: 0, corrections: 0 },
  };
}

function readyReview(completionContext: HoleCompletionContext): HoleCompletionReview {
  const candidate = {
    reason: "PLANNED_DEPTH_REACHED" as const,
    comment: "Final checks complete.",
    componentOutcomes: [OUTCOME],
    finalSurveyResolution: {
      status: "RECORDED" as const,
      surveyId: SURVEY.localId,
    },
    warningAcknowledgements: [],
  };
  const evaluation = evaluateCompletionContext(completionContext, candidate);
  expect(evaluation.canComplete).toBe(true);
  return {
    ...metadata("review-1"),
    holeId: HOLE_ID,
    reviewStatus: "READY",
    disposition: "COMPLETED",
    ...candidate,
    checklist: evaluation.checks,
    startedByUserId: ACTOR.id,
    startedByNameSnapshot: ACTOR.name,
    startedAt: STARTED_AT,
  };
}

class MemoryComponentAssignments {
  readonly resolved = new Map<string, ComponentAssignment>();
  private assignment = ASSIGNMENT;
  calls = 0;

  async getAssignmentById(
    assignmentId: string,
  ): Promise<ComponentAssignment | null> {
    return assignmentId === this.assignment.localId ? this.assignment : null;
  }

  async recoverInterruptedCompletionResolution(): Promise<null> {
    return null;
  }

  async resolveAtHoleCompletion(
    input: ResolveAtHoleCompletionInput,
  ): Promise<ComponentCompletionResolutionResult> {
    this.calls += 1;
    const existing = this.resolved.get(input.operationId);
    if (existing !== undefined) {
      return {
        assignment: existing,
        component: { ...COMPONENT, status: "SERVICEABLE", version: 2 },
        status: "already-resolved",
      };
    }
    const closed: ComponentAssignment = {
      ...ASSIGNMENT,
      status: "CLOSED",
      endDepthDm: input.finalDepthDm,
      removedAt: input.occurredAt,
      removedByUserId: input.userId,
      removedByNameSnapshot: input.userNameSnapshot,
      removalReason: "HOLE_COMPLETED",
      updatedAt: input.occurredAt,
      version: ASSIGNMENT.version + 1,
    };
    this.assignment = closed;
    this.resolved.set(input.operationId, closed);
    return {
      assignment: closed,
      component: { ...COMPONENT, status: "SERVICEABLE", version: 2 },
      status: "resolved",
    };
  }
}

function repositoryFixture() {
  const completionContext = context();
  const review = readyReview(completionContext);
  const completion = new LocalCompletionRepository(
    new MemoryStorage(),
    "organisation-1",
    {
      holes: [HOLE],
      reviews: [review],
    },
  );
  const audits = new MemoryAudits();
  const assignments = new MemoryComponentAssignments();
  let shiftCalls = 0;
  const services = {
    context: { get: async () => completionContext },
    completion,
    shifts: {
      closeFinalShift: async () => {
        shiftCalls += 1;
        return { shift: SHIFT, status: "closed" };
      },
    } as unknown as CompletionShiftRepository,
    components: {} as HoleCompletionApplicationServices["components"],
    componentAssignments:
      assignments as unknown as CompletionComponentAssignmentRepository,
    audits,
  } satisfies HoleCompletionApplicationServices;
  return {
    completionContext,
    review,
    completion,
    audits,
    assignments,
    services,
    shiftCalls: () => shiftCalls,
  };
}

function command() {
  return {
    operationId: "complete-1",
    completionRecordId: "completion-1",
    holeId: HOLE_ID,
    reviewId: "review-1",
    expectedReviewVersion: 1,
    expectedHoleVersion: 2,
    completedAt: COMPLETED_AT,
    actor: ACTOR,
  } as const;
}

describe("hole completion application services", () => {
  it("completes a clean hole and persists unified repository statistics", async () => {
    const fixture = repositoryFixture();
    const result = await completeHole(command(), fixture.services);

    expect(result.status).toBe("completed");
    expect(result.lifecycle.status).toBe("COMPLETED");
    expect(result.transaction?.stage).toBe("COMPLETED");
    expect(result.completion.snapshot).toMatchObject({
      finalDepthDm: 40,
      finalRunNumber: 1,
      totalRuns: 1,
      totalDrilledDm: 40,
      totalRecoveredDm: 38,
      totalLossDm: 2,
      totalGainDm: 0,
      overallRecoveryPercentTenths: 950,
      surveyCount: 1,
      trayCount: 1,
      finalBitSummary: "BIT-1 · SERVICEABLE",
    });
    expect(fixture.assignments.resolved).toHaveLength(1);

    const statistics = await getCompletedHoleStatistics({}, fixture.services);
    expect(statistics).toMatchObject({
      completedHoles: 1,
      abandonedHoles: 0,
      totalFinalDepthDm: 40,
      totalRuns: 1,
      totalDrilledDm: 40,
      totalRecoveredDm: 38,
      componentOutcomes: 1,
      surveys: 1,
      trays: 1,
    });
  });

  it("maps operational abandonment reasons to the abandoned disposition", () => {
    expect(dispositionForCompletionReason("HOLE_ABANDONED")).toBe("ABANDONED");
    expect(dispositionForCompletionReason("GROUND_CONDITIONS")).toBe(
      "COMPLETED",
    );
    expect(dispositionForCompletionReason("RODS_STUCK")).toBe("COMPLETED");
    expect(dispositionForCompletionReason("PLANNED_DEPTH_REACHED")).toBe(
      "COMPLETED",
    );
  });

  it("closes the final shift from authoritative run and rod projections", async () => {
    const completionContext = context();
    const openShift = { ...SHIFT, status: "OPEN" as const, closedAt: undefined };
    let repositoryInput: Parameters<
      CompletionShiftRepository["closeFinalShift"]
    >[0] | null = null;
    const audits = new MemoryAudits();
    const shifts = {
      closeFinalShift: async (
        input: Parameters<CompletionShiftRepository["closeFinalShift"]>[0],
      ) => {
        repositoryInput = input;
        return { shift: SHIFT, status: "closed" as const };
      },
    } as unknown as CompletionShiftRepository;

    const result = await closeFinalCompletionShift(
      {
        operationId: "final-close-1",
        holeId: HOLE_ID,
        shiftId: openShift.localId,
        expectedVersion: openShift.version,
        closedAt: COMPLETED_AT,
        actor: ACTOR,
      },
      {
        context: {
          get: async () => ({
            ...completionContext,
            shifts: [openShift],
          }),
        },
        shifts,
        audits,
      },
    );

    expect(result.status).toBe("CLOSED");
    expect(repositoryInput).toMatchObject({
      operationId: "final-close-1",
      endingState: {
        depthDm: 40,
        rodNumber: 1,
        rodStringDm: 50,
        measuredStickUpDm: 10,
        runNumber: 1,
      },
    });
    expect(audits.entries.has("audit-final-close-1-final-shift-closed")).toBe(
      true,
    );
  });

  it("replays complete idempotently without closing components twice", async () => {
    const fixture = repositoryFixture();
    const first = await completeHole(command(), fixture.services);
    const repeated = await completeHole(command(), fixture.services);

    expect(repeated.status).toBe("already-completed");
    expect(repeated.completion).toEqual(first.completion);
    expect(fixture.assignments.resolved).toHaveLength(1);
    expect(fixture.assignments.calls).toBe(1);
    expect(await fixture.completion.getCompletionHistory(HOLE_ID)).toHaveLength(
      1,
    );
  });

  it("recovers an interruption after an idempotent component closure", async () => {
    const fixture = repositoryFixture();
    let failAdvance = true;
    const interruptedCompletion = new Proxy(fixture.completion, {
      get(target, property) {
        if (property === "advanceCompletionOperation") {
          return async (
            input: Parameters<
              CompletionRepository["advanceCompletionOperation"]
            >[0],
          ) => {
            if (failAdvance && input.stage === "COMPONENTS_CLOSED") {
              failAdvance = false;
              throw new Error("simulated interruption");
            }
            return target.advanceCompletionOperation(input);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as CompletionRepository;
    const interruptedServices = {
      ...fixture.services,
      completion: interruptedCompletion,
    };

    await expect(
      completeHole(command(), interruptedServices),
    ).rejects.toThrow("simulated interruption");
    await expect(
      fixture.completion.inspectPendingCompletionOperation(HOLE_ID),
    ).resolves.toMatchObject({ stage: "SNAPSHOT_PERSISTED" });

    const recovered = await recoverInterruptedCompletion(
      HOLE_ID,
      fixture.services,
    );
    expect(recovered?.status).toBe("recovered");
    expect(recovered?.transaction?.stage).toBe("COMPLETED");
    expect(fixture.assignments.calls).toBe(2);
    expect(fixture.assignments.resolved).toHaveLength(1);
  });

  it("captures a deeply immutable completion snapshot", async () => {
    const fixture = repositoryFixture();
    const result = await completeHole(command(), fixture.services);

    expect(Object.isFrozen(result.completion.snapshot)).toBe(true);
    expect(Object.isFrozen(result.completion.snapshot.runIds)).toBe(true);
    expect(() =>
      (result.completion.snapshot.runIds as string[]).push("mutated"),
    ).toThrow();
    expect(
      (await fixture.completion.getLatestCompletion(HOLE_ID))?.snapshot.runIds,
    ).toEqual(["run-1"]);
  });

  it("deduplicates deterministic completion and reopen audit events", async () => {
    const fixture = repositoryFixture();
    await completeHole(command(), fixture.services);
    await completeHole(command(), fixture.services);
    expect(fixture.audits.entries.size).toBe(2);

    const reopenInput = {
      operationId: "reopen-1",
      holeId: HOLE_ID,
      completionRecordId: "completion-1",
      expectedHoleVersion: 3,
      reason: "Approved extension",
      reopenedAt: REOPENED_AT,
      actor: ACTOR,
    } as const;
    await reopenHole(reopenInput, fixture.services);
    await reopenHole(reopenInput, fixture.services);
    expect(fixture.audits.entries.size).toBe(4);
    expect([...fixture.audits.entries.keys()]).toEqual(
      expect.arrayContaining([
        "audit-complete-1-timeline",
        "audit-complete-1-audit",
        "audit-reopen-1-timeline",
        "audit-reopen-1-audit",
      ]),
    );
  });

  it("reopens without mutating the original completion or opening resources", async () => {
    const fixture = repositoryFixture();
    await completeHole(command(), fixture.services);
    const original = await fixture.completion.getLatestCompletion(HOLE_ID);
    const resolverCalls = fixture.assignments.calls;
    const reopened = await reopenHole(
      {
        operationId: "reopen-1",
        holeId: HOLE_ID,
        expectedHoleVersion: 3,
        reason: "Approved daughter-hole extension",
        comment: "Retain the signed completion record.",
        reopenedAt: REOPENED_AT,
        actor: ACTOR,
      },
      fixture.services,
    );

    expect(reopened.hole.status).toBe("ACTIVE");
    expect(await fixture.completion.getLatestCompletion(HOLE_ID)).toEqual(
      original,
    );
    expect(
      (await fixture.completion.getCompletionHistoryEntries(HOLE_ID))[0],
    ).toMatchObject({
      superseded: true,
      reopened: true,
      completion: original,
    });
    expect(fixture.assignments.calls).toBe(resolverCalls);
    expect(fixture.shiftCalls()).toBe(0);
  });

  it("uses repository records rather than dashboard estimates", async () => {
    const fixture = repositoryFixture();
    await completeHole(command(), fixture.services);
    const statistics = await getCompletedHoleStatistics({}, fixture.services);

    expect(statistics.totalLossDm).toBe(2);
    expect(statistics.totalGainDm).toBe(0);
    expect(statistics.casingSummaries).toBe(0);
    expect(statistics.totalShiftsWithFinalLabels).toBe(1);
    expect(
      evaluateHoleCompletion({
        holeId: HOLE_ID,
        runs: [RUN],
        rodConfiguration: ROD_CONFIGURATION,
        rodEvents: [ROD_EVENT],
        shifts: [SHIFT],
        casingStrings: [],
        componentAssignments: [ASSIGNMENT],
        componentOutcomes: [OUTCOME],
        surveys: [SURVEY],
        finalSurveyResolution: {
          status: "RECORDED",
          surveyId: SURVEY.localId,
        },
        trays: [TRAY],
        pendingOperations: { rodEvents: 0, media: 0, corrections: 0 },
        completionReason: "PLANNED_DEPTH_REACHED",
      }).canComplete,
    ).toBe(true);
  });
});
