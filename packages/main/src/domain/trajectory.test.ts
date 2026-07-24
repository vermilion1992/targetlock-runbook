import { describe, expect, it } from "vitest";

import { decimetres } from "./measurements";
import { calculateHoleTrajectoryComparison } from "./trajectory-comparison";
import {
  calculateMinimumCurvatureTrajectory,
  getTrajectoryPositionAtMeasuredDepth,
} from "./trajectory-desurvey";
import {
  circularAzimuthDifferenceDegrees,
  minCurveDisplacement,
  vectorFromDipAz,
} from "./trajectory-geometry";
import {
  convertAzimuthDegrees,
  toAzimuthConversionConfig,
} from "./trajectory-references";
import { buildStraightPlanStations } from "./trajectory-stations";
import { buildTrackingPoint, calculateTargetTracking } from "./trajectory-tracking";
import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  HoleTarget,
  PlannedHoleTrajectory,
  TrajectoryCollar,
  TrajectoryStationInput,
} from "./trajectory-types";

const collar: TrajectoryCollar = {
  eastingM: 0,
  northingM: 0,
  rlM: 0,
  coordinateMode: "RELATIVE",
  calculationNorthReference: "GRID",
};

function station(
  mdM: number,
  dip: number,
  az: number,
  sourceType: TrajectoryStationInput["sourceType"] = "PLANNED",
  sourceId?: string,
): TrajectoryStationInput {
  return {
    sourceType,
    sourceId,
    measuredDepthDm: decimetres(Math.round(mdM * 10)),
    dipTenths: Math.round(dip * 10),
    originalAzimuthTenths: Math.round(az * 10) % 3600,
    originalNorthReference: "GRID",
    calculationAzimuthTenths: Math.round(az * 10) % 3600,
    calculationNorthReference: "GRID",
  };
}

const relativeConfig = (
  holeId = "DDH041",
): HoleCoordinateConfiguration => ({
  localId: `coord-${holeId}`,
  serverId: null,
  syncStatus: "local-only",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  deviceId: "test",
  version: 1,
  holeId,
  coordinateMode: "RELATIVE",
  calculationNorthReference: "GRID",
  createdByUserId: "user-1",
  createdByNameSnapshot: "Tester",
});

describe("direction conventions", () => {
  it.each([
    {
      name: "vertical down",
      dip: -90,
      az: 0,
      length: 100,
      e: 0,
      n: 0,
      d: 100,
    },
    {
      name: "vertical up",
      dip: 90,
      az: 0,
      length: 100,
      e: 0,
      n: 0,
      d: -100,
    },
    {
      name: "horizontal North",
      dip: 0,
      az: 0,
      length: 100,
      e: 0,
      n: 100,
      d: 0,
    },
    {
      name: "horizontal East",
      dip: 0,
      az: 90,
      length: 100,
      e: 100,
      n: 0,
      d: 0,
    },
    {
      name: "horizontal South",
      dip: 0,
      az: 180,
      length: 100,
      e: 0,
      n: -100,
      d: 0,
    },
    {
      name: "horizontal West",
      dip: 0,
      az: 270,
      length: 100,
      e: -100,
      n: 0,
      d: 0,
    },
  ])("$name", ({ dip, az, length, e, n, d }) => {
    const displacement = minCurveDisplacement(
      { dip, azimuth: az },
      { dip, azimuth: az },
      length,
    );
    expect(displacement.e).toBeCloseTo(e, 6);
    expect(displacement.n).toBeCloseTo(n, 6);
    expect(displacement.d).toBeCloseTo(d, 6);

    const trajectory = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, dip, az, "COLLAR"), station(length, dip, az, "SURVEY")],
      { trajectoryType: "ACTUAL", holeId: "H1" },
    );
    expect(trajectory.eastingDisplacementM).toBeCloseTo(e, 6);
    expect(trajectory.northingDisplacementM).toBeCloseTo(n, 6);
    expect(trajectory.tvdM).toBeCloseTo(d, 6);
    expect(trajectory.verticalDisplacementM).toBeCloseTo(-d, 6);
  });

  it("downward North and East produce positive TVD and correct lateral", () => {
    const north = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -60, 0, "COLLAR"), station(100, -60, 0, "SURVEY")],
      { trajectoryType: "ACTUAL", holeId: "H1" },
    );
    expect(north.northingDisplacementM).toBeCloseTo(50, 4);
    expect(north.tvdM).toBeCloseTo(Math.sin((60 * Math.PI) / 180) * 100, 4);

    const east = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -60, 90, "COLLAR"), station(100, -60, 90, "SURVEY")],
      { trajectoryType: "ACTUAL", holeId: "H1" },
    );
    expect(east.eastingDisplacementM).toBeCloseTo(50, 4);
  });
});

