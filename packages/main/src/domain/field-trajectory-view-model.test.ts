import { describe, expect, it } from "vitest";

import { buildFieldTrajectoryViewModel } from "./trajectory-view-model";
import type { MiniTargetLockResult } from "./mini-target-lock";
import type { CalculatedTrajectory } from "./trajectory-types";

function stubTrajectory(): CalculatedTrajectory {
  const station = {
    index: 0,
    sourceType: "SURVEY" as const,
    sourceId: "s1",
    measuredDepthM: 100,
    dipDegrees: -60,
    azimuthDegrees: 90,
    northReference: "GRID" as const,
    relativeEastingM: 50,
    relativeNorthingM: 0,
    verticalDisplacementM: -86.6,
    tvdM: 86.6,
    eastingM: 100_050,
    northingM: 200_000,
    rlM: 413.4,
  };
  return {
    trajectoryType: "ACTUAL",
    holeId: "DDH050",
    desurveyMethod: "MINIMUM_CURVATURE",
    engineVersion: "minimum-curvature-v1",
    collar: {
      ...station,
      index: 0,
      sourceType: "COLLAR",
      measuredDepthM: 0,
      eastingM: 100_000,
      northingM: 200_000,
      rlM: 500,
      relativeEastingM: 0,
      relativeNorthingM: 0,
      verticalDisplacementM: 0,
      tvdM: 0,
    },
    stations: [
      {
        ...station,
        index: 0,
        sourceType: "COLLAR",
        measuredDepthM: 0,
        eastingM: 100_000,
        northingM: 200_000,
        rlM: 500,
        relativeEastingM: 0,
        relativeNorthingM: 0,
        verticalDisplacementM: 0,
        tvdM: 0,
      },
      station,
    ],
    renderPath: [
      {
        ...station,
        index: 0,
        sourceType: "COLLAR",
        measuredDepthM: 0,
        eastingM: 100_000,
        northingM: 200_000,
        rlM: 500,
        relativeEastingM: 0,
        relativeNorthingM: 0,
        verticalDisplacementM: 0,
        tvdM: 0,
      },
      station,
    ],
    endpoint: station,
    measuredDepthM: 100,
    tvdM: 86.6,
    coordinateMode: "MINE_GRID",
    northReference: "GRID",
    eastingDisplacementM: 50,
    northingDisplacementM: 0,
    verticalDisplacementM: -86.6,
    lateralDisplacementM: 50,
    boundingBox: {
      minEastingM: 100_000,
      maxEastingM: 100_050,
      minNorthingM: 200_000,
      maxNorthingM: 200_000,
      minRlM: 413.4,
      maxRlM: 500,
    },
    warnings: [],
    sourceVersions: [],
  };
}

describe("buildFieldTrajectoryViewModel", () => {
  it("omits planned path and includes projection overlays", () => {
    const result: MiniTargetLockResult = {
      holeId: "DDH050",
      blocked: false,
      calculationNorthReference: "GRID",
      actualTrajectory: stubTrajectory(),
      latestSurvey: {
        measuredDepthM: 100,
        dipDegrees: -60,
        azimuthDegrees: 90,
        eastingM: 100_050,
        northingM: 200_000,
        rlM: 413.4,
        sourceType: "SURVEY",
        sourceId: "s1",
      },
      guidanceFromCollarOnly: false,
      target: {
        eastingM: 100_200,
        northingM: 200_000,
        rlM: 400,
        diameterM: 6,
        measuredDepthM: 250,
        attitudeMode: "UNCONSTRAINED",
      },
      surveyIntervalM: 30,
      nextSurveyMeasuredDepthM: 130,
      nextSurveyGuidance: null,
      curvedSolution: null,
      remainingMeasuredDepthM: 150,
      directToTarget: {
        dipDegrees: -5,
        azimuthDegrees: 90,
        distanceM: 150,
      },
      requiredChange: { dipDegrees: 55, azimuthDegrees: 0 },
      projection: {
        closestApproachM: 8.4,
        missOutsideTargetM: 5.4,
        intersectsTarget: false,
        closestApproachPosition: {
          eastingM: 100_200,
          northingM: 200_008.4,
          rlM: 400,
        },
        projectedPath: [
          { eastingM: 100_050, northingM: 200_000, rlM: 413.4 },
          { eastingM: 100_250, northingM: 200_000, rlM: 350 },
        ],
      },
      warnings: [],
      sourceVersions: [],
    };

    const model = buildFieldTrajectoryViewModel(result);
    expect(model.fieldMode).toBe(true);
    expect(model.plannedPath).toHaveLength(0);
    expect(model.actualPath.length).toBeGreaterThan(0);
    expect(model.target?.diameterM).toBe(6);
    expect(model.target?.radiusM).toBe(3);
    expect(model.directToTargetLine).toBeDefined();
    expect(model.projectedContinuationPath?.length).toBe(2);
    expect(model.closestApproachPoint).toBeDefined();
    expect(model.missVector).toBeDefined();
  });
});
