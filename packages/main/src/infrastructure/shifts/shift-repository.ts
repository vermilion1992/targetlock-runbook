import { z } from "zod";

import {
  decimetres,
  isActiveShiftStatus,
  type Decimetres,
  type RunbookShift,
  type ShiftAnalyticsCloseSnapshot,
  type ShiftCrewMember,
  type ShiftType,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const SHIFT_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const isoTimestampSchema = z.string().datetime();
const decimetresSchema = z.number().int().nonnegative();

const crewMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
});

const shiftSchema = z.object({
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: z.enum([
    "local-only",
    "queued",
    "syncing",
    "synced",
    "conflict",
    "failed",
  ]),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
  holeId: z.string().min(1),
  rigId: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primaryDrillerId: z.string().min(1),
  primaryDrillerNameSnapshot: z.string().trim().min(1),
  crewMembers: z.array(crewMemberSchema),
  startedAt: isoTimestampSchema,
  closedAt: isoTimestampSchema.optional(),
  startingDepthDm: decimetresSchema,
  endingDepthDm: decimetresSchema.optional(),
  startingRodNumber: z.number().int().nonnegative(),
  endingRodNumber: z.number().int().nonnegative().optional(),
  startingRodStringDm: decimetresSchema,
  endingRodStringDm: decimetresSchema.optional(),
  startingMeasuredStickUpDm: decimetresSchema.optional(),
  endingMeasuredStickUpDm: decimetresSchema.optional(),
  startingRunNumber: z.number().int().positive(),
  endingRunNumber: z.number().int().nonnegative().optional(),
  handoverNote: z.string().max(2_000).optional(),
  handoverRunId: z.string().min(1).optional(),
  handoverRunNumber: z.number().int().positive().optional(),
  handoverAcceptedBy: z.string().min(1).optional(),
  handoverAcceptedByNameSnapshot: z.string().trim().min(1).optional(),
  handoverAcceptedAt: isoTimestampSchema.optional(),
  status: z.enum(["OPEN", "HANDOVER_PENDING", "CLOSED"]),
  closeAnalyticsSnapshot: z
    .object({
      capturedAt: isoTimestampSchema,
      startingDepthDm: decimetresSchema,
      endingDepthDm: decimetresSchema,
      metresCompletedDm: decimetresSchema,
      completedRunCount: z.number().int().nonnegative(),
      totalRecoveredDm: decimetresSchema,
      weightedRecoveryTenths: z.number().int().nonnegative().optional(),
      totalCoreLossDm: decimetresSchema,
      totalCoreGainDm: decimetresSchema,
      rodsAdded3m: z.number().int().nonnegative(),
      rodsAdded6m: z.number().int().nonnegative(),
      rodsRemoved: z.number().int().nonnegative(),
    })
    .optional(),
});

const shiftsEnvelopeSchema = z.object({
  version: z.literal(SHIFT_STORAGE_VERSION),
  holeId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: isoTimestampSchema,
  shifts: z.array(shiftSchema),
});

const handoverOperationSchema = z.object({
  version: z.literal(SHIFT_STORAGE_VERSION),
  operationId: z.string().min(1),
  holeId: z.string().min(1),
  outgoingShiftId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  incomingShift: shiftSchema,
  acceptedBy: z.string().min(1),
  acceptedByNameSnapshot: z.string().min(1),
  acceptedAt: isoTimestampSchema,
  status: z.enum(["PREPARED", "COMPLETE"]),
});

const shiftStateSnapshotSchema = z.object({
  depthDm: decimetresSchema,
  rodNumber: z.number().int().nonnegative(),
  rodStringDm: decimetresSchema,
  measuredStickUpDm: decimetresSchema.optional(),
  runNumber: z.number().int().nonnegative(),
});

