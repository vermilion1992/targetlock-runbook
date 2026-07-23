import { z } from "zod";

import type { LocalStorageAdapter } from "./storage";

export const RUN_DRAFT_VERSION = 5 as const;
export const LEGACY_V4_RUN_DRAFT_VERSION = 4 as const;
export const DRAFT_SYNC_STATUS = "local-only" as const;
const LEGACY_SHIFT_ID = "legacy-unassigned-shift";
const LEGACY_USER_ID = "legacy-local-user";
const LEGACY_USER_NAME = "Legacy local operator";

const isoTimestampSchema = z.string().datetime();
const rodLengthDmSchema = z.union([z.literal(30), z.literal(60)]);
const rodEventActionSchema = z.union([z.literal("add"), z.literal("remove")]);
const runStatusSchema = z.enum(["completed", "corrected", "void"]);
const voidReasonSchema = z.enum([
  "ACCIDENTAL_DUPLICATE",
  "WRONG_HOLE",
  "TEST_ENTRY",
  "NEVER_OCCURRED",
  "OTHER",
]);
const runCorrectionTypeSchema = z.enum([
  "MEASURED_STICK_UP",
  "RECOVERED_LENGTH",
  "ROD_EVENT",
  "COMMENT",
  "OPERATIONAL_NOTE",
  "COMPONENT_SNAPSHOT",
  "RUN_NUMBER",
  "OTHER",
  "VOID",
]);
const correctionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const operationStageSchema = z.enum([
  "PREVIEWED",
  "VALIDATED",
  "CORRECTION_SAVED",
  "RUN_PROJECTION_UPDATED",
  "ROD_PROJECTION_UPDATED",
  "DEPENDENT_PROJECTIONS_UPDATED",
  "TIMELINE_UPDATED",
  "AUDIT_WRITTEN",
  "REPORTS_MARKED_STALE",
  "COMPLETED",
  "FAILED",
]);

const pendingRodEventSchema = z.object({
  localId: z.string().min(1),
  action: rodEventActionSchema,
  rodLengthDm: rodLengthDmSchema,
});

const savedRodEventSchema = pendingRodEventSchema.extend({
  sequence: z.number().int().positive(),
  affectedRodNumber: z.number().int().positive(),
  rodNumberAfterEvent: z.number().int().nonnegative(),
  occurredAt: isoTimestampSchema,
});

const runContextSchema = z.object({
  runNumber: z.number().int().positive(),
  rodNumber: z.number().int().nonnegative(),
  currentRodStringDm: z.number().int().nonnegative(),
  previousCompletedDepthDm: z.number().int().nonnegative(),
});

export const runDraftPayloadSchema = z.object({
  localId: z.string().min(1),
  startedAt: isoTimestampSchema,
  startedShiftId: z.string().min(1),
  startedByUserId: z.string().min(1),
  startedByNameSnapshot: z.string().min(1),
  context: runContextSchema,
  pendingRodEvents: z.array(pendingRodEventSchema),
  stickUpMetresInput: z.string(),
  recoveredMetresInput: z.string(),
  conditionTagIds: z.array(z.string().min(1)),
  comment: z.string().max(500),
  activeBitAssignmentId: z.string().min(1).nullable(),
  activeReamerAssignmentId: z.string().min(1).nullable(),
  activeBitSerialNumberSnapshot: z.string().min(1).nullable(),
  activeReamerSerialNumberSnapshot: z.string().min(1).nullable(),
  casingSummarySnapshot: z.string().min(1).nullable(),
});

const runDraftEnvelopeSchema = z.object({
  version: z.literal(RUN_DRAFT_VERSION),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  savedAt: isoTimestampSchema,
  payload: runDraftPayloadSchema,
});

/** Measured run fields frozen as the original entry (no correction metadata). */
export const savedRunOriginalSnapshotSchema = z.object({
  localId: z.string().min(1),
  startedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema,
  startedShiftId: z.string().min(1),
  completedShiftId: z.string().min(1),
  startedByUserId: z.string().min(1),
  startedByNameSnapshot: z.string().min(1),
  completedByUserId: z.string().min(1),
  completedByNameSnapshot: z.string().min(1),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  runNumber: z.number().int().positive(),
  rodNumber: z.number().int().nonnegative(),
  rodStringDm: z.number().int().nonnegative(),
  measuredStickUpDm: z.number().int().nonnegative(),
  previousCompletedDepthDm: z.number().int().nonnegative(),
  holeDepthDm: z.number().int().nonnegative(),
  /** Positive for newly completed runs; may be zero after audited chain recalculation. */
  drilledLengthDm: z.number().int().nonnegative(),
  recoveredLengthDm: z.number().int().nonnegative(),
  recoveryPercentage: z.number().nonnegative(),
  rodEvents: z.array(savedRodEventSchema),
  conditionTagIds: z.array(z.string().min(1)),
  comment: z.string().max(500),
  activeBitAssignmentId: z.string().min(1).nullable(),
  activeReamerAssignmentId: z.string().min(1).nullable(),
  activeBitSerialNumberSnapshot: z.string().min(1).nullable(),
  activeReamerSerialNumberSnapshot: z.string().min(1).nullable(),
  casingSummarySnapshot: z.string().min(1).nullable(),
});

