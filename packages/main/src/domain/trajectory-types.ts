import type { Decimetres } from "./measurements";
import type {
  IsoTimestamp,
  LocalId,
  NorthReference,
  SyncMetadata,
  SyncStatus,
} from "./models";

export type DesurveyMethod = "MINIMUM_CURVATURE";

export const TRAJECTORY_ENGINE_VERSION = "minimum-curvature-v1" as const;

/** |dip| >= this threshold triggers near-vertical azimuth-confidence handling. */
export const NEAR_VERTICAL_DIP_DEG = 85;

export type CoordinateMode = "RELATIVE" | "MINE_GRID";

export interface HoleCoordinateConfiguration extends SyncMetadata {
  readonly holeId: LocalId;
  readonly coordinateMode: CoordinateMode;
  readonly coordinateSystemName?: string;
  readonly epsgCode?: string;
  /** Collar Easting in decimetres (0.1 m). Relative mode uses 0. */
  readonly collarEastingDm?: number;
  readonly collarNorthingDm?: number;
  readonly collarRlDm?: number;
  readonly calculationNorthReference: NorthReference;
  readonly referenceConfigurationId?: LocalId;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export interface ReferenceConfiguration extends SyncMetadata {
  readonly holeId: LocalId;
  /**
   * Degrees added to grid azimuth to obtain true azimuth
   * (IQ-compatible sign convention).
   */
  readonly gridRotationDeg: number;
  /**
   * East-positive declination added to magnetic azimuth to obtain true azimuth.
   */
  readonly magneticDeclinationDeg: number;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export type PlannedTrajectoryStationType =
  | "COLLAR"
  | "CONTROL"
  | "TARGET_DEPTH"
  | "PLANNED_ENDPOINT";

export interface PlannedTrajectoryStation {
  readonly id: LocalId;
  readonly measuredDepthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: NorthReference;
  readonly stationType: PlannedTrajectoryStationType;
  readonly note?: string;
}

export type PlannedTrajectoryStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED";

/**
 * Target entry-direction modes.
 *
 * Canonical:
 * - AUTO_SMOOTH — solve smoothest path; endpoint dip/az free
 * - MATCH_ENTRY_DIRECTION — require target entry dip/az
 *
 * Legacy storage (migrated on read):
 * - UNCONSTRAINED → AUTO_SMOOTH
 * - CUSTOM → MATCH_ENTRY_DIRECTION
 * - SAME_AS_COLLAR → MATCH_ENTRY_DIRECTION using collar (kept for reproducibility)
 */
export type TargetAttitudeMode =
  | "AUTO_SMOOTH"
  | "MATCH_ENTRY_DIRECTION"
  | "SAME_AS_COLLAR"
  | "UNCONSTRAINED"
  | "CUSTOM";

export interface HoleTarget {
  readonly id: LocalId;
  readonly holeId: LocalId;
  readonly name: string;
  readonly coordinateMode: CoordinateMode;
  readonly eastingDm: number;
  readonly northingDm: number;
  readonly rlDm: number;
  /** Target sphere radius in decimetres. Diameter = 2 × radius. */
  readonly radiusDm?: number;
  readonly targetMeasuredDepthDm?: Decimetres;
  readonly attitudeMode: TargetAttitudeMode;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
  readonly note?: string;
  readonly version: number;
  readonly updatedAt: IsoTimestamp;
}

export interface PlannedHoleTrajectory extends SyncMetadata {
  readonly holeId: LocalId;
  readonly name: string;
  readonly description?: string;
  readonly northReference: NorthReference;
  readonly desurveyMethod: DesurveyMethod;
  readonly stations: readonly PlannedTrajectoryStation[];
  readonly targetId?: LocalId;
  readonly status: PlannedTrajectoryStatus;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export interface ActualTrajectoryConfiguration extends SyncMetadata {
  readonly holeId: LocalId;
  readonly collarDipTenths: number;
  readonly collarAzimuthTenths: number;
  readonly collarNorthReference: NorthReference;
  readonly desurveyMethod: DesurveyMethod;
  /** Default north reference offered when recording the next Survey. */
  readonly preferredSurveyNorthReference?: NorthReference;
  /** Default Survey interval in decimetres (0.1 m). Used for next-Survey guidance. */
  readonly preferredSurveyIntervalDm?: Decimetres;
  /** Maximum combined dogleg severity in tenths of a degree per 30 m. */
  readonly maximumDoglegPer30mTenths?: number;
  /** Maximum positive dip change (lift) in tenths of a degree per 30 m. */
  readonly maximumLiftPer30mTenths?: number;
  /** Maximum negative dip change (drop) in tenths of a degree per 30 m. */
  readonly maximumDropPer30mTenths?: number;
  /** Maximum absolute azimuth change in tenths of a degree per 30 m. */
  readonly maximumTurnPer30mTenths?: number;
  /** Changes smaller than this are presented as HOLD, in tenths of a degree. */
  readonly guidanceDeadbandTenths?: number;
}

export type TrajectorySurveySelectionReason =
  | "LATEST_READING"
  | "USER_SELECTED";

export interface TrajectorySurveySelection extends SyncMetadata {
  readonly holeId: LocalId;
  readonly depthDm: Decimetres;
  readonly selectedSurveyId: LocalId;
  readonly selectionReason: TrajectorySurveySelectionReason;
  readonly selectedByUserId?: LocalId;
  readonly selectedByNameSnapshot?: string;
  readonly selectedAt?: IsoTimestamp;
}

export type TrajectoryToleranceSource =
  | "PROJECT_CONFIGURED"
  | "DISPLAY_ONLY";

export interface TrajectoryTrackingTolerance extends SyncMetadata {
  readonly holeId: LocalId;
  readonly horizontalReviewDm?: number;
  readonly horizontalOutsideDm?: number;
  readonly verticalReviewDm?: number;
  readonly verticalOutsideDm?: number;
  readonly spatialReviewDm?: number;
  readonly spatialOutsideDm?: number;
  readonly dipReviewTenths?: number;
  readonly azimuthReviewTenths?: number;
  readonly source: TrajectoryToleranceSource;
}

export type TrajectoryStationSourceType =
  | "PLANNED"
  | "COLLAR"
  | "SURVEY";

export interface TrajectoryStationInput {
  readonly sourceType: TrajectoryStationSourceType;
  readonly sourceId?: LocalId;
  readonly measuredDepthDm: Decimetres;
  readonly dipTenths: number;
  readonly originalAzimuthTenths: number;
  readonly originalNorthReference: NorthReference;
  readonly calculationAzimuthTenths: number;
  readonly calculationNorthReference: NorthReference;
}

export interface TrajectoryCollar {
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly coordinateMode: CoordinateMode;
  readonly coordinateSystemName?: string;
  readonly calculationNorthReference: NorthReference;
}

export interface TrajectoryCalculationOptions {
  /** Maximum MD spacing between render-path samples (dm). Default 50 (5.0 m). */
  readonly maximumRenderSegmentDm?: Decimetres;
}

export type CalculatedStationSourceType =
  | "COLLAR"
  | "PLANNED"
  | "SURVEY"
  | "INTERPOLATED";

export interface CalculatedTrajectoryStation {
  readonly index: number;
  readonly sourceType: CalculatedStationSourceType;
  readonly sourceId?: LocalId;
  readonly measuredDepthM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly northReference: NorthReference;
  readonly relativeEastingM: number;
  readonly relativeNorthingM: number;
  /** Signed vertical movement relative to collar (positive = up). */
  readonly verticalDisplacementM: number;
  /** Positive distance below collar. */
  readonly tvdM: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly doglegDegreesFromPrevious?: number;
}

export interface TrajectoryBoundingBox {
  readonly minEastingM: number;
  readonly maxEastingM: number;
  readonly minNorthingM: number;
  readonly maxNorthingM: number;
  readonly minRlM: number;
  readonly maxRlM: number;
}

export type TrajectoryWarningCode =
  | "DUPLICATE_SURVEY_DEPTHS"
  | "LATEST_DUPLICATE_SELECTED"
  | "MIXED_REFERENCES_CONVERTED"
  | "UNSPECIFIED_REFERENCES"
  | "ACTUAL_DEEPER_THAN_PLAN"
  | "PLAN_DEEPER_THAN_HOLE"
  | "FIRST_SURVEY_FAR_FROM_COLLAR"
  | "LARGE_SURVEY_SPACING"
  | "NEAR_VERTICAL_AZIMUTH"
  | "LARGE_SAME_DEPTH_DEVIATION"
  | "PLANNED_ENDPOINT_OUTSIDE_TARGET"
  | "TARGET_ATTITUDE_DIFFERS"
  | "ACTUAL_PASSED_TARGET_MD"
  | "NO_TARGET_COORDINATES"
  | "COLLAR_ATTITUDE_DIFFERS"
  | "MINE_GRID_BLOCKED"
  | "CALCULATION_BLOCKED";

export type TrajectoryWarningSeverity = "info" | "warning" | "blocker";

export interface TrajectoryWarning {
  readonly code: TrajectoryWarningCode;
  readonly severity: TrajectoryWarningSeverity;
  readonly message: string;
  readonly stationIds?: readonly LocalId[];
}

export interface TrajectorySourceVersion {
  readonly entityType: string;
  readonly entityId: string;
  readonly version: number;
}

export interface CalculatedTrajectory {
  readonly trajectoryType: "PLANNED" | "ACTUAL";
  readonly holeId: LocalId;
  readonly coordinateMode: CoordinateMode;
  readonly coordinateSystemName?: string;
  readonly northReference: NorthReference;
  readonly desurveyMethod: DesurveyMethod;
  readonly engineVersion: typeof TRAJECTORY_ENGINE_VERSION;
  readonly collar: CalculatedTrajectoryStation;
  readonly stations: readonly CalculatedTrajectoryStation[];
  readonly renderPath: readonly CalculatedTrajectoryStation[];
  readonly endpoint: CalculatedTrajectoryStation;
  readonly measuredDepthM: number;
  readonly tvdM: number;
  readonly eastingDisplacementM: number;
  readonly northingDisplacementM: number;
  readonly verticalDisplacementM: number;
  readonly lateralDisplacementM: number;
  readonly boundingBox: TrajectoryBoundingBox;
  readonly warnings: readonly TrajectoryWarning[];
  readonly sourceVersions: readonly TrajectorySourceVersion[];
}

export interface CalculatedTrajectoryPosition {
  readonly measuredDepthM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly northReference: NorthReference;
  readonly relativeEastingM: number;
  readonly relativeNorthingM: number;
  readonly verticalDisplacementM: number;
  readonly tvdM: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly beyondEndpoint: boolean;
}

export type TrajectoryTrackingStatus =
  | "ON_TRACK"
  | "REVIEW"
  | "OUTSIDE_TOLERANCE";

export interface TrajectoryTrackingPoint {
  readonly actualSurveyId: LocalId;
  readonly measuredDepthM: number;
  readonly plannedPosition: CalculatedTrajectoryPosition;
  readonly actualPosition: CalculatedTrajectoryPosition;
  readonly deltaEastingM: number;
  readonly deltaNorthingM: number;
  readonly deltaRlM: number;
  readonly horizontalDeviationM: number;
  readonly verticalDeviationM: number;
  readonly spatialDeviationM: number;
  readonly plannedDipDegrees: number;
  readonly actualDipDegrees: number;
  readonly dipDifferenceDegrees: number;
  readonly plannedAzimuthDegrees: number;
  readonly actualAzimuthDegrees: number;
  readonly circularAzimuthDifferenceDegrees: number;
  readonly status: TrajectoryTrackingStatus;
}

export interface TargetTrackingResult {
  readonly targetId: LocalId;
  readonly targetEastingM: number;
  readonly targetNorthingM: number;
  readonly targetRlM: number;
  readonly targetRadiusM?: number;
  readonly actualEndpointDistanceM: number;
  readonly plannedEndpointDistanceM: number;
  readonly actualClosestApproachM: number;
  readonly actualClosestApproachMeasuredDepthM: number;
  readonly plannedClosestApproachM: number;
  readonly plannedClosestApproachMeasuredDepthM: number;
  readonly actualWithinTargetRadius?: boolean;
  readonly plannedWithinTargetRadius?: boolean;
  readonly endpointAttitudeDifference?: {
    readonly dipDifferenceDegrees?: number;
    readonly azimuthDifferenceDegrees?: number;
  };
}

export interface HoleTrajectoryComparison {
  readonly holeId: LocalId;
  readonly planned: CalculatedTrajectory | null;
  readonly actual: CalculatedTrajectory | null;
  readonly activePlanName?: string;
  readonly trackingPoints: readonly TrajectoryTrackingPoint[];
  readonly currentTrackingPoint?: TrajectoryTrackingPoint;
  readonly targetTracking?: TargetTrackingResult;
  readonly warnings: readonly TrajectoryWarning[];
  readonly sourceVersions: readonly TrajectorySourceVersion[];
  readonly blocked: boolean;
  readonly blockReason?: string;
  /** True when a hole tracking tolerance record was supplied to the comparison. */
  readonly toleranceConfigured: boolean;
  readonly toleranceSource?: TrajectoryToleranceSource;
}

export type SyncStatusAlias = SyncStatus;
