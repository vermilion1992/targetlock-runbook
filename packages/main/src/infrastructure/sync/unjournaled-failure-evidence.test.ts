import { describe, expect, it } from "vitest";

import {
  LocalStorageUnjournaledFailureEvidenceStore,
  MemoryUnjournaledFailureEvidenceStore,
} from "./unjournaled-failure-evidence";

const context = {
  organisationId: "10000000-0000-4000-8000-000000000001",
  deviceId: "20000000-0000-4000-8000-000000000001",
  operatorId: "30000000-0000-4000-8000-000000000001",
};

class TestStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("durable unjournalled failure evidence", () => {
  it("survives coordinator reload independently of IndexedDB and is scoped by device and operator", () => {
    const storage = new TestStorage();
    const first = new LocalStorageUnjournaledFailureEvidenceStore(storage);
    first.record(context, {
      operationType: "runs.saveCompletedRun.v1",
      occurredAt: "2026-07-29T00:00:00.000Z",
      reason: "IndexedDB was unavailable after the local commit.",
    });

    const reloaded = new LocalStorageUnjournaledFailureEvidenceStore(storage);
    expect(reloaded.list(context)).toHaveLength(1);
    expect(
      reloaded.list({
        ...context,
        deviceId: "20000000-0000-4000-8000-000000000002",
      }),
    ).toHaveLength(0);
  });

  it("requires explicit export acknowledgement before clearing evidence", () => {
    const store = new MemoryUnjournaledFailureEvidenceStore();
    store.record(context, {
      operationType: "runs.saveCompletedRun.v1",
      occurredAt: "2026-07-29T00:00:00.000Z",
      reason: "Operation enqueue failed after local commit.",
    });
    expect(store.list(context)).toHaveLength(1);
    expect(
      store.acknowledgeExported({
        organisationId: context.organisationId,
        operatorId: context.operatorId,
      }),
    ).toBe(1);
    expect(store.list(context)).toHaveLength(0);
  });
});