export const savedRunSnapshotSchema = savedRunOriginalSnapshotSchema.extend({
  version: z.number().int().positive().default(1),
  status: runStatusSchema.default("completed"),
  correctionIds: z.array(z.string().min(1)).default([]),
  originalSnapshot: savedRunOriginalSnapshotSchema.nullable().default(null),
  voidReason: voidReasonSchema.nullable().default(null),
  voidComment: z.string().max(500).nullable().default(null),
  voidedAt: isoTimestampSchema.nullable().default(null),
  voidedByUserId: z.string().min(1).nullable().default(null),
  voidedByNameSnapshot: z.string().min(1).nullable().default(null),
});

export const runCorrectionRecordSchema = z.object({
  id: z.string().min(1),
  holeId: z.string().min(1),
  runId: z.string().min(1),
  correctionType: runCorrectionTypeSchema,
  fieldName: z.string().min(1),
  previousValue: correctionValueSchema,
  correctedValue: correctionValueSchema,
  reason: z.string().trim().min(1).max(500),
  comment: z.string().max(500).optional(),
  affectedRunIds: z.array(z.string().min(1)).default([]),
  affectedEntityIds: z.array(z.string().min(1)).default([]),
  correctedAt: isoTimestampSchema,
  correctedByUserId: z.string().min(1),
  correctedByNameSnapshot: z.string().min(1),
  operationId: z.string().min(1),
});

export const rodEventEffectiveOverrideSchema = z.object({
  rodEventId: z.string().min(1),
  runId: z.string().min(1),
  action: rodEventActionSchema,
  rodLengthDm: rodLengthDmSchema,
  affectedRodNumber: z.number().int().positive(),
  voided: z.boolean().default(false),
  version: z.number().int().positive().default(1),
});

export const runCorrectionOperationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(["CORRECT_RUN", "VOID_RUN"]),
  correctionType: runCorrectionTypeSchema,
  runId: z.string().min(1),
  inputJson: z.string(),
  stage: operationStageSchema,
  affectedRunIds: z.array(z.string().min(1)).default([]),
  correctionIds: z.array(z.string().min(1)).default([]),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.nullable().default(null),
  failureReason: z.string().nullable().default(null),
});

const savedRunsEnvelopeSchema = z.object({
  version: z.literal(RUN_DRAFT_VERSION),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  revision: z.number().int().nonnegative().default(0),
  snapshots: z.array(savedRunSnapshotSchema),
  corrections: z.array(runCorrectionRecordSchema).default([]),
  operations: z.array(runCorrectionOperationSchema).default([]),
  rodEventOverrides: z.array(rodEventEffectiveOverrideSchema).default([]),
});

const legacyV4SavedRunSnapshotSchema = savedRunOriginalSnapshotSchema;
const legacyV4SavedRunsEnvelopeSchema = z.object({
  version: z.literal(LEGACY_V4_RUN_DRAFT_VERSION),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  snapshots: z.array(legacyV4SavedRunSnapshotSchema),
});
const legacyV4RunDraftEnvelopeSchema = z.object({
  version: z.literal(LEGACY_V4_RUN_DRAFT_VERSION),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  savedAt: isoTimestampSchema,
  payload: runDraftPayloadSchema,
});

const legacyV3RunDraftPayloadSchema = runDraftPayloadSchema
  .omit({
    activeBitAssignmentId: true,
    activeReamerAssignmentId: true,
    activeBitSerialNumberSnapshot: true,
    activeReamerSerialNumberSnapshot: true,
    casingSummarySnapshot: true,
  })
  .extend({
    activeBitSerialNumberSnapshot: z.string().min(1).nullable().optional(),
    activeReamerSerialNumberSnapshot: z.string().min(1).nullable().optional(),
  });

const legacyV3RunDraftEnvelopeSchema = z.object({
  version: z.literal(3),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  savedAt: isoTimestampSchema,
  payload: legacyV3RunDraftPayloadSchema,
});

const legacyV3SavedRunSnapshotSchema = legacyV4SavedRunSnapshotSchema
  .omit({
    activeBitAssignmentId: true,
    activeReamerAssignmentId: true,
    activeBitSerialNumberSnapshot: true,
    activeReamerSerialNumberSnapshot: true,
    casingSummarySnapshot: true,
  })
  .extend({
    activeBitSerialNumberSnapshot: z.string().min(1).nullable().optional(),
    activeReamerSerialNumberSnapshot: z.string().min(1).nullable().optional(),
  });

const legacyV3SavedRunsEnvelopeSchema = z.object({
  version: z.literal(3),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  snapshots: z.array(legacyV3SavedRunSnapshotSchema),
});

const legacyV2RunDraftPayloadSchema = legacyV3RunDraftPayloadSchema.omit({
  startedShiftId: true,
  startedByUserId: true,
  startedByNameSnapshot: true,
});

const legacyV2RunDraftEnvelopeSchema = z.object({
  version: z.literal(2),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  savedAt: isoTimestampSchema,
  payload: legacyV2RunDraftPayloadSchema,
});

