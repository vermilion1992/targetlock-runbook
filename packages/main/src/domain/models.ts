import type { Decimetres } from "./measurements";
import type { RodEventAction, RodLength } from "./rods";

export type LocalId = string;
export type ServerId = string;
export type IsoTimestamp = string;

export type SyncStatus =
  | "local-only"
  | "queued"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export interface SyncMetadata {
  readonly localId: LocalId;
  readonly serverId: ServerId | null;
  readonly syncStatus: SyncStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly deviceId: string;
  readonly version: number;
}

export interface Organisation extends SyncMetadata {
  readonly name: string;
  readonly code: string;
}

export type UserRole =
  | "administrator"
  | "supervisor"
  | "driller"
  | "geologist"
  | "viewer";

export interface User extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly givenName: string;
  readonly familyName: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: UserRole;
  readonly active: boolean;
}

export interface Project extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly code: string;
  readonly name: string;
  readonly clientName: string;
  readonly location: string;
  readonly status: "planned" | "active" | "completed" | "archived";
}

export interface Rig extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly projectId: LocalId;
  readonly name: string;
  readonly serialNumber: string;
  readonly model: string;
  readonly status: "available" | "operating" | "maintenance" | "retired";
}

export type HoleSize = "PQ" | "HQ" | "NQ" | "BQ";

export const HOLE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "COMPLETION_REVIEW",
  "COMPLETED",
  "ABANDONED",
  "ARCHIVED",
] as const;

/** Canonical lifecycle values used by Stage 5 and later records. */
export type HoleStatus = (typeof HOLE_STATUSES)[number];

/**
 * Stage 1–4 persisted these lowercase values. They remain readable at the
 * storage boundary and are normalized before lifecycle decisions are made.
 */
export type LegacyHoleStatus =
  | "planned"
  | "drilling"
  | "suspended"
  | "completed";

export type PersistedHoleStatus = HoleStatus | LegacyHoleStatus;

export const HOLE_STATUS_LABELS: Readonly<Record<HoleStatus, string>> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  COMPLETION_REVIEW: "Completion review",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
  ARCHIVED: "Archived",
};

export interface Hole extends SyncMetadata {
  readonly projectId: LocalId;
  readonly rigId: LocalId;
  readonly name: string;
  readonly holeSize: HoleSize;
  readonly plannedDepth: Decimetres;
  readonly currentDepth: Decimetres;
  readonly status: PersistedHoleStatus;
  readonly collarEasting: number;
  readonly collarNorthing: number;
  readonly collarElevation: number;
}

export interface HoleConfiguration extends SyncMetadata {
  readonly holeId: LocalId;
  readonly effectiveAt: IsoTimestamp;
  readonly holeSize: HoleSize;
  readonly plannedDepth: Decimetres;
  readonly preferredSurveyIntervalDm?: Decimetres;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly holeDiameterMillimetres: number;
  readonly reason: string;
}

export interface RodStringConfiguration extends SyncMetadata {
  readonly holeId: LocalId;
  readonly effectiveAt: IsoTimestamp;
  readonly bottomHoleAssemblyLength: Decimetres;
  readonly constantStickUp: Decimetres;
  readonly baseRodStringLength: Decimetres;
  readonly reason: string;
}

/**
 * A rod event. The Stage 1 name is retained for compatibility, while `action`
 * explicitly supports both additions and removals.
 */
export interface RodAddition extends SyncMetadata {
  readonly holeId: LocalId;
  readonly runId: LocalId | null;
  readonly shiftId: LocalId | null;
  readonly sequence: number;
  readonly action: RodEventAction;
  readonly rodLength: RodLength;
  /** Physical rod position added or removed by this event. */
  readonly affectedRodNumber: number;
  readonly rodNumberAfterEvent: number;
  readonly occurredAt: IsoTimestamp;
  readonly recordedByUserId: LocalId;
  readonly recordedByNameSnapshot: string;
}

export type ShiftType = "DAY" | "NIGHT";
export type RunbookShiftType = ShiftType;
export type ShiftStatus = "OPEN" | "HANDOVER_PENDING" | "CLOSED";

export interface ShiftCrewMember {
  readonly userId?: LocalId;
  readonly name: string;
  readonly role?: string;
}

/**
 * Immutable analytics captured at Shift close for amendment comparison.
 * Derived values only — never manually edited.
 */
