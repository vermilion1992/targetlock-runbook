import type { Survey } from "./models";
import {
  calculateMinimumCurvatureTrajectory,
  getTrajectoryPositionAtMeasuredDepth,
} from "./trajectory-desurvey";
import {
  buildActualTrajectoryStations,
  buildPlannedTrajectoryStations,
  TrajectoryStationError,
} from "./trajectory-stations";
import {
  buildTargetWarnings,
  buildTrackingPoint,
  calculateTargetTracking,
} from "./trajectory-tracking";
import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  HoleTarget,
  HoleTrajectoryComparison,
  PlannedHoleTrajectory,
  ReferenceConfiguration,
  TrajectoryCollar,
  TrajectorySourceVersion,
  TrajectorySurveySelection,
  TrajectoryTrackingTolerance,
  TrajectoryWarning,
} from "./trajectory-types";
import {
  collectAdvisoryWarnings,
  validateCoordinateConfiguration,
  validateReferenceForMineGrid,
} from "./trajectory-validation";

function buildCollar(
  coordinateConfiguration: HoleCoordinateConfiguration,
): TrajectoryCollar {
  if (coordinateConfiguration.coordinateMode === "RELATIVE") {
    return {
      eastingM: 0,
      northingM: 0,
      rlM: 0,
      coordinateMode: "RELATIVE",
      calculationNorthReference:
        coordinateConfiguration.calculationNorthReference,
    };
  }
  return {
    eastingM: (coordinateConfiguration.collarEastingDm ?? 0) / 10,
    northingM: (coordinateConfiguration.collarNorthingDm ?? 0) / 10,
    rlM: (coordinateConfiguration.collarRlDm ?? 0) / 10,
    coordinateMode: "MINE_GRID",
    coordinateSystemName: coordinateConfiguration.coordinateSystemName,
    calculationNorthReference:
      coordinateConfiguration.calculationNorthReference,
  };
}

export interface CalculateHoleTrajectoryComparisonInput {
  readonly holeId: string;
  readonly surveys: readonly Survey[];
  readonly coordinateConfiguration: HoleCoordinateConfiguration | null;
  readonly planned: PlannedHoleTrajectory | null;
  readonly actualConfiguration: ActualTrajectoryConfiguration | null;
  readonly selections: readonly TrajectorySurveySelection[];
  readonly referenceConfiguration?: ReferenceConfiguration | null;
  readonly target?: HoleTarget | null;
  readonly tolerance?: TrajectoryTrackingTolerance | null;
  readonly holeCurrentDepthDm?: number;
}

