import { z } from "zod";

import {
  decimetres,
  validateCasingRange,
  type CasingEvent,
  type CasingStatus,
  type CasingString,
  type Decimetres,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const CASING_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const EPOCH = new Date(0).toISOString();

const isoTimestampSchema = z.string().datetime();
const depthSchema = z.number().int().nonnegative();
const localMetadataShape = {
  localId: z.string().trim().min(1),
  serverId: z.string().trim().min(1).nullable(),
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
  deviceId: z.string().trim().min(1),
  version: z.number().int().positive(),
};

const casingStatusSchema = z.enum([
  "ACTIVE",
  "COMPLETED",
  "REMOVED",
  "ABANDONED",
]);

const casingStringSchema = z
  .object({
    ...localMetadataShape,
    holeId: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    casingSize: z.string().trim().min(1),
    startDepthDm: depthSchema,
    currentEndDepthDm: depthSchema,
    status: casingStatusSchema,
    installedAt: isoTimestampSchema,
    installedByUserId: z.string().trim().min(1),
    installedByNameSnapshot: z.string().trim().min(1),
  })
  .strict();

const casingEventSchema = z
  .object({
    ...localMetadataShape,
    holeId: z.string().trim().min(1),
    casingStringId: z.string().trim().min(1),
    shiftId: z.string().trim().min(1).optional(),
    eventType: z.enum([
      "INSTALL",
      "ADVANCE",
      "SHORTEN",
      "REMOVE",
      "STATUS_CHANGE",
      "CORRECT",
    ]),
    previousEndDepthDm: depthSchema.optional(),
    newEndDepthDm: depthSchema,
    previousStatus: casingStatusSchema.optional(),
    newStatus: casingStatusSchema.optional(),
    reason: z.string().trim().min(1).optional(),
    comment: z.string().trim().min(1).optional(),
    recordedByUserId: z.string().trim().min(1),
    recordedByNameSnapshot: z.string().trim().min(1),
    recordedAt: isoTimestampSchema,
    operationId: z.string().trim().min(1),
  })
  .strict();

const operationSchema = z
  .object({
    operationId: z.string().trim().min(1),
    kind: z.enum([
      "install",
      "advance",
      "shorten",
      "remove",
      "correct",
      "status",
    ]),
    payload: z.string().min(1),
    casingStringId: z.string().trim().min(1),
    eventId: z.string().trim().min(1),
  })
  .strict();

const casingEnvelopeSchema = z
  .object({
    version: z.literal(CASING_STORAGE_VERSION),
    holeId: z.string().trim().min(1),
    revision: z.number().int().nonnegative(),
    updatedAt: isoTimestampSchema,
    casingStrings: z.array(casingStringSchema),
    events: z.array(casingEventSchema),
    operations: z.array(operationSchema),
  })
  .strict();

type StoredOperation = z.infer<typeof operationSchema>;
type OperationKind = StoredOperation["kind"];

interface CasingEnvelope {
  readonly version: typeof CASING_STORAGE_VERSION;
  readonly holeId: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly casingStrings: readonly CasingString[];
  readonly events: readonly CasingEvent[];
  readonly operations: readonly StoredOperation[];
}

interface CasingEventInput {
  readonly operationId: string;
  readonly eventId?: string;
  readonly holeId: string;
  readonly casingStringId: string;
  readonly shiftId?: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: string;
  readonly comment?: string;
  readonly expectedVersion?: number;
}

interface AboveDepthInput {
  readonly currentHoleDepthDm: Decimetres;
  readonly aboveDepthConfirmed?: boolean;
  readonly aboveDepthReason?: string;
}

export interface InstallCasingInput extends AboveDepthInput {
  readonly operationId: string;
  readonly eventId?: string;
  readonly casingStringId: string;
  readonly holeId: string;
  readonly shiftId?: string;
  readonly label?: string;
  readonly casingSize: string;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm: Decimetres;
  readonly installedAt?: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: string;
  readonly comment?: string;
}

export interface AdvanceCasingInput
  extends CasingEventInput,
    AboveDepthInput {
  readonly newEndDepthDm: Decimetres;
  readonly reason?: string;
}

export interface ShortenCasingInput
  extends CasingEventInput,
    AboveDepthInput {
  readonly newEndDepthDm: Decimetres;
  readonly reason: string;
}

export interface RemoveCasingInput extends CasingEventInput {
  readonly reason: string;
}

export interface CorrectCasingInput
  extends CasingEventInput,
    AboveDepthInput {
  readonly newEndDepthDm?: Decimetres;
  readonly newStatus?: CasingStatus;
  readonly reason: string;
}

export interface UpdateCasingStatusInput extends CasingEventInput {
  readonly newStatus: CasingStatus;
  readonly reason: string;
}

export type CasingRepositoryErrorCode =
  | "CORRUPTED_STORAGE"
  | "DEPTH_CONFIRMATION_REQUIRED"
  | "DUPLICATE_ID"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_DEPTH"
  | "INVALID_STATE"
  | "INVALID_STATUS"
  | "NOT_FOUND"
  | "OUT_OF_ORDER_EVENT"
  | "STALE_VERSION"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_FAILED";

export class CasingRepositoryError extends Error {
  constructor(
    readonly code: CasingRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CasingRepositoryError";
  }
}

export interface CasingRepository {
  listByHole(holeId: string): Promise<readonly CasingString[]>;
  getById(
    casingStringId: string,
    holeId: string,
  ): Promise<CasingString | null>;
  listEvents(
    holeId: string,
    casingStringId?: string,
  ): Promise<readonly CasingEvent[]>;
  install(input: InstallCasingInput): Promise<CasingString>;
  advance(input: AdvanceCasingInput): Promise<CasingString>;
  shorten(input: ShortenCasingInput): Promise<CasingString>;
  remove(input: RemoveCasingInput): Promise<CasingString>;
  correct(input: CorrectCasingInput): Promise<CasingString>;
  setStatus(input: UpdateCasingStatusInput): Promise<CasingString>;
  updateStatus(input: UpdateCasingStatusInput): Promise<CasingString>;
}

function casingKey(holeId: string): string {
  return `targetlock:prototype:v${CASING_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:casing`;
}

function asCasingString(
  value: z.infer<typeof casingStringSchema>,
): CasingString {
  return {
    ...value,
    startDepthDm: decimetres(value.startDepthDm),
    currentEndDepthDm: decimetres(value.currentEndDepthDm),
  };
}

function asCasingEvent(
  value: z.infer<typeof casingEventSchema>,
): CasingEvent {
  return {
    ...value,
    previousEndDepthDm:
      value.previousEndDepthDm === undefined
        ? undefined
        : decimetres(value.previousEndDepthDm),
    newEndDepthDm: decimetres(value.newEndDepthDm),
  };
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CasingRepositoryError(
      "VALIDATION_FAILED",
      `${field} is required.`,
    );
  }
  return normalized;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isoTimestamp(value: string, field: string): string {
  const result = isoTimestampSchema.safeParse(value);
  if (!result.success) {
    throw new CasingRepositoryError(
      "VALIDATION_FAILED",
      `${field} must be a valid ISO timestamp.`,
    );
  }
  return result.data;
}

function depth(value: Decimetres, field: string): Decimetres {
  const result = depthSchema.safeParse(value);
  if (!result.success || !Number.isSafeInteger(result.data)) {
    throw new CasingRepositoryError(
      "INVALID_DEPTH",
      `${field} must be a non-negative whole number of decimetres.`,
    );
  }
  return decimetres(result.data);
}

function canonicalPayload(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(value);
}

function assertUnique(values: readonly string[], description: string): void {
  if (new Set(values).size !== values.length) {
    throw new CasingRepositoryError(
      "CORRUPTED_STORAGE",
      `Persisted casing data contains duplicate ${description}.`,
    );
  }
}

function assertEnvelopeInvariants(envelope: CasingEnvelope): void {
  assertUnique(
    envelope.casingStrings.map(({ localId }) => localId),
    "casing identifiers",
  );
  assertUnique(
    envelope.events.map(({ localId }) => localId),
    "event identifiers",
  );
  assertUnique(
    envelope.events.map(({ operationId }) => operationId),
    "event operation identifiers",
  );
  assertUnique(
    envelope.operations.map(({ operationId }) => operationId),
    "operation identifiers",
  );

  const stringsById = new Map(
    envelope.casingStrings.map((casing) => [casing.localId, casing]),
  );
  for (const casing of envelope.casingStrings) {
    if (
      casing.holeId !== envelope.holeId ||
      casing.currentEndDepthDm < casing.startDepthDm
    ) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted casing projections are invalid or belong to another hole.",
      );
    }
  }

  for (const event of envelope.events) {
    if (
      event.holeId !== envelope.holeId ||
      !stringsById.has(event.casingStringId)
    ) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted casing events are invalid or belong to another hole.",
      );
    }
  }

  for (const operation of envelope.operations) {
    const event = envelope.events.find(
      ({ localId }) => localId === operation.eventId,
    );
    if (
      event?.operationId !== operation.operationId ||
      event.casingStringId !== operation.casingStringId
    ) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted casing idempotency records do not match their events.",
      );
    }
  }

  for (const casing of envelope.casingStrings) {
    const events = envelope.events.filter(
      ({ casingStringId }) => casingStringId === casing.localId,
    );
    if (events.length === 0) continue;

    const first = events[0]!;
    if (
      first.eventType !== "INSTALL" &&
      first.previousEndDepthDm === undefined
    ) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "A casing event stream has no recoverable starting depth.",
      );
    }

    let endDepthDm =
      first.eventType === "INSTALL"
        ? casing.startDepthDm
        : first.previousEndDepthDm!;
    let status: CasingStatus =
      first.previousStatus ??
      (first.eventType === "INSTALL" ? "ACTIVE" : casing.status);
    let previousRecordedAt: string | undefined;

    for (const [index, event] of events.entries()) {
      if (
        event.eventType === "INSTALL" &&
        (index !== 0 || event.previousEndDepthDm !== undefined)
      ) {
        throw new CasingRepositoryError(
          "CORRUPTED_STORAGE",
          "A casing install event appears in an invalid history position.",
        );
      }
      if (
        previousRecordedAt !== undefined &&
        event.recordedAt < previousRecordedAt
      ) {
        throw new CasingRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted casing events are not in chronological order.",
        );
      }
      if (
        event.previousEndDepthDm !== undefined &&
        event.previousEndDepthDm !== endDepthDm
      ) {
        throw new CasingRepositoryError(
          "CORRUPTED_STORAGE",
          "A persisted casing event does not continue from the previous depth.",
        );
      }
      if (
        event.previousStatus !== undefined &&
        event.previousStatus !== status
      ) {
        throw new CasingRepositoryError(
          "CORRUPTED_STORAGE",
          "A persisted casing event does not continue from the previous status.",
        );
      }
      if (event.newEndDepthDm < casing.startDepthDm) {
        throw new CasingRepositoryError(
          "CORRUPTED_STORAGE",
          "A persisted casing event ends before its casing start depth.",
        );
      }

      endDepthDm = event.newEndDepthDm;
      status = event.newStatus ?? status;
      previousRecordedAt = event.recordedAt;
    }

    if (
      endDepthDm !== casing.currentEndDepthDm ||
      status !== casing.status
    ) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "The current casing projection does not match its immutable history.",
      );
    }
  }
}