export interface ShiftAnalyticsCloseSnapshot {
  readonly capturedAt: IsoTimestamp;
  readonly startingDepthDm: Decimetres;
  readonly endingDepthDm: Decimetres;
  readonly metresCompletedDm: Decimetres;
  readonly completedRunCount: number;
  readonly totalRecoveredDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
  readonly totalCoreLossDm: Decimetres;
  readonly totalCoreGainDm: Decimetres;
  readonly rodsAdded3m: number;
  readonly rodsAdded6m: number;
  readonly rodsRemoved: number;
}

export interface RunbookShift extends SyncMetadata {
  readonly holeId: LocalId;
  readonly rigId: LocalId;
  readonly shiftType: ShiftType;
  /** Operational date on which the shift began; it does not roll at midnight. */
  readonly shiftDate: string;
  readonly primaryDrillerId: LocalId;
  readonly primaryDrillerNameSnapshot: string;
  readonly crewMembers: readonly ShiftCrewMember[];
  readonly startedAt: IsoTimestamp;
  readonly closedAt?: IsoTimestamp;
  readonly startingDepthDm: Decimetres;
  readonly endingDepthDm?: Decimetres;
  readonly startingRodNumber: number;
  readonly endingRodNumber?: number;
  readonly startingRodStringDm: Decimetres;
  readonly endingRodStringDm?: Decimetres;
  readonly startingMeasuredStickUpDm?: Decimetres;
  readonly endingMeasuredStickUpDm?: Decimetres;
  readonly startingRunNumber: number;
  readonly endingRunNumber?: number;
  readonly handoverNote?: string;
  readonly handoverRunId?: LocalId;
  readonly handoverRunNumber?: number;
  readonly handoverAcceptedBy?: LocalId;
  readonly handoverAcceptedByNameSnapshot?: string;
  readonly handoverAcceptedAt?: IsoTimestamp;
  readonly status: ShiftStatus;
  /**
   * Immutable analytics captured at Shift close. Written once; never replaced
   * by post-close Run corrections. See domain/shift-analytics.ts.
   */
  readonly closeAnalyticsSnapshot?: ShiftAnalyticsCloseSnapshot;
}

export interface Run extends SyncMetadata {
  readonly holeId: LocalId;
  readonly startedShiftId: LocalId;
  readonly completedShiftId: LocalId | null;
  readonly runNumber: number;
  readonly rodNumber: number;
  readonly startedAt: IsoTimestamp;
  readonly startedByUserId: LocalId;
  readonly startedByNameSnapshot: string;
  readonly completedAt: IsoTimestamp | null;
  readonly completedByUserId: LocalId | null;
  readonly completedByNameSnapshot: string | null;
  /** Ordered movement events associated with this run. */
  readonly rodEventIds: readonly LocalId[];
  /** Stage 1 display snapshot; event history remains authoritative. */
  readonly rodAddedLength: RodLength | null;
  readonly previousCompletedDepth: Decimetres;
  readonly startDepth: Decimetres;
  readonly measuredStickUp: Decimetres;
  readonly rodStringLength: Decimetres;
  readonly holeDepth: Decimetres;
  readonly drilledLength: Decimetres;
  readonly recoveredLength: Decimetres;
  readonly recoveryPercentage: number;
  readonly conditionTagIds: readonly LocalId[];
  readonly conditionTagLabelsSnapshot: readonly string[];
  readonly comment: string | null;
  readonly correctionIds: readonly LocalId[];
  readonly activeBitSerialNumberSnapshot: string | null;
  readonly activeReamerSerialNumberSnapshot: string | null;
  readonly activeBitAssignmentId: LocalId | null;
  readonly activeReamerAssignmentId: LocalId | null;
  readonly casingSummarySnapshot: string | null;
  readonly status: "in_progress" | "completed" | "corrected" | "void";
  readonly holeNameSnapshot: string;
  readonly rigNameSnapshot: string;
}

export interface RunConditionTag extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly code: string;
  readonly label: string;
  readonly colour: string;
  readonly active: boolean;
}

export type CasingStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "REMOVED"
  | "ABANDONED";

export type CasingEventType =
  | "INSTALL"
  | "ADVANCE"
  | "SHORTEN"
  | "REMOVE"
  | "STATUS_CHANGE"
  | "CORRECT";

