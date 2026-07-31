import {
  decimetres,
  metresToDecimetres,
  type CasingEvent,
  type CasingString,
  type Component,
  type ComponentAssignment,
  type Correction,
  type Organisation,
  type Project,
  type ReportRecipient,
  type Rig,
  type RunConditionTag,
  type SentReport,
  type SurveyTool,
  type SyncMetadata,
  type SyncOperation,
  type SyncStatus,
  type User,
} from "../../domain";
import {
  ddh041MidholeCurrentState,
  ddh041MidholeHole,
  ddh041MidholeHoleConfigurations,
  ddh041MidholeHoleEvents,
  ddh041MidholePhotos,
  ddh041MidholeRodEvents,
  ddh041MidholeRodStringConfigurations,
  ddh041MidholeRuns,
  ddh041MidholeShifts,
  ddh041MidholeSurveys,
  ddh041MidholeTrays,
} from "./target-lock-ddh041-midhole";

const DEVICE_ID = "seed-tablet-rig-10";
const SEED_CREATED_AT = "2026-06-01T06:00:00.000Z";

function metadata(
  localId: string,
  updatedAt = SEED_CREATED_AT,
  syncStatus: SyncStatus = "synced",
): SyncMetadata {
  return {
    localId,
    serverId: syncStatus === "synced" ? `server-${localId}` : null,
    syncStatus,
    createdAt: SEED_CREATED_AT,
    updatedAt,
    deviceId: DEVICE_ID,
    version: 1,
  };
}

export const briggsOrganisation: Organisation = {
  ...metadata("organisation-briggs"),
  name: "Briggs Drilling Services",
  code: "BRIGGS",
};

export const briggsProject: Project = {
  ...metadata("project-briggs"),
  organisationId: briggsOrganisation.localId,
  code: "BRG-DEMO-01",
  name: "Demo Ridge Sandbox",
  clientName: "TargetLock Demo Client",
  location: "Relative demo coordinates (not a real site)",
  status: "active",
};

export const rig10: Rig = {
  ...metadata("rig-10"),
  organisationId: briggsOrganisation.localId,
  projectId: briggsProject.localId,
  name: "Rig 10",
  serialNumber: "BRG-R10-DEMO",
  model: "Sandvik DE150",
  status: "operating",
};

export const briggsUsers: readonly User[] = [
  {
    ...metadata("user-supervisor-lee"),
    organisationId: briggsOrganisation.localId,
    givenName: "Morgan",
    familyName: "Lee",
    displayName: "Morgan Lee",
    email: "morgan.lee@briggs.example",
    role: "supervisor",
    active: true,
  },
  {
    ...metadata("user-driller-hayes"),
    organisationId: briggsOrganisation.localId,
    givenName: "Jordan",
    familyName: "Hayes",
    displayName: "Jordan Hayes",
    email: "jordan.hayes@briggs.example",
    role: "driller",
    active: true,
  },
  {
    ...metadata("user-driller-ward"),
    organisationId: briggsOrganisation.localId,
    givenName: "Casey",
    familyName: "Ward",
    displayName: "Casey Ward",
    email: "casey.ward@briggs.example",
    role: "driller",
    active: true,
  },
  {
    ...metadata("user-driller-hoffman"),
    organisationId: briggsOrganisation.localId,
    givenName: "M.",
    familyName: "Hoffman",
    displayName: "M. Hoffman",
    email: "m.hoffman@briggs.example",
    role: "driller",
    active: true,
  },
  {
    ...metadata("user-driller-smith"),
    organisationId: briggsOrganisation.localId,
    givenName: "J.",
    familyName: "Smith",
    displayName: "J. Smith",
    email: "j.smith@briggs.example",
    role: "driller",
    active: true,
  },
  {
    ...metadata("user-geologist-patel"),
    organisationId: briggsOrganisation.localId,
    givenName: "Priya",
    familyName: "Patel",
    displayName: "Priya Patel",
    email: "priya.patel@briggs.example",
    role: "geologist",
    active: true,
  },
];

