import { describe, expect, it } from "vitest";

import { decimetres, type AuditEntry } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import { LocalAuditRepository } from "./audit-repository";

class MemoryStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const entry: AuditEntry = {
  localId: "audit-shift-started",
  serverId: null,
  syncStatus: "local-only",
  createdAt: "2026-07-21T06:00:00.000Z",
  updatedAt: "2026-07-21T06:00:00.000Z",
  deviceId: "test-device",
  version: 1,
  holeId: "DDH041",
  entityType: "shift",
  entityId: "shift-day",
  action: "shift_started",
  userId: "user-hoffman",
  userNameSnapshot: "M. Hoffman",
  timestamp: "2026-07-21T06:00:00.000Z",
  depthDm: decimetres(6_268),
  metadata: { shiftType: "DAY" },
};

describe("local audit repository", () => {
  it("appends immutable, hole-scoped audit records", async () => {
    const repository = new LocalAuditRepository(new MemoryStorage());
    await expect(repository.append(entry)).resolves.toBe("saved");
    await expect(repository.append(entry)).resolves.toBe("already-saved");
    expect(await repository.listByEntity("DDH041", "shift", "shift-day")).toEqual([
      entry,
    ]);
    expect(await repository.listByHole("DDH042")).toEqual([]);
  });

  it("rejects a conflicting duplicate audit identifier", async () => {
    const repository = new LocalAuditRepository(new MemoryStorage());
    await repository.append(entry);
    await expect(
      repository.append({ ...entry, action: "shift_reopened" }),
    ).rejects.toThrow("immutable");
  });
});
