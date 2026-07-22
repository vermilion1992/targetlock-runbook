import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import { LocalAuditRepository } from "@/infrastructure/audit";
import { LocalCasingRepository } from "@/infrastructure/casing";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  advanceCasing,
  correctCasing,
  getCasingHistory,
  installCasing,
} from "./casing-use-cases";

class MemoryStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const actor = {
  recordedByUserId: "user-hoffman",
  recordedByNameSnapshot: "M. Hoffman",
};

describe("casing use cases", () => {
  it("preserves install, advance and correction history with audit entries", async () => {
    const storage = new MemoryStorage();
    const services = {
      casing: new LocalCasingRepository(storage),
      audits: new LocalAuditRepository(storage),
    };
    await installCasing(
      {
        operationId: "install-pq",
        casingStringId: "casing-pq",
        holeId: "DDH041",
        casingSize: "PQ",
        startDepthDm: decimetres(0),
        endDepthDm: decimetres(60),
        currentHoleDepthDm: decimetres(100),
        recordedAt: "2026-07-20T06:00:00.000Z",
        ...actor,
      },
      services,
    );
    await advanceCasing(
      {
        operationId: "advance-pq",
        casingStringId: "casing-pq",
        holeId: "DDH041",
        newEndDepthDm: decimetres(180),
        currentHoleDepthDm: decimetres(200),
        expectedVersion: 1,
        recordedAt: "2026-07-21T06:00:00.000Z",
        ...actor,
      },
      services,
    );
    const corrected = await correctCasing(
      {
        operationId: "correct-pq",
        casingStringId: "casing-pq",
        holeId: "DDH041",
        newEndDepthDm: decimetres(175),
        currentHoleDepthDm: decimetres(200),
        expectedVersion: 2,
        reason: "Entry mistake",
        recordedAt: "2026-07-21T07:00:00.000Z",
        ...actor,
      },
      services,
    );

    expect(corrected.currentEndDepthDm).toBe(175);
    const history = await getCasingHistory("DDH041", services);
    expect(history[0]?.events.map(({ eventType }) => eventType)).toEqual([
      "INSTALL",
      "ADVANCE",
      "CORRECT",
    ]);
    expect(history[0]?.events[1]).toMatchObject({
      previousEndDepthDm: 60,
      newEndDepthDm: 180,
    });
    expect(await services.audits.listByHole("DDH041")).toHaveLength(3);
  });
});