const closeAnalyticsSnapshotSchema = z
  .object({
    capturedAt: isoTimestampSchema,
    startingDepthDm: decimetresSchema,
    endingDepthDm: decimetresSchema,
    metresCompletedDm: decimetresSchema,
    completedRunCount: z.number().int().nonnegative(),
    totalRecoveredDm: decimetresSchema,
    weightedRecoveryTenths: z.number().int().nonnegative().optional(),
    totalCoreLossDm: decimetresSchema,
    totalCoreGainDm: decimetresSchema,
    rodsAdded3m: z.number().int().nonnegative(),
    rodsAdded6m: z.number().int().nonnegative(),
    rodsRemoved: z.number().int().nonnegative(),
  })
  .optional();

const finalShiftCloseInputSchema = z.object({
  operationId: z.string().min(1),
  holeId: z.string().min(1),
  shiftId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  closedAt: isoTimestampSchema,
  endingState: shiftStateSnapshotSchema,
  closeAnalyticsSnapshot: closeAnalyticsSnapshotSchema,
});

const finalShiftCloseOperationSchema = z.object({
  operationId: z.string().min(1),
  fingerprint: z.string().min(1),
  input: finalShiftCloseInputSchema,
  status: z.enum(["PREPARED", "COMPLETE"]),
});

const finalShiftCloseOperationsSchema = z.object({
  version: z.literal(SHIFT_STORAGE_VERSION),
  holeId: z.string().min(1),
  operations: z.array(finalShiftCloseOperationSchema),
});

export interface ShiftStateSnapshot {
  readonly depthDm: Decimetres;
  readonly rodNumber: number;
  readonly rodStringDm: Decimetres;
  readonly measuredStickUpDm?: Decimetres;
  readonly runNumber: number;
}

export interface StartShiftInput {
  readonly id: string;
  readonly holeId: string;
  readonly rigId: string;
  readonly shiftType: ShiftType;
  readonly shiftDate: string;
  readonly primaryDrillerId: string;
  readonly primaryDrillerNameSnapshot: string;
  readonly crewMembers: readonly ShiftCrewMember[];
  readonly startedAt: string;
  readonly startingState: ShiftStateSnapshot;
}

export interface CloseShiftInput {
  readonly holeId: string;
  readonly shiftId: string;
  readonly expectedVersion: number;
  readonly closedAt: string;
  readonly endingState: ShiftStateSnapshot;
  readonly handoverNote?: string;
  readonly handoverRunId?: string;
  readonly handoverRunNumber?: number;
  readonly closeAnalyticsSnapshot?: ShiftAnalyticsCloseSnapshot;
}

export interface CloseFinalShiftInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly shiftId: string;
  readonly expectedVersion: number;
  readonly closedAt: string;
  readonly endingState: ShiftStateSnapshot;
  readonly closeAnalyticsSnapshot?: ShiftAnalyticsCloseSnapshot;
}

export interface AcceptHandoverInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly outgoingShiftId: string;
  readonly expectedVersion: number;
  readonly incomingShiftId: string;
  readonly incomingShiftType: ShiftType;
  readonly incomingShiftDate: string;
  readonly incomingDrillerId: string;
  readonly incomingDrillerNameSnapshot: string;
  readonly incomingCrewMembers: readonly ShiftCrewMember[];
  readonly acceptedAt: string;
}

export interface HandoverResult {
  readonly outgoingShift: RunbookShift;
  readonly incomingShift: RunbookShift;
  readonly status: "accepted" | "already-accepted" | "recovered";
}

export interface FinalShiftCloseResult {
  readonly shift: RunbookShift;
  readonly status: "closed" | "already-closed" | "recovered";
}

export type ShiftRepositoryErrorCode =
  | "ACTIVE_SHIFT_EXISTS"
  | "CORRUPTED_STORAGE"
  | "HANDOVER_ALREADY_ACCEPTED"
  | "HANDOVER_NOT_PENDING"
  | "NOT_FOUND"
  | "OPERATION_CONFLICT"
  | "STALE_VERSION"
  | "STORAGE_UNAVAILABLE";

export class ShiftRepositoryError extends Error {
  constructor(
    readonly code: ShiftRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ShiftRepositoryError";
  }
}

