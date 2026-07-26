/**
 * Field-facing Mini TargetLock geometry.
 *
 * Computes curved recovery guidance, next-Survey KPIs, and current-attitude
 * projected miss from verified desurvey coordinates. Drill guidance is only
 * released when the recovery path fits the configured steering envelope.
 */

import {
  nextSurveyMeasuredDepth,
  solveCurvedTarget,
  type CurvedTargetSolution,
} from "./curved-target-solver";
import { migrateTargetAttitudeMode } from "./target-migration";
import {
  dipAzFromVector,
  normalizeAzimuthDegrees,
  shortestAzimuthDifferenceDegrees,
  vectorFromDipAz,
} from "./trajectory-geometry";
import {
  buildActualTrajectoryStations,
  TrajectoryStationError,
} from "./trajectory-stations";
import { calculateMinimumCurvatureTrajectory } from "./trajectory-desurvey";
import {
  validateCoordinateConfiguration,
  validateReferenceForMineGrid,
} from "./trajectory-validation";
import { decimetresToMetres } from "./measurements";
import type { NorthReference, Survey } from "./models";
import { NEAR_VERTICAL_DIP_DEG } from "./trajectory-types";
import type {
  ActualTrajectoryConfiguration,
  CalculatedTrajectory,
  CalculatedTrajectoryStation,
  HoleCoordinateConfiguration,
  HoleTarget,
  ReferenceConfiguration,
  TargetAttitudeMode,
  TrajectoryCollar,
  TrajectorySourceVersion,
  TrajectorySurveySelection,
  TrajectoryWarning,
} from "./trajectory-types";

export const DEFAULT_TARGET_DIAMETER_M = 6;
export const DEFAULT_GUIDANCE_DEADBAND_DEG = 0.2;

export type MiniTargetLockBlockCode =
  | "MISSING_COORDINATE_CONFIGURATION"
  | "MISSING_COLLAR_COORDINATES"
  | "MISSING_ACTUAL_CONFIGURATION"
  | "CALCULATION_ERROR";

export interface Coordinate3D {
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
}

export interface MiniTargetLockLatestSurvey {
  readonly measuredDepthM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly sourceType: CalculatedTrajectoryStation["sourceType"];
  readonly sourceId?: string;
}

export interface MiniTargetLockTarget {
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly diameterM: number;
  readonly measuredDepthM?: number;
  readonly attitudeMode: TargetAttitudeMode;
  readonly desiredDipDegrees?: number;
  readonly desiredAzimuthDegrees?: number;
  readonly desiredNorthReference?: NorthReference;
}

export interface MiniTargetLockNextSurveyGuidance {
  readonly measuredDepthM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly currentDipDegrees: number;
  readonly currentAzimuthDegrees: number;
  readonly requiredDipChangeDegrees: number;
  readonly requiredAzimuthChangeDegrees: number;
  readonly verticalAction: "LIFT" | "DROP" | "HOLD";
  readonly horizontalAction: "LEFT" | "RIGHT" | "HOLD" | "UNAVAILABLE";
  readonly dipAdjustmentDegrees: number;
  readonly azimuthAdjustmentDegrees: number;
  readonly actionDeadbandDegrees: number;
  readonly azimuthStable: boolean;
}

export interface MiniTargetLockDirectToTarget {
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly distanceM: number;
}

export interface MiniTargetLockRequiredChange {
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
}

export interface MiniTargetLockProjection {
  readonly closestApproachM: number;
  readonly missOutsideTargetM: number;
  readonly intersectsTarget: boolean;
  readonly closestApproachPosition: Coordinate3D;
  readonly projectedEndpoint: Coordinate3D;
  readonly endpointDistanceToTargetM: number;
  readonly endpointMissOutsideTargetM: number;
  readonly projectionLengthM: number;
  readonly projectedPath: readonly Coordinate3D[];
}

