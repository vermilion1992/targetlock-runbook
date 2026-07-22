import { describe, expect, it } from "vitest";

import { decimetres, type SurveyTool } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalSurveyRepository,
} from "./survey-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
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

const tool: SurveyTool = {
  localId: "tool-1",
  serverId: null,
  syncStatus: "local-only",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  deviceId: "test",
  version: 1,
  organisationId: "org-1",
  name: "EZ-TRAC",
  serialNumber: "EZT-18427",
  defaultNorthReference: "GRID",
  status: "ACTIVE",
  createdByUserId: "user-1",
  createdByNameSnapshot: "M. Hoffman",
};

function input(
  operationId: string,
  surveyId: string,
  holeId = "DDH041",
) {
  return {
    operationId,
    surveyId,
    holeId,
    depthDm: decimetres(4_250),
    dipTenths: -621,
    azimuthTenths: 1298,
    northReference: "GRID" as const,
    surveyToolId: tool.localId,
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-21T10:42:00.000Z",
  };
}

describe("LocalSurveyRepository", () => {
  it("creates a survey with immutable tool snapshots", async () => {
    const repository = new LocalSurveyRepository(
      new MemoryStorage(),
      "org-1",
      [tool],
    );
    const saved = await repository.create(input("op-1", "survey-1"));
    expect(saved).toMatchObject({
      depthDm: 4_250,
      toolNameSnapshot: "EZ-TRAC",
      toolSerialSnapshot: "EZT-18427",
    });
  });

  it("creates without a tool and allows repeated depths", async () => {
    const repository = new LocalSurveyRepository(
      new MemoryStorage(),
      "org-1",
      [tool],
    );
    const first = { ...input("op-1", "survey-1"), surveyToolId: undefined };
    const second = input("op-2", "survey-2");
    await repository.create(first);
    await repository.create(second);
    expect(await repository.listByHole("DDH041")).toHaveLength(2);
    expect((await repository.getById("survey-1"))?.toolNameSnapshot).toBeUndefined();
  });

  it("is idempotent and rejects conflicting operation reuse", async () => {
    const repository = new LocalSurveyRepository(
      new MemoryStorage(),
      "org-1",
      [tool],
    );
    const saved = await repository.create(input("op-1", "survey-1"));
    await expect(repository.create(input("op-1", "survey-1"))).resolves.toEqual(
      saved,
    );
    await expect(
      repository.create(input("op-1", "survey-other")),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("preserves original values in correction history", async () => {
    const repository = new LocalSurveyRepository(
      new MemoryStorage(),
      "org-1",
      [tool],
    );
    const saved = await repository.create(input("op-1", "survey-1"));
    const corrected = await repository.correct({
      operationId: "correct-1",
      correctionId: "correction-1",
      surveyId: saved.localId,
      holeId: "DDH041",
      expectedVersion: saved.version,
      changes: { azimuthTenths: 1288 },
      reason: "Typing mistake",
      correctedByUserId: "user-1",
      correctedByNameSnapshot: "M. Hoffman",
      correctedAt: "2026-07-21T10:45:00.000Z",
    });
    expect(corrected.azimuthTenths).toBe(1288);
    expect(await repository.listCorrections(saved.localId)).toMatchObject([
      {
        previousValue: 1298,
        correctedValue: 1288,
        reason: "Typing mistake",
      },
    ]);
  });

  it("isolates holes and hydrates seed data after repository restart", async () => {
    const storage = new MemoryStorage();
    const first = new LocalSurveyRepository(storage, "org-1", [tool]);
    await first.create(input("op-1", "survey-1", "DDH041"));
    await first.create(input("op-2", "survey-2", "DDH042"));
    const restarted = new LocalSurveyRepository(storage, "org-1", [tool]);
    expect(await restarted.listByHole("DDH041")).toHaveLength(1);
    expect(await restarted.listByHole("DDH042")).toHaveLength(1);
  });
});
