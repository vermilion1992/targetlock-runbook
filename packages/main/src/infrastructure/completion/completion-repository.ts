import { z } from "zod";

import {
  HOLE_COMPLETION_REASONS,
  HOLE_COMPLETION_TRANSACTION_STAGES,
  HOLE_STATUSES,
  HoleLockedError,
  assertHoleUnlocked,
  decimetres,
  normalizeHoleStatus,
  type Hole,
  type HoleCompletionCheck,
  type HoleCompletionComponentOutcome,
  type HoleCompletionDisposition,
  type HoleCompletionRecord,
  type HoleCompletionReview,
  type HoleCompletionReviewStatus,
  type HoleCompletionTransaction,
  type HoleCompletionTransactionStage,
  type HoleReopenRecord,
  type HoleStatus,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";

const COMPLETION_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const EPOCH = new Date(0).toISOString();

const isoTimestampSchema = z.string().datetime();
const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const persistedStatusSchema = z.enum([
  ...HOLE_STATUSES,
  "planned",
  "drilling",
  "suspended",
  "completed",
]);
const dispositionSchema = z.enum(["COMPLETED", "ABANDONED"]);
const completionReasonSchema = z.enum(HOLE_COMPLETION_REASONS);
const completionStageSchema = z.enum(HOLE_COMPLETION_TRANSACTION_STAGES);
const depthSchema = z.number().int().nonnegative();

const metadataShape = {
  localId: z.string().trim().min(1),
  serverId: z.string().trim().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deviceId: z.string().trim().min(1),
  version: z.number().int().positive(),
};

const holeSchema = z
  .object({
    ...metadataShape,
    projectId: z.string().trim().min(1),
    rigId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    holeSize: z.enum(["PQ", "HQ", "NQ", "BQ"]),
    plannedDepth: depthSchema,
    currentDepth: depthSchema,
    status: persistedStatusSchema,
    collarEasting: z.number().finite(),
    collarNorthing: z.number().finite(),
    collarElevation: z.number().finite(),
  })
  .strict();

const completionCheckCodeSchema = z.enum([
  "FINAL_DEPTH_AVAILABLE",
  "FINAL_DEPTH_RECONCILED",
  "RUNS_FINISHED",
  "RUN_NUMBERS_UNIQUE",
  "RUN_SEQUENCE_COMPLETE",
  "RUN_DEPTH_GAPS",
  "RUN_DEPTH_OVERLAPS",
  "RUN_LENGTHS_POSITIVE",
  "RUN_DEPTHS_RECONCILED",
  "ROD_CONFIGURATION_VALID",
  "ROD_FIELDS_COMPLETE",
  "ROD_EVENTS_SETTLED",
  "SHIFTS_CLOSED",
  "HANDOVERS_RESOLVED",
  "CASING_VALID",
  "CASING_REVIEWED",
  "COMPONENTS_RESOLVED",
  "FINAL_SURVEY_RESOLVED",
  "FINAL_SURVEY_UNAVAILABLE",
  "TRAYS_RECONCILED",
  "FINAL_PARTIAL_TRAY",
  "MEDIA_SETTLED",
  "CORRECTIONS_SETTLED",
  "COMPLETION_REASON_PROVIDED",
  "COMPLETION_COMMENT_PROVIDED",
]);

const completionCheckSchema = z
  .object({
    code: completionCheckCodeSchema,
    label: z.string().trim().min(1),
    classification: z.enum(["BLOCKING", "ADVISORY"]),
    status: z.enum(["PASS", "FAIL"]),
    message: z.string(),
    entityIds: z.array(z.string().trim().min(1)).optional(),
    amountDm: depthSchema.optional(),
  })
  .strict();

const componentOutcomeBaseShape = {
  assignmentId: z.string().trim().min(1),
  componentId: z.string().trim().min(1),
  componentType: z.enum(["BIT", "REAMER"]),
  comment: z.string().trim().min(1).max(2_000).optional(),
};
const componentOutcomeSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      ...componentOutcomeBaseShape,
      outcome: z.enum([
        "SERVICEABLE",
        "UNDER_INSPECTION",
        "RETIRED",
        "LOST_DOWNHOLE",
      ]),
      targetHoleId: z.never().optional(),
    })
    .strict(),
  z
    .object({
      ...componentOutcomeBaseShape,
      outcome: z.literal("CARRIED_FORWARD"),
      targetHoleId: z.string().trim().min(1).optional(),
    })
    .strict(),
]);

const warningAcknowledgementSchema = z
  .object({
    checkCode: completionCheckCodeSchema,
    reason: z.string().trim().min(1).max(2_000),
    acknowledgedAt: isoTimestampSchema,
    acknowledgedByUserId: z.string().trim().min(1),
    acknowledgedByNameSnapshot: z.string().trim().min(1),
  })
  .strict();

const finalSurveyResolutionSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("RECORDED"),
      surveyId: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal("UNAVAILABLE"),
      reason: z.string().trim().min(1).max(2_000),
    })
    .strict(),
]);

const reviewStatusSchema = z.enum([
  "DRAFT",
  "BLOCKED",
  "READY",
  "COMPLETING",
  "COMPLETED",
  "CANCELLED",
]);

const completionReviewSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().trim().min(1),
    reviewStatus: reviewStatusSchema,
    disposition: dispositionSchema.optional(),
    reason: completionReasonSchema.optional(),
    comment: z.string().trim().min(1).max(5_000).optional(),
    finalSurveyResolution: finalSurveyResolutionSchema.optional(),
    checklist: z.array(completionCheckSchema),
    componentOutcomes: z.array(componentOutcomeSchema),
    warningAcknowledgements: z.array(warningAcknowledgementSchema),
    startedByUserId: z.string().trim().min(1),
    startedByNameSnapshot: z.string().trim().min(1),
    startedAt: isoTimestampSchema,
  })
  .strict();

const completionSnapshotSchema = z
  .object({
    holeId: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    projectNameSnapshot: z.string().trim().min(1),
    rigId: z.string().trim().min(1),
    rigNameSnapshot: z.string().trim().min(1),
    finalStatus: dispositionSchema,
    finalDepthDm: depthSchema,
    plannedDepthDm: depthSchema,
    finalRunNumber: z.number().int().nonnegative(),
    runIds: z.array(z.string().trim().min(1)),
    finalRodNumber: z.number().int().nonnegative(),
    currentRodStringDm: depthSchema,
    measuredStickUpDm: depthSchema,
    bottomHoleAssemblyLengthDm: depthSchema,
    constantStickUpDm: depthSchema,
    baseRodStringDm: depthSchema,
    rodStringConfigurationId: z.string().trim().min(1),
    finalShiftId: z.string().trim().min(1).optional(),
    finalShiftLabel: z.string().trim().min(1).optional(),
    casingSummary: z.string().nullable(),
    finalBitSummary: z.string().trim().min(1).optional(),
    finalReamerSummary: z.string().trim().min(1).optional(),
    finalSurveyId: z.string().trim().min(1).optional(),
    finalSurveyUnavailableReason: z.string().trim().min(1).optional(),
    finalTrayId: z.string().trim().min(1).optional(),
    finalPartialTrayConfirmed: z.boolean(),
    surveyCount: z.number().int().nonnegative(),
    trayCount: z.number().int().nonnegative(),
    totalRuns: z.number().int().nonnegative(),
    totalDrilledDm: depthSchema,
    totalRecoveredDm: depthSchema,
    totalLossDm: depthSchema,
    totalGainDm: depthSchema,
    overallRecoveryPercentTenths: z.number().int().nonnegative(),
    reason: completionReasonSchema,
    comment: z.string().trim().min(1).max(5_000).optional(),
    checklist: z.array(completionCheckSchema),
    componentOutcomes: z.array(componentOutcomeSchema),
    warningAcknowledgements: z.array(warningAcknowledgementSchema),
    completedByUserId: z.string().trim().min(1),
    completedByNameSnapshot: z.string().trim().min(1),
    capturedAt: isoTimestampSchema,
  })
  .strict();

const completionRecordSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().trim().min(1),
    reviewId: z.string().trim().min(1),
    finalStatus: dispositionSchema,
    completedAt: isoTimestampSchema,
    completedByUserId: z.string().trim().min(1),
    completedByNameSnapshot: z.string().trim().min(1),
    snapshot: completionSnapshotSchema,
    operationId: z.string().trim().min(1),
  })
  .strict();

const reopenRecordSchema = z
  .object({
    ...metadataShape,
    holeId: z.string().trim().min(1),
    completionRecordId: z.string().trim().min(1),
    previousStatus: dispositionSchema,
    reopenedStatus: z.literal("ACTIVE"),
    reason: z.string().trim().min(1).max(2_000),
    comment: z.string().trim().min(1).max(5_000).optional(),
    reopenedAt: isoTimestampSchema,
    reopenedByUserId: z.string().trim().min(1),
    reopenedByNameSnapshot: z.string().trim().min(1),
    operationId: z.string().trim().min(1),
  })
  .strict();

const transactionSchema = z
  .object({
    operationId: z.string().trim().min(1),
    holeId: z.string().trim().min(1),
    reviewId: z.string().trim().min(1),
    stage: completionStageSchema,
    completedStages: z.array(completionStageSchema),
    startedAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    lastError: z.string().trim().min(1).optional(),
    fingerprint: z.string().min(1),
  })
  .strict();

const storedOperationSchema = z
  .object({
    operationId: z.string().trim().min(1),
    kind: z.enum([
      "CREATE_HOLE",
      "BEGIN_REVIEW",
      "SAVE_REVIEW",
      "COMMIT_COMPLETION",
      "REOPEN_HOLE",
    ]),
    fingerprint: z.string().min(1),
    holeId: z.string().trim().min(1),
    resultId: z.string().trim().min(1),
    completedAt: isoTimestampSchema,
  })
  .strict();

const completionEnvelopeSchema = z
  .object({
    version: z.literal(COMPLETION_STORAGE_VERSION),
    organisationId: z.string().trim().min(1),
    revision: z.number().int().nonnegative(),
    updatedAt: isoTimestampSchema,
    holes: z.array(holeSchema),
    reviews: z.array(completionReviewSchema),
    completions: z.array(completionRecordSchema),
    reopens: z.array(reopenRecordSchema),
    transactions: z.array(transactionSchema),
    operations: z.array(storedOperationSchema),
  })
  .strict();

type CompletionEnvelope = z.infer<typeof completionEnvelopeSchema>;
type StoredTransaction = z.infer<typeof transactionSchema>;
type StoredOperation = z.infer<typeof storedOperationSchema>;

export type CanonicalHole = Omit<Hole, "status"> & {
  readonly status: HoleStatus;
};

export interface CompletionRepositorySeed {
  readonly holes: readonly Hole[];
  readonly reviews?: readonly HoleCompletionReview[];
  readonly completions?: readonly HoleCompletionRecord[];
  readonly reopens?: readonly HoleReopenRecord[];
  readonly transactions?: readonly HoleCompletionTransaction[];
}

export interface BeginReviewInput {
  readonly operationId: string;
  readonly reviewId: string;
  readonly holeId: string;
  readonly expectedHoleVersion: number;
  readonly startedAt: string;
  readonly startedByUserId: string;
  readonly startedByNameSnapshot: string;
  readonly reviewStatus?: Extract<
    HoleCompletionReviewStatus,
    "DRAFT" | "BLOCKED" | "READY"
  >;
  readonly disposition?: HoleCompletionDisposition;
  readonly reason?: HoleCompletionReview["reason"];
  readonly comment?: string;
  readonly finalSurveyResolution?: HoleCompletionReview["finalSurveyResolution"];
  readonly checklist?: readonly HoleCompletionCheck[];
  readonly componentOutcomes?: readonly HoleCompletionComponentOutcome[];
  readonly warningAcknowledgements?: HoleCompletionReview["warningAcknowledgements"];
}

export interface SaveReviewDraftInput {
  readonly operationId: string;
  readonly reviewId: string;
  readonly holeId: string;
  readonly expectedVersion: number;
  readonly savedAt: string;
  readonly reviewStatus?: Extract<
    HoleCompletionReviewStatus,
    "DRAFT" | "BLOCKED" | "READY" | "COMPLETING"
  >;
  readonly disposition?: HoleCompletionDisposition;
  readonly reason?: HoleCompletionReview["reason"];
  readonly comment?: string;
  readonly finalSurveyResolution?: HoleCompletionReview["finalSurveyResolution"];
  readonly checklist?: readonly HoleCompletionCheck[];
  readonly componentOutcomes?: readonly HoleCompletionComponentOutcome[];
  readonly warningAcknowledgements?: HoleCompletionReview["warningAcknowledgements"];
}

export interface BeginCompletionOperationInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly reviewId: string;
  readonly startedAt: string;
  /**
   * A caller-provided canonical command fingerprint may include data owned by
   * other repositories. When omitted, the stable local identifiers are used.
   */
  readonly fingerprint?: string;
}

export interface AdvanceCompletionOperationInput {
  readonly operationId: string;
  readonly stage: HoleCompletionTransactionStage;
  readonly updatedAt: string;
  readonly lastError?: string;
}

export interface LockHoleInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly completionRecordId: string;
  readonly expectedHoleVersion: number;
  readonly lockedAt?: string;
}

export interface CommitCompletionInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly completionRecordId: string;
  readonly committedAt?: string;
}

export interface ReopenHoleInput {
  readonly operationId: string;
  readonly reopenRecordId: string;
  readonly holeId: string;
  readonly completionRecordId?: string;
  readonly expectedHoleVersion: number;
  readonly reason: string;
  readonly comment?: string;
  readonly reopenedAt: string;
  readonly reopenedByUserId: string;
  readonly reopenedByNameSnapshot: string;
}

export interface CompletionHistoryEntry {
  readonly completion: HoleCompletionRecord;
  readonly superseded: boolean;
  readonly reopened: boolean;
  readonly reopenRecord: HoleReopenRecord | null;
}

export interface CompletedHoleIndexEntry {
  readonly hole: CanonicalHole;
  readonly status: HoleCompletionDisposition;
  readonly completion: HoleCompletionRecord;
}

export interface CompletedHoleFilters {
  readonly status?: HoleCompletionDisposition;
  readonly projectId?: string;
  readonly search?: string;
}

export interface HoleLifecycleState {
  readonly hole: CanonicalHole;
  readonly status: HoleStatus;
  readonly currentReview: HoleCompletionReview | null;
  readonly latestCompletion: HoleCompletionRecord | null;
  readonly completionHistory: readonly CompletionHistoryEntry[];
  readonly reopenHistory: readonly HoleReopenRecord[];
  readonly pendingCompletionOperation: HoleCompletionTransaction | null;
}

export interface HoleLockResult {
  readonly hole: CanonicalHole;
  readonly completion: HoleCompletionRecord;
  readonly transaction: HoleCompletionTransaction | null;
  readonly status: "locked" | "already-locked";
}

export interface CompletionCommitResult {
  readonly hole: CanonicalHole;
  readonly completion: HoleCompletionRecord;
  readonly transaction: HoleCompletionTransaction | null;
  readonly status: "committed" | "already-committed";
}

export interface ReopenHoleResult {
  readonly hole: CanonicalHole;
  readonly completion: HoleCompletionRecord;
  readonly reopenRecord: HoleReopenRecord;
  readonly status: "reopened" | "already-reopened";
}

export type CompletionRepositoryErrorCode =
  | "CORRUPTED_STORAGE"
  | "HOLE_LOCKED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_STATE"
  | "NOT_FOUND"
  | "STALE_VERSION"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_FAILED";

