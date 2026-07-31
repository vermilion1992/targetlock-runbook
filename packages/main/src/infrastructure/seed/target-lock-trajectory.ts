import { decimetres } from "@/domain";
import type { TrajectorySeed } from "@/infrastructure/trajectory/trajectory-repository";
import {
  DDH041_DEMO_CURRENT_DEPTH_M,
  DDH041_DEMO_PLANNED_DEPTH_M,
} from "./target-lock-ddh041-midhole";

const NOW = "2026-07-01T00:00:00.000Z";
const HOLE_ID = "DDH041";

function metadata(localId: string) {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only" as const,
    createdAt: NOW,
    updatedAt: NOW,
    deviceId: "seed-tablet-rig-10",
    version: 1,
  };
}

/**
 * Relative-mode demo trajectory fixtures for DDH041 mid-hole sandbox.
 * Clearly labeled as demo — not mine-grid operational coordinates.
 */
export const ddh041TrajectorySeed: TrajectorySeed = {
  coordinateConfiguration: {
    ...metadata("coord-ddh041-relative"),
    holeId: HOLE_ID,
    coordinateMode: "RELATIVE",
    calculationNorthReference: "GRID",
    createdByUserId: "user-supervisor-lee",
    createdByNameSnapshot: "Morgan Lee",
  },
  actualConfiguration: {
    ...metadata("actual-ddh041"),
    holeId: HOLE_ID,
    collarDipTenths: -600,
    collarAzimuthTenths: 1_280,
    collarNorthReference: "GRID",
    desurveyMethod: "MINIMUM_CURVATURE",
    preferredSurveyIntervalDm: decimetres(300),
  },
  plans: [
    {
      ...metadata("plan-ddh041-demo-curved"),
      holeId: HOLE_ID,
      name: "Demo curved plan (relative)",
      description:
        "Demo relative curved plan for mid-hole sandbox testing. Not a mine-grid design.",
      northReference: "GRID",
      desurveyMethod: "MINIMUM_CURVATURE",
      status: "ACTIVE",
      createdByUserId: "user-supervisor-lee",
      createdByNameSnapshot: "Morgan Lee",
      targetId: "target-ddh041-demo-relative",
      stations: [
        {
          id: "plan-ddh041-s0",
          measuredDepthDm: decimetres(0),
          dipTenths: -600,
          azimuthTenths: 1_280,
          northReference: "GRID",
          stationType: "COLLAR",
        },
        {
          id: "plan-ddh041-s1",
          measuredDepthDm: decimetres(1_500),
          dipTenths: -620,
          azimuthTenths: 1_300,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s2",
          measuredDepthDm: decimetres(3_000),
          dipTenths: -660,
          azimuthTenths: 1_340,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s3",
          measuredDepthDm: decimetres(5_000),
          dipTenths: -700,
          azimuthTenths: 1_400,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s4",
          measuredDepthDm: decimetres(6_500),
          dipTenths: -720,
          azimuthTenths: 1_430,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s5",
          measuredDepthDm: decimetres(DDH041_DEMO_PLANNED_DEPTH_M * 10),
          dipTenths: -740,
          azimuthTenths: 1_450,
          northReference: "GRID",
          stationType: "PLANNED_ENDPOINT",
        },
      ],
    },
  ],
  target: {
    id: "target-ddh041-demo-relative",
    holeId: HOLE_ID,
    name: "Demo relative target",
    coordinateMode: "RELATIVE",
    eastingDm: 3_200,
    northingDm: -2_600,
    rlDm: -6_400,
    radiusDm: 50,
    targetMeasuredDepthDm: decimetres(DDH041_DEMO_PLANNED_DEPTH_M * 10),
    attitudeMode: "AUTO_SMOOTH",
    note: `Demo relative target near ${DDH041_DEMO_PLANNED_DEPTH_M} m plan / ~${DDH041_DEMO_CURRENT_DEPTH_M} m actual.`,
    version: 1,
    updatedAt: NOW,
  },
};

export const trajectorySeedByHole = new Map<string, TrajectorySeed>([
  [HOLE_ID, ddh041TrajectorySeed],
]);