export interface CasingString extends SyncMetadata {
  readonly holeId: LocalId;
  readonly label?: string;
  readonly casingSize: string;
  readonly startDepthDm: Decimetres;
  readonly currentEndDepthDm: Decimetres;
  readonly status: CasingStatus;
  readonly installedAt: IsoTimestamp;
  readonly installedByUserId: LocalId;
  readonly installedByNameSnapshot: string;
}

export interface CasingEvent extends SyncMetadata {
  readonly holeId: LocalId;
  readonly casingStringId: LocalId;
  readonly shiftId?: LocalId;
  readonly eventType: CasingEventType;
  readonly previousEndDepthDm?: Decimetres;
  readonly newEndDepthDm: Decimetres;
  readonly previousStatus?: CasingStatus;
  readonly newStatus?: CasingStatus;
  readonly reason?: string;
  readonly comment?: string;
  readonly recordedByUserId: LocalId;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: IsoTimestamp;
  readonly operationId: string;
}

export type ComponentType = "BIT" | "REAMER";

export type ComponentStatus =
  | "AVAILABLE"
  | "ACTIVE"
  | "REMOVED"
  | "SERVICEABLE"
  | "RETIRED"
  | "LOST_DOWNHOLE"
  | "UNDER_INSPECTION";

export type ComponentRemovalReason =
  | "WORN"
  | "POLISHED"
  | "BURNT"
  | "DAMAGED"
  | "MATRIX_CHANGE"
  | "LOST_DOWNHOLE"
  | "INSPECTION"
  | "HOLE_COMPLETED"
  | "OTHER";

export interface Component extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly type: ComponentType;
  readonly serialNumber: string;
  readonly normalizedSerialNumber: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly matrix?: string;
  readonly size: string;
  readonly supplier?: string;
  readonly startingCrownHeightDm?: Decimetres;
  readonly status: ComponentStatus;
  readonly notes?: string;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export interface ComponentAssignment extends SyncMetadata {
  readonly componentId: LocalId;
  readonly holeId: LocalId;
  readonly componentType: ComponentType;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly installedShiftId?: LocalId;
  readonly removedShiftId?: LocalId;
  readonly installedAt: IsoTimestamp;
  readonly removedAt?: IsoTimestamp;
  readonly installedByUserId: LocalId;
  readonly installedByNameSnapshot: string;
  readonly removedByUserId?: LocalId;
  readonly removedByNameSnapshot?: string;
  readonly removalReason?: ComponentRemovalReason;
  readonly removalComment?: string;
  readonly status: "ACTIVE" | "CLOSED";
}

export const HOLE_COMPLETION_REASONS = [
  "PLANNED_DEPTH_REACHED",
  "TARGET_INTERSECTED",
  "CLIENT_STOPPED",
  "HOLE_ABANDONED",
  "GROUND_CONDITIONS",
  "EXCESSIVE_DEVIATION",
  "RODS_STUCK",
  "EQUIPMENT_LOST",
  "EQUIPMENT_LIMITATION",
  "DAUGHTER_HOLE_COMMENCED",
  "OTHER",
] as const;

export type HoleCompletionReason = (typeof HOLE_COMPLETION_REASONS)[number];

export const HOLE_COMPLETION_REASON_LABELS: Readonly<
  Record<HoleCompletionReason, string>
> = {
  PLANNED_DEPTH_REACHED: "Planned depth reached",
  TARGET_INTERSECTED: "Target intersected",
  CLIENT_STOPPED: "Client stopped hole",
  HOLE_ABANDONED: "Hole abandoned",
  GROUND_CONDITIONS: "Ground conditions",
  EXCESSIVE_DEVIATION: "Excessive deviation",
  RODS_STUCK: "Rods stuck",
  EQUIPMENT_LOST: "Equipment lost",
  EQUIPMENT_LIMITATION: "Equipment limitation",
  DAUGHTER_HOLE_COMMENCED: "Daughter hole commenced",
  OTHER: "Other",
};

export type HoleCompletionDisposition = Extract<
  HoleStatus,
  "COMPLETED" | "ABANDONED"
>;

