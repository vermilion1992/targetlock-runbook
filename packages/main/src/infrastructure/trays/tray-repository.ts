import { z } from "zod";

import {
  decimetres,
  type CorrectionValue,
  type Decimetres,
  type Photo,
  type Tray,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import {
  createBrowserMediaRepository,
  generateImagePreview,
  validateImageBlob,
  type MediaRepository,
} from "@/infrastructure/media";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const TRAY_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const metadataShape = {
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
};
const traySchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  shiftId: z.string().min(1).optional(),
  trayNumber: z.number().int().positive(),
  startDepthDm: z.number().int().nonnegative().optional(),
  endDepthDm: z.number().int().nonnegative().optional(),
  comment: z.string().trim().max(2_000).optional(),
  isFinalPartial: z.boolean(),
  primaryPhotoId: z.string().min(1),
  recordedByUserId: z.string().min(1),
  recordedByNameSnapshot: z.string().trim().min(1),
  recordedAt: z.string().datetime(),
});
const photoSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  entityType: z.enum(["TRAY", "SURVEY", "COMPONENT", "EVENT"]),
  entityId: z.string().min(1),
  category: z.enum(["TRAY", "SURVEY", "COMPONENT", "EVENT"]),
  originalStorageKey: z.string().min(1),
  previewStorageKey: z.string().min(1).optional(),
  originalFilename: z.string().min(1).optional(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  capturedAt: z.string().datetime(),
  description: z.string().trim().min(1).max(500).optional(),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().trim().min(1),
});
const correctionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const correctionSchema = z.object({
  id: z.string().min(1),
  trayId: z.string().min(1),
  fieldName: z.string().min(1),
  previousValue: correctionValueSchema,
  correctedValue: correctionValueSchema,
  reason: z.string().trim().min(1).max(500),
  correctedAt: z.string().datetime(),
  correctedByUserId: z.string().min(1),
  correctedByNameSnapshot: z.string().trim().min(1),
  operationId: z.string().min(1),
});
const operationStageSchema = z.enum([
  "PENDING",
  "ORIGINAL_SAVED",
  "PREVIEW_SAVED",
  "METADATA_SAVED",
  "TRAY_CREATED",
  "COMPLETED",
  "FAILED",
]);
const operationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(["CREATE", "REPLACE"]),
  inputJson: z.string(),
  stage: operationStageSchema,
  trayId: z.string().min(1),
  photoId: z.string().min(1),
  previousPhotoId: z.string().min(1).optional(),
  originalStorageKey: z.string().min(1).optional(),
  previewStorageKey: z.string().min(1).optional(),
  error: z.string().optional(),
  updatedAt: z.string().datetime(),
});
const envelopeSchema = z.object({
  version: z.literal(TRAY_STORAGE_VERSION),
  holeId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  trays: z.array(traySchema),
  photos: z.array(photoSchema),
  corrections: z.array(correctionSchema),
  operations: z.array(operationSchema),
});

export type MediaOperationStage = z.infer<typeof operationStageSchema>;

export interface TrayPendingOperation {
  readonly operationId: string;
  readonly kind: "CREATE" | "REPLACE";
  readonly stage: Exclude<MediaOperationStage, "COMPLETED" | "FAILED">;
  readonly trayId: string;
  readonly photoId: string;
  readonly updatedAt: string;
}

export interface TrayCorrection {
  readonly id: string;
  readonly trayId: string;
  readonly fieldName: string;
  readonly previousValue: CorrectionValue;
  readonly correctedValue: CorrectionValue;
  readonly reason: string;
  readonly correctedAt: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly operationId: string;
}

interface CommonPhotoInput {
  readonly operationId: string;
  readonly photoId: string;
  readonly holeId: string;
  readonly original: Blob;
  readonly preview?: Blob;
  readonly originalFilename?: string;
  readonly capturedAt: string;
  readonly description?: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
}

export interface CreateTrayWithPhotoInput extends CommonPhotoInput {
  readonly trayId: string;
  readonly shiftId?: string;
  readonly trayNumber: number;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly comment?: string;
  readonly isFinalPartial: boolean;
}

