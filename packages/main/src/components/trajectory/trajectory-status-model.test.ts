import { describe, expect, it } from "vitest";

import type { HoleTrajectoryComparison, TrajectoryTrackingPoint } from "@/domain";

import {
  buildActualVsPlanStatus,
  buildPlanToTargetStatus,
  classifyTargetProjectionAlert,
  mapTrackingStatusLabel,
} from "./trajectory-status-model";

function baseComparison(
  overrides: Partial<HoleTrajectoryComparison> = {},
): HoleTrajectoryComparison {
  return {
    holeId: "DDH041",
    planned: null,
    actual: null,
    trackingPoints: [],
    warnings: [],
    sourceVersions: [],
    blocked: false,
    toleranceConfigured: false,
    ...overrides,
  };
}

function trackingPoint(
  overrides: Partial<TrajectoryTrackingPoint> = {},
): TrajectoryTrackingPoint {
  return {
    actualSurveyId: "s1",
    measuredDepthM: 425,
    plannedPosition: {
      measuredDepthM: 425,
      dipDegrees: -68.5,
      azimuthDegrees: 137.5,
      northReference: "GRID",
      relativeEastingM: 0,
      relativeNorthingM: 0,
      verticalDisplacementM: 0,
      tvdM: 0,
      eastingM: 139.3,
      northingM: -124.1,
      rlM: -381.3,
      beyondEndpoint: false,
    },
    actualPosition: {
      measuredDepthM: 425,
      dipDegrees: -62.1,
      azimuthDegrees: 129.8,
      northReference: "GRID",
      relativeEastingM: 0,
      relativeNorthingM: 0,
      verticalDisplacementM: 0,
      tvdM: 0,
      eastingM: 165.2,
      northingM: -127.8,
      rlM: -370.1,
      beyondEndpoint: false,
    },
    deltaEastingM: 25.9,
    deltaNorthingM: -3.7,
    deltaRlM: 11.2,
    horizontalDeviationM: 26.2,
    verticalDeviationM: 11.2,
    spatialDeviationM: 28.5,
    plannedDipDegrees: -68.5,
    actualDipDegrees: -62.1,
    dipDifferenceDegrees: 6.4,
    plannedAzimuthDegrees: 137.5,
    actualAzimuthDegrees: 129.8,
    circularAzimuthDifferenceDegrees: 7.7,
    status: "ON_TRACK",
    ...overrides,
  };
}

describe("trajectory status presentation mapper", () => {
  it("does not present ON_TRACK when tolerance is not configured", () => {
    const label = mapTrackingStatusLabel("ON_TRACK", false, 28.5);
    expect(label).toContain("28.5 m from plan");
    expect(label).not.toContain("ON_TRACK");
  });

  it("maps plan-to-target review when endpoint is outside radius", () => {
    const status = buildPlanToTargetStatus(
      baseComparison({
        targetTracking: {
          targetId: "t1",
          targetEastingM: 250,
          targetNorthingM: -180,
          targetRlM: -450,
          targetRadiusM: 5,
          actualEndpointDistanceM: 210.1,
          plannedEndpointDistanceM: 126.6,
          actualClosestApproachM: 200,
          actualClosestApproachMeasuredDepthM: 425,
          plannedClosestApproachM: 120,
          plannedClosestApproachMeasuredDepthM: 650,
          plannedWithinTargetRadius: false,
        },
      }),
    );
    expect(status.kind).toBe("PLAN_REVIEW_REQUIRED");
    expect(status.title).toBe("PLAN REVIEW REQUIRED");
    expect(status.detail).toContain("126.6 m");
  });

  it("surfaces no-tolerance actual-vs-plan copy", () => {
    const point = trackingPoint();
    const status = buildActualVsPlanStatus(
      baseComparison({
        toleranceConfigured: false,
        currentTrackingPoint: point,
        trackingPoints: [point],
      }),
    );
    expect(status.kind).toBe("NO_TOLERANCE");
    expect(status.detail).toContain("28.5 m");
  });
});

describe("classifyTargetProjectionAlert", () => {
  it("returns green when the projection intersects the target", () => {
    expect(
      classifyTargetProjectionAlert({
        hasTarget: true,
        intersectsTarget: true,
        endpointMissOutsideTargetM: 0,
        nearMissOutsideTargetM: 3,
      }),
    ).toMatchObject({ kind: "ON_TARGET", tone: "success", title: "On target" });
  });

  it("returns amber for a near miss within the configured band", () => {
    expect(
      classifyTargetProjectionAlert({
        hasTarget: true,
        intersectsTarget: false,
        endpointMissOutsideTargetM: 2.4,
        nearMissOutsideTargetM: 3,
      }),
    ).toMatchObject({
      kind: "NEAR_MISS",
      tone: "warning",
      title: "Near miss",
    });
  });

  it("returns red when miss exceeds the near-miss band", () => {
    expect(
      classifyTargetProjectionAlert({
        hasTarget: true,
        intersectsTarget: false,
        endpointMissOutsideTargetM: 12.1,
        nearMissOutsideTargetM: 3,
      }),
    ).toMatchObject({
      kind: "PROJECTED_MISS",
      tone: "danger",
      title: "Projected miss",
    });
  });
});