export type HoleCompletionCheckCode =
  | "FINAL_DEPTH_AVAILABLE"
  | "FINAL_DEPTH_RECONCILED"
  | "RUNS_FINISHED"
  | "RUN_NUMBERS_UNIQUE"
  | "RUN_SEQUENCE_COMPLETE"
  | "RUN_DEPTH_GAPS"
  | "RUN_DEPTH_OVERLAPS"
  | "RUN_LENGTHS_POSITIVE"
  | "RUN_DEPTHS_RECONCILED"
  | "ROD_CONFIGURATION_VALID"
  | "ROD_FIELDS_COMPLETE"
  | "ROD_EVENTS_SETTLED"
  | "SHIFTS_CLOSED"
  | "HANDOVERS_RESOLVED"
  | "CASING_VALID"
  | "CASING_REVIEWED"
  | "COMPONENTS_RESOLVED"
  | "FINAL_SURVEY_RESOLVED"
  | "FINAL_SURVEY_UNAVAILABLE"
  | "TRAYS_RECONCILED"
  | "FINAL_PARTIAL_TRAY"
  | "MEDIA_SETTLED"
  | "CORRECTIONS_SETTLED"
  | "COMPLETION_REASON_PROVIDED"
  | "COMPLETION_COMMENT_PROVIDED";

export type HoleCompletionCheckClassification = "BLOCKING" | "ADVISORY";
export type HoleCompletionCheckStatus = "PASS" | "FAIL";

export interface HoleCompletionCheck {
  readonly code: HoleCompletionCheckCode;
  readonly label: string;
  readonly classification: HoleCompletionCheckClassification;
  readonly status: HoleCompletionCheckStatus;
  readonly message: string;
  readonly entityIds?: readonly LocalId[];
  readonly amountDm?: Decimetres;
}

export interface HoleCompletionWarningAcknowledgement {
  readonly checkCode: HoleCompletionCheckCode;
  readonly reason: string;
  readonly acknowledgedAt: IsoTimestamp;
  readonly acknowledgedByUserId: LocalId;
  readonly acknowledgedByNameSnapshot: string;
}

export type HoleCompletionComponentOutcomeCode =
  | "SERVICEABLE"
  | "UNDER_INSPECTION"
  | "RETIRED"
  | "LOST_DOWNHOLE"
  | "CARRIED_FORWARD";

interface HoleCompletionComponentOutcomeBase {
  readonly assignmentId: LocalId;
  readonly componentId: LocalId;
  readonly componentType: ComponentType;
  readonly comment?: string;
}

export type HoleCompletionComponentOutcome =
  | (HoleCompletionComponentOutcomeBase & {
      readonly outcome: Exclude<
        HoleCompletionComponentOutcomeCode,
        "CARRIED_FORWARD"
      >;
      readonly targetHoleId?: never;
    })
  | (HoleCompletionComponentOutcomeBase & {
      readonly outcome: "CARRIED_FORWARD";
      readonly targetHoleId?: LocalId;
    });

export type HoleCompletionReviewStatus =
  | "DRAFT"
  | "BLOCKED"
  | "READY"
  | "COMPLETING"
  | "COMPLETED"
  | "CANCELLED";

export interface FinalSurveyResolution {
  readonly status: "RECORDED";
  readonly surveyId: LocalId;
}

export interface FinalSurveyUnavailableResolution {
  readonly status: "UNAVAILABLE";
  readonly reason: string;
}

export type HoleFinalSurveyResolution =
  | FinalSurveyResolution
  | FinalSurveyUnavailableResolution;

export interface HoleCompletionReview extends SyncMetadata {
  readonly holeId: LocalId;
  readonly reviewStatus: HoleCompletionReviewStatus;
  readonly disposition?: HoleCompletionDisposition;
  readonly reason?: HoleCompletionReason;
  readonly comment?: string;
  readonly finalSurveyResolution?: HoleFinalSurveyResolution;
  readonly checklist: readonly HoleCompletionCheck[];
  readonly componentOutcomes: readonly HoleCompletionComponentOutcome[];
  readonly warningAcknowledgements: readonly HoleCompletionWarningAcknowledgement[];
  readonly startedByUserId: LocalId;
  readonly startedByNameSnapshot: string;
  readonly startedAt: IsoTimestamp;
}

