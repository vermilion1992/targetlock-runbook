import { describe, expect, it } from "vitest";

import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  createMemoryTrajectoryRepository,
  LocalTrajectoryRepository,
} from "./trajectory-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
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

describe("trajectory steering envelope persistence", () => {
  it("round-trips hole-specific steering limits and action deadband", async () => {
    const repository = createMemoryTrajectoryRepository();
    const occurredAt = "2026-07-26T00:00:00.000Z";

    await repository.saveActualConfiguration({
      operationId: "save-steering-envelope",
      holeId: "DDH900",
      collarDipTenths: -620,
      collarAzimuthTenths: 1_340,
      collarNorthReference: "GRID",
      preferredSurveyIntervalDm: 300,
      maximumDoglegPer30mTenths: 80,
      maximumLiftPer30mTenths: 70,
      maximumDropPer30mTenths: 60,
      maximumTurnPer30mTenths: 50,
      guidanceDeadbandTenths: 2,
      occurredAt,
    });

    await expect(
      repository.getActualConfiguration("DDH900"),
    ).resolves.toMatchObject({
      maximumDoglegPer30mTenths: 80,
      maximumLiftPer30mTenths: 70,
      maximumDropPer30mTenths: 60,
      maximumTurnPer30mTenths: 50,
      guidanceDeadbandTenths: 2,
    });
  });

  it("rejects trajectory envelopes containing another hole's data", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalTrajectoryRepository(storage);
    const holeId = "DDH900";
    await repository.saveActualConfiguration({
      operationId: "save-actual",
      holeId,
      collarDipTenths: -620,
      collarAzimuthTenths: 1_340,
      collarNorthReference: "GRID",
      occurredAt: "2026-07-26T00:00:00.000Z",
    });
    const key = [...storage.values.keys()][0]!;
    const envelope = JSON.parse(storage.getItem(key)!) as {
      actualConfiguration: { holeId: string };
    };
    storage.setItem(
      key,
      JSON.stringify({
        ...envelope,
        actualConfiguration: {
          ...envelope.actualConfiguration,
          holeId: "DDH901",
        },
      }),
    );

    await expect(
      repository.getActualConfiguration(holeId),
    ).rejects.toMatchObject({
      code: "CORRUPTED_STORAGE",
    });
  });
});