describe("minimum curvature", () => {
  it("handles zero and very small doglegs", () => {
    const zero = minCurveDisplacement(
      { dip: -60, azimuth: 128 },
      { dip: -60, azimuth: 128 },
      100,
    );
    const tiny = minCurveDisplacement(
      { dip: -60, azimuth: 128 },
      { dip: -60.000001, azimuth: 128 },
      100,
    );
    expect(Number.isFinite(zero.e)).toBe(true);
    expect(tiny.e).toBeCloseTo(zero.e, 3);
  });

  it("preserves MD and endpoint continuity across control stations", () => {
    const stations = [
      station(0, -60, 128, "COLLAR"),
      station(300, -66, 134),
      station(650, -74, 145),
    ];
    const trajectory = calculateMinimumCurvatureTrajectory(collar, stations, {
      trajectoryType: "PLANNED",
      holeId: "H1",
    });
    expect(trajectory.stations.map((s) => s.measuredDepthM)).toEqual([
      0, 300, 650,
    ]);
    expect(trajectory.endpoint.measuredDepthM).toBe(650);
    expect(trajectory.renderPath[0]).toMatchObject(trajectory.collar);
    expect(trajectory.renderPath.at(-1)?.measuredDepthM).toBe(650);
  });

  it("handles azimuth wrap 359° to 1°", () => {
    const trajectory = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -45, 359, "COLLAR"), station(100, -45, 1, "SURVEY")],
      { trajectoryType: "ACTUAL", holeId: "H1" },
    );
    expect(Number.isFinite(trajectory.endpoint.eastingM)).toBe(true);
    expect(Number.isFinite(trajectory.endpoint.northingM)).toBe(true);
    expect(circularAzimuthDifferenceDegrees(359, 1)).toBeCloseTo(2, 6);
  });
});

describe("curved plan", () => {
  it("is not a straight collar-bearing projection", () => {
    const curvedStations = [
      station(0, -60, 128, "COLLAR"),
      station(300, -66, 134),
      station(650, -74, 145),
    ];
    const curved = calculateMinimumCurvatureTrajectory(collar, curvedStations, {
      trajectoryType: "PLANNED",
      holeId: "H1",
    });
    const straight = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -60, 128, "COLLAR"), station(650, -60, 128)],
      { trajectoryType: "PLANNED", holeId: "H1" },
    );

    const endpointDelta = Math.hypot(
      curved.endpoint.eastingM - straight.endpoint.eastingM,
      curved.endpoint.northingM - straight.endpoint.northingM,
      curved.endpoint.rlM - straight.endpoint.rlM,
    );
    expect(endpointDelta).toBeGreaterThan(1);

    // Mid-path chord should differ from MC sample for a curved interval.
    const mid = getTrajectoryPositionAtMeasuredDepth(
      curvedStations,
      collar,
      150,
    )!;
    const linearE =
      (curved.stations[0]!.eastingM + curved.stations[1]!.eastingM) / 2;
    expect(Math.abs(mid.eastingM - linearE)).toBeGreaterThan(0.01);
  });
});