export function calculateHoleTrajectoryComparison(
  input: CalculateHoleTrajectoryComparisonInput,
): HoleTrajectoryComparison {
  const warnings: TrajectoryWarning[] = [];
  const sourceVersions: TrajectorySourceVersion[] = [];

  if (!input.coordinateConfiguration) {
    return {
      holeId: input.holeId,
      planned: null,
      actual: null,
      trackingPoints: [],
      warnings: [
        {
          code: "CALCULATION_BLOCKED",
          severity: "blocker",
          message:
            "Hole coordinate configuration is required before trajectory comparison.",
        },
      ],
      sourceVersions,
      blocked: true,
      blockReason: "Missing coordinate configuration",
    };
  }

  const coordinateBlock = validateCoordinateConfiguration(
    input.coordinateConfiguration,
  );
  if (coordinateBlock) {
    return {
      holeId: input.holeId,
      planned: null,
      actual: null,
      trackingPoints: [],
      warnings: [coordinateBlock],
      sourceVersions,
      blocked: true,
      blockReason: coordinateBlock.message,
    };
  }

  sourceVersions.push({
    entityType: "coordinateConfiguration",
    entityId: input.coordinateConfiguration.localId,
    version: input.coordinateConfiguration.version,
  });

  if (input.referenceConfiguration) {
    sourceVersions.push({
      entityType: "referenceConfiguration",
      entityId: input.referenceConfiguration.localId,
      version: input.referenceConfiguration.version,
    });
  }

  const stationRefs = [
    ...(input.planned?.stations.map((s) => s.northReference) ?? []),
    ...(input.surveys.map((s) => s.northReference) ?? []),
    ...(input.actualConfiguration
      ? [input.actualConfiguration.collarNorthReference]
      : []),
  ];

  const mineGridBlock = validateReferenceForMineGrid(
    input.coordinateConfiguration,
    input.referenceConfiguration,
    stationRefs,
  );
  if (mineGridBlock) {
    return {
      holeId: input.holeId,
      planned: null,
      actual: null,
      trackingPoints: [],
      warnings: [mineGridBlock],
      sourceVersions,
      blocked: true,
      blockReason: mineGridBlock.message,
    };
  }

  const collar = buildCollar(input.coordinateConfiguration);
  let plannedTrajectory = null;
  let actualTrajectory = null;
  let plannedStations = null;
  let actualStations = null;
  let selectedSurveys: Survey[] = [];

  try {
    if (input.planned) {
      sourceVersions.push({
        entityType: "plannedTrajectory",
        entityId: input.planned.localId,
        version: input.planned.version,
      });
      for (const station of input.planned.stations) {
        sourceVersions.push({
          entityType: "plannedStation",
          entityId: station.id,
          version: input.planned.version,
        });
      }
      const built = buildPlannedTrajectoryStations(
        input.planned,
        input.coordinateConfiguration,
        input.referenceConfiguration,
      );
      plannedStations = built.stations;
      warnings.push(...built.warnings);
      plannedTrajectory = calculateMinimumCurvatureTrajectory(
        collar,
        plannedStations,
        {
          trajectoryType: "PLANNED",
          holeId: input.holeId,
          sourceVersions: sourceVersions.filter(
            (v) =>
              v.entityType === "plannedTrajectory" ||
              v.entityType === "plannedStation",
          ),
        },
      );
    }

    if (input.actualConfiguration) {
      sourceVersions.push({
        entityType: "actualConfiguration",
        entityId: input.actualConfiguration.localId,
        version: input.actualConfiguration.version,
      });
      const built = buildActualTrajectoryStations(
        input.actualConfiguration,
        input.surveys,
        input.selections,
        input.coordinateConfiguration,
        input.referenceConfiguration,
      );
      actualStations = built.stations;
      selectedSurveys = built.selectedSurveys;
      warnings.push(...built.warnings);
      for (const survey of selectedSurveys) {
        sourceVersions.push({
          entityType: "survey",
          entityId: survey.localId,
          version: survey.version,
        });
      }
      for (const selection of input.selections) {
        sourceVersions.push({
          entityType: "surveySelection",
          entityId: selection.localId,
          version: selection.version,
        });
      }
      actualTrajectory = calculateMinimumCurvatureTrajectory(
        collar,
        actualStations,
        {
          trajectoryType: "ACTUAL",
          holeId: input.holeId,
        },
      );
    }
  } catch (error) {
    const message =
      error instanceof TrajectoryStationError || error instanceof Error
        ? error.message
        : "Trajectory calculation failed.";
    return {
      holeId: input.holeId,
      planned: plannedTrajectory,
      actual: actualTrajectory,
      trackingPoints: [],
      warnings: [
        ...warnings,
        {
          code: "CALCULATION_BLOCKED",
          severity: "blocker",
          message,
        },
      ],
      sourceVersions,
      blocked: true,
      blockReason: message,
    };
  }

  if (!input.actualConfiguration) {
    warnings.push({
      code: "CALCULATION_BLOCKED",
      severity: "blocker",
      message: "Actual collar direction is required for Survey trajectory.",
    });
  }

  const trackingPoints = [];
  if (plannedStations && actualStations && plannedTrajectory && actualTrajectory) {
    for (const survey of selectedSurveys) {
      const md = survey.depthDm / 10;
      const plannedPosition = getTrajectoryPositionAtMeasuredDepth(
        plannedStations,
        collar,
        md,
      );
      const actualPosition = getTrajectoryPositionAtMeasuredDepth(
        actualStations,
        collar,
        md,
      );
      if (!plannedPosition || !actualPosition) continue;
      trackingPoints.push(
        buildTrackingPoint({
          actualSurveyId: survey.localId,
          measuredDepthM: md,
          plannedPosition,
          actualPosition,
          tolerance: input.tolerance,
        }),
      );
    }
  }

  let targetTracking = undefined;
  if (input.target && plannedTrajectory && actualTrajectory) {
    sourceVersions.push({
      entityType: "holeTarget",
      entityId: input.target.id,
      version: input.target.version,
    });
    targetTracking = calculateTargetTracking({
      target: input.target,
      planned: plannedTrajectory,
      actual: actualTrajectory,
    });
    warnings.push(
      ...buildTargetWarnings(targetTracking, actualTrajectory, input.target),
    );
  }

  warnings.push(
    ...collectAdvisoryWarnings({
      planned: input.planned,
      actualConfig: input.actualConfiguration,
      coordinateConfiguration: input.coordinateConfiguration,
      surveys: input.surveys,
      plannedTrajectory,
      actualTrajectory,
      trackingPoints,
      holeCurrentDepthDm: input.holeCurrentDepthDm,
      target: input.target,
    }),
  );

  const blocked = warnings.some((warning) => warning.severity === "blocker");
  const currentTrackingPoint = trackingPoints.at(-1);

  return {
    holeId: input.holeId,
    planned: plannedTrajectory,
    actual: actualTrajectory,
    activePlanName: input.planned?.name,
    trackingPoints,
    currentTrackingPoint,
    targetTracking,
    warnings,
    sourceVersions,
    blocked,
    blockReason: blocked
      ? warnings.find((warning) => warning.severity === "blocker")?.message
      : undefined,
  };
}
