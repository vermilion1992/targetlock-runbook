import { decimetres } from "@/domain";
import type { TrajectorySeed } from "@/infrastructure/trajectory/trajectory-repository";

const NOW = "2026-07-24T00:00:00.000Z";
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
 * Relative-mode demo trajectory fixtures for DDH041 (pilot seed hole).
 * Clearly labeled as demo — not mine-grid operational coordinates.
 */
export const ddh041TrajectorySeed: TrajectorySeed = {
  coordinateConfiguration: {
    ...metadata("coord-ddh041-relative"),
    holeId: HOLE_ID,
    coordinateMode: "RELATIVE",
    calculationNorthReference: "GRID",
    createdByUserId: "user-morgan-lee",
    createdByNameSnapshot: "Morgan Lee",
  },
  actualConfiguration: {
    ...metadata("actual-ddh041"),
    holeId: HOLE_ID,
    collarDipTenths: -600,
    collarAzimuthTenths: 1280,
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
        "Demo relative curved plan for pilot testing. Not a mine-grid design.",
      northReference: "GRID",
      desurveyMethod: "MINIMUM_CURVATURE",
      status: "ACTIVE",
      createdByUserId: "user-morgan-lee",
      createdByNameSnapshot: "Morgan Lee",
      targetId: "target-ddh041-demo-relative",
      stations: [
        {
          id: "plan-ddh041-s0",
          measuredDepthDm: decimetres(0),
          dipTenths: -600,
          azimuthTenths: 1280,
          northReference: "GRID",
          stationType: "COLLAR",
        },
        {
          id: "plan-ddh041-s1",
          measuredDepthDm: decimetres(1_500),
          dipTenths: -620,
          azimuthTenths: 1300,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s2",
          measuredDepthDm: decimetres(3_000),
          dipTenths: -660,
          azimuthTenths: 1340,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s3",
          measuredDepthDm: decimetres(5_000),
          dipTenths: -700,
          azimuthTenths: 1400,
          northReference: "GRID",
          stationType: "CONTROL",
        },
        {
          id: "plan-ddh041-s4",
          measuredDepthDm: decimetres(6_500),
          dipTenths: -740,
          azimuthTenths: 1450,
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
    eastingDm: 2_800,
    northingDm: -2_200,
    rlDm: -5_200,
    radiusDm: 50,
    targetMeasuredDepthDm: decimetres(6_500),
    attitudeMode: "CUSTOM",
    desiredDipTenths: -740,
    desiredAzimuthTenths: 1450,
    desiredNorthReference: "GRID",
    note: "Demo relative target offsets for pilot trajectory testing.",
    version: 1,
    updatedAt: NOW,
  },
};

export const trajectorySeedByHole = new Map<string, TrajectorySeed>([
  [HOLE_ID, ddh041TrajectorySeed],
]);
