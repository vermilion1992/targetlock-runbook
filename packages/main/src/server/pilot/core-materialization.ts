import { z } from "zod";

import type { SyncOperationEnvelope } from "./types";
import {
  coreJsonObjectSchema,
  type CoreConfigurationKind,
  type CoreOperationPlan,
  type CoreProjection,
} from "./core-types";

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);

const metadataShape = {
  localId: z.string().trim().min(1).max(240),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1).max(240),
  version: z.number().int().positive(),
};

const projectSchema = z
  .object({
    ...metadataShape,
    organisationId: z.string().min(1).max(200),
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(150),
    clientName: z.string().trim().min(1).max(150),
    location: z.string().trim().min(1).max(200),
    status: z.enum(["planned", "active", "completed", "archived"]),
  })
  .passthrough();

const rigSchema = z
  .object({
    ...metadataShape,
    organisationId: z.string().min(1).max(200),
    projectId: z.string().min(1).max(200),
    name: z.string().trim().min(1).max(100),
    serialNumber: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    status: z.enum(["available", "operating", "maintenance", "retired"]),
  })
  .passthrough();

const holeSchema = z
  .object({
    ...metadataShape,
    projectId: z.string().min(1).max(200),
    rigId: z.string().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    holeSize: z.enum(["PQ", "HQ", "NQ", "BQ"]),
    plannedDepth: z.number().int().positive(),
    currentDepth: z.number().int().nonnegative(),
    status: z.enum([
      "DRAFT",
      "ACTIVE",
      "SUSPENDED",
      "COMPLETION_REVIEW",
      "COMPLETED",
      "ABANDONED",
      "ARCHIVED",
    ]),
    collarEasting: z.number().finite().optional(),
    collarNorthing: z.number().finite().optional(),
    collarElevation: z.number().finite().optional(),
  })
  .passthrough();

const bhaSchema = z
  .object({
    localId: z.string().min(1).max(240),
    holeId: z.string().min(1).max(200),
    effectiveAt: z.string().datetime(),
    effectiveDepthDm: z.number().int().nonnegative(),
    bottomHoleAssemblyLengthDm: z.number().int().positive(),
    constantStickUpDm: z.number().int().nonnegative(),
    baseRodStringLengthDm: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
    recordedByUserId: z.string().min(1).max(200),
    recordedByNameSnapshot: z.string().trim().min(1).max(200),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.constantStickUpDm > value.bottomHoleAssemblyLengthDm) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Constant stick-up exceeds the BHA length.",
        path: ["constantStickUpDm"],
      });
    }
    if (
      value.baseRodStringLengthDm !==
      value.bottomHoleAssemblyLengthDm - value.constantStickUpDm
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Base rod string arithmetic is inconsistent.",
        path: ["baseRodStringLengthDm"],
      });
    }
  });

const shiftSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().min(1).max(200),
    rigId: z.string().min(1).max(200),
    shiftType: z.enum(["DAY", "NIGHT"]),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    primaryDrillerId: z.string().min(1).max(200),
    primaryDrillerNameSnapshot: z.string().trim().min(1).max(200),
    startedAt: z.string().datetime(),
    closedAt: z.string().datetime().optional(),
    startingDepthDm: z.number().int().nonnegative(),
    endingDepthDm: z.number().int().nonnegative().optional(),
    startingRodNumber: z.number().int().nonnegative(),
    endingRodNumber: z.number().int().nonnegative().optional(),
    startingRodStringDm: z.number().int().nonnegative(),
    endingRodStringDm: z.number().int().nonnegative().optional(),
    startingRunNumber: z.number().int().positive(),
    endingRunNumber: z.number().int().nonnegative().optional(),
    handoverAcceptedAt: z.string().datetime().nullable().optional(),
    handoverAcceptedBy: z.string().min(1).max(200).nullable().optional(),
    handoverAcceptedByNameSnapshot: z
      .string()
      .min(1)
      .max(200)
      .nullable()
      .optional(),
    status: z.enum(["OPEN", "HANDOVER_PENDING", "CLOSED"]),
  })
  .passthrough();

