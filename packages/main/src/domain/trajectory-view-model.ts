/**
 * Presentation view-model for trajectory graphics.
 *
 * Consumes verified Implementation 5 calculated coordinates only.
 * Does not recompute desurvey, dogleg, or tracking mathematics.
 *
 * Curved recovery paths are densified for display with the same
 * minimum-curvature sampling used for actual/planned renderPath.
 */

import type { CurvedTargetSolutionStation } from "./curved-target-solver";
import {
  dipAzFromVector,
  minCurveDisplacement,
  slerpDirection,
  vectorFromDipAz,
} from "./trajectory-geometry";
import {
  projectOntoSection,
  sectionBearingDegrees,
} from "./trajectory-tracking";
import type { MiniTargetLockResult } from "./mini-target-lock";
import type {
  CalculatedTrajectoryStation,
  HoleTrajectoryComparison,
  TrajectoryTrackingPoint,
} from "./trajectory-types";

export type TrajectoryGraphicViewMode = "PLAN" | "VERTICAL_SECTION" | "VIEW_3D";
export type TrajectoryVerticalScaleMode = "EQUAL" | "X2" | "EXAGGERATED";

export type TrajectoryDepthIntervalMode =
  | "FULL_HOLE"
  | "LATEST_100"
  | "LATEST_50"
  | "SELECTED_INTERVAL";

export const TRAJECTORY_GRAPHICS_DISCLAIMER =
  "This visualisation is for operational review only. It is not certified anti-collision software.";

export const EXAGGERATED_VERTICAL_SCALE = 3;

/** Match DEFAULT_RENDER_SEGMENT_DM (5.0 m) used by the MC engine. */
const CURVED_RECOVERY_RENDER_SEGMENT_M = 5;

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
  readonly dipDegrees?: number;
  readonly azimuthDegrees?: number;
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

export interface TrajectoryOverlayLine {
  readonly from: TrajectoryPathPoint;
  readonly to: TrajectoryPathPoint;
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
    readonly diameterM?: number;
  };
  readonly collar?: TrajectoryPathPoint;
  readonly bounds: TrajectoryViewBounds;
  readonly sectionBearingDegrees: number | null;
  readonly sectionBearingSource: string;
  readonly trackingPoints: readonly TrajectoryTrackingPoint[];
  readonly currentTrackingPoint?: TrajectoryTrackingPoint;
  readonly activePlanName?: string;
  /** When true, graphics hide planned path (field Mini TargetLock mode). */
  readonly fieldMode?: boolean;
  readonly directToTargetLine?: TrajectoryOverlayLine;
  /** Solved curved recovery path (geometric guidance). */
  readonly curvedRecoveryPath?: readonly TrajectoryPathPoint[];
  readonly projectedContinuationPath?: readonly TrajectoryPathPoint[];
  readonly closestApproachPoint?: TrajectoryPathPoint;
  readonly missVector?: TrajectoryOverlayLine;
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

/**
 * Densify a sparse curved-recovery station list with MC mid-samples so the
 * graphics polyline follows the curve instead of straight chords.
 */
export function densifyCurvedRecoveryPath(
  stations: readonly CurvedTargetSolutionStation[],
  maximumSegmentM: number = CURVED_RECOVERY_RENDER_SEGMENT_M,
): TrajectoryPathPoint[] {
  if (stations.length === 0) return [];
  if (stations.length === 1) {
    const only = stations[0]!;
    return [
      {
        eastingM: only.eastingM,
        northingM: only.northingM,
        rlM: only.rlM,
        measuredDepthM: only.measuredDepthM,
      },
    ];
  }

  const segmentM = Math.max(0.5, maximumSegmentM);
  const path: TrajectoryPathPoint[] = [];

  for (let i = 0; i < stations.length; i += 1) {
    const station = stations[i]!;
    if (i === 0) {
      path.push({
        eastingM: station.eastingM,
        northingM: station.northingM,
        rlM: station.rlM,
        measuredDepthM: station.measuredDepthM,
      });
      continue;
    }

    const previous = stations[i - 1]!;
    const spanM = station.measuredDepthM - previous.measuredDepthM;
    const steps = Math.max(1, Math.ceil(spanM / segmentM));

    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const lengthM = spanM * t;
      const aim = dipAzFromVector(
        slerpDirection(
          vectorFromDipAz(previous.dipDegrees, previous.azimuthDegrees),
          vectorFromDipAz(station.dipDegrees, station.azimuthDegrees),
          t,
        ),
      );
      const displacement = minCurveDisplacement(
        { dip: previous.dipDegrees, azimuth: previous.azimuthDegrees },
        { dip: aim.dip, azimuth: aim.azimuth },
        lengthM,
      );
      path.push({
        eastingM: previous.eastingM + displacement.e,
        northingM: previous.northingM + displacement.n,
        rlM: previous.rlM - displacement.d,
        measuredDepthM: previous.measuredDepthM + lengthM,
      });
    }

    path.push({
      eastingM: station.eastingM,
      northingM: station.northingM,
      rlM: station.rlM,
      measuredDepthM: station.measuredDepthM,
    });
  }

  return path;
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
  if (mode === "EXAGGERATED") return EXAGGERATED_VERTICAL_SCALE;
  if (mode === "X2") return 2;
  return 1;
}