export interface HoleCompletionSnapshot {
  readonly holeId: LocalId;
  readonly projectId: LocalId;
  readonly projectNameSnapshot: string;
  readonly rigId: LocalId;
  readonly rigNameSnapshot: string;
  readonly finalStatus: HoleCompletionDisposition;
  readonly finalDepthDm: Decimetres;
  readonly plannedDepthDm: Decimetres;
  readonly finalRunNumber: number;
  readonly runIds: readonly LocalId[];
  readonly finalRodNumber: number;
  readonly currentRodStringDm: Decimetres;
  readonly measuredStickUpDm: Decimetres;
  readonly bottomHoleAssemblyLengthDm: Decimetres;
  readonly constantStickUpDm: Decimetres;
  readonly baseRodStringDm: Decimetres;
  readonly rodStringConfigurationId: LocalId;
  readonly finalShiftId?: LocalId;
  readonly finalShiftLabel?: string;
  readonly casingSummary: string | null;
  readonly finalBitSummary?: string;
  readonly finalReamerSummary?: string;
  readonly finalSurveyId?: LocalId;
  readonly finalSurveyUnavailableReason?: string;
  readonly finalTrayId?: LocalId;
  readonly finalPartialTrayConfirmed: boolean;
  readonly surveyCount: number;
  readonly trayCount: number;
  readonly totalRuns: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly totalLossDm: Decimetres;
  readonly totalGainDm: Decimetres;
  readonly overallRecoveryPercentTenths: number;
  readonly reason: HoleCompletionReason;
  readonly comment?: string;
  readonly checklist: readonly HoleCompletionCheck[];
  readonly componentOutcomes: readonly HoleCompletionComponentOutcome[];
  readonly warningAcknowledgements: readonly HoleCompletionWarningAcknowledgement[];
  readonly completedByUserId: LocalId;
  readonly completedByNameSnapshot: string;
  readonly capturedAt: IsoTimestamp;
}

export interface HoleCompletionRecord extends SyncMetadata {
  readonly holeId: LocalId;
  readonly reviewId: LocalId;
  readonly finalStatus: HoleCompletionDisposition;
  readonly completedAt: IsoTimestamp;
  readonly completedByUserId: LocalId;
  readonly completedByNameSnapshot: string;
  readonly snapshot: HoleCompletionSnapshot;
  readonly operationId: string;
}

export interface HoleReopenRecord extends SyncMetadata {
  readonly holeId: LocalId;
  readonly completionRecordId: LocalId;
  readonly previousStatus: HoleCompletionDisposition;
  readonly reopenedStatus: Extract<HoleStatus, "ACTIVE">;
  readonly reason: string;
  readonly comment?: string;
  readonly reopenedAt: IsoTimestamp;
  readonly reopenedByUserId: LocalId;
  readonly reopenedByNameSnapshot: string;
  readonly operationId: string;
}

export const HOLE_COMPLETION_TRANSACTION_STAGES = [
  "REVIEW_CREATED",
  "SNAPSHOT_PERSISTED",
  "COMPONENTS_CLOSED",
  "HOLE_LOCKED",
  "TIMELINE_APPENDED",
  "AUDIT_APPENDED",
  "COMPLETED",
] as const;

export type HoleCompletionTransactionStage =
  (typeof HOLE_COMPLETION_TRANSACTION_STAGES)[number];

export interface HoleCompletionTransaction {
  readonly operationId: string;
  readonly holeId: LocalId;
  readonly reviewId: LocalId;
  readonly stage: HoleCompletionTransactionStage;
  readonly completedStages: readonly HoleCompletionTransactionStage[];
  readonly startedAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly lastError?: string;
}

export type RecoveryEstimateStatus =
  | "EXACT_RUN_SET"
  | "RUN_LEVEL_ESTIMATE"
  | "UNAVAILABLE";

export interface ComponentUsage {
  readonly assignmentId: LocalId;
  readonly componentId: LocalId;
  readonly holeId: LocalId;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm: Decimetres;
  readonly drilledMetresDm: Decimetres;
  readonly runsTouched: number;
  readonly fullyCoveredRuns: number;
  readonly partiallyCoveredRuns: number;
  readonly averageRecoveryPercentTenths?: number;
  readonly recoveryEstimateStatus: RecoveryEstimateStatus;
}

export type NorthReference =
  | "MAGNETIC"
  | "TRUE"
  | "GRID"
  | "NOT_SPECIFIED";

export type SurveyToolStatus = "ACTIVE" | "INACTIVE";

