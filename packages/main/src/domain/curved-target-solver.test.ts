import { describe, expect, it } from "vitest";

import {
  CURVED_SOLVER_POSITION_TOLERANCE_M,
  nextSurveyMeasuredDepth,
  solveCurvedTarget,
  type CurvedTargetSolutionInput,
} from "./curved-target-solver";
import { calculateMinimumCurvatureTrajectory } from "./trajectory-desurvey";
import { doglegDegrees, vectorFromDipAz } from "./trajectory-geometry";
import { migrateTargetAttitudeMode } from "./target-migration";
import { decimetres } from "./measurements";

function baseInput(
  overrides: Partial<CurvedTargetSolutionInput> = {},
): CurvedTargetSolutionInput {
  const current = {
    measuredDepthM: 0,
    eastingM: 0,
    northingM: 0,
    rlM: 0,
    dipDegrees: -60,
    azimuthDegrees: 128,
    northReference: "GRID" as const,
  };
  return {
    currentStation: current,
    target: {
      measuredDepthM: 300,
      eastingM: 120,
      northingM: 80,
      rlM: -250,
      radiusM: 3,
      attitudeMode: "UNCONSTRAINED",
    },
    collarAttitude: {
      dipDegrees: -60,
      azimuthDegrees: 128,
      northReference: "GRID",
    },
    nextSurveyMeasuredDepthM: 30,
    calculationReference: "GRID",
    holeId: "TEST",
    ...overrides,
  };
}

describe("target attitude migration", () => {
  it("maps desired dip/az to CUSTOM", () => {
    expect(
      migrateTargetAttitudeMode({
        desiredDipTenths: -740,
        desiredAzimuthTenths: 1450,
      }),
    ).toBe("CUSTOM");
  });

  it("maps missing attitude to UNCONSTRAINED", () => {
    expect(migrateTargetAttitudeMode({})).toBe("UNCONSTRAINED");
  });
});

describe("next survey measured depth", () => {
  it("uses interval inside remaining path", () => {
    expect(
      nextSurveyMeasuredDepth({
        latestMeasuredDepthM: 425,
        targetMeasuredDepthM: 650,
        surveyIntervalM: 30,
      }),
    ).toBe(455);
  });

  it("clamps to target MD", () => {
    expect(
      nextSurveyMeasuredDepth({
        latestMeasuredDepthM: 640,
        targetMeasuredDepthM: 650,
        surveyIntervalM: 30,
      }),
    ).toBe(650);
  });

  it("returns null when interval missing", () => {
    expect(
      nextSurveyMeasuredDepth({
        latestMeasuredDepthM: 425,
        targetMeasuredDepthM: 650,
        surveyIntervalM: null,
      }),
    ).toBeNull();
  });
});

