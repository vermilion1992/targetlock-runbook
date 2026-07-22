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

export const REPORT_GENERATION_STAGES = [
  "SNAPSHOT_BUILDING",
  "SNAPSHOT_SAVED",
  "DOCUMENT_GENERATED",
  "FILE_SAVED",
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

export interface ReportDocumentData {
  readonly holeId: LocalId;
  readonly holeName: string;
  readonly projectName: string;
  readonly rigName: string;
  readonly holeStatus: string;
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
  readonly disclosures: readonly string[];
}

export interface ReportSnapshot {
  readonly id: LocalId;
  readonly holeId: LocalId;
  readonly shiftId?: LocalId;
  readonly reportType: ReportType;
  readonly generatedAt: IsoTimestamp;
  readonly generatedByUserId: LocalId;
  readonly generatedByNameSnapshot: string;
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
