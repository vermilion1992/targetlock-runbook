import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";

import { LocalBottomHoleAssemblySetupRepository } from "./bha-setup-repository";

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

const input = {
  operationId: "bha-change-1",
  holeId: "DDH099",
  effectiveAt: "2026-07-26T12:00:00.000Z",
  bottomHoleAssemblyLengthDm: decimetres(85),
  constantStickUpDm: decimetres(10),
  barrelSerialNumber: "BARREL-099",
  reason: "Measured before drilling",
  recordedByUserId: "user-1",
  recordedByNameSnapshot: "Driller One",
} as const;

describe("LocalBottomHoleAssemblySetupRepository", () => {
  it("saves a hole-specific setup and derives base rod string", async () => {
    const repository = new LocalBottomHoleAssemblySetupRepository(
      new MemoryStorage(),
    );

    const saved = await repository.save(input);

    expect(saved.baseRodStringLengthDm).toBe(75);
    expect(saved.barrelSerialNumber).toBe("BARREL-099");
    await expect(repository.getCurrent("DDH099")).resolves.toEqual(saved);
    await expect(repository.listByHole("DDH100")).resolves.toEqual([]);
  });

  it("is idempotent for a repeated operation ID", async () => {
    const repository = new LocalBottomHoleAssemblySetupRepository(
      new MemoryStorage(),
    );

    const first = await repository.save(input);
    const repeated = await repository.save({
      ...input,
      reason: "Retried request",
    });

    expect(repeated).toEqual(first);
    await expect(repository.listByHole(input.holeId)).resolves.toHaveLength(1);
  });

  it("rejects constant stick-up longer than the assembly", async () => {
    const repository = new LocalBottomHoleAssemblySetupRepository(
      new MemoryStorage(),
    );

    await expect(
      repository.save({
        ...input,
        constantStickUpDm: decimetres(90),
      }),
    ).rejects.toThrow("cannot exceed");
  });
});