export interface MiniTargetLockResult {
  readonly holeId: string;
  readonly blocked: boolean;
  readonly blockCode?: MiniTargetLockBlockCode;
  readonly blockReason?: string;
  readonly calculationNorthReference?: NorthReference;
  readonly actualTrajectory: CalculatedTrajectory | null;
  readonly latestSurvey: MiniTargetLockLatestSurvey | null;
  readonly guidanceFromCollarOnly: boolean;
  readonly target: MiniTargetLockTarget | null;
  readonly surveyIntervalM: number | null;
  readonly nextSurveyMeasuredDepthM: number | null;
  readonly nextSurveyGuidance: MiniTargetLockNextSurveyGuidance | null;
  readonly curvedSolution: CurvedTargetSolution | null;
  readonly remainingMeasuredDepthM: number | null;
  readonly directToTarget: MiniTargetLockDirectToTarget | null;
  readonly requiredChange: MiniTargetLockRequiredChange | null;
  readonly projection: MiniTargetLockProjection | null;
  readonly warnings: readonly TrajectoryWarning[];
  readonly sourceVersions: readonly TrajectorySourceVersion[];
}

export interface CalculateMiniTargetLockInput {
  readonly holeId: string;
  readonly surveys: readonly Survey[];
  readonly coordinateConfiguration: HoleCoordinateConfiguration | null;
  readonly actualConfiguration: ActualTrajectoryConfiguration | null;
  readonly selections: readonly TrajectorySurveySelection[];
  readonly referenceConfiguration?: ReferenceConfiguration | null;
  readonly target?: HoleTarget | null;
}

export function resolveNextSurveyActions(input: {
  readonly currentDipDegrees: number;
  readonly targetDipDegrees: number;
  readonly dipChangeDegrees: number;
  readonly azimuthChangeDegrees: number;
  readonly deadbandDegrees?: number;
}): Pick<
  MiniTargetLockNextSurveyGuidance,
  | "verticalAction"
  | "horizontalAction"
  | "dipAdjustmentDegrees"
  | "azimuthAdjustmentDegrees"
  | "actionDeadbandDegrees"
  | "azimuthStable"
> {
  const deadband =
    input.deadbandDegrees !== undefined &&
    Number.isFinite(input.deadbandDegrees) &&
    input.deadbandDegrees >= 0
      ? input.deadbandDegrees
      : DEFAULT_GUIDANCE_DEADBAND_DEG;
  const dipAdjustmentDegrees = Math.abs(input.dipChangeDegrees);
  const azimuthAdjustmentDegrees = Math.abs(input.azimuthChangeDegrees);
  const azimuthStable =
    Math.abs(input.currentDipDegrees) < NEAR_VERTICAL_DIP_DEG &&
    Math.abs(input.targetDipDegrees) < NEAR_VERTICAL_DIP_DEG;

  return {
    verticalAction:
      dipAdjustmentDegrees <= deadband
        ? "HOLD"
        : input.dipChangeDegrees > 0
          ? "LIFT"
          : "DROP",
    horizontalAction: !azimuthStable
      ? "UNAVAILABLE"
      : azimuthAdjustmentDegrees <= deadband
        ? "HOLD"
        : input.azimuthChangeDegrees > 0
          ? "RIGHT"
          : "LEFT",
    dipAdjustmentDegrees,
    azimuthAdjustmentDegrees,
    actionDeadbandDegrees: deadband,
    azimuthStable,
  };
}

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

function blockedResult(
  holeId: string,
  blockCode: MiniTargetLockBlockCode,
  blockReason: string,
  warnings: readonly TrajectoryWarning[] = [],
  sourceVersions: readonly TrajectorySourceVersion[] = [],
  extras: {
    readonly target?: MiniTargetLockTarget | null;
    readonly surveyIntervalM?: number | null;
  } = {},
): MiniTargetLockResult {
  return {
    holeId,
    blocked: true,
    blockCode,
    blockReason,
    actualTrajectory: null,
    latestSurvey: null,
    guidanceFromCollarOnly: false,
    target: extras.target ?? null,
    surveyIntervalM: extras.surveyIntervalM ?? null,
    nextSurveyMeasuredDepthM: null,
    nextSurveyGuidance: null,
    curvedSolution: null,
    remainingMeasuredDepthM: null,
    directToTarget: null,
    requiredChange: null,
    projection: null,
    warnings,
    sourceVersions,
  };
}

