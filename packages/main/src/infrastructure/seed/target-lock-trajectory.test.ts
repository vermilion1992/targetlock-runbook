import { describe, expect, it } from "vitest";

import { calculateMiniTargetLock } from "../../domain";
import {
  DDH041_DEMO_CURRENT_DEPTH_M,
  DDH041_DEMO_PLANNED_DEPTH_M,
  ddh041MidholeSurveys,
} from "./target-lock-ddh041-midhole";
import { ddh041TrajectorySeed } from "./target-lock-trajectory";

describe("DDH041 trajectory seed guidance", () => {
  it("produces achievable next-survey Lift/Drop and Swing from mid-hole", () => {
    const result = calculateMiniTargetLock({
      holeId: "DDH041",
      surveys: [...ddh041MidholeSurveys],
      coordinateConfiguration:
        ddh041TrajectorySeed.coordinateConfiguration ?? null,
      actualConfiguration: ddh041TrajectorySeed.actualConfiguration ?? null,
      selections: [],
      referenceConfiguration: undefined,
      target: ddh041TrajectorySeed.target,
    });

    expect(result.blocked).toBe(false);
    expect(result.latestSurvey?.measuredDepthM).toBe(
      DDH041_DEMO_CURRENT_DEPTH_M,
    );
    expect(result.target?.measuredDepthM).toBe(DDH041_DEMO_PLANNED_DEPTH_M);
    expect(result.curvedSolution?.status).toBe("SOLVED");
    expect(result.nextSurveyGuidance).not.toBeNull();
    expect(result.nextSurveyGuidance?.verticalAction).toMatch(
      /^(LIFT|DROP|HOLD)$/,
    );
    expect(result.nextSurveyGuidance?.horizontalAction).toMatch(
      /^(LEFT|RIGHT|HOLD)$/,
    );
    expect(result.nextSurveyGuidance?.dipAdjustmentDegrees ?? 99).toBeLessThan(
      3,
    );
    expect(
      result.nextSurveyGuidance?.azimuthAdjustmentDegrees ?? 99,
    ).toBeLessThan(3);
    expect(result.curvedSolution?.maximumDoglegPer30mDegrees ?? 99).toBeLessThan(
      4,
    );
    expect(
      result.curvedSolution?.warnings.some(
        (warning) =>
          warning.code === "STEERING_LIMIT_EXCEEDED" ||
          warning.code === "TARGET_MD_REVIEW_REQUIRED" ||
          warning.code === "ADVANCED_PATH_REVIEW_REQUIRED" ||
          warning.code === "TARGET_UNREACHABLE_AT_MD",
      ),
    ).toBe(false);
  });
});
