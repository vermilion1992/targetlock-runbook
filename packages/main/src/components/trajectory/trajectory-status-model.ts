/**
 * Presentation-only status mapping for the Trajectory Cockpit.
 * Does not alter classifyTrackingStatus or desurvey mathematics.
 */

import type {
  HoleTrajectoryComparison,
  TrajectoryTrackingPoint,
  TrajectoryTrackingStatus,
  TrajectoryWarning,
} from "@/domain";

import { formatMetresValue } from "./trajectory-format";

export type PlanToTargetStatusKind =
  | "NO_TARGET"
  | "PLAN_WITHIN_TARGET"
  | "PLAN_REVIEW_REQUIRED";

export type ActualVsPlanStatusKind =
  | "NO_TRACKING"
  | "NO_TOLERANCE"
  | "WITHIN_TOLERANCE"
  | "REVIEW"
  | "OUTSIDE_TOLERANCE";

export type CalculationStatusKind = "VALID" | "BLOCKED";

export interface PlanToTargetStatusView {
  readonly kind: PlanToTargetStatusKind;
  readonly title: string;
  readonly detail: string;
  readonly targetRadiusLabel?: string;
}

export interface ActualVsPlanStatusView {
  readonly kind: ActualVsPlanStatusKind;
  readonly title: string;
  readonly detail: string;
}

export interface CalculationStatusView {
  readonly kind: CalculationStatusKind;
  readonly title: string;
  readonly detail: string;
}

export function mapTrackingStatusLabel(
  status: TrajectoryTrackingStatus,
  toleranceConfigured: boolean,
  spatialDeviationM: number,
): string {
  if (!toleranceConfigured) {
    return `${formatMetresValue(spatialDeviationM)} from plan`;
  }
  if (status === "ON_TRACK") return "WITHIN PROJECT TOLERANCE";
  if (status === "REVIEW") return "REVIEW";
  return "OUTSIDE PROJECT TOLERANCE";
}

export function buildCalculationStatus(
  comparison: HoleTrajectoryComparison,
): CalculationStatusView {
  if (comparison.blocked) {
    return {
      kind: "BLOCKED",
      title: "CALCULATION BLOCKED",
      detail: comparison.blockReason ?? "Trajectory calculation could not complete.",
    };
  }
  return {
    kind: "VALID",
    title: "TRAJECTORY VALID",
    detail: "Minimum-curvature calculation completed",
  };
}

export function buildPlanToTargetStatus(
  comparison: HoleTrajectoryComparison,
): PlanToTargetStatusView {
  const target = comparison.targetTracking;
  if (!target) {
    return {
      kind: "NO_TARGET",
      title: "NO TARGET",
      detail: "No target coordinates supplied",
    };
  }

  const distanceLabel = formatMetresValue(target.plannedEndpointDistanceM);
  const radiusLabel =
    target.targetRadiusM !== undefined
      ? formatMetresValue(target.targetRadiusM)
      : undefined;

  if (target.plannedWithinTargetRadius === true) {
    return {
      kind: "PLAN_WITHIN_TARGET",
      title: "PLAN REACHES TARGET",
      detail: `Planned endpoint is ${distanceLabel} from target`,
      targetRadiusLabel: radiusLabel,
    };
  }

  if (
    target.plannedWithinTargetRadius === false ||
    (target.targetRadiusM !== undefined &&
      target.plannedEndpointDistanceM > target.targetRadiusM)
  ) {
    return {
      kind: "PLAN_REVIEW_REQUIRED",
      title: "PLAN REVIEW REQUIRED",
      detail: `Planned endpoint is ${distanceLabel} from target`,
      targetRadiusLabel: radiusLabel,
    };
  }

  return {
    kind: "PLAN_REVIEW_REQUIRED",
    title: "PLAN REVIEW REQUIRED",
    detail: `Planned endpoint is ${distanceLabel} from target`,
    targetRadiusLabel: radiusLabel,
  };
}

export function buildActualVsPlanStatus(
  comparison: HoleTrajectoryComparison,
  point?: TrajectoryTrackingPoint | null,
): ActualVsPlanStatusView {
  const tracking = point ?? comparison.currentTrackingPoint;
  if (!tracking) {
    return {
      kind: "NO_TRACKING",
      title: "ACTUAL VS PLAN",
      detail: "No current tracking point available",
    };
  }

  if (!comparison.toleranceConfigured) {
    return {
      kind: "NO_TOLERANCE",
      title: "ACTUAL VS PLAN",
      detail: `${formatMetresValue(tracking.spatialDeviationM)} spatial deviation`,
    };
  }

  if (tracking.status === "OUTSIDE_TOLERANCE") {
    return {
      kind: "OUTSIDE_TOLERANCE",
      title: "OUTSIDE PROJECT TOLERANCE",
      detail: `${formatMetresValue(tracking.spatialDeviationM)} spatial deviation`,
    };
  }
  if (tracking.status === "REVIEW") {
    return {
      kind: "REVIEW",
      title: "REVIEW",
      detail: `${formatMetresValue(tracking.spatialDeviationM)} spatial deviation`,
    };
  }
  return {
    kind: "WITHIN_TOLERANCE",
    title: "WITHIN PROJECT TOLERANCE",
    detail: `${formatMetresValue(tracking.spatialDeviationM)} spatial deviation`,
  };
}

export function reviewItems(
  warnings: readonly TrajectoryWarning[],
): readonly TrajectoryWarning[] {
  return warnings.filter((warning) => warning.severity !== "info");
}