export interface ShiftRepository {
  getActiveShift(holeId: string): Promise<RunbookShift | null>;
  getPendingHandover(holeId: string): Promise<RunbookShift | null>;
  listByHole(holeId: string): Promise<readonly RunbookShift[]>;
  getById(shiftId: string, holeId: string): Promise<RunbookShift | null>;
  startShift(input: StartShiftInput): Promise<RunbookShift>;
  closeForHandover(input: CloseShiftInput): Promise<RunbookShift>;
  closeFinalShift(input: CloseFinalShiftInput): Promise<FinalShiftCloseResult>;
  acceptHandover(input: AcceptHandoverInput): Promise<HandoverResult>;
  hasPendingHandoverOperation(holeId: string): Promise<boolean>;
  recoverInterruptedAcceptance(holeId: string): Promise<HandoverResult | null>;
}

function shiftsKey(holeId: string): string {
  return `targetlock:prototype:v${SHIFT_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:shifts`;
}

function handoverOperationKey(holeId: string): string {
  return `targetlock:prototype:v${SHIFT_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:handover-operation`;
}

function finalShiftCloseOperationsKey(holeId: string): string {
  return `targetlock:prototype:v${SHIFT_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:final-shift-close-operations`;
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

function asCloseAnalyticsSnapshot(
  value: z.infer<typeof shiftSchema>["closeAnalyticsSnapshot"],
): ShiftAnalyticsCloseSnapshot | undefined {
  if (value === undefined) return undefined;
  return {
    capturedAt: value.capturedAt,
    startingDepthDm: decimetres(value.startingDepthDm),
    endingDepthDm: decimetres(value.endingDepthDm),
    metresCompletedDm: decimetres(value.metresCompletedDm),
    completedRunCount: value.completedRunCount,
    totalRecoveredDm: decimetres(value.totalRecoveredDm),
    weightedRecoveryTenths: value.weightedRecoveryTenths,
    totalCoreLossDm: decimetres(value.totalCoreLossDm),
    totalCoreGainDm: decimetres(value.totalCoreGainDm),
    rodsAdded3m: value.rodsAdded3m,
    rodsAdded6m: value.rodsAdded6m,
    rodsRemoved: value.rodsRemoved,
  };
}

function asShift(value: z.infer<typeof shiftSchema>): RunbookShift {
  return {
    ...value,
    startingDepthDm: decimetres(value.startingDepthDm),
    endingDepthDm:
      value.endingDepthDm === undefined
        ? undefined
        : decimetres(value.endingDepthDm),
    startingRodStringDm: decimetres(value.startingRodStringDm),
    endingRodStringDm:
      value.endingRodStringDm === undefined
        ? undefined
        : decimetres(value.endingRodStringDm),
    startingMeasuredStickUpDm:
      value.startingMeasuredStickUpDm === undefined
        ? undefined
        : decimetres(value.startingMeasuredStickUpDm),
    endingMeasuredStickUpDm:
      value.endingMeasuredStickUpDm === undefined
        ? undefined
        : decimetres(value.endingMeasuredStickUpDm),
    closeAnalyticsSnapshot: asCloseAnalyticsSnapshot(
      value.closeAnalyticsSnapshot,
    ),
  };
}

function createIncomingShift(
  input: AcceptHandoverInput,
  outgoing: RunbookShift,
): RunbookShift {
  const depth = outgoing.endingDepthDm ?? outgoing.startingDepthDm;
  const rodNumber = outgoing.endingRodNumber ?? outgoing.startingRodNumber;
  const rodString =
    outgoing.endingRodStringDm ?? outgoing.startingRodStringDm;
  const measuredStickUp =
    outgoing.endingMeasuredStickUpDm ??
    outgoing.startingMeasuredStickUpDm;
  const runNumber =
    outgoing.handoverRunNumber ??
    (outgoing.endingRunNumber ?? outgoing.startingRunNumber - 1) + 1;

  return {
    localId: input.incomingShiftId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.acceptedAt,
    updatedAt: input.acceptedAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    rigId: outgoing.rigId,
    shiftType: input.incomingShiftType,
    shiftDate: input.incomingShiftDate,
    primaryDrillerId: input.incomingDrillerId,
    primaryDrillerNameSnapshot: input.incomingDrillerNameSnapshot,
    crewMembers: input.incomingCrewMembers,
    startedAt: input.acceptedAt,
    startingDepthDm: depth,
    startingRodNumber: rodNumber,
    startingRodStringDm: rodString,
    startingMeasuredStickUpDm: measuredStickUp,
    startingRunNumber: runNumber,
    handoverRunId: outgoing.handoverRunId,
    handoverRunNumber: outgoing.handoverRunNumber,
    status: "OPEN",
  };
}

export class LocalShiftRepository implements ShiftRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly seedShifts: readonly RunbookShift[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private readEnvelope(holeId: string) {
    let raw: string | null;
    try {
      raw = this.storage.getItem(shiftsKey(holeId));
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }

    if (raw === null) {
      const seeded = this.seedShifts.filter((shift) => shift.holeId === holeId);
      return {
        version: SHIFT_STORAGE_VERSION,
        holeId,
        revision: 0,
        updatedAt: seeded.at(-1)?.updatedAt ?? new Date(0).toISOString(),
        shifts: seeded,
      };
    }

    try {
      const result = shiftsEnvelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (!result.success || result.data.holeId !== holeId) {
        throw new ShiftRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted shifts are incompatible or belong to another hole.",
        );
      }
      return {
        ...result.data,
        shifts: result.data.shifts.map(asShift),
      };
    } catch (error) {
      if (error instanceof ShiftRepositoryError) throw error;
      throw new ShiftRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted shifts are not valid JSON.",
      );
    }
  }

  private writeEnvelope(
    holeId: string,
    shifts: readonly RunbookShift[],
    updatedAt: string,
    previousRevision: number,
  ): void {
    const envelope = shiftsEnvelopeSchema.safeParse({
      version: SHIFT_STORAGE_VERSION,
      holeId,
      revision: previousRevision + 1,
      updatedAt,
      shifts,
    });
    if (!envelope.success) {
      throw new ShiftRepositoryError(
        "CORRUPTED_STORAGE",
        "Shift values did not pass persistence validation.",
      );
    }
    try {
      this.storage.setItem(shiftsKey(holeId), JSON.stringify(envelope.data));
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the shift.",
      );
    }
  }

  async getActiveShift(holeId: string): Promise<RunbookShift | null> {
    await this.recoverInterruptedAcceptance(holeId);
    return (
      this.readEnvelope(holeId).shifts.find(
        (shift) => shift.status === "OPEN",
      ) ?? null
    );
  }

  async getPendingHandover(holeId: string): Promise<RunbookShift | null> {
    await this.recoverInterruptedAcceptance(holeId);
    return (
      this.readEnvelope(holeId).shifts.find(
        (shift) => shift.status === "HANDOVER_PENDING",
      ) ?? null
    );
  }

  async listByHole(holeId: string): Promise<readonly RunbookShift[]> {
    await this.recoverInterruptedAcceptance(holeId);
    return [...this.readEnvelope(holeId).shifts].sort(
      (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt),
    );
  }

  async getById(
    shiftId: string,
    holeId: string,
  ): Promise<RunbookShift | null> {
    await this.recoverInterruptedAcceptance(holeId);
    return (
      this.readEnvelope(holeId).shifts.find(
        (shift) => shift.localId === shiftId,
      ) ?? null
    );
  }

  async startShift(input: StartShiftInput): Promise<RunbookShift> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.readEnvelope(input.holeId);
    const duplicate = envelope.shifts.find(
      (shift) => shift.localId === input.id,
    );
    if (duplicate !== undefined) return duplicate;

    const active = envelope.shifts.find((shift) =>
      isActiveShiftStatus(shift.status),
    );
    if (active !== undefined) {
      throw new ShiftRepositoryError(
        "ACTIVE_SHIFT_EXISTS",
        `A runbook shift is already active for ${input.holeId}.`,
      );
    }

    const shift: RunbookShift = {
      localId: input.id,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.startedAt,
      updatedAt: input.startedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      rigId: input.rigId,
      shiftType: input.shiftType,
      shiftDate: input.shiftDate,
      primaryDrillerId: input.primaryDrillerId,
      primaryDrillerNameSnapshot: input.primaryDrillerNameSnapshot,
      crewMembers: input.crewMembers,
      startedAt: input.startedAt,
      startingDepthDm: input.startingState.depthDm,
      startingRodNumber: input.startingState.rodNumber,
      startingRodStringDm: input.startingState.rodStringDm,
      startingMeasuredStickUpDm: input.startingState.measuredStickUpDm,
      startingRunNumber: input.startingState.runNumber,
      status: "OPEN",
    };
    this.writeEnvelope(
      input.holeId,
      [...envelope.shifts, shift],
      input.startedAt,
      envelope.revision,
    );
    return shift;
  }

  async closeForHandover(input: CloseShiftInput): Promise<RunbookShift> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.readEnvelope(input.holeId);
    const existing = envelope.shifts.find(
      (shift) => shift.localId === input.shiftId,
    );
    if (existing === undefined) {
      throw new ShiftRepositoryError("NOT_FOUND", "The active shift was not found.");
    }
    if (existing.version !== input.expectedVersion) {
      throw new ShiftRepositoryError(
        "STALE_VERSION",
        "The shift changed in another view. Reload before closing it.",
      );
    }
    if (existing.status !== "OPEN") {
      throw new ShiftRepositoryError(
        "HANDOVER_NOT_PENDING",
        existing.status === "HANDOVER_PENDING"
          ? "This shift is already awaiting handover."
          : "This shift is already closed.",
      );
    }

    const updated: RunbookShift = {
      ...existing,
      updatedAt: input.closedAt,
      version: existing.version + 1,
      closedAt: input.closedAt,
      endingDepthDm: input.endingState.depthDm,
      endingRodNumber: input.endingState.rodNumber,
      endingRodStringDm: input.endingState.rodStringDm,
      endingMeasuredStickUpDm: input.endingState.measuredStickUpDm,
      endingRunNumber: input.endingState.runNumber,
      handoverNote: input.handoverNote?.trim() || undefined,
      handoverRunId: input.handoverRunId,
      handoverRunNumber: input.handoverRunNumber,
      // Written once at close; never overwritten by later corrections.
      closeAnalyticsSnapshot:
        existing.closeAnalyticsSnapshot ?? input.closeAnalyticsSnapshot,
      status: "HANDOVER_PENDING",
    };
    this.writeEnvelope(
      input.holeId,
      envelope.shifts.map((shift) =>
        shift.localId === updated.localId ? updated : shift,
      ),
      input.closedAt,
      envelope.revision,
    );
    return updated;
  }

  async closeFinalShift(
    input: CloseFinalShiftInput,
  ): Promise<FinalShiftCloseResult> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const parsed = finalShiftCloseInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ShiftRepositoryError(
        "CORRUPTED_STORAGE",
        "The final shift close values did not pass validation.",
      );
    }
    const normalizedInput: CloseFinalShiftInput = {
      ...parsed.data,
      endingState: {
        ...parsed.data.endingState,
        depthDm: decimetres(parsed.data.endingState.depthDm),
        rodStringDm: decimetres(parsed.data.endingState.rodStringDm),
        measuredStickUpDm:
          parsed.data.endingState.measuredStickUpDm === undefined
            ? undefined
            : decimetres(parsed.data.endingState.measuredStickUpDm),
      },
      closeAnalyticsSnapshot: asCloseAnalyticsSnapshot(
        parsed.data.closeAnalyticsSnapshot,
      ),
    };
    const fingerprint = canonicalJson(parsed.data);
    const operationsEnvelope = this.readFinalCloseOperations(input.holeId);
    const existingOperation = operationsEnvelope.operations.find(
      (operation) => operation.operationId === input.operationId,
    );
    if (existingOperation !== undefined) {
      if (existingOperation.fingerprint !== fingerprint) {
        throw new ShiftRepositoryError(
          "OPERATION_CONFLICT",
          "This operation identifier is already used by different final shift data.",
        );
      }
      return this.finishFinalShiftClose(
        existingOperation,
        existingOperation.status === "PREPARED",
      );
    }
    if (
      operationsEnvelope.operations.some(
        (operation) => operation.status === "PREPARED",
      )
    ) {
      throw new ShiftRepositoryError(
        "OPERATION_CONFLICT",
        "Another final shift close operation must be recovered first.",
      );
    }

    const shiftsEnvelope = this.readEnvelope(input.holeId);
    const shift = shiftsEnvelope.shifts.find(
      (candidate) => candidate.localId === input.shiftId,
    );
    if (shift === undefined) {
      throw new ShiftRepositoryError("NOT_FOUND", "The active shift was not found.");
    }
    if (shift.status !== "OPEN") {
      throw new ShiftRepositoryError(
        "HANDOVER_NOT_PENDING",
        shift.status === "HANDOVER_PENDING"
          ? "A shift awaiting handover cannot be closed as the final shift."
          : "This shift is already closed.",
      );
    }
    if (shift.version !== input.expectedVersion) {
      throw new ShiftRepositoryError(
        "STALE_VERSION",
        "The shift changed in another view. Reload before closing it.",
      );
    }

    const prepared = finalShiftCloseOperationSchema.parse({
      operationId: input.operationId,
      fingerprint,
      input: parsed.data,
      status: "PREPARED",
    });
    this.writeFinalCloseOperations({
      ...operationsEnvelope,
      operations: [...operationsEnvelope.operations, prepared],
    });
    return this.finishFinalShiftClose(
      { ...prepared, input: normalizedInput },
      false,
    );
  }

  async acceptHandover(input: AcceptHandoverInput): Promise<HandoverResult> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const existingOperation = this.readOperation(input.holeId);
    if (existingOperation?.operationId === input.operationId) {
      const recovered = await this.finishOperation(existingOperation, true);
      return { ...recovered, status: "already-accepted" };
    }

    const envelope = this.readEnvelope(input.holeId);
    const outgoing = envelope.shifts.find(
      (shift) => shift.localId === input.outgoingShiftId,
    );
    if (outgoing === undefined) {
      throw new ShiftRepositoryError("NOT_FOUND", "The handover was not found.");
    }
    if (outgoing.status === "CLOSED") {
      throw new ShiftRepositoryError(
        "HANDOVER_ALREADY_ACCEPTED",
        "This handover has already been accepted.",
      );
    }
    if (outgoing.status !== "HANDOVER_PENDING") {
      throw new ShiftRepositoryError(
        "HANDOVER_NOT_PENDING",
        "The outgoing shift is not awaiting handover.",
      );
    }
    if (outgoing.version !== input.expectedVersion) {
      throw new ShiftRepositoryError(
        "STALE_VERSION",
        "The handover changed in another view. Reload before accepting it.",
      );
    }

    const incomingShift = createIncomingShift(input, outgoing);
    const operation = handoverOperationSchema.parse({
      version: SHIFT_STORAGE_VERSION,
      operationId: input.operationId,
      holeId: input.holeId,
      outgoingShiftId: input.outgoingShiftId,
      expectedVersion: input.expectedVersion,
      incomingShift,
      acceptedBy: input.incomingDrillerId,
      acceptedByNameSnapshot: input.incomingDrillerNameSnapshot,
      acceptedAt: input.acceptedAt,
      status: "PREPARED",
    });
    this.writeOperation(operation);
    return this.finishOperation(operation, false);
  }

  async hasPendingHandoverOperation(holeId: string): Promise<boolean> {
    return this.readOperation(holeId)?.status === "PREPARED";
  }

  async recoverInterruptedAcceptance(
    holeId: string,
  ): Promise<HandoverResult | null> {
    const operation = this.readOperation(holeId);
    if (operation === null || operation.status === "COMPLETE") return null;

    const envelope = this.readEnvelope(holeId);
    const outgoing = envelope.shifts.find(
      (shift) => shift.localId === operation.outgoingShiftId,
    );
    const incoming = envelope.shifts.find(
      (shift) => shift.localId === operation.incomingShift.localId,
    );
    const alreadyApplied =
      outgoing?.status === "CLOSED" && incoming !== undefined;

    if (!alreadyApplied) {
      try {
        this.mutationGuard?.assertHoleMutable(holeId);
      } catch {
        // A locked hole must not open a new shift from a stale prepared op.
        try {
          this.storage.removeItem(handoverOperationKey(holeId));
        } catch {
          // Best-effort cleanup of an unusable prepared operation.
        }
        return null;
      }
    }

    const result = await this.finishOperation(operation, true);
    return { ...result, status: "recovered" };
  }

  private readOperation(
    holeId: string,
  ): z.infer<typeof handoverOperationSchema> | null {
    let raw: string | null;
    try {
      raw = this.storage.getItem(handoverOperationKey(holeId));
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return null;
    try {
      const result = handoverOperationSchema.safeParse(JSON.parse(raw) as unknown);
      if (!result.success || result.data.holeId !== holeId) {
        throw new ShiftRepositoryError(
          "CORRUPTED_STORAGE",
          "The saved handover operation is incompatible.",
        );
      }
      return result.data;
    } catch (error) {
      if (error instanceof ShiftRepositoryError) throw error;
      throw new ShiftRepositoryError(
        "CORRUPTED_STORAGE",
        "The saved handover operation is not valid JSON.",
      );
    }
  }

  private writeOperation(
    operation: z.infer<typeof handoverOperationSchema>,
  ): void {
    try {
      this.storage.setItem(
        handoverOperationKey(operation.holeId),
        JSON.stringify(operation),
      );
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the handover operation.",
      );
    }
  }

  private readFinalCloseOperations(
    holeId: string,
  ): z.infer<typeof finalShiftCloseOperationsSchema> {
    let raw: string | null;
    try {
      raw = this.storage.getItem(finalShiftCloseOperationsKey(holeId));
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) {
      return {
        version: SHIFT_STORAGE_VERSION,
        holeId,
        operations: [],
      };
    }
    try {
      const parsed = finalShiftCloseOperationsSchema.safeParse(
        JSON.parse(raw) as unknown,
      );
      if (!parsed.success || parsed.data.holeId !== holeId) {
        throw new ShiftRepositoryError(
          "CORRUPTED_STORAGE",
          "The saved final shift close operations are incompatible.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ShiftRepositoryError) throw error;
      throw new ShiftRepositoryError(
        "CORRUPTED_STORAGE",
        "The saved final shift close operations are not valid JSON.",
      );
    }
  }

  private writeFinalCloseOperations(
    envelope: z.infer<typeof finalShiftCloseOperationsSchema>,
  ): void {
    try {
      this.storage.setItem(
        finalShiftCloseOperationsKey(envelope.holeId),
        JSON.stringify(finalShiftCloseOperationsSchema.parse(envelope)),
      );
    } catch {
      throw new ShiftRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the final shift close operation.",
      );
    }
  }

  private finishFinalShiftClose(
    operation: z.infer<typeof finalShiftCloseOperationSchema>,
    recovering: boolean,
  ): FinalShiftCloseResult {
    const input = operation.input;
    const envelope = this.readEnvelope(input.holeId);
    const current = envelope.shifts.find(
      (shift) => shift.localId === input.shiftId,
    );
    if (current === undefined) {
      throw new ShiftRepositoryError("NOT_FOUND", "The final shift was not found.");
    }

    let shift = current;
    if (operation.status === "PREPARED" && current.status === "OPEN") {
      if (current.version !== input.expectedVersion) {
        throw new ShiftRepositoryError(
          "STALE_VERSION",
          "The final shift no longer matches the prepared close operation.",
        );
      }
      shift = {
        ...current,
        updatedAt: input.closedAt,
        version: current.version + 1,
        closedAt: input.closedAt,
        endingDepthDm: decimetres(input.endingState.depthDm),
        endingRodNumber: input.endingState.rodNumber,
        endingRodStringDm: decimetres(input.endingState.rodStringDm),
        endingMeasuredStickUpDm:
          input.endingState.measuredStickUpDm === undefined
            ? undefined
            : decimetres(input.endingState.measuredStickUpDm),
        endingRunNumber: input.endingState.runNumber,
        closeAnalyticsSnapshot:
          current.closeAnalyticsSnapshot ??
          asCloseAnalyticsSnapshot(input.closeAnalyticsSnapshot),
        status: "CLOSED",
      };
      this.writeEnvelope(
        input.holeId,
        envelope.shifts.map((candidate) =>
          candidate.localId === shift.localId ? shift : candidate,
        ),
        input.closedAt,
        envelope.revision,
      );
    } else if (
      current.status !== "CLOSED" ||
      current.version !== input.expectedVersion + 1 ||
      current.closedAt !== input.closedAt ||
      current.updatedAt !== input.closedAt ||
      current.endingDepthDm !== input.endingState.depthDm ||
      current.endingRodNumber !== input.endingState.rodNumber ||
      current.endingRodStringDm !== input.endingState.rodStringDm ||
      current.endingMeasuredStickUpDm !==
        input.endingState.measuredStickUpDm ||
      current.endingRunNumber !== input.endingState.runNumber ||
      current.handoverAcceptedAt !== undefined
    ) {
      throw new ShiftRepositoryError(
        "OPERATION_CONFLICT",
        "The saved final shift close operation does not match the current shift.",
      );
    }

    if (operation.status === "PREPARED") {
      const operationsEnvelope = this.readFinalCloseOperations(input.holeId);
      this.writeFinalCloseOperations({
        ...operationsEnvelope,
        operations: operationsEnvelope.operations.map((candidate) =>
          candidate.operationId === operation.operationId
            ? { ...candidate, status: "COMPLETE" }
            : candidate,
        ),
      });
    }
    return {
      shift,
      status:
        operation.status === "COMPLETE"
          ? "already-closed"
          : recovering
            ? "recovered"
            : "closed",
    };
  }

  private async finishOperation(
    operation: z.infer<typeof handoverOperationSchema>,
    recovering: boolean,
  ): Promise<HandoverResult> {
    const envelope = this.readEnvelope(operation.holeId);
    const currentOutgoing = envelope.shifts.find(
      (shift) => shift.localId === operation.outgoingShiftId,
    );
    if (currentOutgoing === undefined) {
      throw new ShiftRepositoryError("NOT_FOUND", "The outgoing shift was not found.");
    }
    const existingIncoming = envelope.shifts.find(
      (shift) => shift.localId === operation.incomingShift.localId,
    );

    let outgoing = currentOutgoing;
    let incoming = existingIncoming;
    if (outgoing.status !== "CLOSED" || incoming === undefined) {
      if (
        outgoing.status !== "HANDOVER_PENDING" ||
        outgoing.version !== operation.expectedVersion
      ) {
        throw new ShiftRepositoryError(
          "STALE_VERSION",
          "The pending handover no longer matches the saved operation.",
        );
      }
      outgoing = {
        ...outgoing,
        status: "CLOSED",
        handoverAcceptedBy: operation.acceptedBy,
        handoverAcceptedByNameSnapshot: operation.acceptedByNameSnapshot,
        handoverAcceptedAt: operation.acceptedAt,
        updatedAt: operation.acceptedAt,
        version: outgoing.version + 1,
      };
      incoming = asShift(operation.incomingShift);
      const nextShifts = envelope.shifts
        .map((shift) => (shift.localId === outgoing.localId ? outgoing : shift))
        .filter((shift) => shift.localId !== incoming!.localId);
      this.writeEnvelope(
        operation.holeId,
        [...nextShifts, incoming],
        operation.acceptedAt,
        envelope.revision,
      );
    }

    this.writeOperation({ ...operation, status: "COMPLETE" });
    return {
      outgoingShift: outgoing,
      incomingShift: incoming,
      status: recovering ? "recovered" : "accepted",
    };
  }
}

export function createBrowserShiftRepository(
  seedShifts: readonly RunbookShift[] = [],
  mutationGuard?: HoleMutationGuardPort,
): ShiftRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalShiftRepository(storage, seedShifts, mutationGuard);
}