const rodEventSchema = z
  .object({
    localId: z.string().min(1).max(240),
    action: z.enum(["add", "remove"]),
    rodLengthDm: z.union([z.literal(30), z.literal(60)]),
    sequence: z.number().int().positive(),
    affectedRodNumber: z.number().int().positive(),
    rodNumberAfterEvent: z.number().int().nonnegative(),
    occurredAt: z.string().datetime(),
  })
  .passthrough();

const runSchema = z
  .object({
    localId: z.string().min(1).max(240),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    startedShiftId: z.string().min(1).max(240),
    completedShiftId: z.string().min(1).max(240),
    startedByUserId: z.string().min(1).max(200),
    startedByNameSnapshot: z.string().min(1).max(200),
    completedByUserId: z.string().min(1).max(200),
    completedByNameSnapshot: z.string().min(1).max(200),
    holeId: z.string().min(1).max(200),
    runNumber: z.number().int().positive(),
    rodNumber: z.number().int().nonnegative(),
    rodStringDm: z.number().int().nonnegative(),
    measuredStickUpDm: z.number().int().nonnegative(),
    previousCompletedDepthDm: z.number().int().nonnegative(),
    holeDepthDm: z.number().int().nonnegative(),
    drilledLengthDm: z.number().int().nonnegative(),
    recoveredLengthDm: z.number().int().nonnegative(),
    recoveryPercentage: z.number().finite().nonnegative(),
    rodEvents: z.array(rodEventSchema).max(500),
    version: z.number().int().positive(),
    status: z.enum(["completed", "corrected", "void"]),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (
      value.holeDepthDm - value.previousCompletedDepthDm !==
      value.drilledLengthDm
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Run depth arithmetic is inconsistent.",
        path: ["drilledLengthDm"],
      });
    }
  });

const correctionSchema = z
  .object({
    id: z.string().min(1).max(240),
    holeId: z.string().min(1).max(200),
    runId: z.string().min(1).max(240),
    correctionType: z.string().min(1).max(80),
    reason: z.string().trim().min(1).max(500),
    correctedAt: z.string().datetime(),
    correctedByUserId: z.string().min(1).max(200),
    correctedByNameSnapshot: z.string().min(1).max(200),
    operationId: z.string().min(1).max(240),
    version: z.number().int().positive().optional(),
  })
  .passthrough();

const configurationSchema = z
  .object({
    holeId: z.string().min(1).max(200),
    localId: z.string().min(1).max(240).optional(),
    id: z.string().min(1).max(240).optional(),
    version: z.number().int().positive(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
    status: z.string().min(1).max(80).optional(),
  })
  .passthrough()
  .refine((value) => Boolean(value.localId ?? value.id), {
    message: "A trajectory projection requires an immutable local ID.",
  });

const projectResultSchema = z
  .object({
    project: projectSchema,
    rig: rigSchema,
  })
  .strict();

const shiftResultSchema = z
  .object({
    shift: shiftSchema,
  })
  .passthrough();

const handoverResultSchema = z
  .object({
    outgoingShift: shiftSchema,
    incomingShift: shiftSchema,
    status: z.enum(["accepted", "already-accepted", "recovered"]),
  })
  .passthrough();

const correctionResultSchema = z
  .object({
    snapshots: z.array(runSchema).max(2_000),
    corrections: z.array(correctionSchema).max(2_000),
    operation: z
      .object({
        operationId: z.string().min(1).max(240),
        runId: z.string().min(1).max(240),
        correctionType: z.string().min(1).max(80),
        updatedAt: z.string().datetime(),
      })
      .passthrough(),
  })
  .passthrough();

const completionReviewSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().min(1).max(200),
    reviewStatus: z.enum([
      "DRAFT",
      "BLOCKED",
      "READY",
      "COMPLETING",
      "COMPLETED",
      "CANCELLED",
    ]),
    checklist: z.array(z.record(z.unknown())).max(100),
    componentOutcomes: z.array(z.record(z.unknown())).max(100),
    warningAcknowledgements: z.array(z.record(z.unknown())).max(100),
    startedByUserId: z.string().min(1).max(200),
    startedByNameSnapshot: z.string().min(1).max(200),
    startedAt: z.string().datetime(),
  })
  .passthrough();

const completionRecordSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().min(1).max(200),
    reviewId: z.string().min(1).max(240),
    finalStatus: z.enum(["COMPLETED", "ABANDONED"]),
    completedAt: z.string().datetime(),
    completedByUserId: z.string().min(1).max(200),
    completedByNameSnapshot: z.string().min(1).max(200),
    operationId: z.string().min(1).max(240),
    snapshot: z
      .object({
        holeId: z.string().min(1).max(200),
        projectId: z.string().min(1).max(200),
        rigId: z.string().min(1).max(200),
        finalStatus: z.enum(["COMPLETED", "ABANDONED"]),
        checklist: z.array(z.record(z.unknown())).max(100),
        componentOutcomes: z.array(z.record(z.unknown())).max(100),
        warningAcknowledgements: z.array(z.record(z.unknown())).max(100),
        completedByUserId: z.string().min(1).max(200),
        completedByNameSnapshot: z.string().min(1).max(200),
        capturedAt: z.string().datetime(),
      })
      .passthrough(),
  })
  .passthrough();

const reopenRecordSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().min(1).max(200),
    completionRecordId: z.string().min(1).max(240),
    previousStatus: z.enum(["COMPLETED", "ABANDONED"]),
    reopenedStatus: z.literal("ACTIVE"),
    reason: z.string().trim().min(1).max(2_000),
    reopenedAt: z.string().datetime(),
    reopenedByUserId: z.string().min(1).max(200),
    reopenedByNameSnapshot: z.string().min(1).max(200),
    operationId: z.string().min(1).max(240),
  })
  .passthrough();

const CORE_OPERATION_TYPES = new Set([
  "projects.createProjectWithInitialRig.v1",
  "completion.createHole.v1",
  "completion.activateDraftHole.v1",
  "completion.beginReview.v1",
  "completion.saveReviewDraft.v1",
  "completion.persistCompletionRecord.v1",
  "completion.lockHole.v1",
  "completion.commitCompletion.v1",
  "completion.reopenHole.v1",
  "bha-setups.save.v1",
  "shifts.startShift.v1",
  "shifts.closeForHandover.v1",
  "shifts.closeFinalShift.v1",
  "shifts.acceptHandover.v1",
  "runs.saveCompletedRun.v1",
  "run-corrections.apply.v1",
  "run-corrections.voidRun.v1",
  "trajectory.saveCoordinateConfiguration.v1",
  "trajectory.saveReferenceConfiguration.v1",
  "trajectory.saveDraft.v1",
  "trajectory.activate.v1",
  "trajectory.supersede.v1",
  "trajectory.saveTarget.v1",
  "trajectory.saveActualConfiguration.v1",
  "trajectory.saveSurveySelection.v1",
] as const);

const configurationKinds: Readonly<Record<string, CoreConfigurationKind>> = {
  "trajectory.saveCoordinateConfiguration.v1": "COORDINATE",
  "trajectory.saveReferenceConfiguration.v1": "REFERENCE",
  "trajectory.saveDraft.v1": "PLAN",
  "trajectory.activate.v1": "PLAN",
  "trajectory.supersede.v1": "PLAN",
  "trajectory.saveTarget.v1": "TARGET",
  "trajectory.saveActualConfiguration.v1": "ACTUAL",
  "trajectory.saveSurveySelection.v1": "SURVEY_SELECTION",
};

export class CoreOperationValidationError extends Error {
  constructor(
    readonly code: "CORE_PAYLOAD_INVALID" | "CORE_CONTEXT_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "CoreOperationValidationError";
  }
}

function parsed<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new CoreOperationValidationError(
      "CORE_PAYLOAD_INVALID",
      `${label} did not pass authoritative core validation${
        result.error.issues[0]?.path.length
          ? ` at ${result.error.issues[0].path.join(".")}`
          : ""
      }: ${result.error.issues[0]?.message ?? "invalid value"}`,
    );
  }
  return result.data;
}

function projection(
  input: Omit<CoreProjection, "state"> & {
    readonly state: Readonly<Record<string, unknown>>;
  },
): CoreProjection {
  return {
    ...input,
    state: coreJsonObjectSchema.parse(input.state),
  };
}

