import { describe, expect, it } from "vitest";

import { createMemoryTrajectoryRepository } from "@/infrastructure/trajectory";
import { saveTrajectorySurveySelection } from "./trajectory-use-cases";

describe("trajectory survey selection ownership", () => {
  it("rejects a survey that is not owned by the requested hole", async () => {
    const trajectory = createMemoryTrajectoryRepository();

    await expect(
      saveTrajectorySurveySelection(
        {
          operationId: "select-foreign-survey",
          holeId: "DDH042",
          depthDm: 4_250,
          selectedSurveyId: "survey-ddh041-425",
          selectedByUserId: "user-1",
          selectedByNameSnapshot: "M. Hoffman",
          occurredAt: "2026-07-26T00:00:00.000Z",
        },
        {
          trajectory,
          surveys: {
            getById: async () => null,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The selected survey does not belong to this hole.",
    });
    await expect(trajectory.listSelections("DDH042")).resolves.toEqual([]);
  });
});
