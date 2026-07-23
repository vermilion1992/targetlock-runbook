/**
 * Presentation view-model for trajectory graphics.
 *
 * Consumes verified Implementation 5 calculated coordinates only.
 * Does not recompute desurvey, dogleg, or tracking mathematics.
 */

import {
  projectOntoSection,
  sectionBearingDegrees,
} from "./trajectory-tracking";
import type {
  CalculatedTrajectoryStation,
  HoleTrajectoryComparison,
  TrajectoryTrackingPoint,
} from "./trajectory-types";

export type TrajectoryGraphicViewMode = "PLAN" | "VERTICAL_SECTION" | "VIEW_3D";
export type TrajectoryVerticalScaleMode = "EQUAL" | "EXAGGERATED";

export const TRAJECTORY_GRAPHICS_DISCLAIMER =
  "This visualisation is for operational review only. It is not certified anti-collision software.";

export const EXAGGERATED_VERTICAL_SCALE = 3;

export interface TrajectoryPathPoint {
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly measuredDepthM: number;
}

export interface TrajectoryMarkerPoint extends TrajectoryPathPoint {
  readonly kind:
    | "COLLAR"
    | "PLANNED_STATION"
    | "SURVEY_STATION"
    | "ENDPOINT"
    | "TARGET"
    | "SELECTED_SURVEY";
  readonly label: string;
  readonly sourceId?: string;
}

export interface TrajectoryViewBounds {
  readonly minEastingM: number;
  readonly maxEastingM: number;
  readonly minNorthingM: number;
  readonly maxNorthingM: number;
  readonly minRlM: number;
  readonly maxRlM: number;
  readonly centerEastingM: number;
  readonly centerNorthingM: number;
  readonly centerRlM: number;
  readonly spanM: number;
}

export interface TrajectoryViewModel {
  readonly holeId: string;
  readonly engineVersion: string;
  readonly plannedPath: readonly TrajectoryPathPoint[];
  readonly actualPath: readonly TrajectoryPathPoint[];
  readonly plannedStations: readonly TrajectoryPathPoint[];
  readonly surveyStations: readonly TrajectoryPathPoint[];
  readonly markers: readonly TrajectoryMarkerPoint[];
  readonly target?: {
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly radiusM?: number;
  };
  readonly collar?: TrajectoryPathPoint;
  readonly bounds: TrajectoryViewBounds;
  readonly sectionBearingDegrees: number | null;
  readonly sectionBearingSource: string;
  readonly trackingPoints: readonly TrajectoryTrackingPoint[];
  readonly currentTrackingPoint?: TrajectoryTrackingPoint;
  readonly activePlanName?: string;
}

function toPathPoint(
  station: Pick<
    CalculatedTrajectoryStation,
    "eastingM" | "northingM" | "rlM" | "measuredDepthM"
  >,
): TrajectoryPathPoint {
  return {
    eastingM: station.eastingM,
    northingM: station.northingM,
    rlM: station.rlM,
    measuredDepthM: station.measuredDepthM,
  };
}

function emptyBounds(): TrajectoryViewBounds {
  return {
    minEastingM: 0,
    maxEastingM: 1,
    minNorthingM: 0,
    maxNorthingM: 1,
    minRlM: 0,
    maxRlM: 1,
    centerEastingM: 0.5,
    centerNorthingM: 0.5,
    centerRlM: 0.5,
    spanM: 1,
  };
}

function boundsFromPoints(
  points: readonly TrajectoryPathPoint[],
): TrajectoryViewBounds {
  if (points.length === 0) return emptyBounds();
  let minE = points[0]!.eastingM;
  let maxE = points[0]!.eastingM;
  let minN = points[0]!.northingM;
  let maxN = points[0]!.northingM;
  let minRl = points[0]!.rlM;
  let maxRl = points[0]!.rlM;
  for (const point of points) {
    minE = Math.min(minE, point.eastingM);
    maxE = Math.max(maxE, point.eastingM);
    minN = Math.min(minN, point.northingM);
    maxN = Math.max(maxN, point.northingM);
    minRl = Math.min(minRl, point.rlM);
    maxRl = Math.max(maxRl, point.rlM);
  }
  const span = Math.max(maxE - minE, maxN - minN, maxRl - minRl, 1);
  return {
    minEastingM: minE,
    maxEastingM: maxE,
    minNorthingM: minN,
    maxNorthingM: maxN,
    minRlM: minRl,
    maxRlM: maxRl,
    centerEastingM: (minE + maxE) / 2,
    centerNorthingM: (minN + maxN) / 2,
    centerRlM: (minRl + maxRl) / 2,
    spanM: span,
  };
}

