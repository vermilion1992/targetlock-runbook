export type MediaKind = "ORIGINAL" | "PREVIEW";

export interface SaveMediaInput {
  readonly operationId: string;
  readonly blob: Blob;
  readonly storageKey?: string;
}

export interface SavedMedia {
  readonly storageKey: string;
  readonly operationId: string;
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

  private async save(
    kind: MediaKind,
    input: SaveMediaInput,
  ): Promise<SavedMedia> {
    const existing = [...this.records.values()].find(
      (record) =>
        record.operationId === input.operationId && record.kind === kind,
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
      input.storageKey ?? `${input.operationId}:${kind.toLowerCase()}`;
    const record = {
      storageKey,
      operationId: input.operationId,
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
