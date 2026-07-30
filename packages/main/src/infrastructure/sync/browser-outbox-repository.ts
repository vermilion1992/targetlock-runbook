import {
  emptyOutboxSummary,
  outboxOperationSchema,
  type DomainOperationEnvelope,
  type OutboxOperation,
  type OutboxState,
  type OutboxSummary,
} from "./domain-operation";

const DATABASE_NAME = "targetlock-pilot-shadow-v1";
const STORE_NAME = "domain-operations";
const QUARANTINE_STORE_NAME = "domain-operation-quarantine";
const DATABASE_VERSION = 2;

export interface OutboxContext {
  readonly organisationId: string;
  readonly deviceId: string;
  readonly operatorId: string;
}

export class OutboxRepositoryError extends Error {
  constructor(
    readonly code:
      | "CORRUPTED_STORAGE"
      | "IDEMPOTENCY_CONFLICT"
      | "QUOTA_EXCEEDED"
      | "STORAGE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "OutboxRepositoryError";
  }
}

export interface OutboxRepository {
  enqueue(envelope: DomainOperationEnvelope): Promise<OutboxOperation>;
  claimReady(
    now: string,
    context: OutboxContext,
    limit?: number,
  ): Promise<readonly OutboxOperation[]>;
  markOutcome(
    operationId: string,
    outcome: {
      readonly state: Exclude<OutboxState, "pending" | "sending">;
      readonly occurredAt: string;
      readonly serverReceiptTime?: string | null;
      readonly reasonCode?: string | null;
      readonly error?: string | null;
      readonly retryAt?: string;
    },
  ): Promise<void>;
  resetSending(now: string): Promise<void>;
  quarantineForeign(
    context: OutboxContext,
    now: string,
  ): Promise<number>;
  deleteQuarantined(organisationId: string): Promise<number>;
  listAll(): Promise<readonly OutboxOperation[]>;
  summary(context?: OutboxContext): Promise<OutboxSummary>;
}

function initialOperation(
  envelope: DomainOperationEnvelope,
): OutboxOperation {
  return {
    operationId: envelope.operationId,
    envelope,
    state: "pending",
    attempts: 0,
    createdAt: envelope.clientTime,
    updatedAt: envelope.clientTime,
    nextAttemptAt: envelope.clientTime,
    serverReceiptTime: null,
    reasonCode: null,
    lastError: null,
  };
}

function isSameIdempotentOperation(
  existing: DomainOperationEnvelope,
  candidate: DomainOperationEnvelope,
): boolean {
  return (
    existing.operationId === candidate.operationId &&
    existing.schemaVersion === candidate.schemaVersion &&
    existing.organisationId === candidate.organisationId &&
    existing.deviceId === candidate.deviceId &&
    existing.operatorId === candidate.operatorId &&
    existing.operationType === candidate.operationType &&
    existing.projectRef === candidate.projectRef &&
    existing.rigRef === candidate.rigRef &&
    existing.holeRef === candidate.holeRef &&
    existing.shiftRef === candidate.shiftRef &&
    existing.expectedVersion === candidate.expectedVersion &&
    existing.revisionRef === candidate.revisionRef &&
    existing.payloadHash === candidate.payloadHash
  );
}

function matchesContext(
  operation: OutboxOperation,
  context: OutboxContext,
): boolean {
  return (
    operation.envelope.organisationId === context.organisationId &&
    operation.envelope.deviceId === context.deviceId &&
    operation.envelope.operatorId === context.operatorId
  );
}

