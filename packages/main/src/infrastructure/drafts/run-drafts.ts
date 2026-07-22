import { z } from "zod";

import type { LocalStorageAdapter } from "./storage";

export const RUN_DRAFT_VERSION = 4 as const;
export const DRAFT_SYNC_STATUS = "local-only" as const;
const LEGACY_SHIFT_ID = "legacy-unassigned-shift";
const LEGACY_USER_ID = "legacy-local-user";
const LEGACY_USER_NAME = "Legacy local operator";

const isoTimestampSchema = z.string().datetime();
const rodLengthDmSchema = z.union([z.literal(30), z.literal(60)]);
const rodEventActionSchema = z.union([z.literal("add"), z.literal("remove")]);

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

export const savedRunSnapshotSchema = z.object({
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
  drilledLengthDm: z.number().int().positive(),
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

const savedRunsEnvelopeSchema = z.object({
  version: z.literal(RUN_DRAFT_VERSION),
  holeId: z.string().min(1),
  syncStatus: z.literal(DRAFT_SYNC_STATUS),
  updatedAt: isoTimestampSchema,
  snapshots: z.array(savedRunSnapshotSchema),
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

const legacyV3SavedRunSnapshotSchema = savedRunSnapshotSchema
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
export type SavedRunSnapshot = z.infer<typeof savedRunSnapshotSchema>;
export type SavedRunsEnvelope = z.infer<typeof savedRunsEnvelopeSchema>;

export type DraftReadResult =
  | { readonly status: "empty" }
  | { readonly status: "valid"; readonly envelope: RunDraftEnvelope }
  | { readonly status: "invalid"; readonly reason: string };

export type SavedRunsReadResult =
  | { readonly status: "empty"; readonly snapshots: readonly [] }
  | {
      readonly status: "valid";
      readonly snapshots: readonly SavedRunSnapshot[];
    }
  | { readonly status: "invalid"; readonly reason: string };

export type PersistenceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type SaveRunResult =
  | { readonly ok: true; readonly status: "saved" | "already-saved" }
  | { readonly ok: false; readonly reason: string };

export function latestSavedRunSnapshot(
  snapshots: readonly SavedRunSnapshot[],
): SavedRunSnapshot | undefined {
  return snapshots.reduce<SavedRunSnapshot | undefined>(
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

function scopedKey(
  version: 1 | 2 | 3 | typeof RUN_DRAFT_VERSION,
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

  return savedRunSnapshotSchema.parse({
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
  return savedRunSnapshotSchema.parse({
    ...legacy,
    ...migratedComponentSnapshots(
      legacy,
      legacy.holeId,
      legacy.previousCompletedDepthDm,
      candidates,
    ),
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
  return savedRunSnapshotSchema.parse({
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

export function readRunDraft(
  storage: LocalStorageAdapter,
  holeId: string,
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
): DraftReadResult {
  let currentRaw: string | null;
  let v3Raw: string | null;
  let v2Raw: string | null;
  let v1Raw: string | null;

  try {
    currentRaw = storage.getItem(runDraftKey(holeId));
    v3Raw =
      currentRaw === null ? storage.getItem(legacyV3RunDraftKey(holeId)) : null;
    v2Raw =
      currentRaw === null && v3Raw === null
        ? storage.getItem(legacyV2RunDraftKey(holeId))
        : null;
    v1Raw =
      currentRaw === null && v3Raw === null && v2Raw === null
        ? storage.getItem(legacyRunDraftKey(holeId))
        : null;
  } catch {
    return { status: "invalid", reason: "Browser storage is unavailable." };
  }

  if (
    currentRaw === null &&
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
  let v3Raw: string | null;
  let v2Raw: string | null;
  let v1Raw: string | null;

  try {
    currentRaw = storage.getItem(savedRunsKey(holeId));
    v3Raw =
      currentRaw === null ? storage.getItem(legacyV3SavedRunsKey(holeId)) : null;
    v2Raw =
      currentRaw === null && v3Raw === null
        ? storage.getItem(legacyV2SavedRunsKey(holeId))
        : null;
    v1Raw =
      currentRaw === null && v3Raw === null && v2Raw === null
        ? storage.getItem(legacySavedRunsKey(holeId))
        : null;
  } catch {
    return { status: "invalid", reason: "Browser storage is unavailable." };
  }

  if (
    currentRaw === null &&
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
      return { status: "valid", snapshots: current.data.snapshots };
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
      return {
        status: "valid",
        snapshots: v3.data.snapshots.map((snapshot) =>
          migrateV3SavedRun(snapshot, migrationCandidates),
        ),
      };
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
      return {
        status: "valid",
        snapshots: v2.data.snapshots.map((snapshot) =>
          migrateV2SavedRun(snapshot, migrationCandidates),
        ),
      };
    }

    const legacy = legacySavedRunsEnvelopeSchema.safeParse(parseJson(v1Raw!));
    if (!legacy.success || legacy.data.holeId !== holeId) {
      return {
        status: "invalid",
        reason:
          "Existing locally saved runs are incompatible and were left unchanged.",
      };
    }
    return {
      status: "valid",
      snapshots: legacy.data.snapshots.map(migrateLegacySavedRun),
    };
  } catch {
    return {
      status: "invalid",
      reason: "Existing locally saved runs are not valid JSON.",
    };
  }
}

export function appendSavedRunSnapshot(
  storage: LocalStorageAdapter,
  holeId: string,
  snapshot: SavedRunSnapshot,
): SaveRunResult {
  const snapshotResult = savedRunSnapshotSchema.safeParse(snapshot);
  if (!snapshotResult.success || snapshotResult.data.holeId !== holeId) {
    return { ok: false, reason: "The run snapshot did not pass validation." };
  }

  try {
    const existing = readSavedRunSnapshots(storage, holeId);
    if (existing.status === "invalid") {
      return { ok: false, reason: existing.reason };
    }

    const snapshots = existing.snapshots;
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
        ({ runNumber }) => runNumber === snapshotResult.data.runNumber,
      )
    ) {
      return {
        ok: false,
        reason: `Run ${snapshotResult.data.runNumber} is already saved locally.`,
      };
    }

    const envelope = savedRunsEnvelopeSchema.parse({
      version: RUN_DRAFT_VERSION,
      holeId,
      syncStatus: DRAFT_SYNC_STATUS,
      updatedAt: snapshotResult.data.completedAt,
      snapshots: [...snapshots, snapshotResult.data],
    });

    storage.setItem(savedRunsKey(holeId), JSON.stringify(envelope));
    storage.removeItem(legacySavedRunsKey(holeId));
    storage.removeItem(legacyV2SavedRunsKey(holeId));
    storage.removeItem(legacyV3SavedRunsKey(holeId));
    return { ok: true, status: "saved" };
  } catch {
    return { ok: false, reason: "This browser could not save the run." };
  }
}