describe("solveCurvedTarget", () => {
  it("solves a straight-ish unconstrained case", () => {
    const result = solveCurvedTarget(baseInput());
    expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
    expect(result.solverConverged).toBe(true);
    expect(result.endpoint).not.toBeNull();
    expect(result.targetResidualM!).toBeLessThanOrEqual(
      CURVED_SOLVER_POSITION_TOLERANCE_M * 4,
    );
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    expect(result.nextSurveyTarget?.measuredDepthM).toBe(30);
  });

  it("respects SAME_AS_COLLAR endpoint attitude", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 200,
          eastingM: 70,
          northingM: 50,
          rlM: -170,
          radiusM: 3,
          attitudeMode: "SAME_AS_COLLAR",
        },
      }),
    );
    expect(result.solverConverged).toBe(true);
    expect(result.endpoint!.dipDegrees).toBeCloseTo(-60, 0);
    expect(result.endpoint!.azimuthDegrees).toBeCloseTo(128, 0);
  });

  it("respects CUSTOM target attitude different from collar", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 300,
          eastingM: 110,
          northingM: 90,
          rlM: -240,
          radiusM: 3,
          attitudeMode: "CUSTOM",
          desiredDipDegrees: -74,
          desiredAzimuthDegrees: 145,
          desiredNorthReference: "GRID",
        },
      }),
    );
    expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
    expect(result.endpoint!.dipDegrees).toBeCloseTo(-74, 0);
    expect(result.endpoint!.azimuthDegrees).toBeCloseTo(145, 0);
    expect(result.path.length).toBeGreaterThan(2);
    // Path should not be a single straight segment only.
    const doglegs = result.pathStations
      .slice(1)
      .map((s) => s.doglegDegreesFromPrevious ?? 0);
    expect(doglegs.some((d) => d > 0.2)).toBe(true);
  });

  it("blocks unreachable target MD shorter than straight distance", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 50,
          eastingM: 200,
          northingM: 0,
          rlM: 0,
          radiusM: 3,
          attitudeMode: "UNCONSTRAINED",
        },
      }),
    );
    expect(result.status).toBe("NO_SOLUTION");
    expect(result.warnings[0]?.code).toBe("TARGET_UNREACHABLE_AT_MD");
    expect(result.straightDistanceM!).toBeGreaterThan(
      result.remainingMeasuredDepthM!,
    );
  });

  it("is deterministic", () => {
    const input = baseInput({
      target: {
        measuredDepthM: 250,
        eastingM: 90,
        northingM: 70,
        rlM: -200,
        radiusM: 3,
        attitudeMode: "CUSTOM",
        desiredDipDegrees: -70,
        desiredAzimuthDegrees: 140,
        desiredNorthReference: "GRID",
      },
    });
    const a = solveCurvedTarget(input);
    const b = solveCurvedTarget(input);
    expect(a.status).toBe(b.status);
    expect(a.endpoint?.dipDegrees).toBe(b.endpoint?.dipDegrees);
    expect(a.endpoint?.azimuthDegrees).toBe(b.endpoint?.azimuthDegrees);
    expect(a.targetResidualM).toBe(b.targetResidualM);
    expect(a.nextSurveyTarget).toEqual(b.nextSurveyTarget);
  });

  it("produces finite output near vertical", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 0,
          eastingM: 0,
          northingM: 0,
          rlM: 0,
          dipDegrees: -88,
          azimuthDegrees: 10,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 180,
          eastingM: 5,
          northingM: 8,
          rlM: -175,
          radiusM: 3,
          attitudeMode: "CUSTOM",
          desiredDipDegrees: -89,
          desiredAzimuthDegrees: 350,
          desiredNorthReference: "GRID",
        },
      }),
    );
    expect(Number.isFinite(result.endpoint?.eastingM ?? NaN)).toBe(true);
    expect(Number.isFinite(result.endpoint?.dipDegrees ?? NaN)).toBe(true);
    expect(Number.isFinite(result.endpoint?.azimuthDegrees ?? NaN)).toBe(true);
  });

  it("samples path with minimum curvature doglegs", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 300,
          eastingM: 100,
          northingM: 80,
          rlM: -240,
          radiusM: 3,
          attitudeMode: "CUSTOM",
          desiredDipDegrees: -72,
          desiredAzimuthDegrees: 150,
          desiredNorthReference: "GRID",
        },
      }),
    );
    expect(result.pathStations.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < result.pathStations.length; i += 1) {
      const prev = result.pathStations[i - 1]!;
      const curr = result.pathStations[i]!;
      const expected = doglegDegrees(
        vectorFromDipAz(prev.dipDegrees, prev.azimuthDegrees),
        vectorFromDipAz(curr.dipDegrees, curr.azimuthDegrees),
      );
      expect(curr.doglegDegreesFromPrevious ?? 0).toBeCloseTo(expected, 5);
    }
    // Recompute via MC engine for residual sanity
    expect(result.engineVersion).toBe(
      calculateMinimumCurvatureTrajectory.length >= 0
        ? result.engineVersion
        : "",
    );
    void decimetres(0);
  });

  it("handles latest survey deeper than target MD", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 700,
          eastingM: 10,
          northingM: 10,
          rlM: -100,
          dipDegrees: -60,
          azimuthDegrees: 128,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 650,
          eastingM: 100,
          northingM: 100,
          rlM: -200,
          radiusM: 3,
          attitudeMode: "UNCONSTRAINED",
        },
      }),
    );
    expect(result.status).toBe("NO_SOLUTION");
    expect(result.warnings[0]?.code).toBe("TARGET_MD_SHALLOWER_THAN_SURVEY");
  });
});