function assertEnvelopeContext(
  envelope: SyncOperationEnvelope,
  projections: readonly CoreProjection[],
): void {
  for (const item of projections) {
    if (item.holeRef !== null && item.holeRef !== (envelope.holeRef ?? null)) {
      throw new CoreOperationValidationError(
        "CORE_CONTEXT_MISMATCH",
        "A core projection belongs to a different hole than its operation envelope.",
      );
    }
    if (
      item.projectRef !== null &&
      envelope.projectRef !== null &&
      envelope.projectRef !== undefined &&
      item.projectRef !== envelope.projectRef
    ) {
      throw new CoreOperationValidationError(
        "CORE_CONTEXT_MISMATCH",
        "A core projection belongs to a different project than its operation envelope.",
      );
    }
  }
}

function assertActor(actual: string, envelope: SyncOperationEnvelope): void {
  if (actual !== envelope.operatorId) {
    throw new CoreOperationValidationError(
      "CORE_CONTEXT_MISMATCH",
      "The core record actor does not match the authenticated operation actor.",
    );
  }
}

function projectProjection(
  item: z.infer<typeof projectSchema>,
): CoreProjection {
  return projection({
    kind: "PROJECT",
    localId: item.localId,
    projectRef: item.localId,
    rigRef: null,
    holeRef: null,
    version: item.version,
    lifecycleStatus: item.status,
    clientCreatedAt: item.createdAt,
    clientUpdatedAt: item.updatedAt,
    actorNameSnapshot: null,
    state: item,
  });
}

function rigProjection(item: z.infer<typeof rigSchema>): CoreProjection {
  return projection({
    kind: "RIG",
    localId: item.localId,
    projectRef: item.projectId,
    rigRef: item.localId,
    holeRef: null,
    version: item.version,
    lifecycleStatus: item.status,
    clientCreatedAt: item.createdAt,
    clientUpdatedAt: item.updatedAt,
    actorNameSnapshot: null,
    state: item,
  });
}

function holeProjection(item: z.infer<typeof holeSchema>): CoreProjection {
  return projection({
    kind: "HOLE",
    localId: item.localId,
    projectRef: item.projectId,
    rigRef: item.rigId,
    holeRef: item.localId,
    version: item.version,
    lifecycleStatus: item.status,
    clientCreatedAt: item.createdAt,
    clientUpdatedAt: item.updatedAt,
    actorNameSnapshot: null,
    state: item,
  });
}

function bhaProjection(
  item: z.infer<typeof bhaSchema>,
  envelope: SyncOperationEnvelope,
): CoreProjection {
  assertActor(item.recordedByUserId, envelope);
  return projection({
    kind: "BHA_SETUP",
    localId: item.localId,
    projectRef: envelope.projectRef ?? null,
    rigRef: envelope.rigRef ?? null,
    holeRef: item.holeId,
    version: 1,
    lifecycleStatus: "ACTIVE",
    clientCreatedAt: item.effectiveAt,
    clientUpdatedAt: item.effectiveAt,
    actorNameSnapshot: item.recordedByNameSnapshot,
    state: item,
  });
}

function shiftProjection(
  item: z.infer<typeof shiftSchema>,
  envelope: SyncOperationEnvelope,
): CoreProjection {
  return projection({
    kind: "SHIFT",
    localId: item.localId,
    projectRef: envelope.projectRef ?? null,
    rigRef: item.rigId,
    holeRef: item.holeId,
    version: item.version,
    lifecycleStatus: item.status,
    clientCreatedAt: item.createdAt,
    clientUpdatedAt: item.updatedAt,
    actorNameSnapshot: item.primaryDrillerNameSnapshot,
    state: item,
  });
}

function runProjections(
  item: z.infer<typeof runSchema>,
  envelope: SyncOperationEnvelope,
  assertCurrentActor = true,
): readonly CoreProjection[] {
  if (assertCurrentActor) assertActor(item.completedByUserId, envelope);
  const run = projection({
    kind: "RUN" as const,
    localId: item.localId,
    projectRef: envelope.projectRef ?? null,
    rigRef: envelope.rigRef ?? null,
    holeRef: item.holeId,
    version: item.version,
    lifecycleStatus: item.status,
    clientCreatedAt: item.startedAt,
    clientUpdatedAt: item.completedAt,
    actorNameSnapshot: item.completedByNameSnapshot,
    sourceActorUserId: item.completedByUserId,
    state: item,
  });
  return [
    run,
    ...item.rodEvents.map((event) =>
      projection({
        kind: "ROD_EVENT" as const,
        localId: event.localId,
        projectRef: envelope.projectRef ?? null,
        rigRef: envelope.rigRef ?? null,
        holeRef: item.holeId,
        version: item.version,
        lifecycleStatus: "ACTIVE",
        clientCreatedAt: event.occurredAt,
        clientUpdatedAt: event.occurredAt,
        actorNameSnapshot: item.completedByNameSnapshot,
        sourceActorUserId: item.completedByUserId,
        state: { ...event, runId: item.localId, holeId: item.holeId },
      }),
    ),
  ];
}

