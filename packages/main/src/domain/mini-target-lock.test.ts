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
    const target: HoleTarget = {
      id: "t1",
      holeId: "DDH050",
      name: "Target",
      coordinateMode: "MINE_GRID",
      eastingDm: 1_001_750,
      northingDm: 2_001_460,
      rlDm: -1_050,
      radiusDm: 30,
      targetMeasuredDepthDm: 6_500,
      attitudeMode: "CUSTOM",
      desiredDipTenths: -740,
      desiredAzimuthTenths: 1_450,
      desiredNorthReference: "GRID",
      version: 1,
      updatedAt: EPOCH,
    };
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
      target,
    });
    expect(result.blocked).toBe(true);
    expect(result.blockCode).toBe("MISSING_COLLAR_COORDINATES");
    expect(result.target?.attitudeMode).toBe("CUSTOM");
    expect(result.target?.diameterM).toBe(6);
  });

  it("provides collar-only guidance when no Surveys exist", () => {
    // Collar at E/N/RL 100000/200000/500, dip -60°, azimuth 90°.
    // Target placed on the straight collar ray at MD 300 m.
    const mdM = 300;
    const dipRad = (-60 * Math.PI) / 180;
    const azRad = (90 * Math.PI) / 180;
    const de = mdM * Math.cos(dipRad) * Math.sin(azRad);
    const dn = mdM * Math.cos(dipRad) * Math.cos(azRad);
    const drl = mdM * Math.sin(dipRad);
    const target: HoleTarget = {
      id: "t1",
      holeId: "DDH050",
      name: "Target",
      coordinateMode: "MINE_GRID",
      eastingDm: Math.round((100_000 + de) * 10),
      northingDm: Math.round((200_000 + dn) * 10),
      rlDm: Math.round((500 + drl) * 10),
      radiusDm: 30,
      targetMeasuredDepthDm: 3_000,
      attitudeMode: "CUSTOM",
      desiredDipTenths: -600,
      desiredAzimuthTenths: 900,
      desiredNorthReference: "GRID",
      version: 1,
      updatedAt: EPOCH,
    };
    const result = calculateMiniTargetLock({
      holeId: "DDH050",
      surveys: [],
      coordinateConfiguration: coordinateConfig(),
      actualConfiguration: {
        ...actualConfig(),
        preferredSurveyIntervalDm: 300,
      },
      selections: [],
      referenceConfiguration: referenceConfig(),
      target,
    });
    expect(result.blocked).toBe(false);
    expect(result.guidanceFromCollarOnly).toBe(true);
    expect(result.target?.attitudeMode).toBe("CUSTOM");
    expect(result.latestSurvey?.sourceType).toBe("COLLAR");
    expect(result.nextSurveyGuidance).not.toBeNull();
    expect(result.curvedSolution?.status).toMatch(/SOLVED|REVIEW_REQUIRED/);
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