function summarize(
  operations: readonly OutboxOperation[],
  context?: OutboxContext,
  corruptCount = 0,
): OutboxSummary {
  const summary = emptyOutboxSummary("ready");
  const visible =
    context === undefined
      ? operations
      : operations.filter(
          (operation) =>
            matchesContext(operation, context) ||
            (operation.envelope.organisationId === context.organisationId &&
              operation.state === "quarantined"),
        );
  const counts = {
    pending: 0,
    sending: 0,
    accepted: 0,
    conflict: 0,
    rejected: 0,
    failed: 0,
    quarantined: 0,
  };
  let lastAcceptedAt: string | null = null;
  for (const operation of visible) {
    counts[operation.state] += 1;
    if (
      operation.state === "accepted" &&
      operation.serverReceiptTime &&
      (!lastAcceptedAt ||
        Date.parse(operation.serverReceiptTime) > Date.parse(lastAcceptedAt))
    ) {
      lastAcceptedAt = operation.serverReceiptTime;
    }
  }
  return {
    ...summary,
    ...counts,
    unsynced:
      counts.pending +
      counts.sending +
      counts.conflict +
      counts.rejected +
      counts.failed +
      counts.quarantined +
      corruptCount,
    incomplete: counts.quarantined + corruptCount,
    storageErrors: corruptCount,
    lastAcceptedAt,
  };
}

function parseOperation(value: unknown): OutboxOperation {
  const parsed = outboxOperationSchema.safeParse(value);
  if (!parsed.success) {
    throw new OutboxRepositoryError(
      "CORRUPTED_STORAGE",
      "The local operation journal contains an incompatible record.",
    );
  }
  return parsed.data;
}

export class MemoryOutboxRepository implements OutboxRepository {
  private readonly operations = new Map<string, OutboxOperation>();

  async enqueue(envelope: DomainOperationEnvelope): Promise<OutboxOperation> {
    const existing = this.operations.get(envelope.operationId);
    if (existing) {
      if (!isSameIdempotentOperation(existing.envelope, envelope)) {
        throw new OutboxRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This operation ID is already associated with different data.",
        );
      }
      return existing;
    }
    const operation = initialOperation(envelope);
    this.operations.set(operation.operationId, operation);
    return operation;
  }

  async claimReady(
    now: string,
    context: OutboxContext,
    limit = 20,
  ): Promise<readonly OutboxOperation[]> {
    const ready = [...this.operations.values()]
      .filter(
        (operation) =>
          (operation.state === "pending" || operation.state === "failed") &&
          matchesContext(operation, context) &&
          Date.parse(operation.nextAttemptAt) <= Date.parse(now),
      )
      .sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      )
      .slice(0, limit)
      .map((operation) => ({
        ...operation,
        state: "sending" as const,
        attempts: operation.attempts + 1,
        updatedAt: now,
      }));
    for (const operation of ready) {
      this.operations.set(operation.operationId, operation);
    }
    return ready;
  }

  async markOutcome(
    operationId: string,
    outcome: {
      readonly state: Exclude<OutboxState, "pending" | "sending">;
      readonly occurredAt: string;
      readonly serverReceiptTime?: string | null;
      readonly reasonCode?: string | null;
      readonly error?: string | null;
      readonly retryAt?: string;
    },
  ): Promise<void> {
    const current = this.operations.get(operationId);
    if (!current) return;
    this.operations.set(operationId, {
      ...current,
      state: outcome.state,
      updatedAt: outcome.occurredAt,
      nextAttemptAt: outcome.retryAt ?? current.nextAttemptAt,
      serverReceiptTime:
        outcome.serverReceiptTime ?? current.serverReceiptTime,
      reasonCode: outcome.reasonCode ?? null,
      lastError: outcome.error?.slice(0, 500) ?? null,
    });
  }

  async resetSending(now: string): Promise<void> {
    for (const [id, operation] of this.operations) {
      if (operation.state === "sending") {
        this.operations.set(id, {
          ...operation,
          state: "failed",
          updatedAt: now,
          nextAttemptAt: now,
          lastError: "A prior sync attempt was interrupted.",
        });
      }
    }
  }

  async quarantineForeign(
    context: OutboxContext,
    now: string,
  ): Promise<number> {
    let count = 0;
    for (const [id, operation] of this.operations) {
      if (
        operation.envelope.organisationId === context.organisationId &&
        !matchesContext(operation, context) &&
        !["accepted", "quarantined"].includes(operation.state)
      ) {
        this.operations.set(id, {
          ...operation,
          state: "quarantined",
          updatedAt: now,
          reasonCode: "PILOT_CONTEXT_CHANGED",
          lastError:
            "This operation belongs to an earlier operator or device. Export a pilot backup for recovery.",
        });
        count += 1;
      }
    }
    return count;
  }

  async deleteQuarantined(organisationId: string): Promise<number> {
    let count = 0;
    for (const [id, operation] of this.operations) {
      if (
        operation.state === "quarantined" &&
        operation.envelope.organisationId === organisationId
      ) {
        this.operations.delete(id);
        count += 1;
      }
    }
    return count;
  }

  async listAll(): Promise<readonly OutboxOperation[]> {
    return [...this.operations.values()].map(parseOperation);
  }

  async summary(context?: OutboxContext): Promise<OutboxSummary> {
    return summarize(await this.listAll(), context);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function mapStorageError(error: unknown): OutboxRepositoryError {
  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return new OutboxRepositoryError(
      "QUOTA_EXCEEDED",
      "Browser storage is full. Export a pilot backup and free space.",
    );
  }
  if (error instanceof OutboxRepositoryError) return error;
  return new OutboxRepositoryError(
    "STORAGE_UNAVAILABLE",
    "The durable browser operation journal is unavailable.",
  );
}