export interface UpdateTrayDetailsInput {
  readonly operationId: string;
  readonly correctionId: string;
  readonly trayId: string;
  readonly holeId: string;
  readonly expectedVersion: number;
  readonly trayNumber?: number;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly comment?: string;
  readonly isFinalPartial?: boolean;
  readonly reason: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface ReplaceTrayPhotoInput extends CommonPhotoInput {
  readonly trayId: string;
  readonly expectedVersion: number;
  readonly reason: string;
}

export interface CreatePhotoInput {
  readonly photo: Photo;
}

export interface TrayRepository {
  listByHole(holeId: string): Promise<readonly Tray[]>;
  getById(trayId: string, holeId: string): Promise<Tray | null>;
  findByNumber(holeId: string, trayNumber: number): Promise<Tray | null>;
  createWithPhoto(input: CreateTrayWithPhotoInput): Promise<Tray>;
  updateDetails(input: UpdateTrayDetailsInput): Promise<Tray>;
  replacePhoto(input: ReplaceTrayPhotoInput): Promise<Tray>;
  listCorrections(
    trayId: string,
    holeId: string,
  ): Promise<readonly TrayCorrection[]>;
  listPendingOperations(
    holeId: string,
  ): Promise<readonly TrayPendingOperation[]>;
  recoverInterruptedOperations(holeId: string): Promise<number>;
}

export interface PhotoRepository {
  getById(photoId: string, holeId: string): Promise<Photo | null>;
  listByEntity(
    holeId: string,
    entityType: Photo["entityType"],
    entityId: string,
  ): Promise<readonly Photo[]>;
  create(input: CreatePhotoInput): Promise<Photo>;
}

type Envelope = z.infer<typeof envelopeSchema>;
type StoredOperation = z.infer<typeof operationSchema>;

export class TrayRepositoryError extends Error {
  constructor(
    readonly code:
      | "CORRUPTED_STORAGE"
      | "DUPLICATE_TRAY_NUMBER"
      | "IDEMPOTENCY_CONFLICT"
      | "MEDIA_SAVE_FAILED"
      | "NOT_FOUND"
      | "STALE_VERSION"
      | "STORAGE_UNAVAILABLE"
      | "VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "TrayRepositoryError";
  }
}

function trayKey(holeId: string): string {
  return `targetlock:prototype:v${TRAY_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:trays`;
}

function asTray(value: z.infer<typeof traySchema>): Tray {
  return {
    ...value,
    startDepthDm:
      value.startDepthDm === undefined
        ? undefined
        : decimetres(value.startDepthDm),
    endDepthDm:
      value.endDepthDm === undefined ? undefined : decimetres(value.endDepthDm),
  };
}

function photoInputFingerprint(
  input: CommonPhotoInput & Record<string, unknown>,
): string {
  const { original, preview, ...serializable } = input;
  return JSON.stringify({
    ...serializable,
    original: { type: original.type, size: original.size },
    preview:
      preview === undefined ? null : { type: preview.type, size: preview.size },
  });
}

export class LocalTrayRepository implements TrayRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly media: MediaRepository,
    private readonly seedTrays: readonly Tray[] = [],
    private readonly seedPhotos: readonly Photo[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private read(holeId: string): Envelope {
    let raw: string | null;
    try {
      raw = this.storage.getItem(trayKey(holeId));
    } catch {
      throw new TrayRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) {
      return envelopeSchema.parse({
        version: TRAY_STORAGE_VERSION,
        holeId,
        revision: 0,
        updatedAt: new Date(0).toISOString(),
        trays: this.seedTrays.filter((tray) => tray.holeId === holeId),
        photos: this.seedPhotos.filter((photo) => photo.holeId === holeId),
        corrections: [],
        operations: [],
      });
    }
    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (!parsed.success || parsed.data.holeId !== holeId) {
        throw new TrayRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted trays are incompatible or belong to another hole.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof TrayRepositoryError) throw error;
      throw new TrayRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted trays are not valid JSON.",
      );
    }
  }

  private write(envelope: Envelope): void {
    try {
      this.storage.setItem(
        trayKey(envelope.holeId),
        JSON.stringify(envelopeSchema.parse(envelope)),
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new TrayRepositoryError(
          "VALIDATION_FAILED",
          "Tray data did not pass local validation.",
        );
      }
      throw new TrayRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save tray data.",
      );
    }
  }

  private updateOperation(
    envelope: Envelope,
    operationId: string,
    updates: Partial<StoredOperation>,
  ): Envelope {
    const operations = envelope.operations.map((operation) =>
      operation.operationId === operationId
        ? operationSchema.parse({ ...operation, ...updates })
        : operation,
    );
    const updatedAt = updates.updatedAt ?? envelope.updatedAt;
    const next = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt,
      operations,
    };
    this.write(next);
    return next;
  }

  async listByHole(holeId: string): Promise<readonly Tray[]> {
    return this.read(holeId)
      .trays.map(asTray)
      .sort((left, right) => right.trayNumber - left.trayNumber);
  }

  async getById(trayId: string, holeId: string): Promise<Tray | null> {
    const tray = this.read(holeId).trays.find(
      ({ localId }) => localId === trayId,
    );
    return tray === undefined ? null : asTray(tray);
  }

  async findByNumber(
    holeId: string,
    trayNumber: number,
  ): Promise<Tray | null> {
    const tray = this.read(holeId).trays.find(
      (candidate) => candidate.trayNumber === trayNumber,
    );
    return tray === undefined ? null : asTray(tray);
  }

  async getPhotoById(photoId: string, holeId: string): Promise<Photo | null> {
    return (
      this.read(holeId).photos.find(({ localId }) => localId === photoId) ??
      null
    );
  }

  async listPhotosByEntity(
    holeId: string,
    entityType: Photo["entityType"],
    entityId: string,
  ): Promise<readonly Photo[]> {
    return this.read(holeId).photos.filter(
      (photo) =>
        photo.entityType === entityType && photo.entityId === entityId,
    );
  }

  async createPhoto(input: CreatePhotoInput): Promise<Photo> {
    const parsed = photoSchema.parse(input.photo);
    this.mutationGuard?.assertHoleMutable(parsed.holeId);
    const envelope = this.read(parsed.holeId);
    const existing = envelope.photos.find(
      ({ localId }) => localId === parsed.localId,
    );
    if (existing !== undefined) {
      if (JSON.stringify(existing) === JSON.stringify(parsed)) return existing;
      throw new TrayRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "Photo identifier is already used by different metadata.",
      );
    }
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: parsed.createdAt,
      photos: [...envelope.photos, parsed],
    });
    return parsed;
  }

  async listCorrections(
    trayId: string,
    holeId: string,
  ): Promise<readonly TrayCorrection[]> {
    const tray = await this.getById(trayId, holeId);
    if (tray === null) return [];
    return this.read(holeId)
      .corrections.filter((correction) => correction.trayId === trayId)
      .sort(
        (left, right) =>
          Date.parse(right.correctedAt) - Date.parse(left.correctedAt),
      );
  }

  async listPendingOperations(
    holeId: string,
  ): Promise<readonly TrayPendingOperation[]> {
    return this.read(holeId)
      .operations.filter(
        (
          operation,
        ): operation is StoredOperation & {
          stage: TrayPendingOperation["stage"];
        } =>
          operation.stage !== "COMPLETED" && operation.stage !== "FAILED",
      )
      .map(({ operationId, kind, stage, trayId, photoId, updatedAt }) => ({
        operationId,
        kind,
        stage,
        trayId,
        photoId,
        updatedAt,
      }));
  }

  private prepareOperation(
    holeId: string,
    operation: StoredOperation,
  ): { envelope: Envelope; operation: StoredOperation; completed?: Tray } {
    let envelope = this.read(holeId);
    const existing = envelope.operations.find(
      ({ operationId }) => operationId === operation.operationId,
    );
    if (existing !== undefined) {
      if (
        existing.kind !== operation.kind ||
        existing.inputJson !== operation.inputJson
      ) {
        throw new TrayRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "The operation identifier is already used by different tray data.",
        );
      }
      if (existing.stage === "COMPLETED") {
        const tray = envelope.trays.find(
          ({ localId }) => localId === existing.trayId,
        );
        if (tray !== undefined) {
          return { envelope, operation: existing, completed: asTray(tray) };
        }
      }
      return { envelope, operation: existing };
    }
    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: operation.updatedAt,
      operations: [...envelope.operations, operation],
    };
    this.write(envelope);
    return { envelope, operation };
  }

  private async saveMedia(
    envelope: Envelope,
    operation: StoredOperation,
    input: CommonPhotoInput,
  ): Promise<{
    readonly envelope: Envelope;
    readonly operation: StoredOperation;
    readonly width?: number;
    readonly height?: number;
  }> {
    validateImageBlob(input.original);
    let currentEnvelope = envelope;
    let currentOperation = operation;
    try {
      const original = await this.media.saveOriginal({
        operationId: input.operationId,
        holeId: input.holeId,
        blob: input.original,
      });
      if (!(await this.media.verify(original.storageKey))) {
        throw new Error("Original image verification failed.");
      }
      currentEnvelope = this.updateOperation(
        currentEnvelope,
        input.operationId,
        {
          stage: "ORIGINAL_SAVED",
          originalStorageKey: original.storageKey,
          updatedAt: input.capturedAt,
          error: undefined,
        },
      );
      currentOperation = currentEnvelope.operations.find(
        ({ operationId }) => operationId === input.operationId,
      )!;

      let previewBlob = input.preview;
      let width: number | undefined;
      let height: number | undefined;
      if (previewBlob === undefined) {
        try {
          const generated = await generateImagePreview(input.original);
          previewBlob = generated.blob;
          width = generated.width;
          height = generated.height;
        } catch {
          previewBlob = undefined;
        }
      }
      let previewStorageKey: string | undefined;
      if (previewBlob !== undefined) {
        const preview = await this.media.savePreview({
          operationId: input.operationId,
          holeId: input.holeId,
          blob: previewBlob,
        });
        if (!(await this.media.verify(preview.storageKey))) {
          throw new Error("Preview image verification failed.");
        }
        previewStorageKey = preview.storageKey;
      }
      currentEnvelope = this.updateOperation(
        currentEnvelope,
        input.operationId,
        {
          stage: "PREVIEW_SAVED",
          previewStorageKey,
          updatedAt: input.capturedAt,
        },
      );
      currentOperation = currentEnvelope.operations.find(
        ({ operationId }) => operationId === input.operationId,
      )!;
      return {
        envelope: currentEnvelope,
        operation: currentOperation,
        width,
        height,
      };
    } catch (error) {
      this.updateOperation(currentEnvelope, input.operationId, {
        stage: "FAILED",
        error:
          error instanceof Error ? error.message : "Local media save failed.",
        updatedAt: input.capturedAt,
      });
      throw new TrayRepositoryError(
        "MEDIA_SAVE_FAILED",
        "The photograph could not be verified in local storage. The tray was not changed.",
      );
    }
  }

  async createWithPhoto(input: CreateTrayWithPhotoInput): Promise<Tray> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const inputJson = photoInputFingerprint(
      input as CreateTrayWithPhotoInput & Record<string, unknown>,
    );
    const prepared = this.prepareOperation(input.holeId, {
      operationId: input.operationId,
      kind: "CREATE",
      inputJson,
      stage: "PENDING",
      trayId: input.trayId,
      photoId: input.photoId,
      updatedAt: input.capturedAt,
    });
    if (prepared.completed !== undefined) return prepared.completed;
    if (
      prepared.envelope.trays.some(
        ({ trayNumber, localId }) =>
          trayNumber === input.trayNumber && localId !== input.trayId,
      )
    ) {
      throw new TrayRepositoryError(
        "DUPLICATE_TRAY_NUMBER",
        `Tray ${input.trayNumber} already exists.`,
      );
    }
    const saved = await this.saveMedia(
      prepared.envelope,
      prepared.operation,
      input,
    );
    const originalStorageKey = saved.operation.originalStorageKey;
    if (originalStorageKey === undefined) {
      throw new TrayRepositoryError(
        "MEDIA_SAVE_FAILED",
        "Original photograph storage was not completed.",
      );
    }
    const photo = photoSchema.parse({
      localId: input.photoId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.capturedAt,
      updatedAt: input.capturedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      entityType: "TRAY",
      entityId: input.trayId,
      category: "TRAY",
      originalStorageKey,
      previewStorageKey: saved.operation.previewStorageKey,
      originalFilename: input.originalFilename,
      mimeType: input.original.type,
      sizeBytes: input.original.size,
      width: saved.width,
      height: saved.height,
      capturedAt: input.capturedAt,
      description:
        input.description ?? `Completed core tray ${input.trayNumber}`,
      createdByUserId: input.userId,
      createdByNameSnapshot: input.userNameSnapshot,
    });
    let envelope = {
      ...saved.envelope,
      revision: saved.envelope.revision + 1,
      updatedAt: input.capturedAt,
      photos: saved.envelope.photos.some(
        ({ localId }) => localId === input.photoId,
      )
        ? saved.envelope.photos
        : [...saved.envelope.photos, photo],
    };
    this.write(envelope);
    envelope = this.updateOperation(envelope, input.operationId, {
      stage: "METADATA_SAVED",
      updatedAt: input.capturedAt,
    });
    const tray = traySchema.parse({
      localId: input.trayId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.capturedAt,
      updatedAt: input.capturedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      shiftId: input.shiftId,
      trayNumber: input.trayNumber,
      startDepthDm: input.startDepthDm,
      endDepthDm: input.endDepthDm,
      comment: input.comment?.trim() || undefined,
      isFinalPartial: input.isFinalPartial,
      primaryPhotoId: input.photoId,
      recordedByUserId: input.userId,
      recordedByNameSnapshot: input.userNameSnapshot,
      recordedAt: input.capturedAt,
    });
    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.capturedAt,
      trays: envelope.trays.some(({ localId }) => localId === input.trayId)
        ? envelope.trays
        : [...envelope.trays, tray],
    };
    this.write(envelope);
    envelope = this.updateOperation(envelope, input.operationId, {
      stage: "TRAY_CREATED",
      updatedAt: input.capturedAt,
    });
    this.updateOperation(envelope, input.operationId, {
      stage: "COMPLETED",
      updatedAt: input.capturedAt,
    });
    return asTray(tray);
  }

  async updateDetails(input: UpdateTrayDetailsInput): Promise<Tray> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.read(input.holeId);
    const existingOperation = envelope.operations.find(
      ({ operationId }) => operationId === input.operationId,
    );
    if (existingOperation !== undefined) {
      const existing = envelope.trays.find(
        ({ localId }) => localId === input.trayId,
      );
      if (existing !== undefined) return asTray(existing);
    }
    const index = envelope.trays.findIndex(
      ({ localId }) => localId === input.trayId,
    );
    const current = envelope.trays[index];
    if (current === undefined) {
      throw new TrayRepositoryError("NOT_FOUND", "Tray was not found.");
    }
    if (current.version !== input.expectedVersion) {
      throw new TrayRepositoryError(
        "STALE_VERSION",
        "Tray changed after this form was opened.",
      );
    }
    if (
      input.trayNumber !== undefined &&
      envelope.trays.some(
        ({ localId, trayNumber }) =>
          localId !== input.trayId && trayNumber === input.trayNumber,
      )
    ) {
      throw new TrayRepositoryError(
        "DUPLICATE_TRAY_NUMBER",
        `Tray ${input.trayNumber} already exists.`,
      );
    }
    const changes = {
      ...(input.trayNumber === undefined
        ? {}
        : { trayNumber: input.trayNumber }),
      ...(input.startDepthDm === undefined
        ? {}
        : { startDepthDm: input.startDepthDm }),
      ...(input.endDepthDm === undefined ? {} : { endDepthDm: input.endDepthDm }),
      ...(input.comment === undefined ? {} : { comment: input.comment }),
      ...(input.isFinalPartial === undefined
        ? {}
        : { isFinalPartial: input.isFinalPartial }),
    };
    const updated = traySchema.parse({
      ...current,
      ...changes,
      updatedAt: input.occurredAt,
      version: current.version + 1,
      syncStatus: "local-only",
    });
    const corrections = Object.entries(changes)
      .filter(([fieldName, value]) => current[fieldName as keyof typeof current] !== value)
      .map(([fieldName, value], correctionIndex) =>
        correctionSchema.parse({
          id:
            correctionIndex === 0
              ? input.correctionId
              : `${input.correctionId}-${correctionIndex + 1}`,
          trayId: input.trayId,
          fieldName,
          previousValue:
            (current[fieldName as keyof typeof current] as CorrectionValue) ??
            null,
          correctedValue: (value as CorrectionValue) ?? null,
          reason: input.reason,
          correctedAt: input.occurredAt,
          correctedByUserId: input.userId,
          correctedByNameSnapshot: input.userNameSnapshot,
          operationId: input.operationId,
        }),
      );
    const trays = [...envelope.trays];
    trays[index] = updated;
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.occurredAt,
      trays,
      corrections: [...envelope.corrections, ...corrections],
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "CREATE",
          inputJson: JSON.stringify(input),
          stage: "COMPLETED",
          trayId: input.trayId,
          photoId: current.primaryPhotoId,
          updatedAt: input.occurredAt,
        },
      ],
    });
    return asTray(updated);
  }

  async replacePhoto(input: ReplaceTrayPhotoInput): Promise<Tray> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const inputJson = photoInputFingerprint(
      input as ReplaceTrayPhotoInput & Record<string, unknown>,
    );
    const envelope = this.read(input.holeId);
    const trayIndex = envelope.trays.findIndex(
      ({ localId }) => localId === input.trayId,
    );
    const current = envelope.trays[trayIndex];
    if (current === undefined) {
      throw new TrayRepositoryError("NOT_FOUND", "Tray was not found.");
    }
    const prepared = this.prepareOperation(input.holeId, {
      operationId: input.operationId,
      kind: "REPLACE",
      inputJson,
      stage: "PENDING",
      trayId: input.trayId,
      photoId: input.photoId,
      previousPhotoId: current.primaryPhotoId,
      updatedAt: input.capturedAt,
    });
    if (prepared.completed !== undefined) return prepared.completed;
    if (current.version !== input.expectedVersion) {
      throw new TrayRepositoryError(
        "STALE_VERSION",
        "Tray changed after photograph replacement began.",
      );
    }
    const saved = await this.saveMedia(
      prepared.envelope,
      prepared.operation,
      input,
    );
    const originalStorageKey = saved.operation.originalStorageKey;
    if (originalStorageKey === undefined) {
      throw new TrayRepositoryError(
        "MEDIA_SAVE_FAILED",
        "Replacement photograph storage was not completed.",
      );
    }
    const photo = photoSchema.parse({
      localId: input.photoId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.capturedAt,
      updatedAt: input.capturedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      entityType: "TRAY",
      entityId: input.trayId,
      category: "TRAY",
      originalStorageKey,
      previewStorageKey: saved.operation.previewStorageKey,
      originalFilename: input.originalFilename,
      mimeType: input.original.type,
      sizeBytes: input.original.size,
      width: saved.width,
      height: saved.height,
      capturedAt: input.capturedAt,
      description: input.description ?? `Replacement photograph for tray ${current.trayNumber}`,
      createdByUserId: input.userId,
      createdByNameSnapshot: input.userNameSnapshot,
    });
    let nextEnvelope = {
      ...saved.envelope,
      revision: saved.envelope.revision + 1,
      updatedAt: input.capturedAt,
      photos: saved.envelope.photos.some(
        ({ localId }) => localId === input.photoId,
      )
        ? saved.envelope.photos
        : [...saved.envelope.photos, photo],
    };
    this.write(nextEnvelope);
    nextEnvelope = this.updateOperation(nextEnvelope, input.operationId, {
      stage: "METADATA_SAVED",
      updatedAt: input.capturedAt,
    });
    const latestIndex = nextEnvelope.trays.findIndex(
      ({ localId }) => localId === input.trayId,
    );
    const latest = nextEnvelope.trays[latestIndex]!;
    const updated = traySchema.parse({
      ...latest,
      primaryPhotoId: input.photoId,
      updatedAt: input.capturedAt,
      version: latest.version + 1,
      syncStatus: "local-only",
    });
    const trays = [...nextEnvelope.trays];
    trays[latestIndex] = updated;
    nextEnvelope = {
      ...nextEnvelope,
      revision: nextEnvelope.revision + 1,
      updatedAt: input.capturedAt,
      trays,
      corrections: [
        ...nextEnvelope.corrections,
        correctionSchema.parse({
          id: `correction-${input.operationId}`,
          trayId: input.trayId,
          fieldName: "primaryPhotoId",
          previousValue: latest.primaryPhotoId,
          correctedValue: input.photoId,
          reason: input.reason,
          correctedAt: input.capturedAt,
          correctedByUserId: input.userId,
          correctedByNameSnapshot: input.userNameSnapshot,
          operationId: input.operationId,
        }),
      ],
    };
    this.write(nextEnvelope);
    nextEnvelope = this.updateOperation(nextEnvelope, input.operationId, {
      stage: "TRAY_CREATED",
      updatedAt: input.capturedAt,
    });
    this.updateOperation(nextEnvelope, input.operationId, {
      stage: "COMPLETED",
      updatedAt: input.capturedAt,
    });
    return asTray(updated);
  }

  async recoverInterruptedOperations(holeId: string): Promise<number> {
    this.mutationGuard?.assertHoleMutable(holeId);
    let envelope = this.read(holeId);
    let recovered = 0;
    for (const operation of envelope.operations) {
      if (
        operation.stage === "COMPLETED" ||
        operation.stage === "FAILED"
      ) {
        continue;
      }
      const originalVerified =
        operation.originalStorageKey !== undefined &&
        (await this.media.verify(operation.originalStorageKey));
      const photoExists = envelope.photos.some(
        ({ localId }) => localId === operation.photoId,
      );
      const trayIndex = envelope.trays.findIndex(
        ({ localId }) => localId === operation.trayId,
      );
      if (!originalVerified) {
        envelope = this.updateOperation(envelope, operation.operationId, {
          stage: "FAILED",
          error: "Interrupted operation had no verified original photograph.",
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
      if (!photoExists) {
        envelope = this.updateOperation(envelope, operation.operationId, {
          stage: "FAILED",
          error: "Interrupted operation requires photograph metadata recovery.",
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
      if (operation.kind === "CREATE" && trayIndex < 0) {
        envelope = this.updateOperation(envelope, operation.operationId, {
          stage: "FAILED",
          error: "Interrupted operation requires tray metadata recovery.",
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
      if (operation.kind === "REPLACE" && trayIndex >= 0) {
        const tray = envelope.trays[trayIndex]!;
        if (tray.primaryPhotoId !== operation.photoId) {
          const trays = [...envelope.trays];
          trays[trayIndex] = traySchema.parse({
            ...tray,
            primaryPhotoId: operation.photoId,
            updatedAt: operation.updatedAt,
            version: tray.version + 1,
          });
          envelope = {
            ...envelope,
            revision: envelope.revision + 1,
            trays,
          };
          this.write(envelope);
        }
      }
      envelope = this.updateOperation(envelope, operation.operationId, {
        stage: "COMPLETED",
        error: undefined,
        updatedAt: operation.updatedAt,
      });
      recovered += 1;
    }
    return recovered;
  }
}

export class LocalPhotoRepository implements PhotoRepository {
  constructor(private readonly trays: LocalTrayRepository) {}

  async getById(photoId: string, holeId: string): Promise<Photo | null> {
    return this.trays.getPhotoById(photoId, holeId);
  }

  async listByEntity(
    holeId: string,
    entityType: Photo["entityType"],
    entityId: string,
  ): Promise<readonly Photo[]> {
    return this.trays.listPhotosByEntity(holeId, entityType, entityId);
  }

  async create(input: CreatePhotoInput): Promise<Photo> {
    return this.trays.createPhoto(input);
  }
}

export function createBrowserTrayRepository(
  seedTrays: readonly Tray[] = [],
  seedPhotos: readonly Photo[] = [],
  mediaRepository?: MediaRepository,
  mutationGuard?: HoleMutationGuardPort,
): LocalTrayRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  const media = mediaRepository ?? createBrowserMediaRepository();
  if (storage === null || media === null) return null;
  return new LocalTrayRepository(
    storage,
    media,
    seedTrays,
    seedPhotos,
    mutationGuard,
  );
}

export function createBrowserPhotoRepository(
  trayRepository: LocalTrayRepository,
): PhotoRepository {
  return new LocalPhotoRepository(trayRepository);
}
