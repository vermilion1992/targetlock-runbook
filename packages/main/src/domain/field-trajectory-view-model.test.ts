import { describe, expect, it } from "vitest";

import {
  buildFieldTrajectoryViewModel,
  densifyCurvedRecoveryPath,
} from "./trajectory-view-model";
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
    expect(
      model.markers.find((marker) => marker.kind === "COLLAR")?.dipDegrees,
    ).toBe(-60);
    expect(
      model.markers.find((marker) => marker.kind === "SURVEY_STATION")
        ?.azimuthDegrees,
    ).toBe(90);
  });

  it("densifies curved recovery path with MC mid-samples", () => {
    const sparse = [
      {
        measuredDepthM: 425,
        eastingM: 165.2,
        northingM: -127.8,
        rlM: -370.1,
        dipDegrees: -62.1,
        azimuthDegrees: 129.8,
      },
      {
        measuredDepthM: 500,
        eastingM: 200,
        northingM: -160,
        rlM: -420,
        dipDegrees: -45,
        azimuthDegrees: 128,
      },
      {
        measuredDepthM: 575,
        eastingM: 240,
        northingM: -190,
        rlM: -470,
        dipDegrees: -40,
        azimuthDegrees: 127,
      },
      {
        measuredDepthM: 650,
        eastingM: 280,
        northingM: -220,
        rlM: -520,
        dipDegrees: -39,
        azimuthDegrees: 126,
      },
    ];
    const densified = densifyCurvedRecoveryPath(sparse, 5);
    expect(densified.length).toBeGreaterThan(sparse.length);
    expect(densified[0]).toMatchObject({
      measuredDepthM: 425,
      eastingM: 165.2,
      northingM: -127.8,
      rlM: -370.1,
    });
    expect(densified.at(-1)).toMatchObject({
      measuredDepthM: 650,
      eastingM: 280,
      northingM: -220,
      rlM: -520,
    });

    const result: MiniTargetLockResult = {
      holeId: "DDH041",
      blocked: false,
      calculationNorthReference: "GRID",
      actualTrajectory: stubTrajectory(),
      latestSurvey: {
        measuredDepthM: 425,
        dipDegrees: -62.1,
        azimuthDegrees: 129.8,
        eastingM: 165.2,
        northingM: -127.8,
        rlM: -370.1,
        sourceType: "SURVEY",
        sourceId: "s425",
      },
      guidanceFromCollarOnly: false,
      target: {
        eastingM: 280,
        northingM: -220,
        rlM: -520,
        diameterM: 10,
        measuredDepthM: 650,
        attitudeMode: "CUSTOM",
      },
      surveyIntervalM: 30,
      nextSurveyMeasuredDepthM: 455,
      nextSurveyGuidance: null,
      curvedSolution: {
        status: "REVIEW_REQUIRED",
        path: sparse,
        pathStations: [],
        nextSurveyTarget: null,
        endpoint: sparse[3]!,
        targetResidualM: 0.1,
        remainingMeasuredDepthM: 225,
        straightDistanceM: 200,
        maximumDoglegDegrees: 56.3,
        maximumDoglegPer30mDegrees: 22.5,
        solverConverged: true,
        engineVersion: "minimum-curvature-v1",
        solverVersion: "curved-target-mc-v1",
        warnings: [],
      },
      remainingMeasuredDepthM: 225,
      directToTarget: null,
      requiredChange: null,
      projection: null,
      warnings: [],
      sourceVersions: [],
    };

    const model = buildFieldTrajectoryViewModel(result);
    expect(model.curvedRecoveryPath?.length).toBeGreaterThan(sparse.length);
    expect(model.directToTargetLine).toBeUndefined();

    // Rendering parity: field view-model path is exactly densified solver output
    // (no spline / reordering / omitted endpoints).
    const expected = densifyCurvedRecoveryPath(sparse, 5);
    expect(model.curvedRecoveryPath).toEqual(expected);
    expect(model.curvedRecoveryPath![0]).toEqual(expected[0]);
    expect(model.curvedRecoveryPath!.at(-1)).toEqual(expected.at(-1));
  });

  it("densify uses MC mid-samples rather than straight chords between controls", () => {
    const sparse = [
      {
        measuredDepthM: 0,
        eastingM: 0,
        northingM: 0,
        rlM: 0,
        dipDegrees: -60,
        azimuthDegrees: 90,
      },
      {
        measuredDepthM: 100,
        eastingM: 50,
        northingM: 0,
        rlM: -86.6,
        dipDegrees: -30,
        azimuthDegrees: 90,
      },
    ];
    const densified = densifyCurvedRecoveryPath(sparse, 10);
    const mid = densified[Math.floor(densified.length / 2)]!;
    // Straight chord midpoint would sit on the E/RL line between endpoints.
    // MC arc with a 30° dip change bows away from that chord.
    const chordE = 25;
    const chordRl = -43.3;
    expect(Math.hypot(mid.eastingM - chordE, mid.rlM - chordRl)).toBeGreaterThan(
      0.5,
    );
  });
});