function resolveSectionBearing(comparison: HoleTrajectoryComparison): {
  bearing: number | null;
  source: string;
} {
  const originE =
    comparison.planned?.collar.eastingM ??
    comparison.actual?.collar.eastingM ??
    0;
  const originN =
    comparison.planned?.collar.northingM ??
    comparison.actual?.collar.northingM ??
    0;

  if (comparison.targetTracking) {
    const bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.targetTracking.targetEastingM,
      toNorthingM: comparison.targetTracking.targetNorthingM,
    });
    if (bearing !== null) {
      return { bearing, source: "collar-to-target" };
    }
  }
  if (comparison.planned) {
    const bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.planned.endpoint.eastingM,
      toNorthingM: comparison.planned.endpoint.northingM,
    });
    if (bearing !== null) {
      return { bearing, source: "planned collar-to-endpoint" };
    }
  }
  if (comparison.actual) {
    const bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.actual.endpoint.eastingM,
      toNorthingM: comparison.actual.endpoint.northingM,
    });
    if (bearing !== null) {
      return { bearing, source: "actual collar-to-endpoint" };
    }
  }
  return { bearing: null, source: "unavailable" };
}

/**
 * Build a graphics view-model from a verified HoleTrajectoryComparison.
 * Path coordinates are copied from calculated renderPath / stations unchanged.
 */