const legacyV2SavedRunSnapshotSchema = legacyV3SavedRunSnapshotSchema.omit({
  startedShiftId: true,
  completedShiftId: true,
  startedByUserId: true,
  startedByNameSnapshot: true,
  completedByUserId: true,
  completedByNameSnapshot: true,
});

const legacyV2SavedRunsEnvelopeSchema = z.object({
  version: z.literal(2),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  snapshots: z.array(legacyV2SavedRunSnapshotSchema),
});

const legacyPendingRodEventSchema = z.object({
  action: z.literal("add"),
  rodLengthDecimetres: rodLengthDmSchema,
});

const legacyRunContextSchema = z.object({
  runNumber: z.number().int().positive(),
  rodNumber: z.number().int().nonnegative(),
  currentRodStringDecimetres: z.number().int().nonnegative(),
  previousCompletedDepthDecimetres: z.number().int().nonnegative(),
});

const legacyRunDraftEnvelopeSchema = z.object({
  version: z.literal(1),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  savedAt: isoTimestampSchema,
  payload: z.object({
    context: legacyRunContextSchema,
    pendingRodEvents: z.array(legacyPendingRodEventSchema),
    stickUpMetres: z.string(),
    recoveredMetres: z.string(),
    conditionTagIds: z.array(z.string().min(1)),
    comment: z.string().max(500),
  }),
});

const legacySavedRunSnapshotSchema = z.object({
  localId: z.string().min(1),
  savedAt: isoTimestampSchema,
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  runNumber: z.number().int().positive(),
  rodNumber: z.number().int().nonnegative(),
  rodStringDecimetres: z.number().int().nonnegative(),
  measuredStickUpDecimetres: z.number().int().nonnegative(),
  previousCompletedDepthDecimetres: z.number().int().nonnegative(),
  holeDepthDecimetres: z.number().int().nonnegative(),
  drilledLengthDecimetres: z.number().int().positive(),
  recoveredLengthDecimetres: z.number().int().nonnegative(),
  recoveryPercentage: z.number().nonnegative(),
  pendingRodEvents: z.array(legacyPendingRodEventSchema),
  conditionTagIds: z.array(z.string().min(1)),
  comment: z.string().max(500),
});

const legacySavedRunsEnvelopeSchema = z.object({
  version: z.literal(1),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  snapshots: z.array(legacySavedRunSnapshotSchema),
});

export type PendingDraftRodEvent = z.infer<typeof pendingRodEventSchema>;
export type SavedRodEventSnapshot = z.infer<typeof savedRodEventSchema>;
export type RunDraftContext = z.infer<typeof runContextSchema>;
export type RunDraftPayload = z.infer<typeof runDraftPayloadSchema>;
export type RunDraftEnvelope = z.infer<typeof runDraftEnvelopeSchema>;
export type SavedRunOriginalSnapshot = z.infer<
  typeof savedRunOriginalSnapshotSchema
>;
export type SavedRunSnapshot = z.infer<typeof savedRunSnapshotSchema>;
export type SavedRunsEnvelope = z.infer<typeof savedRunsEnvelopeSchema>;
export type RunCorrectionRecord = z.infer<typeof runCorrectionRecordSchema>;
export type RodEventEffectiveOverride = z.infer<
  typeof rodEventEffectiveOverrideSchema
>;
export type RunCorrectionOperation = z.infer<
  typeof runCorrectionOperationSchema
>;
export type RunCorrectionType = z.infer<typeof runCorrectionTypeSchema>;
export type RunVoidReason = z.infer<typeof voidReasonSchema>;
export type RunCorrectionOperationStage = z.infer<typeof operationStageSchema>;

export type DraftReadResult =
  | { readonly status: "empty" }
  | { readonly status: "valid"; readonly envelope: RunDraftEnvelope }
  | { readonly status: "invalid"; readonly reason: string };

export type SavedRunsReadResult =
  | { readonly status: "empty"; readonly snapshots: readonly [] }
  | {
      readonly status: "valid";
      readonly snapshots: readonly SavedRunSnapshot[];
      readonly envelope: SavedRunsEnvelope;
    }
  | { readonly status: "invalid"; readonly reason: string };

export type PersistenceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type SaveRunResult =
  | { readonly ok: true; readonly status: "saved" | "already-saved" }
  | { readonly ok: false; readonly reason: string };

export function isOperationalRunSnapshot(snapshot: SavedRunSnapshot): boolean {
  return snapshot.status !== "void";
}

export function latestSavedRunSnapshot(
  snapshots: readonly SavedRunSnapshot[],
): SavedRunSnapshot | undefined {
  return snapshots
    .filter(isOperationalRunSnapshot)
    .reduce<SavedRunSnapshot | undefined>(
      (latest, snapshot) =>
        latest === undefined || snapshot.runNumber > latest.runNumber
          ? snapshot
          : latest,
      undefined,
    );
}

export function nextRunContextFromSavedRuns(
  snapshots: readonly SavedRunSnapshot[],
  fallback: RunDraftContext,
): RunDraftContext {
  const latest = latestSavedRunSnapshot(snapshots);
  if (latest === undefined) {
    return fallback;
  }

  return {
    runNumber: latest.runNumber + 1,
    rodNumber: latest.rodNumber,
    currentRodStringDm: latest.rodStringDm,
    previousCompletedDepthDm: latest.holeDepthDm,
  };
}

