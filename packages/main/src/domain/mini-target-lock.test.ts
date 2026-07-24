import { describe, expect, it } from "vitest";

import {
  DEFAULT_TARGET_DIAMETER_M,
  calculateMiniTargetLock,
  diameterMToRadiusDm,
  directToTargetFromPositions,
  projectAttitudeClosestApproach,
  targetDiameterM,
} from "./mini-target-lock";
import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  HoleTarget,
  ReferenceConfiguration,
} from "./trajectory-types";
import type { Survey } from "./models";
import { decimetres } from "./measurements";

const EPOCH = "2026-07-01T00:00:00.000Z";

function coordinateConfig(
  overrides: Partial<HoleCoordinateConfiguration> = {},
): HoleCoordinateConfiguration {
  return {
    localId: "coord-1",
    serverId: null,
    syncStatus: "local-only",
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deviceId: "test",
    version: 1,
    holeId: "DDH050",
    coordinateMode: "MINE_GRID",
    coordinateSystemName: "Local Mine Grid",
    collarEastingDm: 1_000_000,
    collarNorthingDm: 2_000_000,
    collarRlDm: 5_000,
    calculationNorthReference: "GRID",
    createdByUserId: "user",
    createdByNameSnapshot: "Test",
    ...overrides,
  };
}

function actualConfig(): ActualTrajectoryConfiguration {
  return {
    localId: "actual-1",
    serverId: null,
    syncStatus: "local-only",
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deviceId: "test",
    version: 1,
    holeId: "DDH050",
    collarDipTenths: -600,
    collarAzimuthTenths: 900,
    collarNorthReference: "GRID",
    desurveyMethod: "MINIMUM_CURVATURE",
  };
}

function referenceConfig(): ReferenceConfiguration {
  return {
    localId: "ref-1",
    serverId: null,
    syncStatus: "local-only",
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deviceId: "test",
    version: 1,
    holeId: "DDH050",
    gridRotationDeg: 0,
    magneticDeclinationDeg: 0,
    createdByUserId: "user",
    createdByNameSnapshot: "Test",
  };
}

describe("mini-target-lock geometry", () => {
  it("maps diameter 6 m to radius 30 dm", () => {
    expect(diameterMToRadiusDm(6)).toBe(30);
    expect(DEFAULT_TARGET_DIAMETER_M).toBe(6);
  });

  it("reads diameter from stored radius", () => {
    const target: HoleTarget = {
      id: "t1",
      holeId: "DDH050",
      name: "Target",
      coordinateMode: "MINE_GRID",
      eastingDm: 0,
      northingDm: 0,
      rlDm: 0,
      radiusDm: 30,
      attitudeMode: "UNCONSTRAINED",
      version: 1,
      updatedAt: EPOCH,
    };
    expect(targetDiameterM(target)).toBe(6);
  });

  it("computes direct-to-target dip and azimuth for a due-east level offset", () => {
    const result = directToTargetFromPositions(
      { eastingM: 0, northingM: 0, rlM: 100 },
      { eastingM: 100, northingM: 0, rlM: 100 },
    );
    expect(result.distanceM).toBeCloseTo(100, 5);
    expect(result.dipDegrees).toBeCloseTo(0, 5);
    expect(result.azimuthDegrees).toBeCloseTo(90, 5);
  });

  it("marks projection as intersecting when ray passes within radius", () => {
    const projection = projectAttitudeClosestApproach({
      origin: { eastingM: 0, northingM: 0, rlM: 100 },
      dipDegrees: 0,
      azimuthDegrees: 90,
      target: { eastingM: 50, northingM: 0, rlM: 100 },
      targetRadiusM: 3,
    });
    expect(projection.intersectsTarget).toBe(true);
    expect(projection.closestApproachM).toBeLessThanOrEqual(3);
    expect(projection.missOutsideTargetM).toBe(0);
  });

  it("marks projection as miss when closest approach is outside radius", () => {
    const projection = projectAttitudeClosestApproach({
      origin: { eastingM: 0, northingM: 0, rlM: 100 },
      dipDegrees: 0,
      azimuthDegrees: 90,
      target: { eastingM: 50, northingM: 20, rlM: 100 },
      targetRadiusM: 3,
    });
    expect(projection.intersectsTarget).toBe(false);
    expect(projection.closestApproachM).toBeCloseTo(20, 5);
    expect(projection.missOutsideTargetM).toBeCloseTo(17, 5);
  });
});

describe("calculateMiniTargetLock", () => {
  it("blocks with MISSING_COLLAR_COORDINATES when mine-grid coords absent", () => {
    const result = calculateMiniTargetLock({
      holeId: "DDH050",
      surveys: [],
      coordinateConfiguration: coordinateConfig({
        collarEastingDm: undefined,
        collarNorthingDm: undefined,
        collarRlDm: undefined,
      }),
      actualConfiguration: actualConfig(),
      selections: [],
      referenceConfiguration: referenceConfig(),
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("MISSING_COLLAR_COORDINATES");
  });

  it("returns actual trajectory and latest survey without target", () => {
    const surveys: Survey[] = [
      {
        localId: "survey-1",
        serverId: null,
        syncStatus: "local-only",
        createdAt: EPOCH,
        updatedAt: EPOCH,
        deviceId: "test",
        version: 1,
        holeId: "DDH050",
        depthDm: decimetres(1_000),
        dipTenths: -600,
        azimuthTenths: 900,
        northReference: "GRID",
        recordedAt: EPOCH,
        recordedByUserId: "user",
        recordedByNameSnapshot: "Test",
      },
    ];
    const result = calculateMiniTargetLock({
      holeId: "DDH050",
      surveys,
      coordinateConfiguration: coordinateConfig(),
      actualConfiguration: actualConfig(),
      selections: [],
      referenceConfiguration: referenceConfig(),
    });
    expect(result.blocked).toBe(false);
    expect(result.actualTrajectory).not.toBeNull();
    expect(result.latestSurvey?.measuredDepthM).toBeCloseTo(100, 5);
    expect(result.target).toBeNull();
    expect(result.projection).toBeNull();
  });
});