export function buildTrajectoryViewModel(
  comparison: HoleTrajectoryComparison,
): TrajectoryViewModel {
  const plannedPath = (comparison.planned?.renderPath ?? []).map(toPathPoint);
  const actualPath = (comparison.actual?.renderPath ?? []).map(toPathPoint);
  const plannedStations = (comparison.planned?.stations ?? []).map(toPathPoint);
  const surveyStations = (comparison.actual?.stations ?? [])
    .filter((station) => station.sourceType === "SURVEY" || station.sourceType === "COLLAR")
    .map(toPathPoint);

  const markers: TrajectoryMarkerPoint[] = [];
  const collarSource = comparison.planned?.collar ?? comparison.actual?.collar;
  if (collarSource) {
    markers.push({
      ...toPathPoint(collarSource),
      kind: "COLLAR",
      label: "Collar",
    });
  }
  for (const station of comparison.planned?.stations ?? []) {
    if (station.sourceType === "COLLAR") continue;
    markers.push({
      ...toPathPoint(station),
      kind: "PLANNED_STATION",
      label: `Plan ${station.measuredDepthM.toFixed(1)} m`,
      sourceId: station.sourceId,
    });
  }
  for (const station of comparison.actual?.stations ?? []) {
    if (station.sourceType !== "SURVEY") continue;
    markers.push({
      ...toPathPoint(station),
      kind: "SURVEY_STATION",
      label: `Survey ${station.measuredDepthM.toFixed(1)} m`,
      sourceId: station.sourceId,
    });
  }
  const plannedEndpoint = comparison.planned?.endpoint;
  if (plannedEndpoint) {
    markers.push({
      ...toPathPoint(plannedEndpoint),
      kind: "ENDPOINT",
      label: "Planned endpoint",
    });
  }
  const actualEndpoint = comparison.actual?.endpoint;
  if (actualEndpoint && comparison.planned?.endpoint) {
    const same =
      Math.abs(actualEndpoint.eastingM - comparison.planned.endpoint.eastingM) <
        1e-9 &&
      Math.abs(
        actualEndpoint.northingM - comparison.planned.endpoint.northingM,
      ) < 1e-9 &&
      Math.abs(actualEndpoint.rlM - comparison.planned.endpoint.rlM) < 1e-9;
    if (!same) {
      markers.push({
        ...toPathPoint(actualEndpoint),
        kind: "ENDPOINT",
        label: "Actual endpoint",
      });
    }
  } else if (actualEndpoint) {
    markers.push({
      ...toPathPoint(actualEndpoint),
      kind: "ENDPOINT",
      label: "Actual endpoint",
    });
  }

  const target = comparison.targetTracking
    ? {
        eastingM: comparison.targetTracking.targetEastingM,
        northingM: comparison.targetTracking.targetNorthingM,
        rlM: comparison.targetTracking.targetRlM,
        radiusM: comparison.targetTracking.targetRadiusM,
      }
    : undefined;
  if (target) {
    markers.push({
      eastingM: target.eastingM,
      northingM: target.northingM,
      rlM: target.rlM,
      measuredDepthM: 0,
      kind: "TARGET",
      label: "Target",
    });
  }

  const allPoints: TrajectoryPathPoint[] = [
    ...plannedPath,
    ...actualPath,
    ...markers,
  ];
  if (target?.radiusM !== undefined) {
    allPoints.push(
      {
        eastingM: target.eastingM + target.radiusM,
        northingM: target.northingM,
        rlM: target.rlM,
        measuredDepthM: 0,
      },
      {
        eastingM: target.eastingM - target.radiusM,
        northingM: target.northingM,
        rlM: target.rlM,
        measuredDepthM: 0,
      },
      {
        eastingM: target.eastingM,
        northingM: target.northingM + target.radiusM,
        rlM: target.rlM,
        measuredDepthM: 0,
      },
      {
        eastingM: target.eastingM,
        northingM: target.northingM - target.radiusM,
        rlM: target.rlM,
        measuredDepthM: 0,
      },
    );
  }

  const { bearing, source } = resolveSectionBearing(comparison);

  return {
    holeId: comparison.holeId,
    engineVersion:
      comparison.planned?.engineVersion ??
      comparison.actual?.engineVersion ??
      "minimum-curvature-v1",
    plannedPath,
    actualPath,
    plannedStations,
    surveyStations,
    markers,
    target,
    collar: collarSource ? toPathPoint(collarSource) : undefined,
    bounds: boundsFromPoints(allPoints),
    sectionBearingDegrees: bearing,
    sectionBearingSource: source,
    trackingPoints: comparison.trackingPoints,
    currentTrackingPoint: comparison.currentTrackingPoint,
    activePlanName: comparison.activePlanName,
  };
}

export function verticalScaleFactor(
  mode: TrajectoryVerticalScaleMode,
): number {
  return mode === "EXAGGERATED" ? EXAGGERATED_VERTICAL_SCALE : 1;
}

/** Scene axes: +X east, +Y up (RL), +Z north. */
export function toSceneCoordinates(
  point: Pick<TrajectoryPathPoint, "eastingM" | "northingM" | "rlM">,
  bounds: TrajectoryViewBounds,
  verticalScale: number,
): { x: number; y: number; z: number } {
  return {
    x: point.eastingM - bounds.centerEastingM,
    y: (point.rlM - bounds.centerRlM) * verticalScale,
    z: point.northingM - bounds.centerNorthingM,
  };
}

export function projectPointToSection(
  point: Pick<TrajectoryPathPoint, "eastingM" | "northingM" | "rlM">,
  model: TrajectoryViewModel,
): { sectionM: number; rlM: number } | null {
  if (model.sectionBearingDegrees === null || model.collar === undefined) {
    return null;
  }
  return {
    sectionM: projectOntoSection({
      eastingM: point.eastingM,
      northingM: point.northingM,
      originEastingM: model.collar.eastingM,
      originNorthingM: model.collar.northingM,
      bearingDegrees: model.sectionBearingDegrees,
    }),
    rlM: point.rlM,
  };
}

export function findTrackingPointForSurvey(
  model: TrajectoryViewModel,
  surveyId: string,
): TrajectoryTrackingPoint | undefined {
  return model.trackingPoints.find((point) => point.actualSurveyId === surveyId);
}