function decodeEnvelope(value: unknown, holeId: string): CasingEnvelope {
  const result = casingEnvelopeSchema.safeParse(value);
  if (!result.success || result.data.holeId !== holeId) {
    throw new CasingRepositoryError(
      "CORRUPTED_STORAGE",
      "Persisted casing data is incompatible or belongs to another hole.",
    );
  }

  const envelope: CasingEnvelope = {
    ...result.data,
    casingStrings: result.data.casingStrings.map(asCasingString),
    events: result.data.events.map(asCasingEvent),
  };
  assertEnvelopeInvariants(envelope);
  return envelope;
}

function validateRange(
  startDepthDm: Decimetres,
  endDepthDm: Decimetres,
  input: AboveDepthInput,
): string | undefined {
  const currentHoleDepthDm = depth(
    input.currentHoleDepthDm,
    "Current hole depth",
  );
  const result = validateCasingRange(
    startDepthDm,
    endDepthDm,
    currentHoleDepthDm,
  );
  if (!result.ok) {
    throw new CasingRepositoryError("INVALID_DEPTH", result.reason);
  }
  if (!result.requiresDepthConfirmation) return undefined;

  const reason = optionalText(input.aboveDepthReason);
  if (input.aboveDepthConfirmed !== true || reason === undefined) {
    throw new CasingRepositoryError(
      "DEPTH_CONFIRMATION_REQUIRED",
      "Casing above the current hole depth requires explicit confirmation and a reason.",
    );
  }
  return reason;
}

