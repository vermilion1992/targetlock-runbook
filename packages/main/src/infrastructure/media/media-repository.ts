export type MediaKind = "ORIGINAL" | "PREVIEW";

export interface SaveMediaInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly blob: Blob;
  readonly storageKey?: string;
}

export interface SavedMedia {
  readonly storageKey: string;
  readonly operationId: string;
  readonly holeId: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface MediaRepository {
  saveOriginal(input: SaveMediaInput): Promise<SavedMedia>;
  savePreview(input: SaveMediaInput): Promise<SavedMedia>;
  getBlob(storageKey: string): Promise<Blob | null>;
  delete(storageKey: string): Promise<void>;
  verify(storageKey: string): Promise<boolean>;
}

export class MediaRepositoryError extends Error {
  constructor(
    readonly code:
      | "IDEMPOTENCY_CONFLICT"
      | "INVALID_MEDIA"
      | "STORAGE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "MediaRepositoryError";
  }
}

export class MemoryMediaRepository implements MediaRepository {
  private readonly records = new Map<
    string,
    SavedMedia & { readonly blob: Blob }
  >();

  async saveOriginal(input: SaveMediaInput): Promise<SavedMedia> {
    return this.save("ORIGINAL", input);
  }

  async savePreview(input: SaveMediaInput): Promise<SavedMedia> {
    return this.save("PREVIEW", input);
  }

  constructor(private readonly organisationId = "memory-organisation") {}

  private async save(
    kind: MediaKind,
    input: SaveMediaInput,
  ): Promise<SavedMedia> {
    const existing = [...this.records.values()].find(
      (record) =>
        record.operationId === input.operationId &&
        record.holeId === input.holeId &&
        record.kind === kind,
    );
    if (existing !== undefined) {
      if (
        existing.sizeBytes !== input.blob.size ||
        existing.mimeType !== input.blob.type
      ) {
        throw new MediaRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This media operation identifier is already used by another file.",
        );
      }
      return existing;
    }
    const storageKey =
      input.storageKey ??
      mediaStorageKey(
        this.organisationId,
        input.holeId,
        input.operationId,
        kind,
      );
    const record = {
      storageKey,
      operationId: input.operationId,
      holeId: input.holeId,
      kind,
      mimeType: input.blob.type,
      sizeBytes: input.blob.size,
      blob: input.blob,
    };
    this.records.set(storageKey, record);
    return record;
  }

  async getBlob(storageKey: string): Promise<Blob | null> {
    return this.records.get(storageKey)?.blob ?? null;
  }

  async delete(storageKey: string): Promise<void> {
    this.records.delete(storageKey);
  }

  async verify(storageKey: string): Promise<boolean> {
    return this.records.has(storageKey);
  }
}

function encodeStorageSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function mediaStorageKey(
  organisationId: string,
  holeId: string,
  operationId: string,
  kind: MediaKind,
  uniqueId?: string,
): string {
  const base =
    `targetlock:v2:org:${encodeStorageSegment(organisationId)}` +
    `:hole:${encodeStorageSegment(holeId)}` +
    `:media:${encodeStorageSegment(operationId)}` +
    `:${kind.toLowerCase()}`;
  return uniqueId === undefined
    ? base
    : `${base}:${encodeStorageSegment(uniqueId)}`;
}