describe("planned position at survey depth", () => {
  const stations = [
    station(0, -60, 128, "COLLAR"),
    station(300, -66, 134),
    station(650, -74, 145),
  ];

  it("matches planned station exactly", () => {
    const position = getTrajectoryPositionAtMeasuredDepth(
      stations,
      collar,
      300,
    )!;
    const built = calculateMinimumCurvatureTrajectory(collar, stations, {
      trajectoryType: "PLANNED",
      holeId: "H1",
    });
    expect(position.eastingM).toBeCloseTo(built.stations[1]!.eastingM, 6);
    expect(position.beyondEndpoint).toBe(false);
  });

  it("interpolates inside a planned interval via MC", () => {
    const position = getTrajectoryPositionAtMeasuredDepth(
      stations,
      collar,
      150,
    )!;
    expect(position.measuredDepthM).toBe(150);
    expect(position.dipDegrees).toBeGreaterThan(-66);
    expect(position.dipDegrees).toBeLessThan(-60);
  });

  it("extrapolates beyond final planned station", () => {
    const position = getTrajectoryPositionAtMeasuredDepth(
      stations,
      collar,
      700,
    )!;
    expect(position.beyondEndpoint).toBe(true);
    expect(position.measuredDepthM).toBe(700);
  });
});

describe("deviation", () => {
  it("computes east/north/vertical/spatial and circular azimuth", () => {
    const planned = {
      measuredDepthM: 100,
      dipDegrees: -60,
      azimuthDegrees: 359,
      northReference: "GRID" as const,
      relativeEastingM: 10,
      relativeNorthingM: 20,
      verticalDisplacementM: -50,
      tvdM: 50,
      eastingM: 10,
      northingM: 20,
      rlM: -50,
      beyondEndpoint: false,
    };
    const actual = {
      ...planned,
      eastingM: 13.7,
      northingM: 16.7,
      rlM: -48.4,
      dipDegrees: -59.2,
      azimuthDegrees: 1,
    };
    const point = buildTrackingPoint({
      actualSurveyId: "s1",
      measuredDepthM: 100,
      plannedPosition: planned,
      actualPosition: actual,
    });
    expect(point.deltaEastingM).toBeCloseTo(3.7, 6);
    expect(point.deltaNorthingM).toBeCloseTo(-3.3, 6);
    expect(point.deltaRlM).toBeCloseTo(1.6, 6);
    expect(point.horizontalDeviationM).toBeCloseTo(
      Math.hypot(3.7, 3.3),
      6,
    );
    expect(point.spatialDeviationM).toBeCloseTo(Math.hypot(3.7, 3.3, 1.6), 6);
    expect(point.circularAzimuthDifferenceDegrees).toBeCloseTo(2, 6);
  });
});

describe("target tracking", () => {
  it("reports endpoint inside/outside radius and closest approach", () => {
    const planned = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -90, 0, "COLLAR"), station(100, -90, 0)],
      { trajectoryType: "PLANNED", holeId: "H1" },
    );
    const actual = calculateMinimumCurvatureTrajectory(
      collar,
      [station(0, -90, 0, "COLLAR"), station(100, -90, 0, "SURVEY", "s1")],
      { trajectoryType: "ACTUAL", holeId: "H1" },
    );
    const target: HoleTarget = {
      id: "target-1",
      holeId: "H1",
      name: "Primary",
      coordinateMode: "RELATIVE",
      eastingDm: 0,
      northingDm: 0,
      rlDm: -1000,
      radiusDm: 50,
      attitudeMode: "AUTO_SMOOTH",
      version: 1,
      updatedAt: "2026-07-24T00:00:00.000Z",
    };
    const result = calculateTargetTracking({ target, planned, actual });
    expect(result.plannedEndpointDistanceM).toBeCloseTo(0, 6);
    expect(result.plannedWithinTargetRadius).toBe(true);
    expect(result.plannedClosestApproachM).toBeLessThanOrEqual(
      result.plannedEndpointDistanceM + 1e-9,
    );

    const miss: HoleTarget = {
      ...target,
      eastingDm: 200,
      northingDm: 0,
      rlDm: -1000,
      radiusDm: 10,
    };
    const missResult = calculateTargetTracking({
      target: miss,
      planned,
      actual,
    });
    expect(missResult.plannedWithinTargetRadius).toBe(false);
    expect(missResult.plannedEndpointDistanceM).toBeCloseTo(20, 6);
  });
});