function operationEventId(
  operationId: string,
  eventId: string | undefined,
): string {
  return optionalText(eventId) ?? `casing-event:${operationId}`;
}

export class LocalCasingRepository implements CasingRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly seedCasingStrings: readonly CasingString[] = [],
    private readonly seedEvents: readonly CasingEvent[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private readEnvelope(holeIdInput: string): CasingEnvelope {
    const holeId = requiredText(holeIdInput, "Hole identifier");
    let raw: string | null;
    try {
      raw = this.storage.getItem(casingKey(holeId));
    } catch {
      throw new CasingRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }

    if (raw === null) {
      const casingStrings = this.seedCasingStrings.filter(
        (casing) => casing.holeId === holeId,
      );
      const events = this.seedEvents.filter((event) => event.holeId === holeId);
      const updatedAt = [...casingStrings.map(({ updatedAt }) => updatedAt), ...events.map(({ updatedAt }) => updatedAt)]
        .sort()
        .at(-1);
      return decodeEnvelope(
        {
          version: CASING_STORAGE_VERSION,
          holeId,
          revision: 0,
          updatedAt: updatedAt ?? EPOCH,
          casingStrings,
          events,
          operations: [],
        },
        holeId,
      );
    }

    try {
      return decodeEnvelope(JSON.parse(raw) as unknown, holeId);
    } catch (error) {
      if (error instanceof CasingRepositoryError) throw error;
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted casing data is not valid JSON.",
      );
    }
  }

  private writeEnvelope(
    envelope: CasingEnvelope,
    casingStrings: readonly CasingString[],
    events: readonly CasingEvent[],
    operations: readonly StoredOperation[],
    updatedAt: string,
  ): void {
    const candidate = decodeEnvelope(
      {
        version: CASING_STORAGE_VERSION,
        holeId: envelope.holeId,
        revision: envelope.revision + 1,
        updatedAt,
        casingStrings,
        events,
        operations,
      },
      envelope.holeId,
    );
    try {
      this.storage.setItem(casingKey(envelope.holeId), JSON.stringify(candidate));
    } catch {
      throw new CasingRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the casing record.",
      );
    }
  }

  private replay(
    envelope: CasingEnvelope,
    operationId: string,
    kind: OperationKind,
    payload: string,
  ): CasingString | null {
    const operation = envelope.operations.find(
      (candidate) => candidate.operationId === operationId,
    );
    if (operation === undefined) {
      if (
        envelope.events.some((event) => event.operationId === operationId)
      ) {
        throw new CasingRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This operation identifier already belongs to an immutable seeded event.",
        );
      }
      return null;
    }
    if (operation.kind !== kind || operation.payload !== payload) {
      throw new CasingRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "This operation identifier was already used with different casing data.",
      );
    }

    const casing = envelope.casingStrings.find(
      ({ localId }) => localId === operation.casingStringId,
    );
    if (casing === undefined) {
      throw new CasingRepositoryError(
        "CORRUPTED_STORAGE",
        "The saved casing operation has no current projection.",
      );
    }
    return casing;
  }

  private current(
    envelope: CasingEnvelope,
    casingStringIdInput: string,
  ): CasingString {
    const casingStringId = requiredText(
      casingStringIdInput,
      "Casing identifier",
    );
    const casing = envelope.casingStrings.find(
      ({ localId }) => localId === casingStringId,
    );
    if (casing === undefined) {
      throw new CasingRepositoryError(
        "NOT_FOUND",
        "The casing string was not found in this hole.",
      );
    }
    return casing;
  }

  private assertMutable(
    casing: CasingString,
    expectedVersion: number | undefined,
    recordedAt: string,
  ): void {
    if (
      expectedVersion !== undefined &&
      expectedVersion !== casing.version
    ) {
      throw new CasingRepositoryError(
        "STALE_VERSION",
        "The casing string changed in another view. Reload before saving.",
      );
    }
    if (recordedAt < casing.updatedAt) {
      throw new CasingRepositoryError(
        "OUT_OF_ORDER_EVENT",
        "A casing event cannot be recorded before the current projection.",
      );
    }
  }

  private append(
    envelope: CasingEnvelope,
    current: CasingString,
    updated: CasingString,
    event: CasingEvent,
    operation: StoredOperation,
  ): CasingString {
    if (envelope.events.some(({ localId }) => localId === event.localId)) {
      throw new CasingRepositoryError(
        "DUPLICATE_ID",
        "The casing event identifier is already in use.",
      );
    }
    this.writeEnvelope(
      envelope,
      envelope.casingStrings.map((casing) =>
        casing.localId === current.localId ? updated : casing,
      ),
      [...envelope.events, event],
      [...envelope.operations, operation],
      event.recordedAt,
    );
    return updated;
  }

  async listByHole(holeId: string): Promise<readonly CasingString[]> {
    return [...this.readEnvelope(holeId).casingStrings].sort(
      (left, right) =>
        left.startDepthDm - right.startDepthDm ||
        left.currentEndDepthDm - right.currentEndDepthDm ||
        left.casingSize.localeCompare(right.casingSize) ||
        left.localId.localeCompare(right.localId),
    );
  }

  async getById(
    casingStringId: string,
    holeId: string,
  ): Promise<CasingString | null> {
    return (
      this.readEnvelope(holeId).casingStrings.find(
        ({ localId }) => localId === casingStringId,
      ) ?? null
    );
  }

  async listEvents(
    holeId: string,
    casingStringId?: string,
  ): Promise<readonly CasingEvent[]> {
    const events = this.readEnvelope(holeId).events;
    return casingStringId === undefined
      ? [...events]
      : events.filter((event) => event.casingStringId === casingStringId);
  }

  async install(input: InstallCasingInput): Promise<CasingString> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const operationId = requiredText(input.operationId, "Operation identifier");
    const casingStringId = requiredText(
      input.casingStringId,
      "Casing identifier",
    );
    const eventId = operationEventId(operationId, input.eventId);
    const holeId = requiredText(input.holeId, "Hole identifier");
    const startDepthDm = depth(input.startDepthDm, "Casing start depth");
    const endDepthDm = depth(input.endDepthDm, "Casing end depth");
    const currentHoleDepthDm = depth(
      input.currentHoleDepthDm,
      "Current hole depth",
    );
    const aboveDepthReason = validateRange(startDepthDm, endDepthDm, {
      currentHoleDepthDm,
      aboveDepthConfirmed: input.aboveDepthConfirmed,
      aboveDepthReason: input.aboveDepthReason,
    });
    const recordedAt = isoTimestamp(input.recordedAt, "Recorded time");
    const installedAt = isoTimestamp(
      input.installedAt ?? recordedAt,
      "Installed time",
    );
    if (recordedAt < installedAt) {
      throw new CasingRepositoryError(
        "VALIDATION_FAILED",
        "The install event cannot be recorded before the casing was installed.",
      );
    }
    const normalized = {
      operationId,
      eventId,
      casingStringId,
      holeId,
      shiftId: optionalText(input.shiftId),
      label: optionalText(input.label),
      casingSize: requiredText(input.casingSize, "Casing size"),
      startDepthDm,
      endDepthDm,
      currentHoleDepthDm,
      aboveDepthConfirmed: input.aboveDepthConfirmed === true,
      aboveDepthReason: optionalText(input.aboveDepthReason),
      installedAt,
      recordedByUserId: requiredText(
        input.recordedByUserId,
        "Recording user identifier",
      ),
      recordedByNameSnapshot: requiredText(
        input.recordedByNameSnapshot,
        "Recording user name",
      ),
      recordedAt,
      comment: optionalText(input.comment),
    };
    const payload = canonicalPayload(normalized);
    const envelope = this.readEnvelope(holeId);
    const replay = this.replay(envelope, operationId, "install", payload);
    if (replay !== null) return replay;
    if (
      envelope.casingStrings.some(
        ({ localId }) => localId === casingStringId,
      )
    ) {
      throw new CasingRepositoryError(
        "DUPLICATE_ID",
        "The casing identifier is already in use in this hole.",
      );
    }
    if (envelope.events.some(({ localId }) => localId === eventId)) {
      throw new CasingRepositoryError(
        "DUPLICATE_ID",
        "The casing event identifier is already in use.",
      );
    }

    const casing: CasingString = {
      localId: casingStringId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: installedAt,
      updatedAt: recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId,
      label: normalized.label,
      casingSize: normalized.casingSize,
      startDepthDm,
      currentEndDepthDm: endDepthDm,
      status: "ACTIVE",
      installedAt,
      installedByUserId: normalized.recordedByUserId,
      installedByNameSnapshot: normalized.recordedByNameSnapshot,
    };
    const event: CasingEvent = {
      localId: eventId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: recordedAt,
      updatedAt: recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId,
      casingStringId,
      shiftId: normalized.shiftId,
      eventType: "INSTALL",
      newEndDepthDm: endDepthDm,
      newStatus: "ACTIVE",
      reason: aboveDepthReason,
      comment: normalized.comment,
      recordedByUserId: normalized.recordedByUserId,
      recordedByNameSnapshot: normalized.recordedByNameSnapshot,
      recordedAt,
      operationId,
    };
    const operation: StoredOperation = {
      operationId,
      kind: "install",
      payload,
      casingStringId,
      eventId,
    };
    this.writeEnvelope(
      envelope,
      [...envelope.casingStrings, casing],
      [...envelope.events, event],
      [...envelope.operations, operation],
      recordedAt,
    );
    return casing;
  }

  async advance(input: AdvanceCasingInput): Promise<CasingString> {
    return this.changeDepth("advance", input);
  }

  async shorten(input: ShortenCasingInput): Promise<CasingString> {
    return this.changeDepth("shorten", input);
  }

  private async changeDepth(
    kind: "advance" | "shorten",
    input: AdvanceCasingInput | ShortenCasingInput,
  ): Promise<CasingString> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const operationId = requiredText(input.operationId, "Operation identifier");
    const casingStringId = requiredText(
      input.casingStringId,
      "Casing identifier",
    );
    const eventId = operationEventId(operationId, input.eventId);
    const holeId = requiredText(input.holeId, "Hole identifier");
    const newEndDepthDm = depth(input.newEndDepthDm, "New casing end depth");
    const currentHoleDepthDm = depth(
      input.currentHoleDepthDm,
      "Current hole depth",
    );
    const recordedAt = isoTimestamp(input.recordedAt, "Recorded time");
    const reason =
      kind === "shorten"
        ? requiredText(input.reason ?? "", "Shortening reason")
        : optionalText(input.reason);
    const normalized = {
      operationId,
      eventId,
      casingStringId,
      holeId,
      shiftId: optionalText(input.shiftId),
      newEndDepthDm,
      currentHoleDepthDm,
      aboveDepthConfirmed: input.aboveDepthConfirmed === true,
      aboveDepthReason: optionalText(input.aboveDepthReason),
      reason,
      recordedByUserId: requiredText(
        input.recordedByUserId,
        "Recording user identifier",
      ),
      recordedByNameSnapshot: requiredText(
        input.recordedByNameSnapshot,
        "Recording user name",
      ),
      recordedAt,
      comment: optionalText(input.comment),
      expectedVersion: input.expectedVersion,
    };
    const payload = canonicalPayload(normalized);
    const envelope = this.readEnvelope(holeId);
    const replay = this.replay(envelope, operationId, kind, payload);
    if (replay !== null) return replay;
    const current = this.current(envelope, casingStringId);
    this.assertMutable(current, input.expectedVersion, recordedAt);
    if (current.status !== "ACTIVE") {
      throw new CasingRepositoryError(
        "INVALID_STATE",
        "Only active casing can be advanced or shortened.",
      );
    }
    if (
      (kind === "advance" &&
        newEndDepthDm <= current.currentEndDepthDm) ||
      (kind === "shorten" &&
        newEndDepthDm >= current.currentEndDepthDm)
    ) {
      throw new CasingRepositoryError(
        "INVALID_DEPTH",
        kind === "advance"
          ? "An advance must end deeper than the current casing depth."
          : "A shortening must end shallower than the current casing depth.",
      );
    }
    const aboveDepthReason = validateRange(
      current.startDepthDm,
      newEndDepthDm,
      {
        currentHoleDepthDm,
        aboveDepthConfirmed: input.aboveDepthConfirmed,
        aboveDepthReason: input.aboveDepthReason,
      },
    );
    const updated: CasingString = {
      ...current,
      currentEndDepthDm: newEndDepthDm,
      updatedAt: recordedAt,
      version: current.version + 1,
    };
    const event: CasingEvent = {
      localId: eventId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: recordedAt,
      updatedAt: recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId,
      casingStringId,
      shiftId: normalized.shiftId,
      eventType: kind === "advance" ? "ADVANCE" : "SHORTEN",
      previousEndDepthDm: current.currentEndDepthDm,
      newEndDepthDm,
      previousStatus: current.status,
      newStatus: current.status,
      reason: reason ?? aboveDepthReason,
      comment: normalized.comment,
      recordedByUserId: normalized.recordedByUserId,
      recordedByNameSnapshot: normalized.recordedByNameSnapshot,
      recordedAt,
      operationId,
    };
    return this.append(envelope, current, updated, event, {
      operationId,
      kind,
      payload,
      casingStringId,
      eventId,
    });
  }

  async remove(input: RemoveCasingInput): Promise<CasingString> {
    return this.changeStatus("remove", input, "REMOVED");
  }

  async setStatus(input: UpdateCasingStatusInput): Promise<CasingString> {
    return this.changeStatus("status", input, input.newStatus);
  }

  async updateStatus(
    input: UpdateCasingStatusInput,
  ): Promise<CasingString> {
    return this.setStatus(input);
  }

  private async changeStatus(
    kind: "remove" | "status",
    input: RemoveCasingInput | UpdateCasingStatusInput,
    newStatus: CasingStatus,
  ): Promise<CasingString> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const operationId = requiredText(input.operationId, "Operation identifier");
    const casingStringId = requiredText(
      input.casingStringId,
      "Casing identifier",
    );
    const eventId = operationEventId(operationId, input.eventId);
    const holeId = requiredText(input.holeId, "Hole identifier");
    const recordedAt = isoTimestamp(input.recordedAt, "Recorded time");
    const reason = requiredText(input.reason, "Status change reason");
    const normalized = {
      operationId,
      eventId,
      casingStringId,
      holeId,
      shiftId: optionalText(input.shiftId),
      newStatus,
      reason,
      recordedByUserId: requiredText(
        input.recordedByUserId,
        "Recording user identifier",
      ),
      recordedByNameSnapshot: requiredText(
        input.recordedByNameSnapshot,
        "Recording user name",
      ),
      recordedAt,
      comment: optionalText(input.comment),
      expectedVersion: input.expectedVersion,
    };
    const payload = canonicalPayload(normalized);
    const envelope = this.readEnvelope(holeId);
    const replay = this.replay(envelope, operationId, kind, payload);
    if (replay !== null) return replay;
    const current = this.current(envelope, casingStringId);
    this.assertMutable(current, input.expectedVersion, recordedAt);
    if (current.status === newStatus) {
      throw new CasingRepositoryError(
        "INVALID_STATUS",
        "The casing already has the requested status.",
      );
    }
    if (
      (current.status === "REMOVED" || current.status === "ABANDONED") &&
      kind !== "remove"
    ) {
      throw new CasingRepositoryError(
        "INVALID_STATUS",
        "Removed or abandoned casing can only be changed through a correction.",
      );
    }
    if (kind === "remove" && current.status === "REMOVED") {
      throw new CasingRepositoryError(
        "INVALID_STATUS",
        "The casing has already been removed.",
      );
    }
    if (newStatus === "ACTIVE" && current.status !== "ACTIVE") {
      throw new CasingRepositoryError(
        "INVALID_STATUS",
        "Reactivating casing requires a correction.",
      );
    }

    const updated: CasingString = {
      ...current,
      status: newStatus,
      updatedAt: recordedAt,
      version: current.version + 1,
    };
    const event: CasingEvent = {
      localId: eventId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: recordedAt,
      updatedAt: recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId,
      casingStringId,
      shiftId: normalized.shiftId,
      eventType: newStatus === "REMOVED" ? "REMOVE" : "STATUS_CHANGE",
      previousEndDepthDm: current.currentEndDepthDm,
      newEndDepthDm: current.currentEndDepthDm,
      previousStatus: current.status,
      newStatus,
      reason,
      comment: normalized.comment,
      recordedByUserId: normalized.recordedByUserId,
      recordedByNameSnapshot: normalized.recordedByNameSnapshot,
      recordedAt,
      operationId,
    };
    return this.append(envelope, current, updated, event, {
      operationId,
      kind,
      payload,
      casingStringId,
      eventId,
    });
  }

  async correct(input: CorrectCasingInput): Promise<CasingString> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const operationId = requiredText(input.operationId, "Operation identifier");
    const casingStringId = requiredText(
      input.casingStringId,
      "Casing identifier",
    );
    const eventId = operationEventId(operationId, input.eventId);
    const holeId = requiredText(input.holeId, "Hole identifier");
    const currentHoleDepthDm = depth(
      input.currentHoleDepthDm,
      "Current hole depth",
    );
    const recordedAt = isoTimestamp(input.recordedAt, "Recorded time");
    const reason = requiredText(input.reason, "Correction reason");
    const requestedEndDepthDm =
      input.newEndDepthDm === undefined
        ? undefined
        : depth(input.newEndDepthDm, "Corrected casing end depth");
    const normalized = {
      operationId,
      eventId,
      casingStringId,
      holeId,
      shiftId: optionalText(input.shiftId),
      newEndDepthDm: requestedEndDepthDm,
      newStatus: input.newStatus,
      currentHoleDepthDm,
      aboveDepthConfirmed: input.aboveDepthConfirmed === true,
      aboveDepthReason: optionalText(input.aboveDepthReason),
      reason,
      recordedByUserId: requiredText(
        input.recordedByUserId,
        "Recording user identifier",
      ),
      recordedByNameSnapshot: requiredText(
        input.recordedByNameSnapshot,
        "Recording user name",
      ),
      recordedAt,
      comment: optionalText(input.comment),
      expectedVersion: input.expectedVersion,
    };
    const payload = canonicalPayload(normalized);
    const envelope = this.readEnvelope(holeId);
    const replay = this.replay(envelope, operationId, "correct", payload);
    if (replay !== null) return replay;
    const current = this.current(envelope, casingStringId);
    this.assertMutable(current, input.expectedVersion, recordedAt);
    const newEndDepthDm =
      requestedEndDepthDm ?? current.currentEndDepthDm;
    const newStatus = input.newStatus ?? current.status;
    if (
      newEndDepthDm === current.currentEndDepthDm &&
      newStatus === current.status
    ) {
      throw new CasingRepositoryError(
        "VALIDATION_FAILED",
        "A correction must change the casing depth or status.",
      );
    }
    const aboveDepthReason = validateRange(
      current.startDepthDm,
      newEndDepthDm,
      {
        currentHoleDepthDm,
        aboveDepthConfirmed: input.aboveDepthConfirmed,
        aboveDepthReason: input.aboveDepthReason,
      },
    );
    const updated: CasingString = {
      ...current,
      currentEndDepthDm: newEndDepthDm,
      status: newStatus,
      updatedAt: recordedAt,
      version: current.version + 1,
    };
    const event: CasingEvent = {
      localId: eventId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: recordedAt,
      updatedAt: recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId,
      casingStringId,
      shiftId: normalized.shiftId,
      eventType: "CORRECT",
      previousEndDepthDm: current.currentEndDepthDm,
      newEndDepthDm,
      previousStatus: current.status,
      newStatus,
      reason: aboveDepthReason
        ? `${reason} Above-depth confirmation: ${aboveDepthReason}`
        : reason,
      comment: normalized.comment,
      recordedByUserId: normalized.recordedByUserId,
      recordedByNameSnapshot: normalized.recordedByNameSnapshot,
      recordedAt,
      operationId,
    };
    return this.append(envelope, current, updated, event, {
      operationId,
      kind: "correct",
      payload,
      casingStringId,
      eventId,
    });
  }
}

export function createBrowserCasingRepository(
  seedCasingStrings: readonly CasingString[] = [],
  seedEvents: readonly CasingEvent[] = [],
  mutationGuard?: HoleMutationGuardPort,
): CasingRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalCasingRepository(
        storage,
        seedCasingStrings,
        seedEvents,
        mutationGuard,
      );
}