export interface SurveyTool extends SyncMetadata {
  readonly organisationId: LocalId;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serialNumber?: string;
  readonly defaultNorthReference?: NorthReference;
  readonly status: SurveyToolStatus;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export interface Survey extends SyncMetadata {
  readonly holeId: LocalId;
  readonly shiftId?: LocalId;
  readonly depthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: NorthReference;
  readonly surveyToolId?: LocalId;
  readonly toolNameSnapshot?: string;
  readonly toolSerialSnapshot?: string;
  readonly comment?: string;
  readonly photoId?: LocalId;
  readonly recordedByUserId: LocalId;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: IsoTimestamp;
}

export type HoleEventType =
  | "started"
  | "paused"
  | "resumed"
  | "casing_changed"
  | "configuration_changed"
  | "component_changed"
  | "completed"
  | "note";

export type HoleEventValue = string | number | boolean | null;

export interface HoleEvent extends SyncMetadata {
  readonly holeId: LocalId;
  readonly shiftId: LocalId | null;
  readonly eventType: HoleEventType;
  readonly occurredAt: IsoTimestamp;
  readonly depth: Decimetres | null;
  readonly summary: string;
  readonly details: Readonly<Record<string, HoleEventValue>>;
  readonly recordedByNameSnapshot: string;
}

export interface Tray extends SyncMetadata {
  readonly holeId: LocalId;
  readonly shiftId?: LocalId;
  readonly trayNumber: number;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly comment?: string;
  readonly isFinalPartial: boolean;
  readonly primaryPhotoId: LocalId;
  readonly recordedByUserId: LocalId;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: IsoTimestamp;
}

export type PhotoCategory = "TRAY" | "SURVEY" | "COMPONENT" | "EVENT";
export type PhotoEntityType = PhotoCategory;

export interface Photo extends SyncMetadata {
  readonly holeId: LocalId;
  readonly entityType: PhotoEntityType;
  readonly entityId: LocalId;
  readonly category: PhotoCategory;
  readonly originalStorageKey: string;
  readonly previewStorageKey?: string;
  readonly originalFilename?: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width?: number;
  readonly height?: number;
  readonly capturedAt: IsoTimestamp;
  readonly description?: string;
  readonly createdByUserId: LocalId;
  readonly createdByNameSnapshot: string;
}

export type CorrectionValue = string | number | boolean | null;

export interface Correction extends SyncMetadata {
  readonly entityType:
    | "run"
    | "rod_event"
    | "survey"
    | "casing"
    | "casing_event"
    | "component"
    | "component_assignment"
    | "tray"
    | "hole";
  readonly entityLocalId: LocalId;
  readonly fieldName: string;
  readonly previousValue: CorrectionValue;
  readonly correctedValue: CorrectionValue;
  readonly reason: string;
  readonly correctedAt: IsoTimestamp;
  readonly correctedByUserId: LocalId;
  readonly correctedByNameSnapshot: string;
}

export interface ReportRecipient extends SyncMetadata {
  readonly projectId: LocalId;
  readonly name: string;
  readonly email: string;
  readonly reportTypes: readonly ("shift" | "daily" | "hole_completion")[];
  readonly active: boolean;
}

export interface ReportAttachmentSnapshot {
  readonly fileName: string;
  readonly localPath: string;
  readonly mediaType: string;
  readonly sizeBytes: number | null;
}

export interface SentReport extends SyncMetadata {
  readonly projectId: LocalId;
  readonly holeId: LocalId;
  readonly reportType: "shift" | "daily" | "hole_completion";
  readonly reportVersion: number;
  readonly shiftIds: readonly LocalId[];
  readonly generatedAt: IsoTimestamp;
  readonly sentAt: IsoTimestamp;
  readonly sentByUserId: LocalId;
  readonly sentByNameSnapshot: string;
  readonly holeDepthSnapshot: Decimetres;
  readonly recipientIds: readonly LocalId[];
  readonly recipientNamesSnapshot: readonly string[];
  readonly recipientEmailsSnapshot: readonly string[];
  readonly localDocumentPath: string;
  readonly attachmentsSnapshot: readonly ReportAttachmentSnapshot[];
  readonly deliveryStatus: "sent" | "partially_sent" | "failed";
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface AuditEntry extends SyncMetadata {
  readonly holeId: LocalId;
  readonly entityType: string;
  readonly entityId: LocalId;
  readonly action: string;
  readonly userId: LocalId;
  readonly userNameSnapshot: string;
  readonly timestamp: IsoTimestamp;
  readonly depthDm?: Decimetres;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface SyncOperation extends SyncMetadata {
  readonly entityType: string;
  readonly entityLocalId: LocalId;
  readonly operation: "create" | "update" | "delete";
  readonly operationStatus: "queued" | "processing" | "completed" | "failed";
  readonly queuedAt: IsoTimestamp;
  readonly attemptedAt: IsoTimestamp | null;
  readonly retryCount: number;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly lastError: string | null;
}