export function verticalScaleLabel(mode: TrajectoryVerticalScaleMode): string {
  if (mode === "EXAGGERATED") return "3×";
  if (mode === "X2") return "2×";
  return "1×";
}

function filterPathByMd(
  path: readonly TrajectoryPathPoint[],
  minMd: number,
  maxMd: number,
): TrajectoryPathPoint[] {
  return path.filter(
    (point) =>
      point.measuredDepthM >= minMd - 1e-9 &&
      point.measuredDepthM <= maxMd + 1e-9,
  );
}

/**
 * Presentation filter for graphics. Coordinates are copied from the view-model;
 * no desurvey recalculation.
 */
export function filterTrajectoryViewModelByInterval(
  model: TrajectoryViewModel,
  interval: TrajectoryDepthIntervalMode,
  selectedMeasuredDepthM?: number | null,
): TrajectoryViewModel {
  if (interval === "FULL_HOLE") return model;

  const allMd = [
    ...model.plannedPath.map((p) => p.measuredDepthM),
    ...model.actualPath.map((p) => p.measuredDepthM),
  ];
  if (allMd.length === 0) return model;
  const maxMd = Math.max(...allMd);
  let minMd = Math.min(...allMd);

  if (interval === "LATEST_100") {
    minMd = Math.max(minMd, maxMd - 100);
  } else if (interval === "LATEST_50") {
    minMd = Math.max(minMd, maxMd - 50);
  } else if (interval === "SELECTED_INTERVAL") {
    const selected =
      selectedMeasuredDepthM ??
      model.currentTrackingPoint?.measuredDepthM ??
      maxMd;
    minMd = Math.max(minMd, selected - 50);
    const end = Math.min(maxMd, selected + 25);
    const plannedPath = filterPathByMd(model.plannedPath, minMd, end);
    const actualPath = filterPathByMd(model.actualPath, minMd, end);
    const boundsPoints = [...plannedPath, ...actualPath, ...model.markers];
    return {
      ...model,
      plannedPath,
      actualPath,
      bounds: boundsFromPoints(
        boundsPoints.length > 0 ? boundsPoints : model.plannedPath,
      ),
    };
  }

  const plannedPath = filterPathByMd(model.plannedPath, minMd, maxMd);
  const actualPath = filterPathByMd(model.actualPath, minMd, maxMd);
  const boundsPoints = [...plannedPath, ...actualPath, ...model.markers];
  return {
    ...model,
    plannedPath,
    actualPath,
    bounds: boundsFromPoints(
      boundsPoints.length > 0 ? boundsPoints : model.plannedPath,
    ),
  };
}

