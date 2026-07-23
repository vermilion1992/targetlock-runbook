import { decimetresToMetres } from "./measurements";
import {
  circularAzimuthDifferenceDegrees,
  shortestAzimuthDifferenceDegrees,
} from "./trajectory-geometry";
import { NEAR_VERTICAL_DIP_DEG } from "./trajectory-types";
import type {
  CalculatedTrajectory,
  CalculatedTrajectoryPosition,
  CalculatedTrajectoryStation,
  HoleTarget,
  TargetTrackingResult,
  TrajectoryTrackingPoint,
  TrajectoryTrackingStatus,
  TrajectoryTrackingTolerance,
  TrajectoryWarning,
} from "./trajectory-types";

function distance3d(
  a: { eastingM: number; northingM: number; rlM: number },
  b: { eastingM: number; northingM: number; rlM: number },
): number {
  return Math.hypot(a.eastingM - b.eastingM, a.northingM - b.northingM, a.rlM - b.rlM);
}

function closestApproachAlongPath(
  path: readonly CalculatedTrajectoryStation[],
  target: { eastingM: number; northingM: number; rlM: number },
): { distanceM: number; measuredDepthM: number } {
  if (path.length === 0) {
    return { distanceM: Number.POSITIVE_INFINITY, measuredDepthM: 0 };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestMd = path[0]!.measuredDepthM;

  for (let i = 0; i < path.length; i += 1) {
    const station = path[i]!;
    const distance = distance3d(station, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMd = station.measuredDepthM;
    }

    if (i === 0) continue;
    const previous = path[i - 1]!;
    // Sample the chord densely enough for foundation closest-approach.
    const samples = 8;
    for (let step = 1; step < samples; step += 1) {
      const t = step / samples;
      const point = {
        eastingM: previous.eastingM + (station.eastingM - previous.eastingM) * t,
        northingM:
          previous.northingM + (station.northingM - previous.northingM) * t,
        rlM: previous.rlM + (station.rlM - previous.rlM) * t,
      };
      const sampleDistance = distance3d(point, target);
      if (sampleDistance < bestDistance) {
        bestDistance = sampleDistance;
        bestMd =
          previous.measuredDepthM +
          (station.measuredDepthM - previous.measuredDepthM) * t;
      }
    }
  }

  return { distanceM: bestDistance, measuredDepthM: bestMd };
}

export function classifyTrackingStatus(
  point: Pick<
    TrajectoryTrackingPoint,
    | "horizontalDeviationM"
    | "verticalDeviationM"
    | "spatialDeviationM"
    | "dipDifferenceDegrees"
    | "circularAzimuthDifferenceDegrees"
    | "actualDipDegrees"
  >,
  tolerance?: TrajectoryTrackingTolerance | null,
): TrajectoryTrackingStatus {
  if (tolerance === undefined || tolerance === null) {
    return "ON_TRACK";
  }

  const nearVertical =
    Math.abs(point.actualDipDegrees) >= NEAR_VERTICAL_DIP_DEG;

  const isOutside =
    (tolerance.horizontalOutsideDm !== undefined &&
      point.horizontalDeviationM >= tolerance.horizontalOutsideDm / 10) ||
    (tolerance.verticalOutsideDm !== undefined &&
      Math.abs(point.verticalDeviationM) >=
        tolerance.verticalOutsideDm / 10) ||
    (tolerance.spatialOutsideDm !== undefined &&
      point.spatialDeviationM >= tolerance.spatialOutsideDm / 10);

  if (isOutside) return "OUTSIDE_TOLERANCE";

  const isReview =
    (tolerance.horizontalReviewDm !== undefined &&
      point.horizontalDeviationM >= tolerance.horizontalReviewDm / 10) ||
    (tolerance.verticalReviewDm !== undefined &&
      Math.abs(point.verticalDeviationM) >=
        tolerance.verticalReviewDm / 10) ||
    (tolerance.spatialReviewDm !== undefined &&
      point.spatialDeviationM >= tolerance.spatialReviewDm / 10) ||
    (tolerance.dipReviewTenths !== undefined &&
      Math.abs(point.dipDifferenceDegrees) >=
        tolerance.dipReviewTenths / 10) ||
    (!nearVertical &&
      tolerance.azimuthReviewTenths !== undefined &&
      point.circularAzimuthDifferenceDegrees >=
        tolerance.azimuthReviewTenths / 10);

  return isReview ? "REVIEW" : "ON_TRACK";
}

export function buildTrackingPoint(input: {
  actualSurveyId: string;
  measuredDepthM: number;
  plannedPosition: CalculatedTrajectoryPosition;
  actualPosition: CalculatedTrajectoryPosition;
  tolerance?: TrajectoryTrackingTolerance | null;
}): TrajectoryTrackingPoint {
  const deltaEastingM =
    input.actualPosition.eastingM - input.plannedPosition.eastingM;
  const deltaNorthingM =
    input.actualPosition.northingM - input.plannedPosition.northingM;
  const deltaRlM = input.actualPosition.rlM - input.plannedPosition.rlM;
  const horizontalDeviationM = Math.hypot(deltaEastingM, deltaNorthingM);
  const spatialDeviationM = Math.hypot(
    deltaEastingM,
    deltaNorthingM,
    deltaRlM,
  );
  const dipDifferenceDegrees =
    input.actualPosition.dipDegrees - input.plannedPosition.dipDegrees;
  const azimuthDifferenceDegrees = circularAzimuthDifferenceDegrees(
    input.plannedPosition.azimuthDegrees,
    input.actualPosition.azimuthDegrees,
  );

  const point: TrajectoryTrackingPoint = {
    actualSurveyId: input.actualSurveyId,
    measuredDepthM: input.measuredDepthM,
    plannedPosition: input.plannedPosition,
    actualPosition: input.actualPosition,
    deltaEastingM,
    deltaNorthingM,
    deltaRlM,
    horizontalDeviationM,
    verticalDeviationM: deltaRlM,
    spatialDeviationM,
    plannedDipDegrees: input.plannedPosition.dipDegrees,
    actualDipDegrees: input.actualPosition.dipDegrees,
    dipDifferenceDegrees,
    plannedAzimuthDegrees: input.plannedPosition.azimuthDegrees,
    actualAzimuthDegrees: input.actualPosition.azimuthDegrees,
    circularAzimuthDifferenceDegrees: azimuthDifferenceDegrees,
    status: "ON_TRACK",
  };

  return {
    ...point,
    status: classifyTrackingStatus(point, input.tolerance),
  };
}

export function calculateTargetTracking(input: {
  target: HoleTarget;
  planned: CalculatedTrajectory;
  actual: CalculatedTrajectory;
}): TargetTrackingResult {
  const targetEastingM = input.target.eastingDm / 10;
  const targetNorthingM = input.target.northingDm / 10;
  const targetRlM = input.target.rlDm / 10;
  const targetPoint = {
    eastingM: targetEastingM,
    northingM: targetNorthingM,
    rlM: targetRlM,
  };
  const radiusM =
    input.target.radiusDm === undefined
      ? undefined
      : input.target.radiusDm / 10;

  const plannedEndpointDistanceM = distance3d(
    input.planned.endpoint,
    targetPoint,
  );
  const actualEndpointDistanceM = distance3d(
    input.actual.endpoint,
    targetPoint,
  );
  const plannedClosest = closestApproachAlongPath(
    input.planned.renderPath,
    targetPoint,
  );
  const actualClosest = closestApproachAlongPath(
    input.actual.renderPath,
    targetPoint,
  );

  let endpointAttitudeDifference:
    | TargetTrackingResult["endpointAttitudeDifference"]
    | undefined;
  if (
    input.target.desiredDipTenths !== undefined ||
    input.target.desiredAzimuthTenths !== undefined
  ) {
    const dipDifferenceDegrees =
      input.target.desiredDipTenths === undefined
        ? undefined
        : input.planned.endpoint.dipDegrees -
          input.target.desiredDipTenths / 10;
    const azimuthDifferenceDegrees =
      input.target.desiredAzimuthTenths === undefined
        ? undefined
        : shortestAzimuthDifferenceDegrees(
            input.target.desiredAzimuthTenths / 10,
            input.planned.endpoint.azimuthDegrees,
          );
    endpointAttitudeDifference = {
      dipDifferenceDegrees,
      azimuthDifferenceDegrees:
        azimuthDifferenceDegrees === undefined
          ? undefined
          : Math.abs(azimuthDifferenceDegrees),
    };
  }

  return {
    targetId: input.target.id,
    targetEastingM,
    targetNorthingM,
    targetRlM,
    targetRadiusM: radiusM,
    actualEndpointDistanceM,
    plannedEndpointDistanceM,
    actualClosestApproachM: actualClosest.distanceM,
    actualClosestApproachMeasuredDepthM: actualClosest.measuredDepthM,
    plannedClosestApproachM: plannedClosest.distanceM,
    plannedClosestApproachMeasuredDepthM: plannedClosest.measuredDepthM,
    actualWithinTargetRadius:
      radiusM === undefined
        ? undefined
        : actualEndpointDistanceM <= radiusM,
    plannedWithinTargetRadius:
      radiusM === undefined
        ? undefined
        : plannedEndpointDistanceM <= radiusM,
    endpointAttitudeDifference,
  };
}

export function buildTargetWarnings(
  targetTracking: TargetTrackingResult,
  actual?: CalculatedTrajectory | null,
  target?: HoleTarget | null,
): TrajectoryWarning[] {
  const warnings: TrajectoryWarning[] = [];
  if (
    targetTracking.plannedWithinTargetRadius === false &&
    targetTracking.targetRadiusM !== undefined
  ) {
    warnings.push({
      code: "PLANNED_ENDPOINT_OUTSIDE_TARGET",
      severity: "warning",
      message: `PLANNED PATH DOES NOT REACH TARGET. The saved directional plan finishes ${targetTracking.plannedEndpointDistanceM.toFixed(1)} m from the target. TargetLock will not silently alter the planned stations.`,
    });
  }

  const attitude = targetTracking.endpointAttitudeDifference;
  if (
    attitude?.dipDifferenceDegrees !== undefined &&
    Math.abs(attitude.dipDifferenceDegrees) >= 2
  ) {
    warnings.push({
      code: "TARGET_ATTITUDE_DIFFERS",
      severity: "info",
      message:
        "Desired target attitude differs materially from the planned endpoint attitude.",
    });
  }
  if (
    attitude?.azimuthDifferenceDegrees !== undefined &&
    attitude.azimuthDifferenceDegrees >= 5
  ) {
    warnings.push({
      code: "TARGET_ATTITUDE_DIFFERS",
      severity: "info",
      message:
        "Desired target azimuth differs materially from the planned endpoint azimuth.",
    });
  }

  if (
    target?.targetMeasuredDepthDm !== undefined &&
    actual !== undefined &&
    actual !== null &&
    actual.measuredDepthM >= decimetresToMetres(target.targetMeasuredDepthDm)
  ) {
    warnings.push({
      code: "ACTUAL_PASSED_TARGET_MD",
      severity: "info",
      message:
        "The actual surveyed path has reached or passed the target measured depth.",
    });
  }

  return warnings;
}

export function formatDeviationSummary(point: TrajectoryTrackingPoint): string {
  const east =
    Math.abs(point.deltaEastingM) < 0.05
      ? "on easting"
      : `${Math.abs(point.deltaEastingM).toFixed(1)} m ${point.deltaEastingM > 0 ? "east" : "west"} of plan`;
  const north =
    Math.abs(point.deltaNorthingM) < 0.05
      ? "on northing"
      : `${Math.abs(point.deltaNorthingM).toFixed(1)} m ${point.deltaNorthingM > 0 ? "north" : "south"} of plan`;
  const vertical =
    Math.abs(point.deltaRlM) < 0.05
      ? "on vertical"
      : `${Math.abs(point.deltaRlM).toFixed(1)} m ${point.deltaRlM > 0 ? "above" : "below"} plan`;
  return `${east}; ${north}; ${vertical}`;
}

export function sectionBearingDegrees(input: {
  fromEastingM: number;
  fromNorthingM: number;
  toEastingM: number;
  toNorthingM: number;
}): number | null {
  const de = input.toEastingM - input.fromEastingM;
  const dn = input.toNorthingM - input.fromNorthingM;
  if (Math.hypot(de, dn) < 1e-9) return null;
  const deg = (Math.atan2(de, dn) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function projectOntoSection(input: {
  eastingM: number;
  northingM: number;
  originEastingM: number;
  originNorthingM: number;
  bearingDegrees: number;
}): number {
  const de = input.eastingM - input.originEastingM;
  const dn = input.northingM - input.originNorthingM;
  const bearingRad = (input.bearingDegrees * Math.PI) / 180;
  return de * Math.sin(bearingRad) + dn * Math.cos(bearingRad);
}