describe("north references", () => {
  it("converts Grid/True/Magnetic with IQ sign conventions", () => {
    const config = toAzimuthConversionConfig({
      localId: "ref-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      deviceId: "test",
      version: 1,
      holeId: "H1",
      gridRotationDeg: 2,
      magneticDeclinationDeg: 8,
      createdByUserId: "u1",
      createdByNameSnapshot: "Tester",
    });
    expect(convertAzimuthDegrees(10, "GRID", "TRUE", config)).toBeCloseTo(12);
    expect(convertAzimuthDegrees(12, "TRUE", "GRID", config)).toBeCloseTo(10);
    expect(convertAzimuthDegrees(10, "MAGNETIC", "TRUE", config)).toBeCloseTo(
      18,
    );
    expect(convertAzimuthDegrees(18, "TRUE", "MAGNETIC", config)).toBeCloseTo(
      10,
    );
    expect(convertAzimuthDegrees(10, "MAGNETIC", "GRID", config)).toBeCloseTo(
      16,
    );
  });
});

describe("near vertical", () => {
  it("keeps finite coordinates and does not exaggerate azimuth failure", () => {
    const trajectory = calculateMinimumCurvatureTrajectory(
      collar,
      [
        station(0, -89, 10, "COLLAR"),
        station(50, -89.5, 200),
        station(100, -89.2, 20),
      ],
      { trajectoryType: "PLANNED", holeId: "H1" },
    );
    expect(Number.isFinite(trajectory.endpoint.eastingM)).toBe(true);
    expect(Number.isFinite(trajectory.endpoint.northingM)).toBe(true);
    expect(Number.isFinite(trajectory.endpoint.rlM)).toBe(true);
    expect(Math.abs(trajectory.lateralDisplacementM)).toBeLessThan(5);
  });
});