/** Signed distance off the section plane (metres). Presentation helper only. */
export function crossSectionOffsetM(input: {
  eastingM: number;
  northingM: number;
  originEastingM: number;
  originNorthingM: number;
  bearingDegrees: number;
}): number {
  const de = input.eastingM - input.originEastingM;
  const dn = input.northingM - input.originNorthingM;
  const bearingRad = (input.bearingDegrees * Math.PI) / 180;
  return de * Math.cos(bearingRad) - dn * Math.sin(bearingRad);
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

/**
 * Field Mini TargetLock view-model: actual path + target overlays only.
 * Planned path is omitted from the normal field workflow.
 */
export function buildFieldTrajectoryViewModel(
  result: MiniTargetLockResult,
): TrajectoryViewModel {
  const actual = result.actualTrajectory;
  const actualPath = (actual?.renderPath ?? []).map(toPathPoint);
  const surveyStations = (actual?.stations ?? [])
    .filter(
      (station) =>
        station.sourceType === "SURVEY" || station.sourceType === "COLLAR",
    )
    .map(toPathPoint);

  const markers: TrajectoryMarkerPoint[] = [];
  if (actual?.collar) {
    markers.push({
      ...toPathPoint({ ...actual.collar, measuredDepthM: 0 }),
      kind: "COLLAR",
      label: "Collar",
      dipDegrees: actual.collar.dipDegrees,
      azimuthDegrees: actual.collar.azimuthDegrees,
    });
  }
  for (const station of actual?.stations ?? []) {
    if (station.sourceType !== "SURVEY") continue;
    markers.push({
      ...toPathPoint(station),
      kind: "SURVEY_STATION",
      label: `Survey ${station.measuredDepthM.toFixed(1)} m`,
      sourceId: station.sourceId,
      dipDegrees: station.dipDegrees,
      azimuthDegrees: station.azimuthDegrees,
    });
  }
  if (result.latestSurvey) {
    markers.push({
      eastingM: result.latestSurvey.eastingM,
      northingM: result.latestSurvey.northingM,
      rlM: result.latestSurvey.rlM,
      measuredDepthM: result.latestSurvey.measuredDepthM,
      kind: "SELECTED_SURVEY",
      label: `Latest ${result.latestSurvey.measuredDepthM.toFixed(1)} m`,
      sourceId: result.latestSurvey.sourceId,
      dipDegrees: result.latestSurvey.dipDegrees,
      azimuthDegrees: result.latestSurvey.azimuthDegrees,
    });
  }

  const target = result.target
    ? {
        eastingM: result.target.eastingM,
        northingM: result.target.northingM,
        rlM: result.target.rlM,
        radiusM: result.target.diameterM / 2,
        diameterM: result.target.diameterM,
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

  let directToTargetLine: TrajectoryOverlayLine | undefined;
  let curvedRecoveryPath: TrajectoryPathPoint[] | undefined;
  let projectedContinuationPath: TrajectoryPathPoint[] | undefined;
  let closestApproachPoint: TrajectoryPathPoint | undefined;
  let missVector: TrajectoryOverlayLine | undefined;

  if (
    result.curvedSolution &&
    (result.curvedSolution.status === "SOLVED" ||
      result.curvedSolution.status === "REVIEW_REQUIRED") &&
    result.curvedSolution.path.length > 0
  ) {
    curvedRecoveryPath = densifyCurvedRecoveryPath(result.curvedSolution.path);
  } else if (result.latestSurvey && result.target && result.directToTarget) {
    // Fallback technical overlay only when curved solution unavailable.
    directToTargetLine = {
      from: {
        eastingM: result.latestSurvey.eastingM,
        northingM: result.latestSurvey.northingM,
        rlM: result.latestSurvey.rlM,
        measuredDepthM: result.latestSurvey.measuredDepthM,
      },
      to: {
        eastingM: result.target.eastingM,
        northingM: result.target.northingM,
        rlM: result.target.rlM,
        measuredDepthM: result.target.measuredDepthM ?? 0,
      },
    };
  }
  if (result.projection) {
    projectedContinuationPath = result.projection.projectedPath.map(
      (point, index) => ({
        ...point,
        measuredDepthM:
          (result.latestSurvey?.measuredDepthM ?? 0) + index,
      }),
    );
    closestApproachPoint = {
      ...result.projection.closestApproachPosition,
      measuredDepthM: result.latestSurvey?.measuredDepthM ?? 0,
    };
    if (result.target) {
      missVector = {
        from: closestApproachPoint,
        to: {
          eastingM: result.target.eastingM,
          northingM: result.target.northingM,
          rlM: result.target.rlM,
          measuredDepthM: result.target.measuredDepthM ?? 0,
        },
      };
    }
  }

  const allPoints: TrajectoryPathPoint[] = [
    ...actualPath,
    ...markers,
    ...(projectedContinuationPath ?? []),
    ...(curvedRecoveryPath ?? []),
  ];
  if (directToTargetLine) {
    allPoints.push(directToTargetLine.from, directToTargetLine.to);
  }
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

  const collarPoint = actual?.collar
    ? toPathPoint({ ...actual.collar, measuredDepthM: 0 })
    : undefined;
  let bearing: number | null = null;
  let bearingSource = "none";
  if (result.latestSurvey && target) {
    bearing = sectionBearingDegrees({
      fromEastingM: result.latestSurvey.eastingM,
      fromNorthingM: result.latestSurvey.northingM,
      toEastingM: target.eastingM,
      toNorthingM: target.northingM,
    });
    bearingSource = "latest-survey-to-target";
  } else if (collarPoint && target) {
    bearing = sectionBearingDegrees({
      fromEastingM: collarPoint.eastingM,
      fromNorthingM: collarPoint.northingM,
      toEastingM: target.eastingM,
      toNorthingM: target.northingM,
    });
    bearingSource = "collar-to-target";
  } else if (collarPoint && result.latestSurvey) {
    bearing = sectionBearingDegrees({
      fromEastingM: collarPoint.eastingM,
      fromNorthingM: collarPoint.northingM,
      toEastingM: result.latestSurvey.eastingM,
      toNorthingM: result.latestSurvey.northingM,
    });
    bearingSource = "collar-to-latest-survey";
  }

  return {
    holeId: result.holeId,
    engineVersion: actual?.engineVersion ?? "minimum-curvature-v1",
    plannedPath: [],
    actualPath,
    plannedStations: [],
    surveyStations,
    markers,
    target,
    collar: collarPoint,
    bounds: boundsFromPoints(allPoints),
    sectionBearingDegrees: bearing,
    sectionBearingSource: bearingSource,
    trackingPoints: [],
    fieldMode: true,
    directToTargetLine,
    curvedRecoveryPath,
    projectedContinuationPath,
    closestApproachPoint,
    missVector,
  };
}