/** Mid-hole demo sandbox (~800 m plan / ~630 m current). */
export const ddh041HoleConfigurations = ddh041MidholeHoleConfigurations;
export const ddh041RodStringConfigurations =
  ddh041MidholeRodStringConfigurations;
export const ddh041RodEvents = ddh041MidholeRodEvents;
export const ddh041CurrentState = ddh041MidholeCurrentState;
export const ddh041 = ddh041MidholeHole;
export const ddh041Shifts = ddh041MidholeShifts;
export const ddh041Runs = ddh041MidholeRuns;
export const ddh041Surveys = ddh041MidholeSurveys;
export const ddh041HoleEvents = ddh041MidholeHoleEvents;
export const ddh041Trays = ddh041MidholeTrays;
export const ddh041Photos = ddh041MidholePhotos;

export const runConditionTags: readonly RunConditionTag[] = [
  {
    ...metadata("run-tag-competent"),
    organisationId: briggsOrganisation.localId,
    code: "COMP",
    label: "Competent ground",
    colour: "#16a34a",
    active: true,
  },
  {
    ...metadata("run-tag-broken"),
    organisationId: briggsOrganisation.localId,
    code: "BRKN",
    label: "Broken ground",
    colour: "#f59e0b",
    active: true,
  },
  {
    ...metadata("run-tag-core-gain"),
    organisationId: briggsOrganisation.localId,
    code: "GAIN",
    label: "Measured core gain",
    colour: "#2563eb",
    active: true,
  },
];

const earlyShiftId = ddh041Shifts[0]?.localId ?? "shift-ddh041-day-2026-06-16";

export const ddh041CasingStrings: readonly CasingString[] = [
  {
    ...metadata("casing-pq-ddh041", "2026-06-02T08:00:00.000Z"),
    holeId: "DDH041",
    label: "PQ casing",
    casingSize: "PQ",
    startDepthDm: metresToDecimetres(0),
    currentEndDepthDm: metresToDecimetres(18),
    status: "ACTIVE",
    installedAt: "2026-06-01T06:00:00.000Z",
    installedByUserId: "user-driller-hoffman",
    installedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata("casing-hq-ddh041", "2026-06-02T09:00:00.000Z"),
    holeId: "DDH041",
    label: "HQ casing",
    casingSize: "HQ",
    startDepthDm: metresToDecimetres(0),
    currentEndDepthDm: metresToDecimetres(42),
    status: "ACTIVE",
    installedAt: "2026-06-02T09:00:00.000Z",
    installedByUserId: "user-driller-hoffman",
    installedByNameSnapshot: "M. Hoffman",
  },
];

