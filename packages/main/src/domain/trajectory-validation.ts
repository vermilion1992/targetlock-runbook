import { decimetresToMetres } from "./measurements";
import type { Survey } from "./models";
import { NEAR_VERTICAL_DIP_DEG } from "./trajectory-types";
import type {
  ActualTrajectoryConfiguration,
  CalculatedTrajectory,
  HoleCoordinateConfiguration,
  HoleTarget,
  PlannedHoleTrajectory,
  ReferenceConfiguration,
  TrajectoryTrackingPoint,
  TrajectoryWarning,
} from "./trajectory-types";

export function validateCoordinateConfiguration(
  config: HoleCoordinateConfiguration,
): TrajectoryWarning | null {
  if (config.coordinateMode === "RELATIVE") {
    return null;
  }
  if (
    config.collarEastingDm === undefined ||
    config.collarNorthingDm === undefined ||
    config.collarRlDm === undefined
  ) {
    return {
      code: "MINE_GRID_BLOCKED",
      severity: "blocker",
      message:
        "Mine-grid mode requires collar Easting, Northing and RL before trajectory comparison.",
    };
  }
  if (!config.coordinateSystemName?.trim()) {
    return {
      code: "MINE_GRID_BLOCKED",
      severity: "blocker",
      message:
        "Mine-grid mode requires a coordinate-system or local-grid name.",
    };
  }
  if (config.calculationNorthReference !== "GRID") {
    return {
      code: "MINE_GRID_BLOCKED",
      severity: "blocker",
      message:
        "Mine-grid trajectory comparison requires calculation north reference Grid North.",
    };
  }
  return null;
}

export function validateReferenceForMineGrid(
  coordinateConfiguration: HoleCoordinateConfiguration,
  referenceConfiguration: ReferenceConfiguration | null | undefined,
  stationReferences: readonly string[],
): TrajectoryWarning | null {
  if (coordinateConfiguration.coordinateMode !== "MINE_GRID") {
    return null;
  }
  const needsConversion = stationReferences.some(
    (ref) => ref !== "GRID" && ref !== "NOT_SPECIFIED",
  );
  const hasUnspecified = stationReferences.includes("NOT_SPECIFIED");
  if (hasUnspecified) {
    return {
      code: "MINE_GRID_BLOCKED",
      severity: "blocker",
      message:
        "Mine-grid mode cannot convert unspecified north references to Grid North.",
    };
  }
  if (needsConversion && !referenceConfiguration) {
    return {
      code: "MINE_GRID_BLOCKED",
      severity: "blocker",
      message:
        "Mine-grid mode requires a reference configuration to convert azimuths to Grid North.",
    };
  }
  return null;
}

export function collectAdvisoryWarnings(input: {
  planned?: PlannedHoleTrajectory | null;
  actualConfig?: ActualTrajectoryConfiguration | null;
  coordinateConfiguration?: HoleCoordinateConfiguration | null;
  surveys: readonly Survey[];
  plannedTrajectory?: CalculatedTrajectory | null;
  actualTrajectory?: CalculatedTrajectory | null;
  trackingPoints: readonly TrajectoryTrackingPoint[];
  holeCurrentDepthDm?: number;
  target?: HoleTarget | null;
}): TrajectoryWarning[] {
  const warnings: TrajectoryWarning[] = [];
  const coordinateMode =
    input.coordinateConfiguration?.coordinateMode ?? "RELATIVE";

  const refs = [
    ...(input.planned?.stations.map((s) => s.northReference) ?? []),
    ...(input.surveys.map((s) => s.northReference) ?? []),
    input.actualConfig?.collarNorthReference,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);

  if (
    coordinateMode === "RELATIVE" &&
    refs.length > 0 &&
    refs.every((ref) => ref === "NOT_SPECIFIED")
  ) {
    warnings.push({
      code: "UNSPECIFIED_REFERENCES",
      severity: "warning",
      message:
        "AZIMUTH REFERENCE NOT SPECIFIED. Planned and actual Hole shape can be displayed, but orientation against mine-grid data is not reliable.",
    });
  }

  if (
    input.plannedTrajectory &&
    input.actualTrajectory &&
    input.actualTrajectory.measuredDepthM >
      input.plannedTrajectory.measuredDepthM + 0.05
  ) {
    warnings.push({
      code: "ACTUAL_DEEPER_THAN_PLAN",
      severity: "warning",
      message:
        "Actual Survey depth exceeds the planned path. Planned positions beyond the plan endpoint are extrapolated along the final planned attitude.",
    });
  }

  if (
    input.plannedTrajectory &&
    input.holeCurrentDepthDm !== undefined &&
    input.plannedTrajectory.measuredDepthM >
      decimetresToMetres(input.holeCurrentDepthDm as never) + 0.05
  ) {
    warnings.push({
      code: "PLAN_DEEPER_THAN_HOLE",
      severity: "info",
      message:
        "The planned path is deeper than the current Hole depth.",
    });
  }

  const surveyDepths = [...new Set(input.surveys.map((s) => Number(s.depthDm)))]
    .sort((a, b) => a - b);
  if (surveyDepths.length > 0 && surveyDepths[0]! > 100) {
    warnings.push({
      code: "FIRST_SURVEY_FAR_FROM_COLLAR",
      severity: "info",
      message: `First Survey is ${surveyDepths[0]! / 10} m from collar.`,
    });
  }
  for (let i = 1; i < surveyDepths.length; i += 1) {
    const gap = surveyDepths[i]! - surveyDepths[i - 1]!;
    if (gap > 500) {
      warnings.push({
        code: "LARGE_SURVEY_SPACING",
        severity: "info",
        message: `Large Survey spacing of ${gap / 10} m detected.`,
      });
      break;
    }
  }

  const nearVertical = [
    ...(input.plannedTrajectory?.stations ?? []),
    ...(input.actualTrajectory?.stations ?? []),
  ].some((station) => Math.abs(station.dipDegrees) >= NEAR_VERTICAL_DIP_DEG);
  if (nearVertical) {
    warnings.push({
      code: "NEAR_VERTICAL_AZIMUTH",
      severity: "warning",
      message:
        "Near-vertical orientation detected (|dip| ≥ 85°). Azimuth is less reliable; horizontal and spatial deviation remain the primary tracking metrics.",
    });
  }

  const largeDeviation = input.trackingPoints.find(
    (point) => point.spatialDeviationM >= 10,
  );
  if (largeDeviation) {
    warnings.push({
      code: "LARGE_SAME_DEPTH_DEVIATION",
      severity: "warning",
      message: `Large same-depth deviation of ${largeDeviation.spatialDeviationM.toFixed(1)} m at ${largeDeviation.measuredDepthM.toFixed(1)} m MD.`,
    });
  }

  if (!input.target) {
    warnings.push({
      code: "NO_TARGET_COORDINATES",
      severity: "info",
      message:
        "No target coordinates supplied. Distance-to-target metrics are unavailable.",
    });
  }

  if (input.planned && input.actualConfig) {
    const plannedCollar = input.planned.stations[0];
    if (
      plannedCollar &&
      (plannedCollar.dipTenths !== input.actualConfig.collarDipTenths ||
        plannedCollar.azimuthTenths !==
          input.actualConfig.collarAzimuthTenths ||
        plannedCollar.northReference !==
          input.actualConfig.collarNorthReference)
    ) {
      warnings.push({
        code: "COLLAR_ATTITUDE_DIFFERS",
        severity: "info",
        message:
          "Planned collar attitude differs from the actual Survey collar configuration.",
      });
    }
  }

  return warnings;
}
