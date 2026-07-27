import { describe, expect, it, vi } from "vitest";

import type {
  CanonicalHole,
  CompletionRepository,
} from "@/infrastructure/completion";
import type { TrajectoryRepository } from "@/infrastructure/trajectory";
import { createHoleWithTrajectoryDefaults } from "./create-hole-use-cases";

describe("createHoleWithTrajectoryDefaults", () => {
  it("resumes trajectory setup after the hole write already succeeded", async () => {
    const hole = { localId: "DDH-RECOVERY" } as CanonicalHole;
    let created = false;
    let physicalWrites = 0;
    const createHole = vi.fn(async () => {
      if (!created) {
        created = true;
        physicalWrites += 1;
      }
      return hole;
    });
    const saveActualConfiguration = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary trajectory failure"))
      .mockResolvedValue({ localId: "actual-1" });
    const completion = {
      createHole,
    } as unknown as CompletionRepository;
    const trajectory = {
      saveActualConfiguration,
      saveReferenceConfiguration: vi
        .fn()
        .mockResolvedValue({ localId: "reference-1" }),
      saveCoordinateConfiguration: vi
        .fn()
        .mockResolvedValue({ localId: "coordinates-1" }),
    } as unknown as TrajectoryRepository;
    const input = {
      operationId: "create-hole-recovery",
      holeId: "DDH-RECOVERY",
      collarDipTenths: -600,
      collarAzimuthTenths: 1280,
      collarNorthReference: "GRID" as const,
      occurredAt: "2026-07-28T00:00:00.000Z",
    };

    await expect(
      createHoleWithTrajectoryDefaults(input, { completion, trajectory }),
    ).rejects.toThrow(
      "Hole DDH-RECOVERY was created but trajectory defaults failed",
    );

    await expect(
      createHoleWithTrajectoryDefaults(input, { completion, trajectory }),
    ).resolves.toMatchObject({ hole, hasTarget: false });
    expect(createHole).toHaveBeenCalledTimes(2);
    expect(physicalWrites).toBe(1);
    expect(saveActualConfiguration).toHaveBeenCalledTimes(2);
  });
});