export class CompletionRepositoryError extends Error {
  constructor(
    readonly code: CompletionRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompletionRepositoryError";
  }
}

export interface CreateHoleInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly name: string;
  readonly projectId: string;
  readonly rigId: string;
  readonly holeSize?: Hole["holeSize"];
  readonly plannedDepthDm?: number;
  readonly collarEasting?: number;
  readonly collarNorthing?: number;
  readonly collarElevation?: number;
  readonly createdAt: string;
}

export interface CompletionRepository {
  getLifecycleState(holeId: string): Promise<HoleLifecycleState | null>;
  getStatus(holeId: string): Promise<HoleStatus | null>;
  getLifecycleStatus(holeId: string): Promise<HoleStatus | null>;
  getHole(holeId: string): Promise<CanonicalHole | null>;
  listHoles(): Promise<readonly CanonicalHole[]>;
  createHole(input: CreateHoleInput): Promise<CanonicalHole>;
  getCurrentReview(holeId: string): Promise<HoleCompletionReview | null>;
  getLatestCompletion(holeId: string): Promise<HoleCompletionRecord | null>;
  getCompletionHistory(
    holeId: string,
  ): Promise<readonly HoleCompletionRecord[]>;
  getCompletionHistoryEntries(
    holeId: string,
  ): Promise<readonly CompletionHistoryEntry[]>;
  getReopenHistory(holeId: string): Promise<readonly HoleReopenRecord[]>;
  listCompletedHoles(
    filters?: CompletedHoleFilters,
  ): Promise<readonly CompletedHoleIndexEntry[]>;
  beginReview(input: BeginReviewInput): Promise<HoleCompletionReview>;
  saveReviewDraft(input: SaveReviewDraftInput): Promise<HoleCompletionReview>;
  beginCompletionOperation(
    input: BeginCompletionOperationInput,
  ): Promise<HoleCompletionTransaction>;
  advanceCompletionOperation(
    input: AdvanceCompletionOperationInput,
  ): Promise<HoleCompletionTransaction>;
  persistCompletionRecord(
    record: HoleCompletionRecord,
  ): Promise<HoleCompletionRecord>;
  lockHole(input: LockHoleInput): Promise<HoleLockResult>;
  commitCompletion(input: CommitCompletionInput): Promise<CompletionCommitResult>;
  reopenHole(input: ReopenHoleInput): Promise<ReopenHoleResult>;
  inspectPendingCompletionOperation(
    holeId?: string,
  ): Promise<HoleCompletionTransaction | null>;
  getPendingCompletionOperation(
    holeId?: string,
  ): Promise<HoleCompletionTransaction | null>;
}

export interface HoleMutationSnapshot {
  readonly status: HoleStatus;
  readonly completionRecordId?: string;
}

export interface HoleMutationGuardPort {
  assertHoleMutable(holeId: string): void;
}

export function completionStorageKey(organisationId: string): string {
  return `targetlock:prototype:v${COMPLETION_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:completion`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function asHole(value: z.infer<typeof holeSchema>): CanonicalHole {
  return {
    ...value,
    plannedDepth: decimetres(value.plannedDepth),
    currentDepth: decimetres(value.currentDepth),
    status: normalizeHoleStatus(value.status),
  };
}

function asReview(
  value: z.infer<typeof completionReviewSchema>,
): HoleCompletionReview {
  return {
    ...value,
    checklist: value.checklist.map((check) => ({
      ...check,
      amountDm:
        check.amountDm === undefined ? undefined : decimetres(check.amountDm),
    })),
  } as HoleCompletionReview;
}

function asCompletion(
  value: z.infer<typeof completionRecordSchema>,
): HoleCompletionRecord {
  const snapshot = value.snapshot;
  return {
    ...value,
    snapshot: {
      ...snapshot,
      finalDepthDm: decimetres(snapshot.finalDepthDm),
      plannedDepthDm: decimetres(snapshot.plannedDepthDm),
      currentRodStringDm: decimetres(snapshot.currentRodStringDm),
      measuredStickUpDm: decimetres(snapshot.measuredStickUpDm),
      bottomHoleAssemblyLengthDm: decimetres(
        snapshot.bottomHoleAssemblyLengthDm,
      ),
      constantStickUpDm: decimetres(snapshot.constantStickUpDm),
      baseRodStringDm: decimetres(snapshot.baseRodStringDm),
      totalDrilledDm: decimetres(snapshot.totalDrilledDm),
      totalRecoveredDm: decimetres(snapshot.totalRecoveredDm),
      totalLossDm: decimetres(snapshot.totalLossDm),
      totalGainDm: decimetres(snapshot.totalGainDm),
      checklist: snapshot.checklist.map((check) => ({
        ...check,
        amountDm:
          check.amountDm === undefined ? undefined : decimetres(check.amountDm),
      })),
    },
  } as HoleCompletionRecord;
}

function asReopen(
  value: z.infer<typeof reopenRecordSchema>,
): HoleReopenRecord {
  return value;
}

function asTransaction(value: StoredTransaction): HoleCompletionTransaction {
  const { fingerprint, ...transaction } = value;
  void fingerprint;
  return transaction;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function compareTimestampNewest(
  left: { readonly updatedAt: string },
  right: { readonly updatedAt: string },
): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function completionNewest(
  left: z.infer<typeof completionRecordSchema>,
  right: z.infer<typeof completionRecordSchema>,
): number {
  return (
    Date.parse(right.completedAt) - Date.parse(left.completedAt) ||
    right.localId.localeCompare(left.localId)
  );
}

function reopenNewest(
  left: z.infer<typeof reopenRecordSchema>,
  right: z.infer<typeof reopenRecordSchema>,
): number {
  return (
    Date.parse(right.reopenedAt) - Date.parse(left.reopenedAt) ||
    right.localId.localeCompare(left.localId)
  );
}

function stageIndex(stage: HoleCompletionTransactionStage): number {
  return HOLE_COMPLETION_TRANSACTION_STAGES.indexOf(stage);
}

function storedTransactionAtStage(
  transaction: StoredTransaction,
  stage: HoleCompletionTransactionStage,
  updatedAt: string,
  lastError?: string,
): StoredTransaction {
  return transactionSchema.parse({
    ...transaction,
    stage,
    completedStages: HOLE_COMPLETION_TRANSACTION_STAGES.slice(
      0,
      stageIndex(stage) + 1,
    ),
    updatedAt,
    lastError: optionalText(lastError),
  });
}

function assertEnvelopeInvariants(envelope: CompletionEnvelope): void {
  const identifiers = [
    ["hole", envelope.holes.map(({ localId }) => localId)],
    ["review", envelope.reviews.map(({ localId }) => localId)],
    ["completion", envelope.completions.map(({ localId }) => localId)],
    ["reopen", envelope.reopens.map(({ localId }) => localId)],
    ["transaction", envelope.transactions.map(({ operationId }) => operationId)],
    ["operation", envelope.operations.map(({ operationId }) => operationId)],
  ] as const;
  for (const [name, values] of identifiers) {
    if (!unique(values)) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        `Persisted completion data contains duplicate ${name} identifiers.`,
      );
    }
  }
  if (!unique(envelope.completions.map(({ operationId }) => operationId))) {
    throw new CompletionRepositoryError(
      "CORRUPTED_STORAGE",
      "Persisted completion records contain duplicate operation identifiers.",
    );
  }
  if (!unique(envelope.reopens.map(({ operationId }) => operationId))) {
    throw new CompletionRepositoryError(
      "CORRUPTED_STORAGE",
      "Persisted reopen records contain duplicate operation identifiers.",
    );
  }

  const holes = new Map(envelope.holes.map((hole) => [hole.localId, hole]));
  const reviews = new Map(
    envelope.reviews.map((review) => [review.localId, review]),
  );
  const completions = new Map(
    envelope.completions.map((completion) => [completion.localId, completion]),
  );
  for (const review of envelope.reviews) {
    if (!holes.has(review.holeId)) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "A persisted completion review belongs to an unknown hole.",
      );
    }
  }
  for (const completion of envelope.completions) {
    const review = reviews.get(completion.reviewId);
    if (
      !holes.has(completion.holeId) ||
      review?.holeId !== completion.holeId ||
      completion.snapshot.holeId !== completion.holeId ||
      completion.snapshot.finalStatus !== completion.finalStatus
    ) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "A persisted immutable completion snapshot has inconsistent references.",
      );
    }
  }
  for (const reopen of envelope.reopens) {
    const completion = completions.get(reopen.completionRecordId);
    if (
      completion?.holeId !== reopen.holeId ||
      completion.finalStatus !== reopen.previousStatus
    ) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "A persisted hole reopen record has inconsistent references.",
      );
    }
  }
  for (const transaction of envelope.transactions) {
    if (
      holes.get(transaction.holeId) === undefined ||
      reviews.get(transaction.reviewId)?.holeId !== transaction.holeId ||
      !unique(transaction.completedStages) ||
      transaction.completedStages.some(
        (stage, index) => HOLE_COMPLETION_TRANSACTION_STAGES[index] !== stage,
      ) ||
      transaction.completedStages.at(-1) !== transaction.stage
    ) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "A persisted completion transaction is not a valid ordered lifecycle.",
      );
    }
  }
  for (const operation of envelope.operations) {
    if (!holes.has(operation.holeId)) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "A persisted completion operation belongs to an unknown hole.",
      );
    }
  }
}