export class IndexedDbOutboxRepository implements OutboxRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, {
            keyPath: "operationId",
          });
        }
        if (!request.result.objectStoreNames.contains(QUARANTINE_STORE_NAME)) {
          request.result.createObjectStore(QUARANTINE_STORE_NAME, {
            keyPath: "id",
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Operation journal database upgrade is blocked."));
    });
    return this.databasePromise.catch((error: unknown) => {
      this.databasePromise = null;
      throw mapStorageError(error);
    });
  }

  private async corruptCount(): Promise<number> {
    const database = await this.database();
    const transaction = database.transaction(
      QUARANTINE_STORE_NAME,
      "readonly",
    );
    const count = await requestResult(
      transaction.objectStore(QUARANTINE_STORE_NAME).count(),
    );
    await transactionDone(transaction);
    return count;
  }

  private async all() {
    try {
      const database = await this.database();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const [values, keys] = await Promise.all([
        requestResult(store.getAll()),
        requestResult(store.getAllKeys()),
      ]);
      await transactionDone(transaction);
      const operations: OutboxOperation[] = [];
      const corrupt: Array<{ readonly key: IDBValidKey; readonly value: unknown }> = [];
      values.forEach((value, index) => {
        const parsed = outboxOperationSchema.safeParse(value);
        if (parsed.success) operations.push(parsed.data);
        else if (keys[index] !== undefined) {
          corrupt.push({ key: keys[index]!, value });
        }
      });
      if (corrupt.length > 0) {
        const quarantine = database.transaction(
          [STORE_NAME, QUARANTINE_STORE_NAME],
          "readwrite",
        );
        const source = quarantine.objectStore(STORE_NAME);
        const target = quarantine.objectStore(QUARANTINE_STORE_NAME);
        const occurredAt = new Date().toISOString();
        corrupt.forEach(({ key, value }, index) => {
          source.delete(key);
          target.put({
            id: `${Date.now()}-${index}-${String(key)}`,
            sourceKey: String(key),
            occurredAt,
            reason: "OUTBOX_SCHEMA_INVALID",
            value,
          });
        });
        await transactionDone(quarantine);
      }
      return operations;
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async enqueue(envelope: DomainOperationEnvelope): Promise<OutboxOperation> {
    try {
      const database = await this.database();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const existingValue = await requestResult(store.get(envelope.operationId));
      if (existingValue !== undefined) {
        const existing = parseOperation(existingValue);
        if (!isSameIdempotentOperation(existing.envelope, envelope)) {
          transaction.abort();
          throw new OutboxRepositoryError(
            "IDEMPOTENCY_CONFLICT",
            "This operation ID is already associated with different data.",
          );
        }
        await transactionDone(transaction);
        return existing;
      }
      const operation = initialOperation(envelope);
      store.add(operation);
      await transactionDone(transaction);
      return operation;
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async claimReady(
    now: string,
    context: OutboxContext,
    limit = 20,
  ): Promise<readonly OutboxOperation[]> {
    const operations = await this.all();
    const ready = operations
      .filter(
        (operation) =>
          (operation.state === "pending" || operation.state === "failed") &&
          matchesContext(operation, context) &&
          Date.parse(operation.nextAttemptAt) <= Date.parse(now),
      )
      .sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      )
      .slice(0, limit)
      .map((operation) => ({
        ...operation,
        state: "sending" as const,
        attempts: operation.attempts + 1,
        updatedAt: now,
      }));
    if (ready.length === 0) return ready;
    try {
      const database = await this.database();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const operation of ready) store.put(operation);
      await transactionDone(transaction);
      return ready;
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async markOutcome(
    operationId: string,
    outcome: {
      readonly state: Exclude<OutboxState, "pending" | "sending">;
      readonly occurredAt: string;
      readonly serverReceiptTime?: string | null;
      readonly reasonCode?: string | null;
      readonly error?: string | null;
      readonly retryAt?: string;
    },
  ): Promise<void> {
    try {
      const database = await this.database();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const value = await requestResult(store.get(operationId));
      if (value !== undefined) {
        const current = parseOperation(value);
        store.put({
          ...current,
          state: outcome.state,
          updatedAt: outcome.occurredAt,
          nextAttemptAt: outcome.retryAt ?? current.nextAttemptAt,
          serverReceiptTime:
            outcome.serverReceiptTime ?? current.serverReceiptTime,
          reasonCode: outcome.reasonCode ?? null,
          lastError: outcome.error?.slice(0, 500) ?? null,
        });
      }
      await transactionDone(transaction);
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async resetSending(now: string): Promise<void> {
    const sending = (await this.all()).filter(
      (operation) => operation.state === "sending",
    );
    for (const operation of sending) {
      await this.markOutcome(operation.operationId, {
        state: "failed",
        occurredAt: now,
        retryAt: now,
        error: "A prior sync attempt was interrupted.",
      });
    }
  }

  async quarantineForeign(
    context: OutboxContext,
    now: string,
  ): Promise<number> {
    const foreign = (await this.all()).filter(
      (operation) =>
        operation.envelope.organisationId === context.organisationId &&
        !matchesContext(operation, context) &&
        !["accepted", "quarantined"].includes(operation.state),
    );
    for (const operation of foreign) {
      await this.markOutcome(operation.operationId, {
        state: "quarantined",
        occurredAt: now,
        reasonCode: "PILOT_CONTEXT_CHANGED",
        error:
          "This operation belongs to an earlier operator or device. Export a pilot backup for recovery.",
      });
    }
    return foreign.length;
  }

  async deleteQuarantined(organisationId: string): Promise<number> {
    const quarantined = (await this.all()).filter(
      (operation) =>
        operation.state === "quarantined" &&
        operation.envelope.organisationId === organisationId,
    );
    if (quarantined.length === 0) return 0;
    try {
      const database = await this.database();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const operation of quarantined) {
        store.delete(operation.operationId);
      }
      await transactionDone(transaction);
      return quarantined.length;
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async listAll(): Promise<readonly OutboxOperation[]> {
    return this.all();
  }

  async summary(context?: OutboxContext): Promise<OutboxSummary> {
    return summarize(
      await this.listAll(),
      context,
      await this.corruptCount(),
    );
  }
}

export function createBrowserOutboxRepository(): OutboxRepository | null {
  return typeof indexedDB === "undefined"
    ? null
    : new IndexedDbOutboxRepository();
}
