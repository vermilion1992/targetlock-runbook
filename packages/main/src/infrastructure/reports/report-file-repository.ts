import type { SavedReportFile } from "@/domain";

export interface ReportFileRepository {
  save(
    operationId: string,
    filename: string,
    mimeType: string,
    data: Blob,
  ): Promise<SavedReportFile>;

  get(storageKey: string): Promise<Blob | null>;

  verify(storageKey: string): Promise<boolean>;

  delete(storageKey: string): Promise<void>;
}

export class ReportFileRepositoryError extends Error {
  constructor(
    readonly code: "IDEMPOTENCY_CONFLICT" | "STORAGE_UNAVAILABLE" | "INVALID_FILE",
    message: string,
  ) {
    super(message);
    this.name = "ReportFileRepositoryError";
  }
}

interface StoredReportFile extends SavedReportFile {
  readonly blob: Blob;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new ReportFileRepositoryError(
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
        new ReportFileRepositoryError(
          "STORAGE_UNAVAILABLE",
          transaction.error?.message ?? "IndexedDB transaction failed.",
        ),
      );
  });
}

const DATABASE_NAME = "targetlock-runbook-reports-v1";
const DATABASE_VERSION = 1;
const STORE_NAME = "report-files";

export class IndexedDbReportFileRepository implements ReportFileRepository {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(private readonly indexedDb: IDBFactory = window.indexedDB) {}

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
          new ReportFileRepositoryError(
            "STORAGE_UNAVAILABLE",
            request.error?.message ?? "IndexedDB is unavailable.",
          ),
        );
      request.onblocked = () =>
        reject(
          new ReportFileRepositoryError(
            "STORAGE_UNAVAILABLE",
            "IndexedDB upgrade is blocked by another open page.",
          ),
        );
    });
    return this.databasePromise;
  }

  async save(
    operationId: string,
    filename: string,
    mimeType: string,
    data: Blob,
  ): Promise<SavedReportFile> {
    if (data.size <= 0 || mimeType.trim().length === 0) {
      throw new ReportFileRepositoryError(
        "INVALID_FILE",
        "Report files must be non-empty with a mime type.",
      );
    }
    const database = await this.database();
    const readTransaction = database.transaction(STORE_NAME, "readonly");
    const existing = (await requestResult(
      readTransaction.objectStore(STORE_NAME).index("operationId").getAll(operationId),
    )) as StoredReportFile[];
    if (existing.length > 0) {
      const match = existing[0]!;
      if (
        match.sizeBytes !== data.size ||
        match.mimeType !== mimeType ||
        match.filename !== filename
      ) {
        throw new ReportFileRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This report operation identifier is already used by another file.",
        );
      }
      return {
        storageKey: match.storageKey,
        operationId: match.operationId,
        filename: match.filename,
        mimeType: match.mimeType,
        sizeBytes: match.sizeBytes,
      };
    }

    const storageKey = `report:${operationId}`;
    const record: StoredReportFile = {
      storageKey,
      operationId,
      filename,
      mimeType,
      sizeBytes: data.size,
      blob: data,
    };
    const writeTransaction = database.transaction(STORE_NAME, "readwrite");
    writeTransaction.objectStore(STORE_NAME).put(record);
    await transactionComplete(writeTransaction);
    return {
      storageKey: record.storageKey,
      operationId: record.operationId,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  async get(storageKey: string): Promise<Blob | null> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = (await requestResult(
      transaction.objectStore(STORE_NAME).get(storageKey),
    )) as StoredReportFile | undefined;
    return record?.blob ?? null;
  }

  async verify(storageKey: string): Promise<boolean> {
    const blob = await this.get(storageKey);
    return blob !== null && blob.size > 0;
  }

  async delete(storageKey: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(storageKey);
    await transactionComplete(transaction);
  }
}

export class MemoryReportFileRepository implements ReportFileRepository {
  private readonly records = new Map<string, StoredReportFile>();

  async save(
    operationId: string,
    filename: string,
    mimeType: string,
    data: Blob,
  ): Promise<SavedReportFile> {
    if (data.size <= 0 || mimeType.trim().length === 0) {
      throw new ReportFileRepositoryError(
        "INVALID_FILE",
        "Report files must be non-empty with a mime type.",
      );
    }
    const existing = [...this.records.values()].find(
      (record) => record.operationId === operationId,
    );
    if (existing !== undefined) {
      if (
        existing.sizeBytes !== data.size ||
        existing.mimeType !== mimeType ||
        existing.filename !== filename
      ) {
        throw new ReportFileRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This report operation identifier is already used by another file.",
        );
      }
      return {
        storageKey: existing.storageKey,
        operationId: existing.operationId,
        filename: existing.filename,
        mimeType: existing.mimeType,
        sizeBytes: existing.sizeBytes,
      };
    }
    const storageKey = `report:${operationId}`;
    const record: StoredReportFile = {
      storageKey,
      operationId,
      filename,
      mimeType,
      sizeBytes: data.size,
      blob: data,
    };
    this.records.set(storageKey, record);
    return {
      storageKey: record.storageKey,
      operationId: record.operationId,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  async get(storageKey: string): Promise<Blob | null> {
    return this.records.get(storageKey)?.blob ?? null;
  }

  async verify(storageKey: string): Promise<boolean> {
    const blob = await this.get(storageKey);
    return blob !== null && blob.size > 0;
  }

  async delete(storageKey: string): Promise<void> {
    this.records.delete(storageKey);
  }
}

export function createBrowserReportFileRepository(): ReportFileRepository | null {
  if (typeof window === "undefined" || window.indexedDB === undefined) {
    return null;
  }
  return new IndexedDbReportFileRepository(window.indexedDB);
}
