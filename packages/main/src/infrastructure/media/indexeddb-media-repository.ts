import {
  mediaStorageKey,
  MediaRepositoryError,
  type MediaKind,
  type MediaRepository,
  type SaveMediaInput,
  type SavedMedia,
} from "./media-repository";

const DATABASE_NAME = "targetlock-runbook-media-v1";
const DATABASE_VERSION = 1;
const STORE_NAME = "media";

interface StoredMedia extends SavedMedia {
  readonly blob: Blob;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new MediaRepositoryError(
          "STORAGE_UNAVAILABLE",
          request.error?.message ?? "IndexedDB request failed.",
        ),
      );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(
        new MediaRepositoryError(
          "STORAGE_UNAVAILABLE",
          transaction.error?.message ?? "IndexedDB transaction failed.",
        ),
      );
  });
}

export class IndexedDbMediaRepository implements MediaRepository {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(
    private readonly indexedDb: IDBFactory = window.indexedDB,
    private readonly organisationId = "local-organisation",
  ) {}

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, {
            keyPath: "storageKey",
          });
          store.createIndex("operationId", "operationId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new MediaRepositoryError(
            "STORAGE_UNAVAILABLE",
            request.error?.message ?? "IndexedDB is unavailable.",
          ),
        );
      request.onblocked = () =>
        reject(
          new MediaRepositoryError(
            "STORAGE_UNAVAILABLE",
            "IndexedDB upgrade is blocked by another open page.",
          ),
        );
    });
    return this.databasePromise;
  }

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
    if (input.blob.size <= 0 || !input.blob.type.startsWith("image/")) {
      throw new MediaRepositoryError(
        "INVALID_MEDIA",
        "Only non-empty image files can be stored.",
      );
    }
    const database = await this.database();
    const readTransaction = database.transaction(STORE_NAME, "readonly");
    const records = (await requestResult(
      readTransaction.objectStore(STORE_NAME).index("operationId").getAll(
        input.operationId,
      ),
    )) as StoredMedia[];
    const existing = records.find(
      (record) =>
        record.organisationId === this.organisationId &&
        record.kind === kind && record.holeId === input.holeId,
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
        crypto.randomUUID(),
      );
    const record: StoredMedia = {
      organisationId: this.organisationId,
      storageKey,
      operationId: input.operationId,
      holeId: input.holeId,
      kind,
      mimeType: input.blob.type,
      sizeBytes: input.blob.size,
      blob: input.blob,
    };
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await transactionComplete(transaction);
    return record;
  }

  async getBlob(storageKey: string): Promise<Blob | null> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = (await requestResult(
      transaction.objectStore(STORE_NAME).get(storageKey),
    )) as StoredMedia | undefined;
    return record?.blob ?? null;
  }

  async delete(storageKey: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(storageKey);
    await transactionComplete(transaction);
  }

  async verify(storageKey: string): Promise<boolean> {
    const blob = await this.getBlob(storageKey);
    return blob !== null && blob.size > 0;
  }
}

export function createBrowserMediaRepository(
  organisationId = "local-organisation",
): MediaRepository | null {
  if (typeof window === "undefined" || window.indexedDB === undefined) {
    return null;
  }
  return new IndexedDbMediaRepository(window.indexedDB, organisationId);
}

export async function listBrowserMediaManifest(): Promise<
  readonly SavedMedia[]
> {
  if (typeof indexedDB === "undefined") return [];
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, {
          keyPath: "storageKey",
        });
        store.createIndex("operationId", "operationId", { unique: false });
      }
    };
  });
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = (await requestResult(
      transaction.objectStore(STORE_NAME).getAll(),
    )) as StoredMedia[];
    return records.map((record) => ({
      organisationId: record.organisationId,
      storageKey: record.storageKey,
      operationId: record.operationId,
      holeId: record.holeId,
      kind: record.kind,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    }));
  } finally {
    database.close();
  }
}