export function freezeOriginalRunSnapshot(
  snapshot: SavedRunSnapshot | SavedRunOriginalSnapshot,
): SavedRunOriginalSnapshot {
  return savedRunOriginalSnapshotSchema.parse({
    localId: snapshot.localId,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    startedShiftId: snapshot.startedShiftId,
    completedShiftId: snapshot.completedShiftId,
    startedByUserId: snapshot.startedByUserId,
    startedByNameSnapshot: snapshot.startedByNameSnapshot,
    completedByUserId: snapshot.completedByUserId,
    completedByNameSnapshot: snapshot.completedByNameSnapshot,
    holeId: snapshot.holeId,
    syncStatus: snapshot.syncStatus,
    runNumber: snapshot.runNumber,
    rodNumber: snapshot.rodNumber,
    rodStringDm: snapshot.rodStringDm,
    measuredStickUpDm: snapshot.measuredStickUpDm,
    previousCompletedDepthDm: snapshot.previousCompletedDepthDm,
    holeDepthDm: snapshot.holeDepthDm,
    drilledLengthDm: snapshot.drilledLengthDm,
    recoveredLengthDm: snapshot.recoveredLengthDm,
    recoveryPercentage: snapshot.recoveryPercentage,
    rodEvents: snapshot.rodEvents,
    conditionTagIds: snapshot.conditionTagIds,
    comment: snapshot.comment,
    activeBitAssignmentId: snapshot.activeBitAssignmentId,
    activeReamerAssignmentId: snapshot.activeReamerAssignmentId,
    activeBitSerialNumberSnapshot: snapshot.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: snapshot.activeReamerSerialNumberSnapshot,
    casingSummarySnapshot: snapshot.casingSummarySnapshot,
  });
}

export function withDefaultRunCorrectionFields(
  snapshot: SavedRunOriginalSnapshot | SavedRunSnapshot,
): SavedRunSnapshot {
  return savedRunSnapshotSchema.parse({
    ...freezeOriginalRunSnapshot(snapshot),
    version: "version" in snapshot ? snapshot.version : 1,
    status: "status" in snapshot ? snapshot.status : "completed",
    correctionIds: "correctionIds" in snapshot ? snapshot.correctionIds : [],
    originalSnapshot:
      "originalSnapshot" in snapshot ? snapshot.originalSnapshot : null,
    voidReason: "voidReason" in snapshot ? snapshot.voidReason : null,
    voidComment: "voidComment" in snapshot ? snapshot.voidComment : null,
    voidedAt: "voidedAt" in snapshot ? snapshot.voidedAt : null,
    voidedByUserId: "voidedByUserId" in snapshot ? snapshot.voidedByUserId : null,
    voidedByNameSnapshot:
      "voidedByNameSnapshot" in snapshot ? snapshot.voidedByNameSnapshot : null,
  });
}

function emptySavedRunsEnvelope(
  holeId: string,
  updatedAt: string,
): SavedRunsEnvelope {
  return savedRunsEnvelopeSchema.parse({
    version: RUN_DRAFT_VERSION,
    holeId,
    syncStatus: DRAFT_SYNC_STATUS,
    updatedAt,
    revision: 0,
    snapshots: [],
    corrections: [],
    operations: [],
    rodEventOverrides: [],
  });
}

function scopedKey(
  version: 1 | 2 | 3 | 4 | typeof RUN_DRAFT_VERSION,
  holeId: string,
  suffix: "run-draft" | "saved-runs",
): string {
  return `targetlock:prototype:v${version}:hole:${encodeURIComponent(holeId)}:${suffix}`;
}

export function runDraftKey(holeId: string): string {
  return scopedKey(RUN_DRAFT_VERSION, holeId, "run-draft");
}

export function savedRunsKey(holeId: string): string {
  return scopedKey(RUN_DRAFT_VERSION, holeId, "saved-runs");
}

function legacyRunDraftKey(holeId: string): string {
  return scopedKey(1, holeId, "run-draft");
}

function legacySavedRunsKey(holeId: string): string {
  return scopedKey(1, holeId, "saved-runs");
}

function legacyV2RunDraftKey(holeId: string): string {
  return scopedKey(2, holeId, "run-draft");
}

function legacyV2SavedRunsKey(holeId: string): string {
  return scopedKey(2, holeId, "saved-runs");
}

function legacyV3RunDraftKey(holeId: string): string {
  return scopedKey(3, holeId, "run-draft");
}

function legacyV3SavedRunsKey(holeId: string): string {
  return scopedKey(3, holeId, "saved-runs");
}

function legacyV4RunDraftKey(holeId: string): string {
  return scopedKey(LEGACY_V4_RUN_DRAFT_VERSION, holeId, "run-draft");
}

