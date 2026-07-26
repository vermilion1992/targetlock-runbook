import { describe, expect, it } from "vitest";

import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import { LocalTrajectoryProjectDefaultsRepository } from "./trajectory-project-defaults";

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

describe("trajectory project defaults", () => {
  it("keeps defaults isolated by project", async () => {
    const repository = new LocalTrajectoryProjectDefaultsRepository(
      new MemoryStorage(),
    );
    const shared = {
      surveyNorthReference: "GRID" as const,
      calculationNorthReference: "GRID" as const,
      gridRotationDeg: 0,
      magneticDeclinationDeg: 0,
      coordinateSystemName: "Local Mine Grid",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };

    await repository.save("project-a", {
      ...shared,
      preferredSurveyIntervalDm: 300,
    });
    await repository.save("project-b", {
      ...shared,
      preferredSurveyIntervalDm: 450,
    });

    expect(repository.read("project-a")?.preferredSurveyIntervalDm).toBe(300);
    expect(repository.read("project-b")?.preferredSurveyIntervalDm).toBe(450);
    expect(repository.read("project-c")).toBeNull();
  });
});