describe("comparison orchestration", () => {
  it("builds curved planned vs actual tracking", () => {
    const plan: PlannedHoleTrajectory = {
      localId: "plan-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      deviceId: "test",
      version: 1,
      holeId: "DDH041",
      name: "Demo curved plan (relative)",
      northReference: "GRID",
      desurveyMethod: "MINIMUM_CURVATURE",
      status: "ACTIVE",
      createdByUserId: "u1",
      createdByNameSnapshot: "Tester",
      stations: [
        {
          id: "p0",
          measuredDepthDm: decimetres(0),
          dipTenths: -600,
          azimuthTenths: 1280,
          northReference: "GRID",
          stationType: "COLLAR",
        },
        {
          id: "p1",
          measuredDepthDm: decimetres(3000),
          dipTenths: -660,
          azimuthTenths: 1340,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "p2",
          measuredDepthDm: decimetres(6500),
          dipTenths: -740,
          azimuthTenths: 1450,
          northReference: "GRID",
          stationType: "PLANNED_ENDPOINT",
        },
      ],
    };
    const actual: ActualTrajectoryConfiguration = {
      localId: "actual-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      deviceId: "test",
      version: 1,
      holeId: "DDH041",
      collarDipTenths: -600,
      collarAzimuthTenths: 1280,
      collarNorthReference: "GRID",
      desurveyMethod: "MINIMUM_CURVATURE",
    };
    const surveys = [
      {
        localId: "survey-a",
        serverId: null,
        syncStatus: "local-only" as const,
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
        deviceId: "test",
        version: 1,
        holeId: "DDH041",
        depthDm: decimetres(4250),
        dipTenths: -664,
        azimuthTenths: 1381,
        northReference: "GRID" as const,
        recordedByUserId: "u1",
        recordedByNameSnapshot: "Tester",
        recordedAt: "2026-07-24T01:00:00.000Z",
      },
    ];

    const comparison = calculateHoleTrajectoryComparison({
      holeId: "DDH041",
      surveys,
      coordinateConfiguration: relativeConfig(),
      planned: plan,
      actualConfiguration: actual,
      selections: [],
      target: {
        id: "t1",
        holeId: "DDH041",
        name: "Demo relative target",
        coordinateMode: "RELATIVE",
        eastingDm: 2500,
        northingDm: -1800,
        rlDm: -4500,
        radiusDm: 50,
        attitudeMode: "AUTO_SMOOTH",
        version: 1,
        updatedAt: "2026-07-24T00:00:00.000Z",
      },
    });

    expect(comparison.blocked).toBe(false);
    expect(comparison.planned).not.toBeNull();
    expect(comparison.actual).not.toBeNull();
    expect(comparison.trackingPoints).toHaveLength(1);
    expect(comparison.currentTrackingPoint?.measuredDepthM).toBe(425);
    expect(comparison.targetTracking?.plannedEndpointDistanceM).toBeGreaterThan(
      0,
    );
    expect(comparison.toleranceConfigured).toBe(false);
  });

  it("builds straight plan stations with constant attitude", () => {
    const stations = buildStraightPlanStations({
      collarDipTenths: -600,
      collarAzimuthTenths: 420,
      northReference: "GRID",
      endpointMeasuredDepthDm: decimetres(7500),
    });
    expect(stations).toHaveLength(2);
    expect(stations[0]?.dipTenths).toBe(stations[1]?.dipTenths);
    expect(stations[0]?.azimuthTenths).toBe(stations[1]?.azimuthTenths);
  });

  it("blocks mine-grid without conversion for mixed refs", () => {
    const comparison = calculateHoleTrajectoryComparison({
      holeId: "H1",
      surveys: [],
      coordinateConfiguration: {
        ...relativeConfig("H1"),
        coordinateMode: "MINE_GRID",
        coordinateSystemName: "Local Mine Grid",
        collarEastingDm: 1_000_000,
        collarNorthingDm: 2_000_000,
        collarRlDm: 1000,
        calculationNorthReference: "GRID",
      },
      planned: {
        localId: "plan-1",
        serverId: null,
        syncStatus: "local-only",
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
        deviceId: "test",
        version: 1,
        holeId: "H1",
        name: "Plan",
        northReference: "MAGNETIC",
        desurveyMethod: "MINIMUM_CURVATURE",
        status: "ACTIVE",
        createdByUserId: "u1",
        createdByNameSnapshot: "Tester",
        stations: [
          {
            id: "p0",
            measuredDepthDm: decimetres(0),
            dipTenths: -600,
            azimuthTenths: 1000,
            northReference: "MAGNETIC",
            stationType: "COLLAR",
          },
          {
            id: "p1",
            measuredDepthDm: decimetres(1000),
            dipTenths: -600,
            azimuthTenths: 1000,
            northReference: "MAGNETIC",
            stationType: "PLANNED_ENDPOINT",
          },
        ],
      },
      actualConfiguration: null,
      selections: [],
    });
    expect(comparison.blocked).toBe(true);
    expect(comparison.blockReason).toMatch(/reference configuration/i);
  });
});

describe("IQ vector parity", () => {
  it("matches IQ vectorFromDipAz for horizontal east", () => {
    const v = vectorFromDipAz(0, 90);
    expect(v.e).toBeCloseTo(1, 10);
    expect(v.n).toBeCloseTo(0, 10);
    expect(v.d).toBeCloseTo(0, 10);
  });
});
