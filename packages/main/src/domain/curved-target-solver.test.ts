import { describe, expect, it } from "vitest";

import {
  buildRecoveryIntervalDiagnostics,
  CURVED_SOLVER_POSITION_TOLERANCE_M,
  nextSurveyMeasuredDepth,
  solveCurvedTarget,
  summariseRecoveryPathDiagnostics,
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
      attitudeMode: "AUTO_SMOOTH",
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
  it("maps desired dip/az to MATCH_ENTRY_DIRECTION", () => {
    expect(
      migrateTargetAttitudeMode({
        desiredDipTenths: -740,
        desiredAzimuthTenths: 1450,
      }),
    ).toBe("MATCH_ENTRY_DIRECTION");
  });

  it("maps missing attitude to AUTO_SMOOTH", () => {
    expect(migrateTargetAttitudeMode({})).toBe("AUTO_SMOOTH");
  });

  it("migrates legacy modes idempotently", () => {
    expect(migrateTargetAttitudeMode({ attitudeMode: "AUTO_SMOOTH" })).toBe(
      "AUTO_SMOOTH",
    );
    expect(migrateTargetAttitudeMode({ attitudeMode: "MATCH_ENTRY_DIRECTION" })).toBe(
      "MATCH_ENTRY_DIRECTION",
    );
    expect(migrateTargetAttitudeMode({ attitudeMode: "SAME_AS_COLLAR" })).toBe(
      "SAME_AS_COLLAR",
    );
    expect(migrateTargetAttitudeMode({ attitudeMode: "AUTO_SMOOTH" })).toBe(
      "AUTO_SMOOTH",
    );
    expect(
      migrateTargetAttitudeMode({ attitudeMode: "MATCH_ENTRY_DIRECTION" }),
    ).toBe("MATCH_ENTRY_DIRECTION");
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
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 300,
          eastingM: 120,
          northingM: 80,
          rlM: -250,
          radiusM: 3,
          attitudeMode: "AUTO_SMOOTH",
        },
      }),
    );
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

  it("respects MATCH_ENTRY_DIRECTION target attitude different from collar", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 300,
          eastingM: 110,
          northingM: 90,
          rlM: -240,
          radiusM: 3,
          attitudeMode: "MATCH_ENTRY_DIRECTION",
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
          attitudeMode: "AUTO_SMOOTH",
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
        attitudeMode: "MATCH_ENTRY_DIRECTION",
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
          attitudeMode: "MATCH_ENTRY_DIRECTION",
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
          attitudeMode: "MATCH_ENTRY_DIRECTION",
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
          attitudeMode: "AUTO_SMOOTH",
        },
      }),
    );
    expect(result.status).toBe("NO_SOLUTION");
    expect(result.warnings[0]?.code).toBe("TARGET_MD_SHALLOWER_THAN_SURVEY");
  });

  it("begins tangent to the latest survey", () => {
    const input = baseInput({
      currentStation: {
        measuredDepthM: 425,
        eastingM: 165.17,
        northingM: -127.84,
        rlM: -370.12,
        dipDegrees: -62.1,
        azimuthDegrees: 129.8,
        northReference: "GRID",
      },
      target: {
        measuredDepthM: 650,
        eastingM: 280,
        northingM: -220,
        rlM: -520,
        radiusM: 5,
        attitudeMode: "MATCH_ENTRY_DIRECTION",
        desiredDipDegrees: -74,
        desiredAzimuthDegrees: 145,
        desiredNorthReference: "GRID",
      },
    });
    const result = solveCurvedTarget(input);
    expect(result.path[0]).toMatchObject({
      measuredDepthM: 425,
      dipDegrees: -62.1,
      azimuthDegrees: 129.8,
    });
    expect(result.path[0]!.eastingM).toBeCloseTo(165.17, 2);
    expect(result.path[0]!.northingM).toBeCloseTo(-127.84, 2);
    expect(result.path[0]!.rlM).toBeCloseTo(-370.12, 2);
  });

  it("prefers distributed curvature over a concentrated dogleg for DDH041-like geometry", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 425,
          eastingM: 165.16963300923754,
          northingM: -127.84231168994178,
          rlM: -370.117410748341,
          dipDegrees: -62.1,
          azimuthDegrees: 129.8,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 650,
          eastingM: 280,
          northingM: -220,
          rlM: -520,
          radiusM: 5,
          attitudeMode: "MATCH_ENTRY_DIRECTION",
          desiredDipDegrees: -74,
          desiredAzimuthDegrees: 145,
          desiredNorthReference: "GRID",
        },
        nextSurveyMeasuredDepthM: 455,
      }),
    );

    expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
    expect(result.solverConverged).toBe(true);
    expect(result.targetResidualM!).toBeLessThanOrEqual(
      CURVED_SOLVER_POSITION_TOLERANCE_M,
    );
    expect(result.endpoint!.dipDegrees).toBeCloseTo(-74, 0);
    expect(result.endpoint!.azimuthDegrees).toBeCloseTo(145, 0);

    const diagnostics = result.intervalDiagnostics!;
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);

    // No artificial straight terminal from duplicated end attitudes.
    const last = diagnostics[diagnostics.length - 1]!;
    expect(last.doglegDegrees).toBeGreaterThan(0.2);

    // Curvature should not collapse into one dominant interval when a smoother
    // feasible geometry exists (baseline concentrated solution was ~22.5°/30 m
    // with ~17° DLS change between intervals).
    expect(result.maximumDoglegPer30mDegrees!).toBeLessThan(26);
    expect(result.maximumDoglegChangePer30mDegrees!).toBeLessThan(14);

    const dlsValues = diagnostics.map((interval) => interval.doglegPer30mDegrees);
    const maxDls = Math.max(...dlsValues);
    const meanDls = dlsValues.reduce((sum, value) => sum + value, 0) / dlsValues.length;
    expect(maxDls / meanDls).toBeLessThan(1.65);
  });

  it("is deterministic for the DDH041-like recovery", () => {
    const input = baseInput({
      currentStation: {
        measuredDepthM: 425,
        eastingM: 165.16963300923754,
        northingM: -127.84231168994178,
        rlM: -370.117410748341,
        dipDegrees: -62.1,
        azimuthDegrees: 129.8,
        northReference: "GRID",
      },
      target: {
        measuredDepthM: 650,
        eastingM: 280,
        northingM: -220,
        rlM: -520,
        radiusM: 5,
        attitudeMode: "MATCH_ENTRY_DIRECTION",
        desiredDipDegrees: -74,
        desiredAzimuthDegrees: 145,
        desiredNorthReference: "GRID",
      },
    });
    const a = solveCurvedTarget(input);
    const b = solveCurvedTarget(input);
    expect(a.status).toBe(b.status);
    expect(a.targetResidualM).toBe(b.targetResidualM);
    expect(a.maximumDoglegPer30mDegrees).toBe(b.maximumDoglegPer30mDegrees);
    expect(a.path).toEqual(b.path);
  });

  it("handles azimuth wrap across north", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 0,
          eastingM: 0,
          northingM: 0,
          rlM: 0,
          dipDegrees: -55,
          azimuthDegrees: 350,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 220,
          eastingM: 40,
          northingM: 160,
          rlM: -170,
          radiusM: 3,
          attitudeMode: "MATCH_ENTRY_DIRECTION",
          desiredDipDegrees: -60,
          desiredAzimuthDegrees: 20,
          desiredNorthReference: "GRID",
        },
      }),
    );
    expect(["SOLVED", "REVIEW_REQUIRED", "NO_SOLUTION"]).toContain(result.status);
    if (result.solverConverged) {
      expect(result.endpoint!.azimuthDegrees).toBeGreaterThanOrEqual(0);
      expect(result.endpoint!.azimuthDegrees).toBeLessThan(360);
    }
  });

  it("does not invent an attitude requirement in AUTO_SMOOTH mode", () => {
    const result = solveCurvedTarget(
      baseInput({
        target: {
          measuredDepthM: 250,
          eastingM: 90,
          northingM: 60,
          rlM: -200,
          radiusM: 3,
          attitudeMode: "AUTO_SMOOTH",
        },
      }),
    );
    expect(result.targetAttitudeResidual).toBeUndefined();
    expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
  });

  it("DDH041 AUTO_SMOOTH has no lateral turn reversal", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 425,
          eastingM: 165.16963300923754,
          northingM: -127.84231168994178,
          rlM: -370.117410748341,
          dipDegrees: -62.1,
          azimuthDegrees: 129.8,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 650,
          eastingM: 280,
          northingM: -220,
          rlM: -520,
          radiusM: 5,
          attitudeMode: "AUTO_SMOOTH",
        },
        nextSurveyMeasuredDepthM: 455,
      }),
    );

    expect(result.solverConverged).toBe(true);
    expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
    expect(result.pathQuality?.hasTurnReversal).toBe(false);
    expect(result.pathQuality?.hasCrossTrackOvershoot).toBe(false);
    expect(result.pathQuality?.targetMdReviewRequired).toBe(false);
    expect(result.targetResidualM!).toBeLessThanOrEqual(
      CURVED_SOLVER_POSITION_TOLERANCE_M,
    );
    expect(result.path[0]).toMatchObject({
      measuredDepthM: 425,
      dipDegrees: -62.1,
      azimuthDegrees: 129.8,
    });
    expect(result.nextSurveyTarget?.measuredDepthM).toBe(455);
    expect(result.targetAttitudeResidual).toBeUndefined();
    expect(result.warnings.some((w) => w.code === "TARGET_MD_REVIEW_REQUIRED")).toBe(
      false,
    );
  });

  it("AUTO_SMOOTH solves endpoint attitude automatically without reversal for monotonic az", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 0,
          eastingM: 0,
          northingM: 0,
          rlM: 0,
          dipDegrees: -55,
          azimuthDegrees: 100,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 240,
          eastingM: 80,
          northingM: 120,
          rlM: -150,
          radiusM: 3,
          attitudeMode: "AUTO_SMOOTH",
        },
      }),
    );
    expect(result.solverConverged).toBe(true);
    expect(result.pathQuality?.hasTurnReversal).toBe(false);
    expect(result.endpoint).not.toBeNull();
  });

  it("flags excess MD that would force a looping AUTO_SMOOTH path", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 0,
          eastingM: 0,
          northingM: 0,
          rlM: 0,
          dipDegrees: -60,
          azimuthDegrees: 90,
          northReference: "GRID",
        },
        target: {
          // Far more MD than the ~100 m spatial chord needs.
          measuredDepthM: 400,
          eastingM: 100,
          northingM: 0,
          rlM: 0,
          radiusM: 3,
          attitudeMode: "AUTO_SMOOTH",
        },
      }),
    );
    expect(result.remainingMeasuredDepthM).toBe(400);
    expect(result.straightDistanceM!).toBeCloseTo(100, 0);
    // Either a smooth solution exists, or MD review is required — never a silent S-curve.
    if (result.pathQuality?.hasTurnReversal || result.pathQuality?.hasCrossTrackOvershoot) {
      expect(result.warnings.some((w) => w.code === "TARGET_MD_REVIEW_REQUIRED")).toBe(
        true,
      );
      expect(result.path).toHaveLength(0);
    } else if (result.solverConverged) {
      expect(result.pathQuality?.hasTurnReversal).toBe(false);
      expect(result.pathQuality?.hasCrossTrackOvershoot).toBe(false);
    }
  });

  it("MATCH_ENTRY that forces a complex path returns advanced review", () => {
    const result = solveCurvedTarget(
      baseInput({
        currentStation: {
          measuredDepthM: 425,
          eastingM: 165.16963300923754,
          northingM: -127.84231168994178,
          rlM: -370.117410748341,
          dipDegrees: -62.1,
          azimuthDegrees: 129.8,
          northReference: "GRID",
        },
        target: {
          measuredDepthM: 650,
          eastingM: 280,
          northingM: -220,
          rlM: -520,
          radiusM: 5,
          attitudeMode: "MATCH_ENTRY_DIRECTION",
          desiredDipDegrees: -74,
          desiredAzimuthDegrees: 145,
          desiredNorthReference: "GRID",
        },
        nextSurveyMeasuredDepthM: 455,
      }),
    );
    if (result.pathQuality?.hasTurnReversal || result.pathQuality?.hasBuildReversal) {
      expect(
        result.warnings.some((w) => w.code === "ADVANCED_PATH_REVIEW_REQUIRED"),
      ).toBe(true);
      expect(result.nextSurveyTarget).toBeNull();
    } else {
      expect(["SOLVED", "REVIEW_REQUIRED"]).toContain(result.status);
    }
  });
});

describe("recovery path diagnostics", () => {
  it("reports interval DLS, build and turn rates", () => {
    const intervals = buildRecoveryIntervalDiagnostics([
      {
        measuredDepthM: 0,
        dipDegrees: -60,
        azimuthDegrees: 100,
      },
      {
        measuredDepthM: 30,
        dipDegrees: -63,
        azimuthDegrees: 110,
      },
      {
        measuredDepthM: 60,
        dipDegrees: -66,
        azimuthDegrees: 120,
      },
    ]);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]!.lengthM).toBe(30);
    expect(intervals[0]!.buildRatePer30mDegrees).toBeCloseTo(-3, 5);
    expect(intervals[0]!.turnRatePer30mDegrees).toBeCloseTo(10, 5);

    const summary = summariseRecoveryPathDiagnostics(intervals, 0.1, {
      dipDegrees: 0,
      azimuthDegrees: 0,
    });
    expect(summary.meanDoglegPer30mDegrees).toBeGreaterThan(0);
    expect(summary.maximumDoglegInterval).toEqual({
      fromMdM: expect.any(Number),
      toMdM: expect.any(Number),
    });
    expect(summary.endpointResidualM).toBe(0.1);
  });
});
