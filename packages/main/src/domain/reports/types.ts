import type { Decimetres } from "../measurements";
import type {
  IsoTimestamp,
  LocalId,
  SyncStatus,
} from "../models";

export const REPORT_TYPES = [
  "CURRENT_SHIFT_RUNBOOK",
  "FULL_HOLE_RUNBOOK",
  "HOLE_SUMMARY",
  "SURVEY_HISTORY",
  "TRAY_REGISTER",
  "COMPONENT_HISTORY",
  "CASING_HISTORY",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_FORMATS = ["PDF", "XLSX", "CSV"] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const CSV_DATASET_NAMES = [
  "runs",
  "shifts",
  "surveys",
  "trays",
  "casing",
  "components",
  "corrections",
] as const;

export type CsvDatasetName = (typeof CSV_DATASET_NAMES)[number];

export const CSV_DATASET_LABELS: Readonly<Record<CsvDatasetName, string>> = {
  runs: "Runs",
  shifts: "Shifts",
  surveys: "Surveys",
  trays: "Trays",
  casing: "Casing",
  components: "Components",
  corrections: "Corrections",
};

export const CSV_DATASETS_BY_REPORT: Readonly<
  Record<ReportType, readonly CsvDatasetName[]>
> = {
  FULL_HOLE_RUNBOOK: [
    "runs",
    "shifts",
    "surveys",
    "trays",
    "casing",
    "components",
    "corrections",
  ],
  CURRENT_SHIFT_RUNBOOK: ["runs", "shifts"],
  HOLE_SUMMARY: ["runs", "shifts", "corrections"],
  SURVEY_HISTORY: ["surveys", "corrections"],
  TRAY_REGISTER: ["trays"],
  COMPONENT_HISTORY: ["components"],
  CASING_HISTORY: ["casing"],
};

export function defaultCsvDatasetForReport(
  reportType: ReportType,
): CsvDatasetName {
  return CSV_DATASETS_BY_REPORT[reportType][0];
}

export function isCsvDatasetCompatible(
  reportType: ReportType,
  dataset: CsvDatasetName,
): boolean {
  return CSV_DATASETS_BY_REPORT[reportType].includes(dataset);
}

export const REPORT_GENERATION_STAGES = [
  "SNAPSHOT_BUILDING",
  "SNAPSHOT_SAVED",
  "DOCUMENT_GENERATING",
  "DOCUMENT_GENERATED",
  "FILE_SAVING",
  /** @deprecated Prefer FILE_VERIFIED; retained for resume of V1 envelopes. */
  "FILE_SAVED",
  "FILE_VERIFIED",
  "METADATA_SAVED",
  "COMPLETED",
  "FAILED",
] as const;

export type ReportGenerationStage = (typeof REPORT_GENERATION_STAGES)[number];

export const REPORT_ACTIVITY_STATUSES = [
  "GENERATING",
  "GENERATED",
  "DOWNLOADED",
  "SHARED",
  "EMAIL_DRAFT",
  "FAILED",
] as const;

export type ReportActivityStatus = (typeof REPORT_ACTIVITY_STATUSES)[number];

export const REPORT_DISPATCH_STATUSES = [
  "DRAFT",
  "READY_TO_SHARE",
  "SHARED",
  "QUEUED_FOR_FUTURE_PROVIDER",
  "FAILED",
  "CANCELLED",
] as const;

export type ReportDispatchStatus = (typeof REPORT_DISPATCH_STATUSES)[number];

export const REPORT_TYPE_LABELS: Readonly<Record<ReportType, string>> = {
  CURRENT_SHIFT_RUNBOOK: "Current-Shift Runbook",
  FULL_HOLE_RUNBOOK: "Full-Hole Runbook",
  HOLE_SUMMARY: "Hole Summary",
  SURVEY_HISTORY: "Survey History",
  TRAY_REGISTER: "Tray Register",
  COMPONENT_HISTORY: "Component History",
  CASING_HISTORY: "Casing History",
};

export interface ReportSourceVersion {
  readonly entityType: string;
  readonly entityId: LocalId;
  readonly version: number;
}

export interface ReportRunsheetRow {
  readonly runNumber: number;
  readonly runId: LocalId;
  readonly shiftId?: LocalId;
  readonly shiftLabel?: string;
  readonly shared: boolean;
  readonly rodNumber: number;
  readonly rodAddedDm: Decimetres;
  readonly rodStringDm: Decimetres;
  readonly stickUpDm: Decimetres;
  readonly holeDepthDm: Decimetres;
  readonly drilledDm: Decimetres;
  readonly recoveredDm: Decimetres;
  readonly recoveryPercentTenths: number;
}

export interface ReportShiftSection {
  readonly shiftId: LocalId;
  readonly shiftType: string;
  readonly shiftDate: string;
  readonly label: string;
  readonly primaryDrillerName: string;
  readonly crewNames: readonly string[];
  readonly startingDepthDm: Decimetres;
  readonly endingDepthDm: Decimetres;
  readonly handoverNote?: string;
  readonly runIds: readonly LocalId[];
  readonly sharedRunIds: readonly LocalId[];
}

export interface ReportSurveyRow {
  readonly surveyId: LocalId;
  readonly depthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: string;
  readonly toolName: string;
  readonly toolSerial: string;
  readonly recordedAt: IsoTimestamp;
  readonly corrected: boolean;
}

export interface ReportTrayRow {
  readonly trayId: LocalId;
  readonly trayNumber: number;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm: Decimetres;
  readonly relatedRunNumbers: readonly number[];
  readonly photoDate?: IsoTimestamp;
  readonly finalPartial: boolean;
}

export interface ReportComponentRow {
  readonly assignmentId: LocalId;
  readonly componentType: "BIT" | "REAMER";
  readonly serialNumber: string;
  readonly manufacturer: string;
  readonly modelOrMatrix: string;
  readonly size: string;
  readonly status: string;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly recordedMetresDm: Decimetres;
  readonly runsTouched: number;
  readonly recoveryOrEstimateLabel: string;
  readonly isEstimate: boolean;
  readonly installedAt: IsoTimestamp;
  readonly removedAt?: IsoTimestamp;
  readonly removalReason?: string;
}

export interface ReportCasingEventRow {
  readonly eventId: LocalId;
  readonly casingId: LocalId;
  readonly casingSize: string;
  readonly eventType: string;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly status: string;
  readonly comment?: string;
  readonly userName: string;
  readonly recordedAt: IsoTimestamp;
}

export interface ReportCorrectionRow {
  readonly correctionId: LocalId;
  readonly entityType: string;
  readonly entityId: LocalId;
  readonly fieldName: string;
  readonly previousValue: string;
  readonly correctedValue: string;
  readonly reason: string;
  readonly correctedByName: string;
  readonly correctedAt: IsoTimestamp;
}

export interface ReportStatistics {
  readonly totalRuns: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly weightedRecoveryPercentTenths: number;
  readonly totalLossDm: Decimetres;
  readonly totalGainDm: Decimetres;
  readonly surveyCount: number;
  readonly trayCount: number;
  readonly shiftCount: number;
}

/** Serialised HoleAnalytics for Full-Hole / Hole Summary reports. */
export interface ReportHoleAnalytics {
  readonly completionId?: string;
  readonly calculatedAt: string;
  readonly startingDepthDm: Decimetres;
  readonly currentOrFinalDepthDm: Decimetres;
  readonly plannedDepthDm: Decimetres;
  readonly differenceFromPlannedDm: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
  readonly totalCoreLossDm: Decimetres;
  readonly totalCoreGainDm: Decimetres;
  readonly totalCompletedRuns: number;
  readonly totalVoidedRuns: number;
  readonly totalCorrectedRuns: number;
  readonly averageRunLengthDm?: Decimetres;
  readonly medianRunLengthDm?: Decimetres;
  readonly completedShifts: number;
  readonly dayShifts: number;
  readonly nightShifts: number;
  readonly sharedRuns: number;
  readonly averageMetresPerCompletedShiftDm?: Decimetres;
  readonly medianMetresPerCompletedShiftDm?: Decimetres;
  readonly rodsAdded3m: number;
  readonly rodsAdded6m: number;
  readonly rodsRemoved: number;
  readonly bitsUsed: number;
  readonly reamersUsed: number;
  readonly surveyCount: number;
  readonly trayCount: number;
  readonly mixedNorthReferences: boolean;
  readonly mixedNorthReferenceWarning?: string;
  readonly completeness: readonly {
    readonly category: string;
    readonly status: string;
    readonly notes: readonly string[];
  }[];
  readonly chartSummaries: readonly {
    readonly chart: string;
    readonly summary: string;
  }[];
  readonly shiftRows: readonly {
    readonly shiftId: string;
    readonly shiftType: string;
    readonly shiftDate: string;
    readonly metresCompletedDm: Decimetres;
    readonly endingDepthDm: Decimetres;
    readonly weightedRecoveryTenths?: number;
    readonly analyticsAmended: boolean;
  }[];
  readonly runRows: readonly {
    readonly runNumber: number;
    readonly depthDm: number;
    readonly drilledLengthDm: number;
    readonly recoveryPercentTenths: number;
    readonly lossDm: number;
    readonly gainDm: number;
  }[];
  readonly componentRows: readonly {
    readonly componentType: string;
    readonly serialNumber: string;
    readonly startDepthDm: number;
    readonly endDepthDm: number;
    readonly recordedMetresDm: number;
    readonly observedRecoveryTenths?: number;
    readonly recoveryEstimateStatus: string;
    readonly partialBoundaryRuns: number;
  }[];
}

/** Serialised ShiftAnalytics for Current-Shift reports (shared calculator). */
export interface ReportShiftAnalytics {
  readonly shiftId: LocalId;
  readonly startingDepthDm: Decimetres;
  readonly endingDepthDm: Decimetres;
  readonly metresCompletedDm: Decimetres;
  readonly completedRunCount: number;
  readonly sharedRunCount: number;
  readonly voidedRunCount: number;
  readonly runCorrectionCount: number;
  readonly averageRunLengthDm?: Decimetres;
  readonly medianRunLengthDm?: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
  readonly totalCoreLossDm: Decimetres;
  readonly totalCoreGainDm: Decimetres;
  readonly startingRodNumber: number;
  readonly endingRodNumber: number;
  readonly rodsAdded3m: number;
  readonly rodsAdded6m: number;
  readonly rodsRemoved: number;
  readonly startingRodStringDm: Decimetres;
  readonly endingRodStringDm: Decimetres;
  readonly surveyCount: number;
  readonly trayCount: number;
  readonly casingEventCount: number;
  readonly bitChangeCount: number;
  readonly reamerChangeCount: number;
  readonly elapsedMinutes?: number;
  readonly grossMetresPerElapsedHourTenths?: number;
  readonly averageRecordedRunCycleMinutes?: number;
  readonly medianRecordedRunCycleMinutes?: number;
  readonly unresolvedItems: readonly string[];
}

export type ReportOperatorRole = "DRILLER" | "SUPERVISOR" | "COMPANY_ADMIN";

export interface ReportGeneratedBySnapshot {
  readonly userId: LocalId;
  readonly displayName: string;
  readonly role?: ReportOperatorRole;
}

export interface ReportCollarSnapshot {
  /** Recorded collar coordinates in metres; no CRS conversion is performed. */
  readonly eastingM?: number;
  readonly northingM?: number;
  readonly rlM?: number;
  readonly dipDegrees?: number;
  readonly azimuthDegrees?: number;
  readonly northReference?: string;
  readonly coordinateMode?: "RELATIVE" | "MINE_GRID";
  readonly coordinateSystemName?: string;
  readonly epsgCode?: string;
}

export interface ReportDocumentData {
  readonly holeId: LocalId;
  readonly holeName: string;
  readonly projectName: string;
  readonly projectCode?: string;
  readonly clientName?: string;
  readonly siteLocation?: string;
  readonly rigName: string;
  readonly holeStatus: string;
  readonly collar?: ReportCollarSnapshot;
  /** Human-readable source grid/CRS label, never an inferred geographic CRS. */
  readonly coordinateSystemLabel?: string;
  /** Copied from generation metadata so the immutable document stands alone. */
  readonly generatedBy?: ReportGeneratedBySnapshot;
  readonly reportVersion?: number;
  readonly reportGeneratedAt?: IsoTimestamp;
  readonly currentOrFinalDepthDm: Decimetres;
  readonly plannedDepthDm: Decimetres;
  readonly completion?: {
    readonly reason: string;
    readonly comment?: string;
    readonly completedByName: string;
    readonly completedAt: IsoTimestamp;
    readonly finalStatus: string;
    readonly warningAcknowledgements: readonly string[];
  };
  readonly shifts: readonly ReportShiftSection[];
  readonly runsheet: readonly ReportRunsheetRow[];
  readonly rodEvents: readonly {
    readonly eventId: LocalId;
    readonly action: string;
    readonly rodLengthDm: Decimetres;
    readonly recordedAt: IsoTimestamp;
    readonly userName: string;
  }[];
  readonly rodConfigurationSummary: string;
  readonly currentRodState: string;
  readonly casingSummary: string;
  readonly casingEvents: readonly ReportCasingEventRow[];
  readonly bits: readonly ReportComponentRow[];
  readonly reamers: readonly ReportComponentRow[];
  readonly surveys: readonly ReportSurveyRow[];
  readonly surveySummary: {
    readonly total: number;
    readonly firstDepthDm?: Decimetres;
    readonly latestDepthDm?: Decimetres;
    readonly averageSpacingDm?: Decimetres;
    readonly largestGapDm?: Decimetres;
    readonly duplicateDepthCount: number;
    readonly correctionCount: number;
  };
  readonly trays: readonly ReportTrayRow[];
  readonly corrections: readonly ReportCorrectionRow[];
  readonly timelineSummary: readonly string[];
  readonly significantEvents: readonly string[];
  readonly statistics: ReportStatistics;
  readonly activeBitSummary?: string;
  readonly activeReamerSummary?: string;
  readonly latestSurveySummary?: string;
  readonly currentTraySummary?: string;
  readonly currentShift?: ReportShiftSection;
  /** Present on Current-Shift reports generated after V2 analytics. */
  readonly shiftAnalytics?: ReportShiftAnalytics;
  /** Present on Full-Hole and Hole Summary reports after V2 hole analytics. */
  readonly holeAnalytics?: ReportHoleAnalytics;
  /** Present when planned/actual trajectory comparison is available. */
  readonly trajectorySummary?: ReportTrajectorySummary;
  readonly disclosures: readonly string[];
}

export interface ReportTrajectoryPathPoint {
  readonly measuredDepthM: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
}

export interface ReportTrajectorySummary {
  readonly activePlanName?: string;
  readonly coordinateMode?: string;
  readonly coordinateSystemName?: string;
  readonly desurveyMethod: string;
  readonly engineVersion: string;
  readonly latestSurveyDepthM?: number;
  readonly plannedEastingM?: number;
  readonly plannedNorthingM?: number;
  readonly plannedRlM?: number;
  readonly actualEastingM?: number;
  readonly actualNorthingM?: number;
  readonly actualRlM?: number;
  readonly horizontalDeviationM?: number;
  readonly verticalDeviationM?: number;
  readonly spatialDeviationM?: number;
  readonly distanceToTargetM?: number;
  readonly plannedEndpointDistanceToTargetM?: number;
  readonly closestApproachM?: number;
  readonly projectedMissOutsideTargetM?: number;
  readonly warningCount: number;
  readonly sectionBearingDegrees?: number | null;
  readonly targetEastingM?: number;
  readonly targetNorthingM?: number;
  readonly targetRlM?: number;
  readonly targetRadiusM?: number;
  readonly targetDiameterM?: number;
  readonly targetMeasuredDepthM?: number;
  readonly targetAttitudeMode?: string;
  readonly targetDesiredDipDegrees?: number;
  readonly targetDesiredAzimuthDegrees?: number;
  readonly nextSurveyMeasuredDepthM?: number;
  readonly nextSurveyDipDegrees?: number;
  readonly nextSurveyAzimuthDegrees?: number;
  readonly geometricGuidanceDisclaimer?: string;
  readonly curvedRecoveryPath?: readonly ReportTrajectoryPathPoint[];
  /** Dense render-path samples copied from verified comparison (not recalculated). */
  readonly plannedRenderPath?: readonly ReportTrajectoryPathPoint[];
  readonly actualRenderPath?: readonly ReportTrajectoryPathPoint[];
  readonly plannedStations: readonly {
    readonly measuredDepthM: number;
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly tvdM: number;
  }[];
  readonly actualStations: readonly {
    readonly measuredDepthM: number;
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly tvdM: number;
  }[];
  readonly trackingRows: readonly {
    readonly measuredDepthM: number;
    readonly deltaEastingM: number;
    readonly deltaNorthingM: number;
    readonly deltaRlM: number;
    readonly spatialDeviationM: number;
    readonly status: string;
  }[];
}

export interface ReportSnapshot {
  readonly id: LocalId;
  readonly holeId: LocalId;
  readonly shiftId?: LocalId;
  readonly reportType: ReportType;
  readonly generatedAt: IsoTimestamp;
  readonly generatedByUserId: LocalId;
  readonly generatedByNameSnapshot: string;
  readonly generatedByRoleSnapshot?: ReportOperatorRole;
  readonly holeDepthSnapshotDm: Decimetres;
  readonly holeStatusSnapshot: string;
  readonly sourceVersions: readonly ReportSourceVersion[];
  readonly documentData: ReportDocumentData;
  readonly operationId: string;
  readonly version: number;
}

export interface GeneratedReportRecord {
  readonly localId: LocalId;
  readonly holeId: LocalId;
  readonly snapshotId: LocalId;
  readonly reportType: ReportType;
  readonly format: ReportFormat;
  readonly version: number;
  readonly filename: string;
  readonly mimeType: string;
  readonly storageKey: string;
  readonly sizeBytes: number;
  readonly generatedAt: IsoTimestamp;
  readonly generatedByUserId: LocalId;
  readonly generatedByNameSnapshot: string;
  readonly generatedByRoleSnapshot?: ReportOperatorRole;
  readonly holeDepthSnapshotDm: Decimetres;
  readonly holeStatusSnapshot: string;
  readonly activityStatus: ReportActivityStatus;
  readonly operationId: string;
  readonly csvDataset?: string;
  readonly syncStatus: SyncStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly versionMeta: number;
}

export interface ReportGenerationTransaction {
  readonly operationId: string;
  readonly holeId: LocalId;
  readonly reportType: ReportType;
  readonly format: ReportFormat;
  readonly fingerprint: string;
  readonly stage: ReportGenerationStage;
  readonly completedStages: readonly ReportGenerationStage[];
  readonly snapshotId?: LocalId;
  readonly storageKey?: string;
  readonly reportRecordId?: LocalId;
  readonly failureReason?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface SavedReportRecipient {
  readonly id: LocalId;
  readonly projectId?: LocalId;
  readonly holeId?: LocalId;
  readonly displayName?: string;
  readonly email: string;
  readonly scope: "ORGANISATION" | "PROJECT" | "HOLE";
  readonly isDefault: boolean;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly syncStatus: SyncStatus;
  readonly version: number;
}

export interface ReportOutboxItem {
  readonly localId: LocalId;
  readonly holeId: LocalId;
  readonly reportRecordId: LocalId;
  readonly reportVersion: number;
  readonly toRecipients: readonly string[];
  readonly ccRecipients: readonly string[];
  readonly subject: string;
  readonly message: string;
  readonly attachmentFilename: string;
  readonly attachmentStorageKey: string;
  readonly status: ReportDispatchStatus;
  readonly failureReason?: string;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
  readonly createdAt: IsoTimestamp;
  readonly lastAttemptedAt?: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly syncStatus: SyncStatus;
  readonly version: number;
}

export interface SavedReportFile {
  readonly storageKey: string;
  readonly operationId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}