export const ddh041CasingEvents: readonly CasingEvent[] = [
  {
    ...metadata("casing-event-pq-install", "2026-06-01T06:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-pq-ddh041",
    shiftId: earlyShiftId,
    eventType: "INSTALL",
    newEndDepthDm: metresToDecimetres(6),
    newStatus: "ACTIVE",
    comment: "Initial PQ casing installed (demo).",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-06-01T06:00:00.000Z",
    operationId: "seed-casing-pq-install",
  },
  {
    ...metadata("casing-event-pq-advance", "2026-06-02T08:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-pq-ddh041",
    shiftId: earlyShiftId,
    eventType: "ADVANCE",
    previousEndDepthDm: metresToDecimetres(6),
    newEndDepthDm: metresToDecimetres(18),
    newStatus: "ACTIVE",
    comment: "PQ casing advanced after collar stabilization (demo).",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-06-02T08:00:00.000Z",
    operationId: "seed-casing-pq-advance",
  },
  {
    ...metadata("casing-event-hq-install", "2026-06-02T09:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-hq-ddh041",
    shiftId: earlyShiftId,
    eventType: "INSTALL",
    newEndDepthDm: metresToDecimetres(42),
    newStatus: "ACTIVE",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-06-02T09:00:00.000Z",
    operationId: "seed-casing-hq-install",
  },
];

function seedComponent(
  localId: string,
  type: Component["type"],
  serialNumber: string,
  status: Component["status"],
  overrides: Partial<Component> = {},
): Component {
  return {
    ...metadata(localId),
    organisationId: briggsOrganisation.localId,
    type,
    serialNumber,
    normalizedSerialNumber: serialNumber.toUpperCase(),
    manufacturer: type === "BIT" ? "Boart Longyear" : "Fordia",
    model: type === "BIT" ? "Stage 3" : "Hero 7",
    matrix: type === "BIT" ? "8" : undefined,
    size: "HQ",
    status,
    notes: status === "ACTIVE" ? `Active ${type.toLowerCase()} record.` : undefined,
    createdByUserId: "user-driller-hoffman",
    createdByNameSnapshot: "M. Hoffman",
    ...overrides,
  };
}

export const rig10Components: readonly Component[] = [
  seedComponent("component-bit-001842", "BIT", "BIT-HQ-001842", "REMOVED"),
  seedComponent("component-bit-002193", "BIT", "BIT-HQ-002193", "ACTIVE"),
  seedComponent("component-bit-003007", "BIT", "BIT-HQ-003007", "AVAILABLE"),
  seedComponent(
    "component-bit-ddh040",
    "BIT",
    "BIT-HQ-003008",
    "ACTIVE",
    { notes: "Active in DDH040 for duplicate-assignment protection." },
  ),
  seedComponent(
    "component-reamer-000734",
    "REAMER",
    "REA-HQ-000734",
    "UNDER_INSPECTION",
  ),
  seedComponent(
    "component-reamer-000912",
    "REAMER",
    "REA-HQ-000912",
    "ACTIVE",
  ),
  seedComponent(
    "component-reamer-001104",
    "REAMER",
    "REA-HQ-001104",
    "AVAILABLE",
  ),
];

function seedAssignment(
  localId: string,
  componentId: string,
  holeId: string,
  componentType: ComponentAssignment["componentType"],
  startDepthDm: number,
  endDepthDm?: number,
  removalReason?: ComponentAssignment["removalReason"],
): ComponentAssignment {
  const installedAt = "2026-06-01T06:00:00.000Z";
  const removedAt =
    endDepthDm === undefined ? undefined : "2026-06-28T08:00:00.000Z";
  const closedShift =
    ddh041Shifts.find(({ status }) => status === "CLOSED")?.localId ??
    earlyShiftId;
  return {
    ...metadata(localId, removedAt ?? "2026-07-01T08:00:00.000Z"),
    componentId,
    holeId,
    componentType,
    startDepthDm: decimetres(startDepthDm),
    endDepthDm:
      endDepthDm === undefined ? undefined : decimetres(endDepthDm),
    installedShiftId: earlyShiftId,
    removedShiftId: endDepthDm === undefined ? undefined : closedShift,
    installedAt,
    removedAt,
    installedByUserId: "user-driller-hayes",
    installedByNameSnapshot: "Jordan Hayes",
    removedByUserId: endDepthDm === undefined ? undefined : "user-driller-hoffman",
    removedByNameSnapshot: endDepthDm === undefined ? undefined : "M. Hoffman",
    removalReason,
    status: endDepthDm === undefined ? "ACTIVE" : "CLOSED",
  };
}

export const rig10ComponentAssignments: readonly ComponentAssignment[] = [
  seedAssignment(
    "assignment-bit-001842-ddh041",
    "component-bit-001842",
    "DDH041",
    "BIT",
    0,
    4_126,
    "WORN",
  ),
  seedAssignment(
    "assignment-bit-002193-ddh041",
    "component-bit-002193",
    "DDH041",
    "BIT",
    4_126,
  ),
  seedAssignment(
    "assignment-reamer-000734-ddh041",
    "component-reamer-000734",
    "DDH041",
    "REAMER",
    0,
    2_489,
    "INSPECTION",
  ),
  seedAssignment(
    "assignment-reamer-000912-ddh041",
    "component-reamer-000912",
    "DDH041",
    "REAMER",
    2_489,
  ),
  seedAssignment(
    "assignment-bit-ddh040",
    "component-bit-ddh040",
    "DDH040",
    "BIT",
    2_150,
  ),
];

export const briggsSurveyTools: readonly SurveyTool[] = [
  {
    ...metadata("survey-tool-reflex-01"),
    organisationId: briggsOrganisation.localId,
    name: "EZ-TRAC",
    serialNumber: "EZT-18427",
    manufacturer: "REFLEX",
    model: "EZ-TRAC",
    defaultNorthReference: "GRID",
    status: "ACTIVE",
    createdByUserId: "user-supervisor-lee",
    createdByNameSnapshot: "Morgan Lee",
  },
  {
    ...metadata("survey-tool-reflex-02"),
    organisationId: briggsOrganisation.localId,
    name: "DeviShot",
    serialNumber: "DEV-44017",
    manufacturer: "REFLEX",
    model: "DeviShot",
    defaultNorthReference: "GRID",
    status: "ACTIVE",
    createdByUserId: "user-supervisor-lee",
    createdByNameSnapshot: "Morgan Lee",
  },
];

export const ddh041Corrections: readonly Correction[] = [
  {
    ...metadata("correction-ddh041-survey-420", "2026-07-10T14:05:00.000Z"),
    entityType: "survey",
    entityLocalId: "survey-ddh041-420",
    fieldName: "azimuthTenths",
    previousValue: 1_398,
    correctedValue: 1_298,
    reason: "Corrected transcription against tool export (demo)",
    correctedAt: "2026-07-10T14:05:00.000Z",
    correctedByUserId: "user-geologist-patel",
    correctedByNameSnapshot: "Priya Patel",
  },
];

export const briggsReportRecipients: readonly ReportRecipient[] = [
  {
    ...metadata("report-recipient-client"),
    projectId: briggsProject.localId,
    name: "Alex Chen",
    email: "alex.chen@demo.example",
    reportTypes: ["daily", "hole_completion"],
    active: true,
  },
  {
    ...metadata("report-recipient-ops"),
    projectId: briggsProject.localId,
    name: "Briggs Operations",
    email: "operations@briggs.example",
    reportTypes: ["shift", "daily", "hole_completion"],
    active: true,
  },
];

const lastClosedShift = [...ddh041Shifts]
  .reverse()
  .find(({ status }) => status === "CLOSED");
const priorClosedShift = [...ddh041Shifts]
  .reverse()
  .filter(({ status }) => status === "CLOSED")[1];

export const ddh041SentReports: readonly SentReport[] = [
  {
    ...metadata("sent-report-ddh041-recent", "2026-06-29T06:20:00.000Z"),
    projectId: briggsProject.localId,
    holeId: ddh041.localId,
    reportType: "daily",
    reportVersion: 1,
    shiftIds: [
      priorClosedShift?.localId ?? earlyShiftId,
      lastClosedShift?.localId ?? earlyShiftId,
    ],
    generatedAt: "2026-06-29T06:10:00.000Z",
    sentAt: "2026-06-29T06:20:00.000Z",
    sentByUserId: "user-supervisor-lee",
    sentByNameSnapshot: "Morgan Lee",
    holeDepthSnapshot: lastClosedShift?.endingDepthDm ?? ddh041.currentDepth,
    recipientIds: ["report-recipient-client", "report-recipient-ops"],
    recipientNamesSnapshot: ["Alex Chen", "Briggs Operations"],
    recipientEmailsSnapshot: [
      "alex.chen@demo.example",
      "operations@briggs.example",
    ],
    localDocumentPath: "/seed/reports/ddh041-demo-daily.pdf",
    attachmentsSnapshot: [
      {
        fileName: "ddh041-demo-daily.pdf",
        localPath: "/seed/reports/ddh041-demo-daily.pdf",
        mediaType: "application/pdf",
        sizeBytes: 284_160,
      },
    ],
    deliveryStatus: "sent",
  },
  {
    ...metadata("sent-report-ddh041-shift", "2026-06-29T18:10:00.000Z"),
    projectId: briggsProject.localId,
    holeId: ddh041.localId,
    reportType: "shift",
    reportVersion: 1,
    shiftIds: [lastClosedShift?.localId ?? earlyShiftId],
    generatedAt: "2026-06-29T18:05:00.000Z",
    sentAt: "2026-06-29T18:10:00.000Z",
    sentByUserId: "user-supervisor-lee",
    sentByNameSnapshot: "Morgan Lee",
    holeDepthSnapshot: ddh041CurrentState.currentHoleDepth,
    recipientIds: ["report-recipient-ops"],
    recipientNamesSnapshot: ["Briggs Operations"],
    recipientEmailsSnapshot: ["operations@briggs.example"],
    localDocumentPath: "/seed/reports/ddh041-demo-shift.pdf",
    attachmentsSnapshot: [
      {
        fileName: "ddh041-demo-shift.pdf",
        localPath: "/seed/reports/ddh041-demo-shift.pdf",
        mediaType: "application/pdf",
        sizeBytes: 198_420,
      },
    ],
    deliveryStatus: "sent",
  },
];

export const seedSyncOperations: readonly SyncOperation[] = [
  {
    ...metadata(
      "sync-operation-photo-open-tray",
      "2026-06-30T07:21:00.000Z",
      "queued",
    ),
    entityType: "photo",
    entityLocalId: "photo-ddh041-tray-111-a",
    operation: "create",
    operationStatus: "queued",
    queuedAt: "2026-06-30T07:21:00.000Z",
    attemptedAt: null,
    retryCount: 0,
    payload: {
      localPath: "/seed/placeholders/ddh041/tray-105-current.jpg",
      holeId: "DDH041",
    },
    lastError: null,
  },
];

export interface TargetLockStage1Seed {
  readonly organisation: Organisation;
  readonly users: readonly User[];
  readonly project: Project;
  readonly rig: Rig;
  readonly hole: typeof ddh041;
  readonly holeConfigurations: typeof ddh041HoleConfigurations;
  readonly rodStringConfigurations: typeof ddh041RodStringConfigurations;
  readonly rodEvents: typeof ddh041RodEvents;
  readonly shifts: typeof ddh041Shifts;
  readonly runs: typeof ddh041Runs;
  readonly runConditionTags: readonly RunConditionTag[];
  readonly casingStrings: readonly CasingString[];
  readonly casingEvents: readonly CasingEvent[];
  readonly components: readonly Component[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly surveys: typeof ddh041Surveys;
  readonly surveyTools: readonly SurveyTool[];
  readonly holeEvents: typeof ddh041HoleEvents;
  readonly trays: typeof ddh041Trays;
  readonly photos: typeof ddh041Photos;
  readonly corrections: readonly Correction[];
  readonly reportRecipients: readonly ReportRecipient[];
  readonly sentReports: readonly SentReport[];
  readonly syncOperations: readonly SyncOperation[];
}

export const targetLockStage1Seed: TargetLockStage1Seed = {
  organisation: briggsOrganisation,
  users: briggsUsers,
  project: briggsProject,
  rig: rig10,
  hole: ddh041,
  holeConfigurations: ddh041HoleConfigurations,
  rodStringConfigurations: ddh041RodStringConfigurations,
  rodEvents: ddh041RodEvents,
  shifts: ddh041Shifts,
  runs: ddh041Runs,
  runConditionTags,
  casingStrings: ddh041CasingStrings,
  casingEvents: ddh041CasingEvents,
  components: rig10Components,
  componentAssignments: rig10ComponentAssignments,
  surveys: ddh041Surveys,
  surveyTools: briggsSurveyTools,
  holeEvents: ddh041HoleEvents,
  trays: ddh041Trays,
  photos: ddh041Photos,
  corrections: ddh041Corrections,
  reportRecipients: briggsReportRecipients,
  sentReports: ddh041SentReports,
  syncOperations: seedSyncOperations,
};