function resolveMiniTarget(
  target: HoleTarget | null | undefined,
): MiniTargetLockTarget | null {
  if (!target) return null;
  const diameterM = targetDiameterM(target);
  const attitudeMode = migrateTargetAttitudeMode(target);
  const measuredDepthM =
    target.targetMeasuredDepthDm === undefined
      ? undefined
      : decimetresToMetres(target.targetMeasuredDepthDm);
  return {
    eastingM: target.eastingDm / 10,
    northingM: target.northingDm / 10,
    rlM: target.rlDm / 10,
    diameterM,
    measuredDepthM,
    attitudeMode,
    desiredDipDegrees:
      target.desiredDipTenths === undefined
        ? undefined
        : target.desiredDipTenths / 10,
    desiredAzimuthDegrees:
      target.desiredAzimuthTenths === undefined
        ? undefined
        : target.desiredAzimuthTenths / 10,
    desiredNorthReference: target.desiredNorthReference,
  };
}

export function targetDiameterM(target: HoleTarget): number {
  if (target.radiusDm === undefined) return DEFAULT_TARGET_DIAMETER_M;
  return (target.radiusDm / 10) * 2;
}

export function diameterMToRadiusDm(diameterM: number): number {
  return Math.round((diameterM / 2) * 10);
}

export function directToTargetFromPositions(
  from: Coordinate3D,
  to: Coordinate3D,
): MiniTargetLockDirectToTarget {
  const deltaE = to.eastingM - from.eastingM;
  const deltaN = to.northingM - from.northingM;
  const deltaRl = to.rlM - from.rlM;
  const distanceM = Math.hypot(deltaE, deltaN, deltaRl);
  if (distanceM < 1e-9) {
    return {
      dipDegrees: from.rlM === to.rlM ? 0 : -90,
      azimuthDegrees: 0,
      distanceM: 0,
    };
  }
  const attitude = dipAzFromVector({
    e: deltaE,
    n: deltaN,
    d: -deltaRl,
  });
  return {
    dipDegrees: attitude.dip,
    azimuthDegrees: normalizeAzimuthDegrees(attitude.azimuth),
    distanceM,
  };
}

/**
 * Closest approach of a ray from `origin` along current dip/azimuth to `target`.
 * Ray parameter t is measured depth extension in metres (t >= 0).
 */
export function projectAttitudeClosestApproach(input: {
  readonly origin: Coordinate3D;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly target: Coordinate3D;
  readonly targetRadiusM: number;
  /** Finite hold-attitude horizon, normally remaining MD to target MD. */
  readonly projectionLengthM?: number;
  /** @deprecated Use projectionLengthM for operational hold projections. */
  readonly sampleLengthM?: number;
}): MiniTargetLockProjection {
  const direction = vectorFromDipAz(input.dipDegrees, input.azimuthDegrees);
  // ENR direction: down-positive `d` becomes negative RL change.
  const dirE = direction.e;
  const dirN = direction.n;
  const dirRl = -direction.d;
  const dirLenSq = dirE * dirE + dirN * dirN + dirRl * dirRl;

  const relativeE = input.target.eastingM - input.origin.eastingM;
  const relativeN = input.target.northingM - input.origin.northingM;
  const relativeRl = input.target.rlM - input.origin.rlM;

  let t =
    dirLenSq < 1e-12
      ? 0
      : (relativeE * dirE + relativeN * dirN + relativeRl * dirRl) / dirLenSq;
  if (t < 0) t = 0;
  const finiteProjectionLength =
    input.projectionLengthM !== undefined &&
    Number.isFinite(input.projectionLengthM)
      ? Math.max(0, input.projectionLengthM)
      : undefined;
  if (finiteProjectionLength !== undefined) {
    t = Math.min(t, finiteProjectionLength);
  }

  const closestApproachPosition: Coordinate3D = {
    eastingM: input.origin.eastingM + dirE * t,
    northingM: input.origin.northingM + dirN * t,
    rlM: input.origin.rlM + dirRl * t,
  };

  const closestApproachM = Math.hypot(
    input.target.eastingM - closestApproachPosition.eastingM,
    input.target.northingM - closestApproachPosition.northingM,
    input.target.rlM - closestApproachPosition.rlM,
  );
  const missOutsideTargetM = Math.max(
    0,
    closestApproachM - input.targetRadiusM,
  );
  const intersectsTarget = closestApproachM <= input.targetRadiusM + 1e-9;

  const projectionLengthM =
    finiteProjectionLength ??
    input.sampleLengthM ??
    Math.max(
      Math.hypot(relativeE, relativeN, relativeRl) * 1.25,
      t + input.targetRadiusM * 2,
      50,
    );
  const projectedEndpoint: Coordinate3D = {
    eastingM: input.origin.eastingM + dirE * projectionLengthM,
    northingM: input.origin.northingM + dirN * projectionLengthM,
    rlM: input.origin.rlM + dirRl * projectionLengthM,
  };
  const endpointDistanceToTargetM = Math.hypot(
    input.target.eastingM - projectedEndpoint.eastingM,
    input.target.northingM - projectedEndpoint.northingM,
    input.target.rlM - projectedEndpoint.rlM,
  );
  const endpointMissOutsideTargetM = Math.max(
    0,
    endpointDistanceToTargetM - input.targetRadiusM,
  );
  const stepCount = 24;
  const projectedPath: Coordinate3D[] = [];
  for (let i = 0; i <= stepCount; i += 1) {
    const s = (projectionLengthM * i) / stepCount;
    projectedPath.push({
      eastingM: input.origin.eastingM + dirE * s,
      northingM: input.origin.northingM + dirN * s,
      rlM: input.origin.rlM + dirRl * s,
    });
  }

  return {
    closestApproachM,
    missOutsideTargetM,
    intersectsTarget,
    closestApproachPosition,
    projectedEndpoint,
    endpointDistanceToTargetM,
    endpointMissOutsideTargetM,
    projectionLengthM,
    projectedPath,
  };
}