function plan(
  envelope: SyncOperationEnvelope,
  projections: readonly CoreProjection[],
  aggregateType: "PROJECT_DIRECTORY" | "HOLE",
  aggregateRef: string,
): CoreOperationPlan {
  assertEnvelopeContext(envelope, projections);
  const revisionProjection =
    envelope.revisionRef === null || envelope.revisionRef === undefined
      ? null
      : projections.find((candidate) =>
          envelope.revisionRef!.endsWith(`:${candidate.localId}`),
        ) ?? null;
  return {
    semantics: "AUTHORITATIVE_CORE",
    aggregateType,
    aggregateRef,
    revisionVersion: revisionProjection?.version ?? null,
    projections,
  };
}

export function isCoreOperationType(operationType: string): boolean {
  return CORE_OPERATION_TYPES.has(
    operationType as (typeof CORE_OPERATION_TYPES extends Set<infer T>
      ? T
      : never),
  );
}

export function planCoreOperation(
  envelope: SyncOperationEnvelope,
): CoreOperationPlan | null {
  if (!isCoreOperationType(envelope.operationType)) return null;
  const result = envelope.payload.result;

  if (envelope.operationType === "projects.createProjectWithInitialRig.v1") {
    const value = parsed(projectResultSchema, result, "Project creation result");
    const projections = [
      projectProjection(value.project),
      rigProjection(value.rig),
    ];
    return plan(envelope, projections, "PROJECT_DIRECTORY", "directory");
  }

  if (
    envelope.operationType === "completion.createHole.v1" ||
    envelope.operationType === "completion.activateDraftHole.v1"
  ) {
    const value = parsed(holeSchema, result, "Hole result");
    return plan(
      envelope,
      [holeProjection(value)],
      "HOLE",
      value.localId,
    );
  }

  if (
    envelope.operationType === "completion.beginReview.v1" ||
    envelope.operationType === "completion.saveReviewDraft.v1"
  ) {
    const value = parsed(
      completionReviewSchema,
      result,
      "Completion review result",
    );
    const review = projection({
      kind: "COMPLETION_REVIEW",
      localId: value.localId,
      projectRef: envelope.projectRef ?? null,
      rigRef: envelope.rigRef ?? null,
      holeRef: value.holeId,
      version: value.version,
      lifecycleStatus: value.reviewStatus,
      clientCreatedAt: value.createdAt,
      clientUpdatedAt: value.updatedAt,
      actorNameSnapshot: value.startedByNameSnapshot,
      sourceActorUserId: value.startedByUserId,
      state: value,
    });
    return plan(envelope, [review], "HOLE", value.holeId);
  }

  if (envelope.operationType === "completion.persistCompletionRecord.v1") {
    const value = parsed(
      completionRecordSchema,
      result,
      "Completion record result",
    );
    assertActor(value.completedByUserId, envelope);
    const record = projection({
      kind: "COMPLETION_RECORD",
      localId: value.localId,
      projectRef: value.snapshot.projectId,
      rigRef: value.snapshot.rigId,
      holeRef: value.holeId,
      version: value.version,
      lifecycleStatus: value.finalStatus,
      clientCreatedAt: value.createdAt,
      clientUpdatedAt: value.updatedAt,
      actorNameSnapshot: value.completedByNameSnapshot,
      sourceActorUserId: value.completedByUserId,
      state: value,
    });
    return plan(envelope, [record], "HOLE", value.holeId);
  }

  if (
    envelope.operationType === "completion.lockHole.v1" ||
    envelope.operationType === "completion.commitCompletion.v1" ||
    envelope.operationType === "completion.reopenHole.v1"
  ) {
    const value = parsed(
      z
        .object({
          hole: holeSchema,
          completion: completionRecordSchema.optional(),
          reopenRecord: reopenRecordSchema.optional(),
        })
        .passthrough(),
      result,
      "Hole lifecycle result",
    );
    const projections: CoreProjection[] = [holeProjection(value.hole)];
    if (value.completion) {
      projections.push(
        projection({
          kind: "COMPLETION_RECORD",
          localId: value.completion.localId,
          projectRef: value.completion.snapshot.projectId,
          rigRef: value.completion.snapshot.rigId,
          holeRef: value.completion.holeId,
          version: value.completion.version,
          lifecycleStatus: value.completion.finalStatus,
          clientCreatedAt: value.completion.createdAt,
          clientUpdatedAt: value.completion.updatedAt,
          actorNameSnapshot: value.completion.completedByNameSnapshot,
          sourceActorUserId: value.completion.completedByUserId,
          state: value.completion,
        }),
      );
    }
    if (value.reopenRecord) {
      assertActor(value.reopenRecord.reopenedByUserId, envelope);
      projections.push(
        projection({
          kind: "REOPEN_RECORD",
          localId: value.reopenRecord.localId,
          projectRef: value.hole.projectId,
          rigRef: value.hole.rigId,
          holeRef: value.reopenRecord.holeId,
          version: value.reopenRecord.version,
          lifecycleStatus: "ACTIVE",
          clientCreatedAt: value.reopenRecord.createdAt,
          clientUpdatedAt: value.reopenRecord.updatedAt,
          actorNameSnapshot: value.reopenRecord.reopenedByNameSnapshot,
          sourceActorUserId: value.reopenRecord.reopenedByUserId,
          state: value.reopenRecord,
        }),
      );
    }
    return plan(envelope, projections, "HOLE", value.hole.localId);
  }

  if (envelope.operationType === "bha-setups.save.v1") {
    const value = parsed(bhaSchema, result, "BHA setup result");
    return plan(
      envelope,
      [bhaProjection(value, envelope)],
      "HOLE",
      value.holeId,
    );
  }

  const configurationKind = configurationKinds[envelope.operationType];
  if (configurationKind !== undefined) {
    const value = parsed(
      configurationSchema,
      result,
      "Trajectory configuration result",
    );
    const localId = value.localId ?? value.id!;
    const item = projection({
      kind: "HOLE_CONFIGURATION" as const,
      localId,
      projectRef: envelope.projectRef ?? null,
      rigRef: envelope.rigRef ?? null,
      holeRef: value.holeId,
      version: value.version,
      lifecycleStatus: value.status ?? "ACTIVE",
      clientCreatedAt: value.createdAt ?? null,
      clientUpdatedAt: value.updatedAt,
      actorNameSnapshot: null,
      configurationKind,
      state: value,
    });
    return plan(envelope, [item], "HOLE", value.holeId);
  }

  if (
    envelope.operationType === "shifts.startShift.v1" ||
    envelope.operationType === "shifts.closeForHandover.v1"
  ) {
    const value = parsed(shiftSchema, result, "Shift result");
    const projections: CoreProjection[] = [
      shiftProjection(value, envelope),
    ];
    if (envelope.operationType === "shifts.closeForHandover.v1") {
      projections.push(
        projection({
          kind: "HANDOVER",
          localId: `handover:${value.localId}`,
          projectRef: envelope.projectRef ?? null,
          rigRef: value.rigId,
          holeRef: value.holeId,
          version: value.version,
          lifecycleStatus: "PENDING",
          clientCreatedAt: value.closedAt ?? value.updatedAt,
          clientUpdatedAt: value.updatedAt,
          actorNameSnapshot: value.primaryDrillerNameSnapshot,
          state: {
            outgoingShiftId: value.localId,
            incomingShiftId: null,
            status: "PENDING",
            note: value.handoverNote ?? null,
            acceptedAt: null,
          },
        }),
      );
    }
    return plan(envelope, projections, "HOLE", value.holeId);
  }

  if (envelope.operationType === "shifts.closeFinalShift.v1") {
    const value = parsed(shiftResultSchema, result, "Final shift close result");
    return plan(
      envelope,
      [
        shiftProjection(value.shift, envelope),
        projection({
          kind: "HANDOVER",
          localId: `final:${value.shift.localId}`,
          projectRef: envelope.projectRef ?? null,
          rigRef: value.shift.rigId,
          holeRef: value.shift.holeId,
          version: value.shift.version,
          lifecycleStatus: "FINAL_CLOSE",
          clientCreatedAt: value.shift.closedAt ?? value.shift.updatedAt,
          clientUpdatedAt: value.shift.updatedAt,
          actorNameSnapshot: value.shift.primaryDrillerNameSnapshot,
          state: {
            outgoingShiftId: value.shift.localId,
            incomingShiftId: null,
            status: "FINAL_CLOSE",
            acceptedAt: null,
          },
        }),
      ],
      "HOLE",
      value.shift.holeId,
    );
  }

  if (envelope.operationType === "shifts.acceptHandover.v1") {
    const value = parsed(
      handoverResultSchema,
      result,
      "Handover acceptance result",
    );
    return plan(
      envelope,
      [
        shiftProjection(value.outgoingShift, envelope),
        shiftProjection(value.incomingShift, envelope),
        projection({
          kind: "HANDOVER",
          localId: `handover:${value.outgoingShift.localId}`,
          projectRef: envelope.projectRef ?? null,
          rigRef: value.outgoingShift.rigId,
          holeRef: value.outgoingShift.holeId,
          version: value.outgoingShift.version,
          lifecycleStatus: "ACCEPTED",
          clientCreatedAt:
            value.outgoingShift.closedAt ?? value.outgoingShift.updatedAt,
          clientUpdatedAt:
            value.outgoingShift.handoverAcceptedAt ??
            value.outgoingShift.updatedAt,
          actorNameSnapshot:
            value.outgoingShift.handoverAcceptedByNameSnapshot ??
            value.incomingShift.primaryDrillerNameSnapshot,
          state: {
            outgoingShiftId: value.outgoingShift.localId,
            incomingShiftId: value.incomingShift.localId,
            status: "ACCEPTED",
            acceptedAt:
              value.outgoingShift.handoverAcceptedAt ??
              value.incomingShift.startedAt,
            acceptedBy: value.outgoingShift.handoverAcceptedBy ?? null,
            acceptedByNameSnapshot:
              value.outgoingShift.handoverAcceptedByNameSnapshot ?? null,
          },
        }),
      ],
      "HOLE",
      value.outgoingShift.holeId,
    );
  }

  if (envelope.operationType === "runs.saveCompletedRun.v1") {
    const snapshot = parsed(
      runSchema,
      envelope.payload.arguments[1],
      "Completed run",
    );
    return plan(
      envelope,
      runProjections(snapshot, envelope, false),
      "HOLE",
      snapshot.holeId,
    );
  }

  if (
    envelope.operationType === "run-corrections.apply.v1" ||
    envelope.operationType === "run-corrections.voidRun.v1"
  ) {
    const value = parsed(
      correctionResultSchema,
      result,
      "Run correction result",
    );
    const projections: CoreProjection[] = value.snapshots.flatMap((snapshot) =>
      runProjections(snapshot, envelope, false),
    );
    for (const correction of value.corrections) {
      assertActor(correction.correctedByUserId, envelope);
      projections.push(
        projection({
          kind: "RUN_CORRECTION",
          localId: correction.id,
          projectRef: envelope.projectRef ?? null,
          rigRef: envelope.rigRef ?? null,
          holeRef: correction.holeId,
          version:
            correction.version ??
            value.snapshots.find((snapshot) => snapshot.localId === correction.runId)
              ?.version ??
            1,
          lifecycleStatus: "APPLIED",
          clientCreatedAt: correction.correctedAt,
          clientUpdatedAt: correction.correctedAt,
          actorNameSnapshot: correction.correctedByNameSnapshot,
          sourceActorUserId: correction.correctedByUserId,
          state: correction,
        }),
      );
    }
    const holeRef = value.snapshots[0]?.holeId;
    if (!holeRef) {
      throw new CoreOperationValidationError(
        "CORE_PAYLOAD_INVALID",
        "A run correction must return the authoritative run chain.",
      );
    }
    return plan(envelope, projections, "HOLE", holeRef);
  }

  throw new CoreOperationValidationError(
    "CORE_PAYLOAD_INVALID",
    "The registered core operation has no authoritative handler.",
  );
}