export class LocalCompletionRepository implements CompletionRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly organisationId: string,
    private readonly seed: CompletionRepositorySeed = { holes: [] },
  ) {}

  private seedEnvelope(): CompletionEnvelope {
    const transactions = (this.seed.transactions ?? []).map((transaction) => ({
      ...transaction,
      fingerprint: canonicalJson({
        holeId: transaction.holeId,
        reviewId: transaction.reviewId,
      }),
    }));
    const candidate = completionEnvelopeSchema.safeParse({
      version: COMPLETION_STORAGE_VERSION,
      organisationId: this.organisationId,
      revision: 0,
      updatedAt: EPOCH,
      holes: this.seed.holes,
      reviews: this.seed.reviews ?? [],
      completions: this.seed.completions ?? [],
      reopens: this.seed.reopens ?? [],
      transactions,
      operations: [],
    });
    if (!candidate.success) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "Seed completion data did not pass storage validation.",
      );
    }
    const normalized = this.normalizeEnvelope(candidate.data);
    assertEnvelopeInvariants(normalized);
    return normalized;
  }

  private normalizeEnvelope(envelope: CompletionEnvelope): CompletionEnvelope {
    return {
      ...envelope,
      holes: envelope.holes.map((hole) => ({
        ...hole,
        status: normalizeHoleStatus(hole.status),
      })),
    };
  }

  private read(): CompletionEnvelope {
    let raw: string | null;
    try {
      raw = this.storage.getItem(completionStorageKey(this.organisationId));
    } catch {
      throw new CompletionRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return this.seedEnvelope();

    try {
      const parsed = completionEnvelopeSchema.safeParse(
        JSON.parse(raw) as unknown,
      );
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new CompletionRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted completion data is incompatible or belongs to another organisation.",
        );
      }
      const normalized = this.normalizeEnvelope(parsed.data);
      assertEnvelopeInvariants(normalized);
      return normalized;
    } catch (error) {
      if (error instanceof CompletionRepositoryError) throw error;
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted completion data is not valid JSON.",
      );
    }
  }

  assertMutable(holeId: string): void {
    const envelope = this.read();
    const hole = envelope.holes.find((candidate) => candidate.localId === holeId);
    if (hole === undefined) {
      throw new CompletionRepositoryError("NOT_FOUND", "Hole was not found.");
    }
    const status = normalizeHoleStatus(hole.status);
    if (
      status === "COMPLETED" ||
      status === "ABANDONED" ||
      status === "ARCHIVED"
    ) {
      throw new HoleLockedError(
        holeId,
        status,
        this.latestCompletion(envelope, holeId)?.localId,
      );
    }
  }

  private write(envelope: CompletionEnvelope): void {
    const parsed = completionEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Completion values did not pass local persistence validation.",
      );
    }
    assertEnvelopeInvariants(parsed.data);
    try {
      this.storage.setItem(
        completionStorageKey(this.organisationId),
        JSON.stringify(parsed.data),
      );
    } catch {
      throw new CompletionRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save completion data.",
      );
    }
  }

  private operation(
    envelope: CompletionEnvelope,
    operationId: string,
    kind: StoredOperation["kind"],
    fingerprint: string,
  ): StoredOperation | null {
    const existing =
      envelope.operations.find(
        (operation) => operation.operationId === operationId,
      ) ?? null;
    if (
      existing !== null &&
      (existing.kind !== kind || existing.fingerprint !== fingerprint)
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "This operation identifier is already used by different lifecycle data.",
      );
    }
    return existing;
  }

  private requireHole(
    envelope: CompletionEnvelope,
    holeId: string,
  ): z.infer<typeof holeSchema> {
    const hole = envelope.holes.find((candidate) => candidate.localId === holeId);
    if (hole === undefined) {
      throw new CompletionRepositoryError("NOT_FOUND", "Hole was not found.");
    }
    return hole;
  }

  private currentReview(
    envelope: CompletionEnvelope,
    holeId: string,
  ): z.infer<typeof completionReviewSchema> | undefined {
    return envelope.reviews
      .filter(
        (review) =>
          review.holeId === holeId &&
          !["COMPLETED", "CANCELLED"].includes(review.reviewStatus),
      )
      .sort(compareTimestampNewest)[0];
  }

  private latestCompletion(
    envelope: CompletionEnvelope,
    holeId: string,
  ): z.infer<typeof completionRecordSchema> | undefined {
    return envelope.completions
      .filter((completion) => completion.holeId === holeId)
      .sort(completionNewest)[0];
  }

  private pendingTransaction(
    envelope: CompletionEnvelope,
    holeId?: string,
  ): StoredTransaction | undefined {
    return envelope.transactions
      .filter(
        (transaction) =>
          transaction.stage !== "COMPLETED" &&
          (holeId === undefined || transaction.holeId === holeId),
      )
      .sort(compareTimestampNewest)[0];
  }

  getHoleMutationSnapshot(holeId: string): HoleMutationSnapshot | null {
    const envelope = this.read();
    const hole = envelope.holes.find((candidate) => candidate.localId === holeId);
    if (hole === undefined) return null;
    return {
      status: normalizeHoleStatus(hole.status),
      completionRecordId: this.latestCompletion(envelope, holeId)?.localId,
    };
  }

  async getLifecycleState(holeId: string): Promise<HoleLifecycleState | null> {
    const envelope = this.read();
    const hole = envelope.holes.find((candidate) => candidate.localId === holeId);
    if (hole === undefined) return null;
    const completionHistory = await this.historyEntries(envelope, holeId);
    const reopens = envelope.reopens
      .filter((reopen) => reopen.holeId === holeId)
      .sort(reopenNewest)
      .map(asReopen);
    const review = this.currentReview(envelope, holeId);
    const latest = this.latestCompletion(envelope, holeId);
    const pending = this.pendingTransaction(envelope, holeId);
    const canonical = asHole(hole);
    return {
      hole: canonical,
      status: canonical.status,
      currentReview: review === undefined ? null : asReview(review),
      latestCompletion: latest === undefined ? null : asCompletion(latest),
      completionHistory,
      reopenHistory: reopens,
      pendingCompletionOperation:
        pending === undefined ? null : asTransaction(pending),
    };
  }

  async getStatus(holeId: string): Promise<HoleStatus | null> {
    const hole = this.read().holes.find(
      (candidate) => candidate.localId === holeId,
    );
    return hole === undefined ? null : normalizeHoleStatus(hole.status);
  }

  async getLifecycleStatus(holeId: string): Promise<HoleStatus | null> {
    return this.getStatus(holeId);
  }

  async getHole(holeId: string): Promise<CanonicalHole | null> {
    const hole = this.read().holes.find(
      (candidate) => candidate.localId === holeId,
    );
    return hole === undefined ? null : asHole(hole);
  }

  async listHoles(): Promise<readonly CanonicalHole[]> {
    return this.read().holes.map(asHole);
  }

  async createHole(input: CreateHoleInput): Promise<CanonicalHole> {
    const holeId = input.holeId.trim();
    const name = input.name.trim();
    if (!holeId || !name) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Hole ID and name are required.",
      );
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(holeId)) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Hole ID must be 1–64 characters: letters, numbers, '.', '_' or '-'.",
      );
    }

    let envelope = this.read();
    const fingerprint = canonicalJson({
      holeId,
      name,
      projectId: input.projectId,
      rigId: input.rigId,
    });
    const prior = this.operation(
      envelope,
      input.operationId,
      "CREATE_HOLE",
      fingerprint,
    );
    if (prior !== null) {
      const existing = envelope.holes.find(
        (candidate) => candidate.localId === prior.resultId,
      );
      if (existing === undefined) {
        throw new CompletionRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          `Operation ${input.operationId} was already applied.`,
        );
      }
      return asHole(existing);
    }

    if (
      envelope.holes.some(
        (candidate) =>
          candidate.localId === holeId ||
          candidate.name.toLocaleLowerCase("en-AU") ===
            name.toLocaleLowerCase("en-AU"),
      )
    ) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        `Hole ${holeId} already exists.`,
      );
    }

    const parsed = holeSchema.safeParse({
      localId: holeId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      deviceId: DEVICE_ID,
      version: 1,
      projectId: input.projectId,
      rigId: input.rigId,
      name,
      holeSize: input.holeSize ?? "HQ",
      plannedDepth: input.plannedDepthDm ?? 7_500,
      currentDepth: 0,
      status: "ACTIVE",
      collarEasting: input.collarEasting ?? 0,
      collarNorthing: input.collarNorthing ?? 0,
      collarElevation: input.collarElevation ?? 0,
    });
    if (!parsed.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Hole values did not pass validation.",
      );
    }

    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.createdAt,
      holes: [...envelope.holes, parsed.data],
      operations: [
        ...envelope.operations,
        storedOperationSchema.parse({
          operationId: input.operationId,
          kind: "CREATE_HOLE",
          fingerprint,
          holeId,
          resultId: holeId,
          completedAt: input.createdAt,
        }),
      ],
    };
    this.write(envelope);
    return asHole(parsed.data);
  }

  async getCurrentReview(
    holeId: string,
  ): Promise<HoleCompletionReview | null> {
    const review = this.currentReview(this.read(), holeId);
    return review === undefined ? null : asReview(review);
  }

  async getLatestCompletion(
    holeId: string,
  ): Promise<HoleCompletionRecord | null> {
    const completion = this.latestCompletion(this.read(), holeId);
    return completion === undefined ? null : asCompletion(completion);
  }

  async getCompletionHistory(
    holeId: string,
  ): Promise<readonly HoleCompletionRecord[]> {
    return this.read()
      .completions.filter((completion) => completion.holeId === holeId)
      .sort(completionNewest)
      .map(asCompletion);
  }

  private async historyEntries(
    envelope: CompletionEnvelope,
    holeId: string,
  ): Promise<readonly CompletionHistoryEntry[]> {
    return envelope.completions
      .filter((completion) => completion.holeId === holeId)
      .sort(completionNewest)
      .map((completion) => {
        const reopen =
          envelope.reopens
            .filter(
              (candidate) =>
                candidate.completionRecordId === completion.localId,
            )
            .sort(reopenNewest)[0] ?? null;
        return {
          completion: asCompletion(completion),
          superseded: reopen !== null,
          reopened: reopen !== null,
          reopenRecord: reopen === null ? null : asReopen(reopen),
        };
      });
  }

  async getCompletionHistoryEntries(
    holeId: string,
  ): Promise<readonly CompletionHistoryEntry[]> {
    return this.historyEntries(this.read(), holeId);
  }

  async getReopenHistory(
    holeId: string,
  ): Promise<readonly HoleReopenRecord[]> {
    return this.read()
      .reopens.filter((reopen) => reopen.holeId === holeId)
      .sort(reopenNewest)
      .map(asReopen);
  }

  async listCompletedHoles(
    filters: CompletedHoleFilters = {},
  ): Promise<readonly CompletedHoleIndexEntry[]> {
    const envelope = this.read();
    const query = filters.search?.trim().toLocaleLowerCase("en-AU");
    return envelope.holes
      .map(asHole)
      .filter(
        (hole) =>
          (hole.status === "COMPLETED" || hole.status === "ABANDONED") &&
          (filters.status === undefined || hole.status === filters.status) &&
          (filters.projectId === undefined ||
            hole.projectId === filters.projectId) &&
          (query === undefined ||
            query.length === 0 ||
            hole.name.toLocaleLowerCase("en-AU").includes(query)),
      )
      .map((hole) => {
        const completion = this.latestCompletion(envelope, hole.localId);
        if (
          completion === undefined ||
          completion.finalStatus !== hole.status
        ) {
          throw new CompletionRepositoryError(
            "CORRUPTED_STORAGE",
            "A locked hole has no matching completion snapshot.",
          );
        }
        return {
          hole,
          status: hole.status,
          completion: asCompletion(completion),
        };
      })
      .sort(
        (left, right) =>
          Date.parse(right.completion.completedAt) -
            Date.parse(left.completion.completedAt) ||
          left.hole.name.localeCompare(right.hole.name),
      );
  }

  async beginReview(input: BeginReviewInput): Promise<HoleCompletionReview> {
    let envelope = this.read();
    const fingerprint = canonicalJson(input);
    const prior = this.operation(
      envelope,
      input.operationId,
      "BEGIN_REVIEW",
      fingerprint,
    );
    if (prior !== null) {
      const existing = envelope.reviews.find(
        (review) => review.localId === prior.resultId,
      );
      if (existing === undefined) {
        throw new CompletionRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed begin-review operation has no result.",
        );
      }
      return asReview(existing);
    }
    if (
      envelope.transactions.some(
        (transaction) => transaction.operationId === input.operationId,
      ) ||
      envelope.completions.some(
        (completion) => completion.operationId === input.operationId,
      ) ||
      envelope.reopens.some(
        (reopen) => reopen.operationId === input.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "This operation identifier is already used by different lifecycle data.",
      );
    }

    const hole = this.requireHole(envelope, input.holeId);
    const status = normalizeHoleStatus(hole.status);
    if (["COMPLETED", "ABANDONED", "ARCHIVED"].includes(status)) {
      throw new CompletionRepositoryError(
        "HOLE_LOCKED",
        "A locked hole cannot begin another completion review.",
      );
    }
    if (hole.version !== input.expectedHoleVersion) {
      throw new CompletionRepositoryError(
        "STALE_VERSION",
        "The hole changed after the completion review was opened.",
      );
    }
    if (this.currentReview(envelope, input.holeId) !== undefined) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "This hole already has a current completion review.",
      );
    }
    if (
      envelope.reviews.some((review) => review.localId === input.reviewId)
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The completion review identifier is already in use.",
      );
    }

    const parsed = completionReviewSchema.safeParse({
      localId: input.reviewId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.startedAt,
      updatedAt: input.startedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      reviewStatus: input.reviewStatus ?? "DRAFT",
      disposition: input.disposition,
      reason: input.reason,
      comment: optionalText(input.comment),
      finalSurveyResolution: input.finalSurveyResolution,
      checklist: input.checklist ?? [],
      componentOutcomes: input.componentOutcomes ?? [],
      warningAcknowledgements: input.warningAcknowledgements ?? [],
      startedByUserId: input.startedByUserId,
      startedByNameSnapshot: input.startedByNameSnapshot,
      startedAt: input.startedAt,
    });
    if (!parsed.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Completion review values did not pass validation.",
      );
    }
    const updatedHole = holeSchema.parse({
      ...hole,
      status: "COMPLETION_REVIEW",
      updatedAt: input.startedAt,
      version: hole.version + 1,
      syncStatus: "local-only",
    });
    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.startedAt,
      holes: envelope.holes.map((candidate) =>
        candidate.localId === updatedHole.localId ? updatedHole : candidate,
      ),
      reviews: [...envelope.reviews, parsed.data],
      operations: [
        ...envelope.operations,
        storedOperationSchema.parse({
          operationId: input.operationId,
          kind: "BEGIN_REVIEW",
          fingerprint,
          holeId: input.holeId,
          resultId: input.reviewId,
          completedAt: input.startedAt,
        }),
      ],
    };
    this.write(envelope);
    return asReview(parsed.data);
  }

  async saveReviewDraft(
    input: SaveReviewDraftInput,
  ): Promise<HoleCompletionReview> {
    const envelope = this.read();
    const fingerprint = canonicalJson(input);
    const prior = this.operation(
      envelope,
      input.operationId,
      "SAVE_REVIEW",
      fingerprint,
    );
    if (prior !== null) {
      const existing = envelope.reviews.find(
        (review) => review.localId === prior.resultId,
      );
      if (existing === undefined) {
        throw new CompletionRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed review save operation has no result.",
        );
      }
      return asReview(existing);
    }
    if (
      envelope.transactions.some(
        (transaction) => transaction.operationId === input.operationId,
      ) ||
      envelope.completions.some(
        (completion) => completion.operationId === input.operationId,
      ) ||
      envelope.reopens.some(
        (reopen) => reopen.operationId === input.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "This operation identifier is already used by different lifecycle data.",
      );
    }
    const hole = this.requireHole(envelope, input.holeId);
    if (normalizeHoleStatus(hole.status) !== "COMPLETION_REVIEW") {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The hole is not in completion review.",
      );
    }
    const current = envelope.reviews.find(
      (review) =>
        review.localId === input.reviewId && review.holeId === input.holeId,
    );
    if (current === undefined) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "Completion review was not found.",
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new CompletionRepositoryError(
        "STALE_VERSION",
        "The completion review changed after this form was opened.",
      );
    }
    if (["COMPLETED", "CANCELLED"].includes(current.reviewStatus)) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "A finished completion review cannot be edited.",
      );
    }

    const updated = completionReviewSchema.safeParse({
      ...current,
      reviewStatus: input.reviewStatus ?? current.reviewStatus,
      disposition: input.disposition ?? current.disposition,
      reason: input.reason ?? current.reason,
      comment:
        input.comment === undefined
          ? current.comment
          : optionalText(input.comment),
      finalSurveyResolution:
        input.finalSurveyResolution ?? current.finalSurveyResolution,
      checklist: input.checklist ?? current.checklist,
      componentOutcomes:
        input.componentOutcomes ?? current.componentOutcomes,
      warningAcknowledgements:
        input.warningAcknowledgements ?? current.warningAcknowledgements,
      updatedAt: input.savedAt,
      version: current.version + 1,
      syncStatus: "local-only",
    });
    if (!updated.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Completion review values did not pass validation.",
      );
    }
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.savedAt,
      reviews: envelope.reviews.map((review) =>
        review.localId === updated.data.localId ? updated.data : review,
      ),
      operations: [
        ...envelope.operations,
        storedOperationSchema.parse({
          operationId: input.operationId,
          kind: "SAVE_REVIEW",
          fingerprint,
          holeId: input.holeId,
          resultId: input.reviewId,
          completedAt: input.savedAt,
        }),
      ],
    });
    return asReview(updated.data);
  }

  async beginCompletionOperation(
    input: BeginCompletionOperationInput,
  ): Promise<HoleCompletionTransaction> {
    const envelope = this.read();
    this.requireHole(envelope, input.holeId);
    const review = envelope.reviews.find(
      (candidate) =>
        candidate.localId === input.reviewId &&
        candidate.holeId === input.holeId,
    );
    if (review === undefined) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "Completion review was not found.",
      );
    }
    if (review.reviewStatus !== "READY") {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The completion review is not ready to complete.",
      );
    }
    const fingerprint =
      input.fingerprint ??
      canonicalJson({ holeId: input.holeId, reviewId: input.reviewId });
    const existing = envelope.transactions.find(
      (transaction) => transaction.operationId === input.operationId,
    );
    if (existing !== undefined) {
      if (
        existing.holeId !== input.holeId ||
        existing.reviewId !== input.reviewId ||
        existing.fingerprint !== fingerprint
      ) {
        throw new CompletionRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This completion operation identifier is already used by different data.",
        );
      }
      return asTransaction(existing);
    }
    if (
      this.pendingTransaction(envelope, input.holeId) !== undefined ||
      envelope.operations.some(
        (operation) => operation.operationId === input.operationId,
      ) ||
      envelope.completions.some(
        (completion) => completion.operationId === input.operationId,
      ) ||
      envelope.reopens.some(
        (reopen) => reopen.operationId === input.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "A completion operation is already pending or the identifier is in use.",
      );
    }
    const transaction = transactionSchema.parse({
      operationId: input.operationId,
      holeId: input.holeId,
      reviewId: input.reviewId,
      stage: "REVIEW_CREATED",
      completedStages: ["REVIEW_CREATED"],
      startedAt: input.startedAt,
      updatedAt: input.startedAt,
      fingerprint,
    });
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.startedAt,
      transactions: [...envelope.transactions, transaction],
    });
    return asTransaction(transaction);
  }

  async advanceCompletionOperation(
    input: AdvanceCompletionOperationInput,
  ): Promise<HoleCompletionTransaction> {
    const envelope = this.read();
    const transaction = envelope.transactions.find(
      (candidate) => candidate.operationId === input.operationId,
    );
    if (transaction === undefined) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "Pending completion operation was not found.",
      );
    }
    if (transaction.stage === input.stage) return asTransaction(transaction);
    if (stageIndex(input.stage) !== stageIndex(transaction.stage) + 1) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "Completion transaction stages must advance exactly once in order.",
      );
    }
    if (input.stage === "SNAPSHOT_PERSISTED") {
      const completion = envelope.completions.find(
        (candidate) => candidate.operationId === input.operationId,
      );
      if (completion === undefined) {
        throw new CompletionRepositoryError(
          "INVALID_STATE",
          "The immutable completion snapshot must be persisted before advancing.",
        );
      }
    }
    if (input.stage === "HOLE_LOCKED") {
      const completion = envelope.completions.find(
        (candidate) => candidate.operationId === input.operationId,
      );
      const hole = envelope.holes.find(
        (candidate) => candidate.localId === transaction.holeId,
      );
      if (
        completion === undefined ||
        hole === undefined ||
        normalizeHoleStatus(hole.status) !== completion.finalStatus
      ) {
        throw new CompletionRepositoryError(
          "INVALID_STATE",
          "The hole must be locked before advancing this transaction stage.",
        );
      }
    }
    if (input.stage === "COMPLETED") {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "Use commitCompletion to finish a staged completion operation.",
      );
    }
    const advanced = storedTransactionAtStage(
      transaction,
      input.stage,
      input.updatedAt,
      input.lastError,
    );
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.updatedAt,
      transactions: envelope.transactions.map((candidate) =>
        candidate.operationId === input.operationId ? advanced : candidate,
      ),
    });
    return asTransaction(advanced);
  }

  async persistCompletionRecord(
    record: HoleCompletionRecord,
  ): Promise<HoleCompletionRecord> {
    const parsed = completionRecordSchema.safeParse(record);
    if (!parsed.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "The immutable completion snapshot did not pass validation.",
      );
    }
    const envelope = this.read();
    this.requireHole(envelope, parsed.data.holeId);
    const review = envelope.reviews.find(
      (candidate) => candidate.localId === parsed.data.reviewId,
    );
    if (review?.holeId !== parsed.data.holeId) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "The completion snapshot review was not found.",
      );
    }
    if (
      review.reviewStatus !== "READY" ||
      review.disposition !== parsed.data.finalStatus ||
      review.reason !== parsed.data.snapshot.reason
    ) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The immutable snapshot does not match the ready completion review.",
      );
    }
    if (
      parsed.data.snapshot.holeId !== parsed.data.holeId ||
      parsed.data.snapshot.finalStatus !== parsed.data.finalStatus ||
      parsed.data.completedByUserId !==
        parsed.data.snapshot.completedByUserId ||
      parsed.data.completedByNameSnapshot !==
        parsed.data.snapshot.completedByNameSnapshot
    ) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "The immutable completion snapshot is internally inconsistent.",
      );
    }
    const fingerprint = canonicalJson(parsed.data);
    const duplicateById = envelope.completions.find(
      (completion) => completion.localId === parsed.data.localId,
    );
    const duplicateByOperation = envelope.completions.find(
      (completion) => completion.operationId === parsed.data.operationId,
    );
    const duplicate = duplicateById ?? duplicateByOperation;
    if (duplicate !== undefined) {
      if (canonicalJson(duplicate) !== fingerprint) {
        throw new CompletionRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "The completion record or operation identifier is already used by different immutable data.",
        );
      }
      return asCompletion(duplicate);
    }
    if (
      envelope.operations.some(
        (operation) => operation.operationId === parsed.data.operationId,
      ) ||
      envelope.reopens.some(
        (reopen) => reopen.operationId === parsed.data.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The completion operation identifier is already in use.",
      );
    }
    const transaction = envelope.transactions.find(
      (candidate) => candidate.operationId === parsed.data.operationId,
    );
    if (
      transaction !== undefined &&
      (transaction.holeId !== parsed.data.holeId ||
        transaction.reviewId !== parsed.data.reviewId)
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The completion snapshot does not match its staged operation.",
      );
    }
    if (
      transaction !== undefined &&
      transaction.stage !== "REVIEW_CREATED"
    ) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The completion snapshot has already advanced past persistence.",
      );
    }
    const nextTransactions =
      transaction === undefined
        ? envelope.transactions
        : envelope.transactions.map((candidate) =>
            candidate.operationId === transaction.operationId
              ? storedTransactionAtStage(
                  candidate,
                  "SNAPSHOT_PERSISTED",
                  parsed.data.completedAt,
                )
              : candidate,
          );
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: parsed.data.completedAt,
      completions: [...envelope.completions, parsed.data],
      transactions: nextTransactions,
    });
    return asCompletion(parsed.data);
  }

  async lockHole(input: LockHoleInput): Promise<HoleLockResult> {
    const envelope = this.read();
    const hole = this.requireHole(envelope, input.holeId);
    const completion = envelope.completions.find(
      (candidate) =>
        candidate.localId === input.completionRecordId &&
        candidate.holeId === input.holeId,
    );
    if (completion === undefined) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "The immutable completion snapshot was not found.",
      );
    }
    if (completion.operationId !== input.operationId) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The completion snapshot belongs to another operation.",
      );
    }
    const transaction = envelope.transactions.find(
      (candidate) => candidate.operationId === input.operationId,
    );
    const status = normalizeHoleStatus(hole.status);
    if (status === completion.finalStatus) {
      return {
        hole: asHole(hole),
        completion: asCompletion(completion),
        transaction:
          transaction === undefined ? null : asTransaction(transaction),
        status: "already-locked",
      };
    }
    if (["COMPLETED", "ABANDONED", "ARCHIVED"].includes(status)) {
      throw new CompletionRepositoryError(
        "HOLE_LOCKED",
        "The hole is already locked by another lifecycle result.",
      );
    }
    if (hole.version !== input.expectedHoleVersion) {
      throw new CompletionRepositoryError(
        "STALE_VERSION",
        "The hole changed before completion could be locked.",
      );
    }
    if (status !== "COMPLETION_REVIEW") {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "Only a hole in completion review can be locked.",
      );
    }
    if (
      transaction !== undefined &&
      transaction.stage !== "COMPONENTS_CLOSED"
    ) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The staged completion operation is not ready to lock the hole.",
      );
    }
    const lockedAt = input.lockedAt ?? completion.completedAt;
    const locked = holeSchema.parse({
      ...hole,
      status: completion.finalStatus,
      updatedAt: lockedAt,
      version: hole.version + 1,
      syncStatus: "local-only",
    });
    const review = envelope.reviews.find(
      (candidate) => candidate.localId === completion.reviewId,
    );
    if (review === undefined) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "The completion snapshot review is missing.",
      );
    }
    const completingReview = completionReviewSchema.parse({
      ...review,
      reviewStatus: "COMPLETING",
      updatedAt: lockedAt,
      version:
        review.reviewStatus === "COMPLETING"
          ? review.version
          : review.version + 1,
      syncStatus: "local-only",
    });
    const nextTransaction =
      transaction === undefined
        ? undefined
        : storedTransactionAtStage(
            transaction,
            "HOLE_LOCKED",
            lockedAt,
          );
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: lockedAt,
      holes: envelope.holes.map((candidate) =>
        candidate.localId === locked.localId ? locked : candidate,
      ),
      reviews: envelope.reviews.map((candidate) =>
        candidate.localId === completingReview.localId
          ? completingReview
          : candidate,
      ),
      transactions:
        nextTransaction === undefined
          ? envelope.transactions
          : envelope.transactions.map((candidate) =>
              candidate.operationId === nextTransaction.operationId
                ? nextTransaction
                : candidate,
            ),
    });
    return {
      hole: asHole(locked),
      completion: asCompletion(completion),
      transaction:
        nextTransaction === undefined ? null : asTransaction(nextTransaction),
      status: "locked",
    };
  }

  async commitCompletion(
    input: CommitCompletionInput,
  ): Promise<CompletionCommitResult> {
    const envelope = this.read();
    const completion = envelope.completions.find(
      (candidate) =>
        candidate.localId === input.completionRecordId &&
        candidate.holeId === input.holeId,
    );
    if (completion === undefined) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "The immutable completion snapshot was not found.",
      );
    }
    const fingerprint = canonicalJson(completion);
    const prior = this.operation(
      envelope,
      input.operationId,
      "COMMIT_COMPLETION",
      fingerprint,
    );
    const hole = this.requireHole(envelope, input.holeId);
    const transaction = envelope.transactions.find(
      (candidate) => candidate.operationId === input.operationId,
    );
    if (prior !== null) {
      return {
        hole: asHole(hole),
        completion: asCompletion(completion),
        transaction:
          transaction === undefined ? null : asTransaction(transaction),
        status: "already-committed",
      };
    }
    if (completion.operationId !== input.operationId) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The completion snapshot belongs to another operation.",
      );
    }
    if (normalizeHoleStatus(hole.status) !== completion.finalStatus) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The hole must be locked before completion is committed.",
      );
    }
    if (
      transaction !== undefined &&
      transaction.stage !== "AUDIT_APPENDED"
    ) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "The staged completion operation has not finished its external append steps.",
      );
    }
    const committedAt =
      input.committedAt ?? transaction?.updatedAt ?? completion.completedAt;
    const review = envelope.reviews.find(
      (candidate) => candidate.localId === completion.reviewId,
    );
    if (review === undefined) {
      throw new CompletionRepositoryError(
        "CORRUPTED_STORAGE",
        "The completion snapshot review is missing.",
      );
    }
    const completedReview = completionReviewSchema.parse({
      ...review,
      reviewStatus: "COMPLETED",
      updatedAt: committedAt,
      version:
        review.reviewStatus === "COMPLETED"
          ? review.version
          : review.version + 1,
      syncStatus: "local-only",
    });
    const completedTransaction =
      transaction === undefined
        ? undefined
        : storedTransactionAtStage(transaction, "COMPLETED", committedAt);
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: committedAt,
      reviews: envelope.reviews.map((candidate) =>
        candidate.localId === completedReview.localId
          ? completedReview
          : candidate,
      ),
      transactions:
        completedTransaction === undefined
          ? envelope.transactions
          : envelope.transactions.map((candidate) =>
              candidate.operationId === completedTransaction.operationId
                ? completedTransaction
                : candidate,
            ),
      operations: [
        ...envelope.operations,
        storedOperationSchema.parse({
          operationId: input.operationId,
          kind: "COMMIT_COMPLETION",
          fingerprint,
          holeId: input.holeId,
          resultId: completion.localId,
          completedAt: committedAt,
        }),
      ],
    });
    return {
      hole: asHole(hole),
      completion: asCompletion(completion),
      transaction:
        completedTransaction === undefined
          ? null
          : asTransaction(completedTransaction),
      status: "committed",
    };
  }

  async reopenHole(input: ReopenHoleInput): Promise<ReopenHoleResult> {
    const envelope = this.read();
    const normalizedInput = {
      ...input,
      reason: input.reason.trim(),
      comment: optionalText(input.comment),
    };
    const fingerprint = canonicalJson(normalizedInput);
    const prior = this.operation(
      envelope,
      input.operationId,
      "REOPEN_HOLE",
      fingerprint,
    );
    if (prior !== null) {
      const reopen = envelope.reopens.find(
        (candidate) => candidate.localId === prior.resultId,
      );
      const completion =
        reopen === undefined
          ? undefined
          : envelope.completions.find(
              (candidate) =>
                candidate.localId === reopen.completionRecordId,
            );
      const hole = envelope.holes.find(
        (candidate) => candidate.localId === input.holeId,
      );
      if (reopen === undefined || completion === undefined || hole === undefined) {
        throw new CompletionRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed reopen operation has incomplete results.",
        );
      }
      return {
        hole: asHole(hole),
        completion: asCompletion(completion),
        reopenRecord: asReopen(reopen),
        status: "already-reopened",
      };
    }
    if (
      envelope.transactions.some(
        (transaction) => transaction.operationId === input.operationId,
      ) ||
      envelope.completions.some(
        (completion) => completion.operationId === input.operationId,
      ) ||
      envelope.reopens.some(
        (reopen) => reopen.operationId === input.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "This operation identifier is already used by different lifecycle data.",
      );
    }

    const hole = this.requireHole(envelope, input.holeId);
    const status = normalizeHoleStatus(hole.status);
    if (status !== "COMPLETED" && status !== "ABANDONED") {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "Only a completed or abandoned hole can be reopened.",
      );
    }
    if (hole.version !== input.expectedHoleVersion) {
      throw new CompletionRepositoryError(
        "STALE_VERSION",
        "The hole changed before it could be reopened.",
      );
    }
    const completion =
      input.completionRecordId === undefined
        ? this.latestCompletion(envelope, input.holeId)
        : envelope.completions.find(
            (candidate) =>
              candidate.localId === input.completionRecordId &&
              candidate.holeId === input.holeId,
          );
    if (completion === undefined || completion.finalStatus !== status) {
      throw new CompletionRepositoryError(
        "NOT_FOUND",
        "The current immutable completion snapshot was not found.",
      );
    }
    if (
      envelope.reopens.some(
        (reopen) => reopen.completionRecordId === completion.localId,
      )
    ) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "This completion has already been reopened.",
      );
    }
    if (this.pendingTransaction(envelope, input.holeId) !== undefined) {
      throw new CompletionRepositoryError(
        "INVALID_STATE",
        "A pending completion operation must finish before reopening the hole.",
      );
    }
    const reopen = reopenRecordSchema.safeParse({
      localId: input.reopenRecordId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.reopenedAt,
      updatedAt: input.reopenedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      completionRecordId: completion.localId,
      previousStatus: status,
      reopenedStatus: "ACTIVE",
      reason: normalizedInput.reason,
      comment: normalizedInput.comment,
      reopenedAt: input.reopenedAt,
      reopenedByUserId: input.reopenedByUserId,
      reopenedByNameSnapshot: input.reopenedByNameSnapshot,
      operationId: input.operationId,
    });
    if (!reopen.success) {
      throw new CompletionRepositoryError(
        "VALIDATION_FAILED",
        "Hole reopen values did not pass validation.",
      );
    }
    if (
      envelope.reopens.some(
        (candidate) =>
          candidate.localId === reopen.data.localId ||
          candidate.operationId === reopen.data.operationId,
      ) ||
      envelope.completions.some(
        (candidate) => candidate.operationId === reopen.data.operationId,
      ) ||
      envelope.transactions.some(
        (candidate) => candidate.operationId === reopen.data.operationId,
      )
    ) {
      throw new CompletionRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The reopen record or operation identifier is already in use.",
      );
    }
    const reopenedHole = holeSchema.parse({
      ...hole,
      status: "ACTIVE",
      updatedAt: input.reopenedAt,
      version: hole.version + 1,
      syncStatus: "local-only",
    });
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.reopenedAt,
      holes: envelope.holes.map((candidate) =>
        candidate.localId === reopenedHole.localId
          ? reopenedHole
          : candidate,
      ),
      reopens: [...envelope.reopens, reopen.data],
      operations: [
        ...envelope.operations,
        storedOperationSchema.parse({
          operationId: input.operationId,
          kind: "REOPEN_HOLE",
          fingerprint,
          holeId: input.holeId,
          resultId: reopen.data.localId,
          completedAt: input.reopenedAt,
        }),
      ],
    });
    return {
      hole: asHole(reopenedHole),
      completion: asCompletion(completion),
      reopenRecord: asReopen(reopen.data),
      status: "reopened",
    };
  }

  async inspectPendingCompletionOperation(
    holeId?: string,
  ): Promise<HoleCompletionTransaction | null> {
    const transaction = this.pendingTransaction(this.read(), holeId);
    return transaction === undefined ? null : asTransaction(transaction);
  }

  async getPendingCompletionOperation(
    holeId?: string,
  ): Promise<HoleCompletionTransaction | null> {
    return this.inspectPendingCompletionOperation(holeId);
  }

  /** Compatibility aliases keep staged transaction terminology explicit. */
  async stageCompletionTransaction(
    input: BeginCompletionOperationInput,
  ): Promise<HoleCompletionTransaction> {
    return this.beginCompletionOperation(input);
  }

  async advanceCompletionTransaction(
    input: AdvanceCompletionOperationInput,
  ): Promise<HoleCompletionTransaction> {
    return this.advanceCompletionOperation(input);
  }

  async listCompletionIndex(
    filters: CompletedHoleFilters = {},
  ): Promise<readonly CompletedHoleIndexEntry[]> {
    return this.listCompletedHoles(filters);
  }
}

export function createBrowserCompletionRepository(
  organisationId: string,
  seed: CompletionRepositorySeed = { holes: [] },
): LocalCompletionRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalCompletionRepository(storage, organisationId, seed);
}

export class HoleMutationGuard implements HoleMutationGuardPort {
  constructor(private readonly completion: LocalCompletionRepository) {}

  assertHoleMutable(holeId: string): void {
    const snapshot = this.completion.getHoleMutationSnapshot(holeId);
    if (snapshot === null) return;
    assertHoleUnlocked(
      holeId,
      snapshot.status,
      snapshot.completionRecordId,
    );
  }
}
