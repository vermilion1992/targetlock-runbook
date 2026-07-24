import { describe, expect, it } from "vitest";

import { decimetres } from "./measurements";
import { calculateHoleTrajectoryComparison } from "./trajectory-comparison";
import {
  buildTrajectoryViewModel,
  crossSectionOffsetM,
  filterTrajectoryViewModelByInterval,
  toSceneCoordinates,
  TRAJECTORY_GRAPHICS_DISCLAIMER,
} from "./trajectory-view-model";
import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  PlannedHoleTrajectory,
} from "./trajectory-types";

function relativeConfig(
  holeId = "DDH041",
): HoleCoordinateConfiguration {
  return {
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
    collarEastingDm: 0,
    collarNorthingDm: 0,
    collarRlDm: 0,
    createdByUserId: "u1",
    createdByNameSnapshot: "Tester",
  };
}

describe("trajectory view-model (Implementation 6 presentation)", () => {
  it("copies verified renderPath coordinates without alteration", () => {
    const plan: PlannedHoleTrajectory = {
      localId: "plan-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      deviceId: "test",
      version: 1,
      holeId: "DDH041",
      name: "Curved plan",
      northReference: "GRID",
      desurveyMethod: "MINIMUM_CURVATURE",
      status: "ACTIVE",
      createdByUserId: "u1",
      createdByNameSnapshot: "Tester",
      stations: [
        {
          id: "s0",
          measuredDepthDm: decimetres(0),
          dipTenths: -600,
          azimuthTenths: 1280,
          northReference: "GRID",
          stationType: "COLLAR",
        },
        {
          id: "s1",
          measuredDepthDm: decimetres(3000),
          dipTenths: -620,
          azimuthTenths: 1350,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "s2",
          measuredDepthDm: decimetres(6500),
          dipTenths: -640,
          azimuthTenths: 1400,
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
        localId: "survey-1",
        serverId: null,
        syncStatus: "local-only" as const,
        createdAt: "2026-07-24T01:00:00.000Z",
        updatedAt: "2026-07-24T01:00:00.000Z",
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
        name: "Target",
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

    const viewModel = buildTrajectoryViewModel(comparison);
    expect(TRAJECTORY_GRAPHICS_DISCLAIMER).toMatch(/not certified anti-collision/i);
    expect(viewModel.engineVersion).toBe(comparison.planned?.engineVersion);

    const planned = comparison.planned!;
    expect(viewModel.plannedPath).toHaveLength(planned.renderPath.length);
    viewModel.plannedPath.forEach((point, index) => {
      const source = planned.renderPath[index]!;
      expect(point.eastingM).toBe(source.eastingM);
      expect(point.northingM).toBe(source.northingM);
      expect(point.rlM).toBe(source.rlM);
      expect(point.measuredDepthM).toBe(source.measuredDepthM);
    });

    const actualPath = comparison.actual!;
    expect(viewModel.actualPath).toHaveLength(actualPath.renderPath.length);
    viewModel.actualPath.forEach((point, index) => {
      const source = actualPath.renderPath[index]!;
      expect(point.eastingM).toBe(source.eastingM);
      expect(point.northingM).toBe(source.northingM);
      expect(point.rlM).toBe(source.rlM);
      expect(point.measuredDepthM).toBe(source.measuredDepthM);
    });

    expect(viewModel.target?.radiusM).toBe(5);
    expect(viewModel.markers.some((marker) => marker.kind === "TARGET")).toBe(
      true,
    );
    expect(viewModel.markers.some((marker) => marker.kind === "COLLAR")).toBe(
      true,
    );

    const scene = toSceneCoordinates(
      viewModel.plannedPath[0]!,
      viewModel.bounds,
      1,
    );
    expect(Number.isFinite(scene.x)).toBe(true);
    expect(Number.isFinite(scene.y)).toBe(true);
    expect(Number.isFinite(scene.z)).toBe(true);

    const latest = filterTrajectoryViewModelByInterval(viewModel, "LATEST_50");
    expect(
      latest.actualPath.every((point) => point.measuredDepthM >= 375 - 1e-6),
    ).toBe(true);

    const offset = crossSectionOffsetM({
      eastingM: 10,
      northingM: 0,
      originEastingM: 0,
      originNorthingM: 0,
      bearingDegrees: 0,
    });
    expect(offset).toBeCloseTo(10, 6);
  });
});