function legacyV4SavedRunsKey(holeId: string): string {
  return scopedKey(LEGACY_V4_RUN_DRAFT_VERSION, holeId, "saved-runs");
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

const emptyComponentSnapshots = {
  activeBitAssignmentId: null,
  activeReamerAssignmentId: null,
  activeBitSerialNumberSnapshot: null,
  activeReamerSerialNumberSnapshot: null,
  casingSummarySnapshot: null,
} as const;

export interface RunAssignmentMigrationCandidate {
  readonly assignmentId: string;
  readonly componentType: "BIT" | "REAMER";
  readonly serialNumber: string;
  readonly holeId: string;
  readonly startDepthDm: number;
  readonly endDepthDm?: number;
}

function resolveMigratedAssignmentId(
  componentType: "BIT" | "REAMER",
  serialNumber: string | null,
  holeId: string,
  runStartDepthDm: number,
  candidates: readonly RunAssignmentMigrationCandidate[],
): string | null {
  if (serialNumber === null) return null;
  const normalisedSerial = serialNumber.trim().toLocaleUpperCase("en-AU");
  const matches = candidates.filter(
    (candidate) =>
      candidate.componentType === componentType &&
      candidate.holeId === holeId &&
      candidate.serialNumber.trim().toLocaleUpperCase("en-AU") ===
        normalisedSerial &&
      candidate.startDepthDm <= runStartDepthDm &&
      (candidate.endDepthDm === undefined ||
        candidate.endDepthDm > runStartDepthDm),
  );
  return matches.length === 1 ? matches[0].assignmentId : null;
}

function migratedComponentSnapshots(
  legacy: {
    readonly activeBitSerialNumberSnapshot?: string | null;
    readonly activeReamerSerialNumberSnapshot?: string | null;
  },
  holeId: string,
  runStartDepthDm: number,
  candidates: readonly RunAssignmentMigrationCandidate[],
) {
  const activeBitSerialNumberSnapshot =
    legacy.activeBitSerialNumberSnapshot ?? null;
  const activeReamerSerialNumberSnapshot =
    legacy.activeReamerSerialNumberSnapshot ?? null;
  return {
    activeBitAssignmentId: resolveMigratedAssignmentId(
      "BIT",
      activeBitSerialNumberSnapshot,
      holeId,
      runStartDepthDm,
      candidates,
    ),
    activeReamerAssignmentId: resolveMigratedAssignmentId(
      "REAMER",
      activeReamerSerialNumberSnapshot,
      holeId,
      runStartDepthDm,
      candidates,
    ),
    activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot,
    casingSummarySnapshot: null,
  };
}

function migrateLegacyDraft(
  legacy: z.infer<typeof legacyRunDraftEnvelopeSchema>,
): RunDraftEnvelope {
  return runDraftEnvelopeSchema.parse({
    version: RUN_DRAFT_VERSION,
    holeId: legacy.holeId,
    syncStatus: legacy.syncStatus,
    savedAt: legacy.savedAt,
    payload: {
      localId: `legacy-run-${encodeURIComponent(legacy.holeId)}-${legacy.payload.context.runNumber}`,
      startedAt: legacy.savedAt,
      startedShiftId: LEGACY_SHIFT_ID,
      startedByUserId: LEGACY_USER_ID,
      startedByNameSnapshot: LEGACY_USER_NAME,
      context: {
        runNumber: legacy.payload.context.runNumber,
        rodNumber: legacy.payload.context.rodNumber,
        currentRodStringDm:
          legacy.payload.context.currentRodStringDecimetres,
        previousCompletedDepthDm:
          legacy.payload.context.previousCompletedDepthDecimetres,
      },
      pendingRodEvents: legacy.payload.pendingRodEvents.map((event, index) => ({
        localId: `legacy-pending-rod-${legacy.payload.context.runNumber}-${index + 1}`,
        action: event.action,
        rodLengthDm: event.rodLengthDecimetres,
      })),
      stickUpMetresInput: legacy.payload.stickUpMetres,
      recoveredMetresInput: legacy.payload.recoveredMetres,
      conditionTagIds: legacy.payload.conditionTagIds,
      comment: legacy.payload.comment,
      ...emptyComponentSnapshots,
    },
  });
}

function migrateLegacySavedRun(
  legacy: z.infer<typeof legacySavedRunSnapshotSchema>,
): SavedRunSnapshot {
  const initialRodNumber =
    legacy.rodNumber - legacy.pendingRodEvents.length;

  return withDefaultRunCorrectionFields({
    localId: legacy.localId,
    startedAt: legacy.savedAt,
    completedAt: legacy.savedAt,
    startedShiftId: LEGACY_SHIFT_ID,
    completedShiftId: LEGACY_SHIFT_ID,
    startedByUserId: LEGACY_USER_ID,
    startedByNameSnapshot: LEGACY_USER_NAME,
    completedByUserId: LEGACY_USER_ID,
    completedByNameSnapshot: LEGACY_USER_NAME,
    holeId: legacy.holeId,
    syncStatus: legacy.syncStatus,
    runNumber: legacy.runNumber,
    rodNumber: legacy.rodNumber,
    rodStringDm: legacy.rodStringDecimetres,
    measuredStickUpDm: legacy.measuredStickUpDecimetres,
    previousCompletedDepthDm: legacy.previousCompletedDepthDecimetres,
    holeDepthDm: legacy.holeDepthDecimetres,
    drilledLengthDm: legacy.drilledLengthDecimetres,
    recoveredLengthDm: legacy.recoveredLengthDecimetres,
    recoveryPercentage: legacy.recoveryPercentage,
    rodEvents: legacy.pendingRodEvents.map((event, index) => ({
      localId: `${legacy.localId}-rod-${index + 1}`,
      sequence: index + 1,
      action: event.action,
      rodLengthDm: event.rodLengthDecimetres,
      affectedRodNumber: initialRodNumber + index + 1,
      rodNumberAfterEvent: initialRodNumber + index + 1,
      occurredAt: legacy.savedAt,
    })),
    conditionTagIds: legacy.conditionTagIds,
    comment: legacy.comment,
    ...emptyComponentSnapshots,
  });
}

function migrateV3Draft(
  legacy: z.infer<typeof legacyV3RunDraftEnvelopeSchema>,
  candidates: readonly RunAssignmentMigrationCandidate[],
): RunDraftEnvelope {
  return runDraftEnvelopeSchema.parse({
    ...legacy,
    version: RUN_DRAFT_VERSION,
    payload: {
      ...legacy.payload,
      ...migratedComponentSnapshots(
        legacy.payload,
        legacy.holeId,
        legacy.payload.context.previousCompletedDepthDm,
        candidates,
      ),
    },
  });
}

function migrateV3SavedRun(
  legacy: z.infer<typeof legacyV3SavedRunSnapshotSchema>,
  candidates: readonly RunAssignmentMigrationCandidate[],
): SavedRunSnapshot {
  return withDefaultRunCorrectionFields({
    ...legacy,
    ...migratedComponentSnapshots(
      legacy,
      legacy.holeId,
      legacy.previousCompletedDepthDm,
      candidates,
    ),
  });
}

function migrateV4SavedRun(
  legacy: z.infer<typeof legacyV4SavedRunSnapshotSchema>,
): SavedRunSnapshot {
  return withDefaultRunCorrectionFields(legacy);
}

function migrateV4Draft(
  legacy: z.infer<typeof legacyV4RunDraftEnvelopeSchema>,
): RunDraftEnvelope {
  return runDraftEnvelopeSchema.parse({
    ...legacy,
    version: RUN_DRAFT_VERSION,
  });
}

function migrateV2Draft(
  legacy: z.infer<typeof legacyV2RunDraftEnvelopeSchema>,
  candidates: readonly RunAssignmentMigrationCandidate[],
): RunDraftEnvelope {
  return runDraftEnvelopeSchema.parse({
    ...legacy,
    version: RUN_DRAFT_VERSION,
    payload: {
      ...legacy.payload,
      startedShiftId: LEGACY_SHIFT_ID,
      startedByUserId: LEGACY_USER_ID,
      startedByNameSnapshot: LEGACY_USER_NAME,
      ...migratedComponentSnapshots(
        legacy.payload,
        legacy.holeId,
        legacy.payload.context.previousCompletedDepthDm,
        candidates,
      ),
    },
  });
}

function migrateV2SavedRun(
  legacy: z.infer<typeof legacyV2SavedRunSnapshotSchema>,
  candidates: readonly RunAssignmentMigrationCandidate[],
): SavedRunSnapshot {
  return withDefaultRunCorrectionFields({
    ...legacy,
    startedShiftId: LEGACY_SHIFT_ID,
    completedShiftId: LEGACY_SHIFT_ID,
    startedByUserId: LEGACY_USER_ID,
    startedByNameSnapshot: LEGACY_USER_NAME,
    completedByUserId: LEGACY_USER_ID,
    completedByNameSnapshot: LEGACY_USER_NAME,
    ...migratedComponentSnapshots(
      legacy,
      legacy.holeId,
      legacy.previousCompletedDepthDm,
      candidates,
    ),
  });
}

function envelopeFromMigratedSnapshots(
  holeId: string,
  updatedAt: string,
  snapshots: readonly SavedRunSnapshot[],
): SavedRunsEnvelope {
  return savedRunsEnvelopeSchema.parse({
    ...emptySavedRunsEnvelope(holeId, updatedAt),
    snapshots,
  });
}

export function readRunDraft(
  storage: LocalStorageAdapter,
  holeId: string,
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
): DraftReadResult {
  let currentRaw: string | null;
  let v4Raw: string | null;
  let v3Raw: string | null;
  let v2Raw: string | null;
  let v1Raw: string | null;

  try {
    currentRaw = storage.getItem(runDraftKey(holeId));
    v4Raw =
      currentRaw === null ? storage.getItem(legacyV4RunDraftKey(holeId)) : null;
    v3Raw =
      currentRaw === null && v4Raw === null
        ? storage.getItem(legacyV3RunDraftKey(holeId))
        : null;
    v2Raw =
      currentRaw === null && v4Raw === null && v3Raw === null
        ? storage.getItem(legacyV2RunDraftKey(holeId))
        : null;
    v1Raw =
      currentRaw === null &&
      v4Raw === null &&
      v3Raw === null &&
      v2Raw === null
        ? storage.getItem(legacyRunDraftKey(holeId))
        : null;
  } catch {
    return { status: "invalid", reason: "Browser storage is unavailable." };
  }

  if (
    currentRaw === null &&
    v4Raw === null &&
    v3Raw === null &&
    v2Raw === null &&
    v1Raw === null
  ) {
    return { status: "empty" };
  }

  try {
    const parsed =
      currentRaw !== null
        ? runDraftEnvelopeSchema.safeParse(parseJson(currentRaw))
        : v4Raw !== null
          ? legacyV4RunDraftEnvelopeSchema.safeParse(parseJson(v4Raw))
          : v3Raw !== null
            ? legacyV3RunDraftEnvelopeSchema.safeParse(parseJson(v3Raw))
            : v2Raw !== null
              ? legacyV2RunDraftEnvelopeSchema.safeParse(parseJson(v2Raw))
              : legacyRunDraftEnvelopeSchema.safeParse(parseJson(v1Raw!));
    if (!parsed.success || parsed.data.holeId !== holeId) {
      return {
        status: "invalid",
        reason: "The saved draft is incompatible or belongs to another hole.",
      };
    }

    const envelope =
      parsed.data.version === RUN_DRAFT_VERSION
        ? parsed.data
        : parsed.data.version === LEGACY_V4_RUN_DRAFT_VERSION
          ? migrateV4Draft(parsed.data)
          : parsed.data.version === 3
            ? migrateV3Draft(parsed.data, migrationCandidates)
            : parsed.data.version === 2
              ? migrateV2Draft(parsed.data, migrationCandidates)
              : migrateLegacyDraft(parsed.data);
    return {
      status: "valid",
      envelope,
    };
  } catch {
    return { status: "invalid", reason: "The saved draft is not valid JSON." };
  }
}

export function writeRunDraft(
  storage: LocalStorageAdapter,
  holeId: string,
  payload: RunDraftPayload,
  savedAt = new Date().toISOString(),
): PersistenceResult {
  const envelope = runDraftEnvelopeSchema.safeParse({
    version: RUN_DRAFT_VERSION,
    holeId,
    syncStatus: DRAFT_SYNC_STATUS,
    savedAt,
    payload,
  });

  if (!envelope.success) {
    return { ok: false, reason: "Draft values did not pass validation." };
  }

  try {
    storage.setItem(runDraftKey(holeId), JSON.stringify(envelope.data));
    storage.removeItem(legacyRunDraftKey(holeId));
    storage.removeItem(legacyV2RunDraftKey(holeId));
    storage.removeItem(legacyV3RunDraftKey(holeId));
    storage.removeItem(legacyV4RunDraftKey(holeId));
    return { ok: true };
  } catch {
    return { ok: false, reason: "This browser could not save the draft." };
  }
}

export function clearRunDraft(
  storage: LocalStorageAdapter,
  holeId: string,
): PersistenceResult {
  try {
    storage.removeItem(runDraftKey(holeId));
    storage.removeItem(legacyRunDraftKey(holeId));
    storage.removeItem(legacyV2RunDraftKey(holeId));
    storage.removeItem(legacyV3RunDraftKey(holeId));
    storage.removeItem(legacyV4RunDraftKey(holeId));
    return { ok: true };
  } catch {
    return { ok: false, reason: "This browser could not clear the draft." };
  }
}

export function readSavedRunSnapshots(
  storage: LocalStorageAdapter,
  holeId: string,
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
): SavedRunsReadResult {
  let currentRaw: string | null;
  let v4Raw: string | null;
  let v3Raw: string | null;
  let v2Raw: string | null;
  let v1Raw: string | null;

  try {
    currentRaw = storage.getItem(savedRunsKey(holeId));
    v4Raw =
      currentRaw === null ? storage.getItem(legacyV4SavedRunsKey(holeId)) : null;
    v3Raw =
      currentRaw === null && v4Raw === null
        ? storage.getItem(legacyV3SavedRunsKey(holeId))
        : null;
    v2Raw =
      currentRaw === null && v4Raw === null && v3Raw === null
        ? storage.getItem(legacyV2SavedRunsKey(holeId))
        : null;
    v1Raw =
      currentRaw === null &&
      v4Raw === null &&
      v3Raw === null &&
      v2Raw === null
        ? storage.getItem(legacySavedRunsKey(holeId))
        : null;
  } catch {
    return { status: "invalid", reason: "Browser storage is unavailable." };
  }

  if (
    currentRaw === null &&
    v4Raw === null &&
    v3Raw === null &&
    v2Raw === null &&
    v1Raw === null
  ) {
    return { status: "empty", snapshots: [] };
  }

  try {
    if (currentRaw !== null) {
      const current = savedRunsEnvelopeSchema.safeParse(parseJson(currentRaw));
      if (!current.success || current.data.holeId !== holeId) {
        return {
          status: "invalid",
          reason:
            "Existing locally saved runs are incompatible and were left unchanged.",
        };
      }
      return {
        status: "valid",
        snapshots: current.data.snapshots,
        envelope: current.data,
      };
    }

    if (v4Raw !== null) {
      const v4 = legacyV4SavedRunsEnvelopeSchema.safeParse(parseJson(v4Raw));
      if (!v4.success || v4.data.holeId !== holeId) {
        return {
          status: "invalid",
          reason:
            "Existing locally saved runs are incompatible and were left unchanged.",
        };
      }
      const envelope = envelopeFromMigratedSnapshots(
        holeId,
        v4.data.updatedAt,
        v4.data.snapshots.map(migrateV4SavedRun),
      );
      return { status: "valid", snapshots: envelope.snapshots, envelope };
    }

    if (v3Raw !== null) {
      const v3 = legacyV3SavedRunsEnvelopeSchema.safeParse(parseJson(v3Raw));
      if (!v3.success || v3.data.holeId !== holeId) {
        return {
          status: "invalid",
          reason:
            "Existing locally saved runs are incompatible and were left unchanged.",
        };
      }
      const envelope = envelopeFromMigratedSnapshots(
        holeId,
        v3.data.updatedAt,
        v3.data.snapshots.map((snapshot) =>
          migrateV3SavedRun(snapshot, migrationCandidates),
        ),
      );
      return { status: "valid", snapshots: envelope.snapshots, envelope };
    }

    if (v2Raw !== null) {
      const v2 = legacyV2SavedRunsEnvelopeSchema.safeParse(parseJson(v2Raw));
      if (!v2.success || v2.data.holeId !== holeId) {
        return {
          status: "invalid",
          reason:
            "Existing locally saved runs are incompatible and were left unchanged.",
        };
      }
      const envelope = envelopeFromMigratedSnapshots(
        holeId,
        v2.data.updatedAt,
        v2.data.snapshots.map((snapshot) =>
          migrateV2SavedRun(snapshot, migrationCandidates),
        ),
      );
      return { status: "valid", snapshots: envelope.snapshots, envelope };
    }

    const legacy = legacySavedRunsEnvelopeSchema.safeParse(parseJson(v1Raw!));
    if (!legacy.success || legacy.data.holeId !== holeId) {
      return {
        status: "invalid",
        reason:
          "Existing locally saved runs are incompatible and were left unchanged.",
      };
    }
    const envelope = envelopeFromMigratedSnapshots(
      holeId,
      legacy.data.updatedAt,
      legacy.data.snapshots.map(migrateLegacySavedRun),
    );
    return { status: "valid", snapshots: envelope.snapshots, envelope };
  } catch {
    return {
      status: "invalid",
      reason: "Existing locally saved runs are not valid JSON.",
    };
  }
}

export function writeSavedRunsEnvelope(
  storage: LocalStorageAdapter,
  holeId: string,
  envelope: SavedRunsEnvelope,
): PersistenceResult {
  const parsed = savedRunsEnvelopeSchema.safeParse({
    ...envelope,
    version: RUN_DRAFT_VERSION,
    holeId,
  });
  if (!parsed.success || parsed.data.holeId !== holeId) {
    return { ok: false, reason: "The saved runs envelope did not pass validation." };
  }
  try {
    storage.setItem(savedRunsKey(holeId), JSON.stringify(parsed.data));
    storage.removeItem(legacySavedRunsKey(holeId));
    storage.removeItem(legacyV2SavedRunsKey(holeId));
    storage.removeItem(legacyV3SavedRunsKey(holeId));
    storage.removeItem(legacyV4SavedRunsKey(holeId));
    return { ok: true };
  } catch {
    return { ok: false, reason: "This browser could not save the runs." };
  }
}

export function appendSavedRunSnapshot(
  storage: LocalStorageAdapter,
  holeId: string,
  snapshot: SavedRunSnapshot,
): SaveRunResult {
  const snapshotResult = savedRunSnapshotSchema.safeParse(
    withDefaultRunCorrectionFields(snapshot),
  );
  if (!snapshotResult.success || snapshotResult.data.holeId !== holeId) {
    return { ok: false, reason: "The run snapshot did not pass validation." };
  }

  try {
    const existing = readSavedRunSnapshots(storage, holeId);
    if (existing.status === "invalid") {
      return { ok: false, reason: existing.reason };
    }

    const base =
      existing.status === "valid"
        ? existing.envelope
        : emptySavedRunsEnvelope(holeId, snapshotResult.data.completedAt);
    const snapshots = base.snapshots;
    const sameLocalId = snapshots.find(
      ({ localId }) => localId === snapshotResult.data.localId,
    );
    if (sameLocalId !== undefined) {
      return JSON.stringify(sameLocalId) === JSON.stringify(snapshotResult.data)
        ? { ok: true, status: "already-saved" }
        : {
            ok: false,
            reason:
              "The local run identifier is already used by different saved data.",
          };
    }

    if (
      snapshots.some(
        (item) =>
          item.runNumber === snapshotResult.data.runNumber &&
          isOperationalRunSnapshot(item),
      )
    ) {
      return {
        ok: false,
        reason: `Run ${snapshotResult.data.runNumber} is already saved locally.`,
      };
    }

    const envelope = savedRunsEnvelopeSchema.parse({
      ...base,
      version: RUN_DRAFT_VERSION,
      holeId,
      syncStatus: DRAFT_SYNC_STATUS,
      updatedAt: snapshotResult.data.completedAt,
      revision: base.revision + 1,
      snapshots: [...snapshots, snapshotResult.data],
    });

    const written = writeSavedRunsEnvelope(storage, holeId, envelope);
    if (!written.ok) {
      return { ok: false, reason: written.reason };
    }
    return { ok: true, status: "saved" };
  } catch {
    return { ok: false, reason: "This browser could not save the run." };
  }
}
