import { describe, expect, it } from "vitest";

import { LocalCompletionRepository } from "@/infrastructure/completion";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  isSeedRunCompatibleWithHole,
  STAGE5_HOLE_IDS,
  stage5CompletionSeed,
  targetLockStage5Seed,
} from "@/infrastructure/seed";

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

describe("targetLockStage5Seed", () => {
  it("rejects known seed run IDs under another hole", () => {
    const seedRunId = targetLockStage5Seed.runs[0]?.localId ?? "run-ddh041-1";
    expect(isSeedRunCompatibleWithHole("DDH041", seedRunId)).toBe(true);
    expect(isSeedRunCompatibleWithHole("DDH042", seedRunId)).toBe(false);
    expect(isSeedRunCompatibleWithHole("DDH042", "local-run-1")).toBe(true);
  });

  it("keeps DDH041 active and seeds completed, abandoned, and reopened holes", async () => {
    expect(STAGE5_HOLE_IDS).toEqual(
      expect.arrayContaining(["DDH041", "DDH038", "DDH039", "DDH042"]),
    );
    expect(
      targetLockStage5Seed.componentAssignments.some(
        ({ holeId, status }) => holeId === "DDH040" && status === "ACTIVE",
      ),
    ).toBe(true);
    expect(
      targetLockStage5Seed.componentAssignments.some(
        ({ holeId }) => holeId === "DDH038",
      ),
    ).toBe(false);

    const repository = new LocalCompletionRepository(
      new MemoryStorage(),
      targetLockStage5Seed.organisation.localId,
      stage5CompletionSeed,
    );

    await expect(repository.getStatus("DDH041")).resolves.toBe("ACTIVE");
    await expect(repository.getStatus("DDH038")).resolves.toBe("COMPLETED");
    await expect(repository.getStatus("DDH039")).resolves.toBe("ABANDONED");
    await expect(repository.getStatus("DDH042")).resolves.toBe("ACTIVE");
    await expect(repository.listCompletedHoles()).resolves.toHaveLength(2);
    await expect(repository.getReopenHistory("DDH042")).resolves.toHaveLength(1);
    await expect(
      repository.getLatestCompletion("DDH042"),
    ).resolves.toMatchObject({
      finalStatus: "COMPLETED",
    });
  });
});
