import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import {
  IndexedDbOutboxRepository,
  MemoryOutboxRepository,
  OutboxRepositoryError,
} from "./browser-outbox-repository";
import type { DomainOperationEnvelope } from "./domain-operation";

const envelope: DomainOperationEnvelope = {
  operationId: "10000000-0000-4000-8000-000000000001",
  schemaVersion: 1,
  organisationId: "20000000-0000-4000-8000-000000000001",
  deviceId: "30000000-0000-4000-8000-000000000001",
  operatorId: "40000000-0000-4000-8000-000000000001",
  operationType: "runs.saveCompletedRun.v1",
  projectRef: "project-local-1",
  rigRef: "rig-local-1",
  holeRef: "hole-local-1",
  shiftRef: "shift-local-1",
  expectedVersion: 3,
  revisionRef: "runs:hole-local-1",
  clientTime: "2026-07-28T12:00:00.000Z",
  payloadHash: "a".repeat(64),
  payload: {
    repository: "runs",
    method: "saveCompletedRun",
    arguments: [{ holeId: "hole-local-1", depth: 120 }],
    clientMutationId: "run-complete-1",
    result: { status: "completed" },
  },
  leaseEvidence: {
    state: "PRIMARY_WRITER",
    leaseId: "50000000-0000-4000-8000-000000000001",
    leaseVersion: 2,
    lastVerifiedAt: "2026-07-28T11:59:00.000Z",
    graceExpiresAt: null,
  },
};
const context = {
  organisationId: envelope.organisationId,
  deviceId: envelope.deviceId,
  operatorId: envelope.operatorId,
};

describe("browser operation outbox", () => {
  it("persists state transitions without changing the idempotent envelope", async () => {
    const repository = new MemoryOutboxRepository();
    await repository.enqueue(envelope);
    const [claimed] = await repository.claimReady(
      "2026-07-28T12:00:01.000Z",
      context,
    );
    expect(claimed).toMatchObject({ state: "sending", attempts: 1 });

    await repository.markOutcome(envelope.operationId, {
      state: "accepted",
      occurredAt: "2026-07-28T12:00:02.000Z",
      serverReceiptTime: "2026-07-28T12:00:02.000Z",
    });
    await expect(repository.summary()).resolves.toMatchObject({
      accepted: 1,
      unsynced: 0,
      lastAcceptedAt: "2026-07-28T12:00:02.000Z",
    });
  });

  it("rejects operation ID reuse with a different payload", async () => {
    const repository = new MemoryOutboxRepository();
    await repository.enqueue(envelope);
    await expect(
      repository.enqueue({
        ...envelope,
        payloadHash: "b".repeat(64),
        payload: {
          ...envelope.payload,
          arguments: [{ holeId: "other-hole" }],
        },
      }),
    ).rejects.toBeInstanceOf(OutboxRepositoryError);
  });

  it("deduplicates a retried local mutation despite newer timing evidence", async () => {
    const repository = new MemoryOutboxRepository();
    const original = await repository.enqueue(envelope);
    const duplicate = await repository.enqueue({
      ...envelope,
      clientTime: "2026-07-28T12:05:00.000Z",
      leaseEvidence: {
        ...envelope.leaseEvidence!,
        leaseVersion: 3,
        lastVerifiedAt: "2026-07-28T12:04:59.000Z",
      },
    });

    expect(duplicate).toEqual(original);
    await expect(repository.summary()).resolves.toMatchObject({ pending: 1 });
  });

  it("recovers an interrupted sending state for retry", async () => {
    const repository = new MemoryOutboxRepository();
    await repository.enqueue(envelope);
    await repository.claimReady("2026-07-28T12:00:01.000Z", context);
    await repository.resetSending("2026-07-28T12:00:02.000Z");
    await expect(repository.summary()).resolves.toMatchObject({
      failed: 1,
      unsynced: 1,
    });
  });

  it.each([
    ["new operator", { operatorId: "40000000-0000-4000-8000-000000000099" }],
    ["re-registered device", { deviceId: "30000000-0000-4000-8000-000000000099" }],
    ["replacement for revoked user", { operatorId: "40000000-0000-4000-8000-000000000088" }],
  ])("quarantines pending work after %s context handover", async (_, change) => {
    const repository = new MemoryOutboxRepository();
    await repository.enqueue(envelope);
    const nextContext = { ...context, ...change };
    await expect(
      repository.quarantineForeign(
        nextContext,
        "2026-07-28T12:10:00.000Z",
      ),
    ).resolves.toBe(1);
    await expect(
      repository.claimReady(
        "2026-07-28T12:11:00.000Z",
        nextContext,
      ),
    ).resolves.toEqual([]);
    await expect(repository.summary(nextContext)).resolves.toMatchObject({
      quarantined: 1,
      incomplete: 1,
      unsynced: 1,
    });
    await expect(
      repository.deleteQuarantined(nextContext.organisationId),
    ).resolves.toBe(1);
    await expect(repository.summary(nextContext)).resolves.toMatchObject({
      quarantined: 0,
      incomplete: 0,
      unsynced: 0,
    });
  });

  it("quarantines corrupt IndexedDB rows without hiding valid records", async () => {
    const indexedDb = new IDBFactory();
    vi.stubGlobal("indexedDB", indexedDb);
    const repository = new IndexedDbOutboxRepository();
    await repository.enqueue(envelope);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open("targetlock-pilot-shadow-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      "domain-operations",
      "readwrite",
    );
    transaction.objectStore("domain-operations").put({
      operationId: "corrupt-row",
      envelope: "not-an-envelope",
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error);
    });
    database.close();

    await expect(repository.listAll()).resolves.toEqual([
      expect.objectContaining({ operationId: envelope.operationId }),
    ]);
    await expect(repository.summary(context)).resolves.toMatchObject({
      pending: 1,
      incomplete: 1,
      storageErrors: 1,
      unsynced: 2,
    });
    vi.unstubAllGlobals();
  });
});