function latestStation(
  trajectory: CalculatedTrajectory,
): CalculatedTrajectoryStation {
  return trajectory.stations[trajectory.stations.length - 1]!;
}

export function calculateMiniTargetLock(
  input: CalculateMiniTargetLockInput,
): MiniTargetLockResult {
  const warnings: TrajectoryWarning[] = [];
  const sourceVersions: TrajectorySourceVersion[] = [];
  const resolvedTarget = resolveMiniTarget(input.target);
  if (input.target) {
    sourceVersions.push({
      entityType: "target",
      entityId: input.target.id,
      version: input.target.version,
    });
  }
  const surveyIntervalM =
    input.actualConfiguration?.preferredSurveyIntervalDm === undefined
      ? null
      : decimetresToMetres(input.actualConfiguration.preferredSurveyIntervalDm);

  if (!input.coordinateConfiguration) {
    return blockedResult(
      input.holeId,
      "MISSING_COORDINATE_CONFIGURATION",
      "Hole coordinate configuration is required before trajectory calculation.",
      warnings,
      sourceVersions,
      { target: resolvedTarget, surveyIntervalM },
    );
  }

  const coordinateBlock = validateCoordinateConfiguration(
    input.coordinateConfiguration,
  );
  if (coordinateBlock) {
    const missingCoords =
      input.coordinateConfiguration.coordinateMode === "MINE_GRID" &&
      (input.coordinateConfiguration.collarEastingDm === undefined ||
        input.coordinateConfiguration.collarNorthingDm === undefined ||
        input.coordinateConfiguration.collarRlDm === undefined);
    return blockedResult(
      input.holeId,
      missingCoords
        ? "MISSING_COLLAR_COORDINATES"
        : "MISSING_COORDINATE_CONFIGURATION",
      missingCoords
        ? "Trajectory requires collar Easting, Northing and RL."
        : coordinateBlock.message,
      [coordinateBlock],
      sourceVersions,
      { target: resolvedTarget, surveyIntervalM },
    );
  }

  sourceVersions.push({
    entityType: "coordinateConfiguration",
    entityId: input.coordinateConfiguration.localId,
    version: input.coordinateConfiguration.version,
  });

  if (!input.actualConfiguration) {
    return blockedResult(
      input.holeId,
      "MISSING_ACTUAL_CONFIGURATION",
      "Collar direction is required before trajectory calculation.",
      warnings,
      sourceVersions,
      { target: resolvedTarget, surveyIntervalM },
    );
  }

  if (input.referenceConfiguration) {
    sourceVersions.push({
      entityType: "referenceConfiguration",
      entityId: input.referenceConfiguration.localId,
      version: input.referenceConfiguration.version,
    });
  }

  const stationRefs = [
    ...input.surveys.map((survey) => survey.northReference),
    input.actualConfiguration.collarNorthReference,
  ];
  const mineGridBlock = validateReferenceForMineGrid(
    input.coordinateConfiguration,
    input.referenceConfiguration,
    stationRefs,
  );
  if (mineGridBlock) {
    return blockedResult(
      input.holeId,
      "CALCULATION_ERROR",
      mineGridBlock.message,
      [mineGridBlock],
      sourceVersions,
      { target: resolvedTarget, surveyIntervalM },
    );
  }

  sourceVersions.push({
    entityType: "actualConfiguration",
    entityId: input.actualConfiguration.localId,
    version: input.actualConfiguration.version,
  });

  try {
    const collar = buildCollar(input.coordinateConfiguration);
    const built = buildActualTrajectoryStations(
      input.actualConfiguration,
      input.surveys,
      input.selections,
      input.coordinateConfiguration,
      input.referenceConfiguration,
      { allowCollarOnly: true },
    );
    warnings.push(...built.warnings);
    for (const survey of built.selectedSurveys) {
      sourceVersions.push({
        entityType: "survey",
        entityId: survey.localId,
        version: survey.version,
      });
    }

    const actualTrajectory = calculateMinimumCurvatureTrajectory(
      collar,
      built.stations,
      {
        trajectoryType: "ACTUAL",
        holeId: input.holeId,
        sourceVersions: sourceVersions.filter(
          (version) =>
            version.entityType === "actualConfiguration" ||
            version.entityType === "survey",
        ),
      },
    );

    const station = latestStation(actualTrajectory);
    const latestSurvey: MiniTargetLockLatestSurvey = {
      measuredDepthM: station.measuredDepthM,
      dipDegrees: station.dipDegrees,
      azimuthDegrees: station.azimuthDegrees,
      eastingM: station.eastingM,
      northingM: station.northingM,
      rlM: station.rlM,
      sourceType: station.sourceType,
      sourceId: station.sourceId,
    };
    const guidanceFromCollarOnly =
      station.sourceType === "COLLAR" ||
      !built.selectedSurveys.some((survey) => Number(survey.depthDm) > 0);
    const guidanceDeadbandDegrees =
      input.actualConfiguration.guidanceDeadbandTenths === undefined
        ? DEFAULT_GUIDANCE_DEADBAND_DEG
        : input.actualConfiguration.guidanceDeadbandTenths / 10;

    const target: MiniTargetLockTarget | null = resolvedTarget;
    let directToTarget: MiniTargetLockDirectToTarget | null = null;
    let requiredChange: MiniTargetLockRequiredChange | null = null;
    let projection: MiniTargetLockProjection | null = null;
    let curvedSolution: CurvedTargetSolution | null = null;
    let nextSurveyMeasuredDepthM: number | null = null;
    let nextSurveyGuidance: MiniTargetLockNextSurveyGuidance | null = null;
    let remainingMeasuredDepthM: number | null = null;

    if (target) {
      const diameterM = target.diameterM;
      const measuredDepthM = target.measuredDepthM;

      directToTarget = directToTargetFromPositions(latestSurvey, target);
      requiredChange = {
        dipDegrees: directToTarget.dipDegrees - latestSurvey.dipDegrees,
        azimuthDegrees: shortestAzimuthDifferenceDegrees(
          latestSurvey.azimuthDegrees,
          directToTarget.azimuthDegrees,
        ),
      };
      projection = projectAttitudeClosestApproach({
        origin: latestSurvey,
        dipDegrees: latestSurvey.dipDegrees,
        azimuthDegrees: latestSurvey.azimuthDegrees,
        target,
        targetRadiusM: diameterM / 2,
        projectionLengthM:
          measuredDepthM === undefined
            ? undefined
            : Math.max(0, measuredDepthM - latestSurvey.measuredDepthM),
      });

      if (measuredDepthM !== undefined && measuredDepthM > 0) {
        remainingMeasuredDepthM = measuredDepthM - latestSurvey.measuredDepthM;
        nextSurveyMeasuredDepthM = nextSurveyMeasuredDepth({
          latestMeasuredDepthM: latestSurvey.measuredDepthM,
          targetMeasuredDepthM: measuredDepthM,
          surveyIntervalM,
        });
        curvedSolution = solveCurvedTarget({
          currentStation: {
            measuredDepthM: latestSurvey.measuredDepthM,
            eastingM: latestSurvey.eastingM,
            northingM: latestSurvey.northingM,
            rlM: latestSurvey.rlM,
            dipDegrees: latestSurvey.dipDegrees,
            azimuthDegrees: latestSurvey.azimuthDegrees,
            northReference:
              input.coordinateConfiguration.calculationNorthReference,
          },
          target: {
            measuredDepthM,
            eastingM: target.eastingM,
            northingM: target.northingM,
            rlM: target.rlM,
            radiusM: diameterM / 2,
            attitudeMode: target.attitudeMode,
            desiredDipDegrees: target.desiredDipDegrees,
            desiredAzimuthDegrees: target.desiredAzimuthDegrees,
            desiredNorthReference: target.desiredNorthReference,
          },
          collarAttitude: {
            dipDegrees: input.actualConfiguration.collarDipTenths / 10,
            azimuthDegrees: input.actualConfiguration.collarAzimuthTenths / 10,
            northReference: input.actualConfiguration.collarNorthReference,
          },
          nextSurveyMeasuredDepthM:
            nextSurveyMeasuredDepthM ?? undefined,
          calculationReference:
            input.coordinateConfiguration.calculationNorthReference,
          referenceConfiguration: input.referenceConfiguration,
          steeringLimits: {
            maximumDoglegPer30mDegrees:
              input.actualConfiguration.maximumDoglegPer30mTenths === undefined
                ? undefined
                : input.actualConfiguration.maximumDoglegPer30mTenths / 10,
            maximumLiftPer30mDegrees:
              input.actualConfiguration.maximumLiftPer30mTenths === undefined
                ? undefined
                : input.actualConfiguration.maximumLiftPer30mTenths / 10,
            maximumDropPer30mDegrees:
              input.actualConfiguration.maximumDropPer30mTenths === undefined
                ? undefined
                : input.actualConfiguration.maximumDropPer30mTenths / 10,
            maximumTurnPer30mDegrees:
              input.actualConfiguration.maximumTurnPer30mTenths === undefined
                ? undefined
                : input.actualConfiguration.maximumTurnPer30mTenths / 10,
          },
          holeId: input.holeId,
        });

        const guidanceBlocked = curvedSolution.warnings.some(
          (warning) =>
            warning.code === "TARGET_MD_REVIEW_REQUIRED" ||
            warning.code === "ADVANCED_PATH_REVIEW_REQUIRED" ||
            warning.code === "STEERING_LIMIT_EXCEEDED",
        );
        if (
          !guidanceBlocked &&
          curvedSolution.nextSurveyTarget &&
          nextSurveyMeasuredDepthM !== null
        ) {
          const next = curvedSolution.nextSurveyTarget;
          const requiredDipChangeDegrees =
            next.dipDegrees - latestSurvey.dipDegrees;
          const requiredAzimuthChangeDegrees =
            shortestAzimuthDifferenceDegrees(
              latestSurvey.azimuthDegrees,
              next.azimuthDegrees,
            );
          nextSurveyGuidance = {
            measuredDepthM: next.measuredDepthM,
            dipDegrees: next.dipDegrees,
            azimuthDegrees: next.azimuthDegrees,
            currentDipDegrees: latestSurvey.dipDegrees,
            currentAzimuthDegrees: latestSurvey.azimuthDegrees,
            requiredDipChangeDegrees,
            requiredAzimuthChangeDegrees,
            ...resolveNextSurveyActions({
              currentDipDegrees: latestSurvey.dipDegrees,
              targetDipDegrees: next.dipDegrees,
              dipChangeDegrees: requiredDipChangeDegrees,
              azimuthChangeDegrees: requiredAzimuthChangeDegrees,
              deadbandDegrees: guidanceDeadbandDegrees,
            }),
          };
        }
      }
    }

    return {
      holeId: input.holeId,
      blocked: false,
      calculationNorthReference:
        input.coordinateConfiguration.calculationNorthReference,
      actualTrajectory,
      latestSurvey,
      guidanceFromCollarOnly,
      target,
      surveyIntervalM,
      nextSurveyMeasuredDepthM,
      nextSurveyGuidance,
      curvedSolution,
      remainingMeasuredDepthM,
      directToTarget,
      requiredChange,
      projection,
      warnings,
      sourceVersions,
    };
  } catch (error) {
    const message =
      error instanceof TrajectoryStationError || error instanceof Error
        ? error.message
        : "Unable to calculate trajectory.";
    return blockedResult(
      input.holeId,
      "CALCULATION_ERROR",
      message,
      warnings,
      sourceVersions,
      { target: resolvedTarget, surveyIntervalM },
    );
  }
}
