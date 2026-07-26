import {
  calculateActiveRodInventory,
  calculateBaseRodString,
  calculateCurrentRodString,
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRecoveryPercentage,
  calculateRodNumber,
  decimetres,
  metresToDecimetres,
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
  type CasingEvent,
  type CasingString,
  type Component,
  type ComponentAssignment,
  type Correction,
  type Hole,
  type HoleConfiguration,
  type HoleEvent,
  type Organisation,
  type Photo,
  type Project,
  type ReportRecipient,
  type Rig,
  type RodAddition,
  type RodEventAction,
  type RodLength,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type RunConditionTag,
  type SentReport,
  type Survey,
  type SurveyTool,
  type SyncMetadata,
  type SyncOperation,
  type SyncStatus,
  type Tray,
  type User,
} from "../../domain";

const DEVICE_ID = "seed-tablet-rig-10";
const SEED_CREATED_AT = "2026-02-01T06:00:00.000Z";

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
  code: "BRG-26-01",
  name: "Briggs North Ridge",
  clientName: "North Ridge Minerals",
  location: "Pilbara, Western Australia",
  status: "active",
};

export const rig10: Rig = {
  ...metadata("rig-10"),
  organisationId: briggsOrganisation.localId,
  projectId: briggsProject.localId,
  name: "Rig 10",
  serialNumber: "BRG-R10-2019",
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

export const ddh041HoleConfigurations: readonly HoleConfiguration[] = [
  {
    ...metadata("hole-config-ddh041-01"),
    holeId: "DDH041",
    effectiveAt: "2026-02-01T06:00:00.000Z",
    holeSize: "HQ",
    plannedDepth: metresToDecimetres(750),
    dipDegrees: -60,
    azimuthDegrees: 42,
    holeDiameterMillimetres: 96,
    reason: "Approved collar plan",
  },
  {
    ...metadata(
      "hole-config-ddh041-02",
      "2026-03-10T06:00:00.000Z",
    ),
    holeId: "DDH041",
    effectiveAt: "2026-03-10T06:00:00.000Z",
    holeSize: "HQ",
    plannedDepth: metresToDecimetres(750),
    dipDegrees: -60,
    azimuthDegrees: 42,
    holeDiameterMillimetres: 96,
    reason: "HQ configuration confirmed after casing shoe",
  },
];

export const ddh041RodStringConfigurations: readonly RodStringConfiguration[] =
  [
    {
      ...metadata("rod-config-ddh041-01"),
      holeId: "DDH041",
      effectiveAt: "2026-02-01T06:00:00.000Z",
      bottomHoleAssemblyLength: metresToDecimetres(4.5),
      constantStickUp: metresToDecimetres(2),
      baseRodStringLength: calculateBaseRodString(
        metresToDecimetres(4.5),
        metresToDecimetres(2),
      ),
      reason: "Initial HQ assembly",
    },
    {
      ...metadata(
        "rod-config-ddh041-02",
        "2026-03-08T06:00:00.000Z",
      ),
      holeId: "DDH041",
      effectiveAt: "2026-03-08T06:00:00.000Z",
      bottomHoleAssemblyLength: metresToDecimetres(4.3),
      constantStickUp: metresToDecimetres(2),
      baseRodStringLength: calculateBaseRodString(
        metresToDecimetres(4.3),
        metresToDecimetres(2),
      ),
      reason: "BHA changed after reamer replacement",
    },
    {
      ...metadata(
        "rod-config-ddh041-03",
        "2026-03-18T06:00:00.000Z",
      ),
      holeId: "DDH041",
      effectiveAt: "2026-03-18T06:00:00.000Z",
      bottomHoleAssemblyLength: metresToDecimetres(4.3),
      constantStickUp: metresToDecimetres(1.8),
      baseRodStringLength: calculateBaseRodString(
        metresToDecimetres(4.3),
        metresToDecimetres(1.8),
      ),
      reason: "Constant stick-up remeasured at 1.8 m",
    },
  ];

interface SeedRodEventSpec {
  readonly action: RodEventAction;
  readonly rodLength: RodLength;
  readonly occurredAt: string;
  readonly runId: string | null;
  readonly shiftId: string | null;
}

function historicalRodTimestamp(index: number): string {
  const start = Date.parse("2026-02-01T07:00:00.000Z");
  return new Date(start + index * 6 * 60 * 60 * 1_000).toISOString();
}

function createDdh041RodEvents(): readonly RodAddition[] {
  const specs: SeedRodEventSpec[] = [];

  for (let index = 0; index < 107; index += 1) {
    specs.push({
      action: "add",
      rodLength: SIX_METRE_ROD_LENGTH,
      occurredAt: historicalRodTimestamp(index),
      runId: null,
      shiftId: null,
    });
  }

  for (let index = 0; index < 5; index += 1) {
    specs.push({
      action: "add",
      rodLength: THREE_METRE_ROD_LENGTH,
      occurredAt: historicalRodTimestamp(107 + index),
      runId: null,
      shiftId: null,
    });
  }

  specs.push(
    {
      action: "remove",
      rodLength: SIX_METRE_ROD_LENGTH,
      occurredAt: "2026-03-18T05:30:00.000Z",
      runId: null,
      shiftId: "shift-ddh041-day-18",
    },
    {
      action: "remove",
      rodLength: THREE_METRE_ROD_LENGTH,
      occurredAt: "2026-03-18T05:35:00.000Z",
      runId: null,
      shiftId: "shift-ddh041-day-18",
    },
    {
      action: "add",
      rodLength: SIX_METRE_ROD_LENGTH,
      occurredAt: "2026-03-19T07:05:00.000Z",
      runId: "run-ddh041-217",
      shiftId: "shift-ddh041-day-19",
    },
    {
      action: "add",
      rodLength: SIX_METRE_ROD_LENGTH,
      occurredAt: "2026-03-20T07:05:00.000Z",
      runId: "run-ddh041-219",
      shiftId: "shift-ddh041-day-20",
    },
  );

  let rodNumber = 0;
  return specs.map((spec, index) => {
    const affectedRodNumber =
      spec.action === "add" ? rodNumber + 1 : rodNumber;
    rodNumber += spec.action === "add" ? 1 : -1;

    return {
      ...metadata(
        `rod-event-ddh041-${String(index + 1).padStart(3, "0")}`,
        spec.occurredAt,
      ),
      holeId: "DDH041",
      runId: spec.runId,
      shiftId: spec.shiftId,
      sequence: index + 1,
      action: spec.action,
      rodLength: spec.rodLength,
      affectedRodNumber,
      rodNumberAfterEvent: rodNumber,
      occurredAt: spec.occurredAt,
      recordedByUserId: "user-driller-hayes",
      recordedByNameSnapshot: "Jordan Hayes",
    };
  });
}

export const ddh041RodEvents = createDdh041RodEvents();

const currentRodConfiguration =
  ddh041RodStringConfigurations[
    ddh041RodStringConfigurations.length - 1
  ];

if (currentRodConfiguration === undefined) {
  throw new Error("DDH041 seed requires a current rod string configuration.");
}

const rodEventInputs = ddh041RodEvents.map(({ action, rodLength }) => ({
  action,
  rodLength,
}));

const activeRodInventory = calculateActiveRodInventory(rodEventInputs);
const currentRodString = calculateCurrentRodString(
  currentRodConfiguration.baseRodStringLength,
  rodEventInputs,
);
const currentStickUp = metresToDecimetres(1);
const currentHoleDepth = calculateHoleDepth(
  currentRodString,
  currentStickUp,
);
const previousCompletedDepth = metresToDecimetres(658.6);
const currentDrilledLength = calculateDrilledLength(
  currentHoleDepth,
  previousCompletedDepth,
);
const currentRecoveredLength = metresToDecimetres(2.8);

export const ddh041CurrentState = {
  activeThreeMetreRods: activeRodInventory.threeMetreRods,
  activeSixMetreRods: activeRodInventory.sixMetreRods,
  activeRodLength: activeRodInventory.totalLength,
  rodNumber: calculateRodNumber(rodEventInputs),
  bottomHoleAssemblyLength:
    currentRodConfiguration.bottomHoleAssemblyLength,
  constantStickUp: currentRodConfiguration.constantStickUp,
  baseRodStringLength: currentRodConfiguration.baseRodStringLength,
  currentRodString,
  measuredStickUp: currentStickUp,
  currentHoleDepth,
  previousCompletedDepth,
  drilledLength: currentDrilledLength,
  recoveredLength: currentRecoveredLength,
  recoveryPercentage: calculateRecoveryPercentage(
    currentDrilledLength,
    currentRecoveredLength,
  ),
} as const;

export const ddh041: Hole = {
  ...metadata("DDH041", "2026-03-20T18:30:00.000Z"),
  projectId: briggsProject.localId,
  rigId: rig10.localId,
  name: "DDH041",
  holeSize: "HQ",
  plannedDepth: metresToDecimetres(750),
  currentDepth: ddh041CurrentState.currentHoleDepth,
  status: "drilling",
  collarEasting: 482_315.42,
  collarNorthing: 7_514_882.16,
  collarElevation: 487.3,
};

export const ddh041Shifts: readonly RunbookShift[] = [
  {
    ...metadata("shift-ddh041-day-18", "2026-03-18T18:00:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "DAY",
    shiftDate: "2026-03-18",
    primaryDrillerId: "user-driller-hayes",
    primaryDrillerNameSnapshot: "Jordan Hayes",
    crewMembers: [{ userId: "user-driller-hayes", name: "Jordan Hayes", role: "Driller" }],
    startedAt: "2026-03-18T06:00:00.000Z",
    closedAt: "2026-03-18T18:00:00.000Z",
    startingDepthDm: metresToDecimetres(643.6),
    endingDepthDm: metresToDecimetres(646.6),
    startingRodNumber: 110,
    endingRodNumber: 110,
    startingRodStringDm: metresToDecimetres(650.5),
    endingRodStringDm: metresToDecimetres(650.5),
    startingMeasuredStickUpDm: metresToDecimetres(6.9),
    endingMeasuredStickUpDm: metresToDecimetres(3.9),
    startingRunNumber: 215,
    endingRunNumber: 215,
    handoverNote: "Rod inventory reconciled after 3 m and 6 m removals.",
    handoverAcceptedBy: "user-driller-ward",
    handoverAcceptedByNameSnapshot: "Casey Ward",
    handoverAcceptedAt: "2026-03-18T18:00:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata("shift-ddh041-night-18", "2026-03-19T06:00:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "NIGHT",
    shiftDate: "2026-03-18",
    primaryDrillerId: "user-driller-ward",
    primaryDrillerNameSnapshot: "Casey Ward",
    crewMembers: [{ userId: "user-driller-ward", name: "Casey Ward", role: "Driller" }],
    startedAt: "2026-03-18T18:00:00.000Z",
    closedAt: "2026-03-19T06:00:00.000Z",
    startingDepthDm: metresToDecimetres(646.6),
    endingDepthDm: metresToDecimetres(649.6),
    startingRodNumber: 110,
    endingRodNumber: 110,
    startingRodStringDm: metresToDecimetres(650.5),
    endingRodStringDm: metresToDecimetres(650.5),
    startingMeasuredStickUpDm: metresToDecimetres(3.9),
    endingMeasuredStickUpDm: metresToDecimetres(0.9),
    startingRunNumber: 216,
    endingRunNumber: 216,
    handoverNote: "Run 216 corrected after tray reconciliation.",
    handoverAcceptedBy: "user-driller-hayes",
    handoverAcceptedByNameSnapshot: "Jordan Hayes",
    handoverAcceptedAt: "2026-03-19T06:00:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata("shift-ddh041-day-19", "2026-03-19T18:00:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "DAY",
    shiftDate: "2026-03-19",
    primaryDrillerId: "user-driller-hayes",
    primaryDrillerNameSnapshot: "Jordan Hayes",
    crewMembers: [{ userId: "user-driller-hayes", name: "Jordan Hayes", role: "Driller" }],
    startedAt: "2026-03-19T06:00:00.000Z",
    closedAt: "2026-03-19T18:00:00.000Z",
    startingDepthDm: metresToDecimetres(649.6),
    endingDepthDm: metresToDecimetres(652.6),
    startingRodNumber: 110,
    endingRodNumber: 111,
    startingRodStringDm: metresToDecimetres(650.5),
    endingRodStringDm: metresToDecimetres(656.5),
    startingMeasuredStickUpDm: metresToDecimetres(0.9),
    endingMeasuredStickUpDm: metresToDecimetres(3.9),
    startingRunNumber: 217,
    endingRunNumber: 217,
    handoverNote: "New 6 m rod added; survey completed at 650.0 m.",
    handoverAcceptedBy: "user-driller-ward",
    handoverAcceptedByNameSnapshot: "Casey Ward",
    handoverAcceptedAt: "2026-03-19T18:00:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata("shift-ddh041-night-19", "2026-03-20T06:00:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "NIGHT",
    shiftDate: "2026-03-19",
    primaryDrillerId: "user-driller-ward",
    primaryDrillerNameSnapshot: "Casey Ward",
    crewMembers: [{ userId: "user-driller-ward", name: "Casey Ward", role: "Driller" }],
    startedAt: "2026-03-19T18:00:00.000Z",
    closedAt: "2026-03-20T06:00:00.000Z",
    startingDepthDm: metresToDecimetres(652.6),
    endingDepthDm: metresToDecimetres(655.6),
    startingRodNumber: 111,
    endingRodNumber: 111,
    startingRodStringDm: metresToDecimetres(656.5),
    endingRodStringDm: metresToDecimetres(656.5),
    startingMeasuredStickUpDm: metresToDecimetres(3.9),
    endingMeasuredStickUpDm: metresToDecimetres(0.9),
    startingRunNumber: 218,
    endingRunNumber: 218,
    handoverNote: "Broken ground in run 218; monitor recovery.",
    handoverAcceptedBy: "user-driller-hayes",
    handoverAcceptedByNameSnapshot: "Jordan Hayes",
    handoverAcceptedAt: "2026-03-20T06:00:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata("shift-ddh041-day-20", "2026-03-20T18:00:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "DAY",
    shiftDate: "2026-03-20",
    primaryDrillerId: "user-driller-hayes",
    primaryDrillerNameSnapshot: "Jordan Hayes",
    crewMembers: [{ userId: "user-driller-hayes", name: "Jordan Hayes", role: "Driller" }],
    startedAt: "2026-03-20T06:00:00.000Z",
    closedAt: "2026-03-20T18:00:00.000Z",
    startingDepthDm: metresToDecimetres(655.6),
    endingDepthDm: metresToDecimetres(658.6),
    startingRodNumber: 111,
    endingRodNumber: 112,
    startingRodStringDm: metresToDecimetres(656.5),
    endingRodStringDm: metresToDecimetres(662.5),
    startingMeasuredStickUpDm: metresToDecimetres(0.9),
    endingMeasuredStickUpDm: metresToDecimetres(3.9),
    startingRunNumber: 219,
    endingRunNumber: 219,
    handoverNote: "Run 220 remains open at handover; no rod added.",
    handoverRunId: "run-ddh041-220",
    handoverAcceptedBy: "user-driller-ward",
    handoverAcceptedByNameSnapshot: "Casey Ward",
    handoverAcceptedAt: "2026-03-20T18:00:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata("shift-ddh041-night-20", "2026-03-20T18:30:00.000Z"),
    holeId: ddh041.localId,
    rigId: rig10.localId,
    shiftType: "NIGHT",
    shiftDate: "2026-03-20",
    primaryDrillerId: "user-driller-ward",
    primaryDrillerNameSnapshot: "Casey Ward",
    crewMembers: [{ userId: "user-driller-ward", name: "Casey Ward", role: "Driller" }],
    startedAt: "2026-03-20T18:00:00.000Z",
    startingDepthDm: metresToDecimetres(658.6),
    startingRodNumber: 112,
    startingRodStringDm: metresToDecimetres(662.5),
    startingMeasuredStickUpDm: metresToDecimetres(3.9),
    startingRunNumber: 220,
    handoverRunId: "run-ddh041-220",
    status: "OPEN",
  },
];

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

interface SeedRunValues {
  readonly localId: string;
  readonly shiftIds: readonly string[];
  readonly runNumber: number;
  readonly rodNumber: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly startedByUserId: string;
  readonly startedByNameSnapshot: string;
  readonly rodAddedLength: RodLength | null;
  readonly previousCompletedDepthDm: number;
  readonly measuredStickUpDm: number;
  readonly rodStringDm: number;
  readonly recoveredLengthDm: number;
  readonly conditionTagIds: readonly string[];
  readonly comment: string | null;
  readonly correctionIds: readonly string[];
  readonly status: Run["status"];
}

function createSeedRun(values: SeedRunValues): Run {
  const startedShiftId = values.shiftIds[0];
  const completedShiftId = values.shiftIds.at(-1);
  if (startedShiftId === undefined || completedShiftId === undefined) {
    throw new Error(`Run ${values.runNumber} requires at least one shift.`);
  }
  const previousDepth = decimetres(values.previousCompletedDepthDm);
  const stickUp = decimetres(values.measuredStickUpDm);
  const rodString = decimetres(values.rodStringDm);
  const holeDepth = calculateHoleDepth(rodString, stickUp);
  const drilledLength = calculateDrilledLength(holeDepth, previousDepth);
  const recoveredLength = decimetres(values.recoveredLengthDm);

  return {
    ...metadata(
      values.localId,
      values.completedAt ?? "2026-03-20T18:30:00.000Z",
    ),
    holeId: ddh041.localId,
    startedShiftId,
    completedShiftId: values.completedAt === null ? null : completedShiftId,
    runNumber: values.runNumber,
    rodNumber: values.rodNumber,
    startedAt: values.startedAt,
    startedByUserId: values.startedByUserId,
    startedByNameSnapshot: values.startedByNameSnapshot,
    completedAt: values.completedAt,
    completedByUserId:
      values.completedAt === null ? null : values.startedByUserId,
    completedByNameSnapshot:
      values.completedAt === null ? null : values.startedByNameSnapshot,
    rodEventIds: ddh041RodEvents
      .filter(({ runId }) => runId === values.localId)
      .map(({ localId }) => localId),
    rodAddedLength: values.rodAddedLength,
    previousCompletedDepth: previousDepth,
    startDepth: previousDepth,
    measuredStickUp: stickUp,
    rodStringLength: rodString,
    holeDepth,
    drilledLength,
    recoveredLength,
    recoveryPercentage: calculateRecoveryPercentage(
      drilledLength,
      recoveredLength,
    ),
    conditionTagIds: values.conditionTagIds,
    conditionTagLabelsSnapshot: values.conditionTagIds.map((tagId) => {
      const tag = runConditionTags.find(({ localId }) => localId === tagId);
      if (tag === undefined) {
        throw new Error(`Unknown run condition tag: ${tagId}.`);
      }
      return tag.label;
    }),
    comment: values.comment,
    correctionIds: values.correctionIds,
    activeBitSerialNumberSnapshot: "BIT-HQ-002193",
    activeReamerSerialNumberSnapshot: "REA-HQ-000912",
    activeBitAssignmentId: "assignment-bit-002193-ddh041",
    activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
    casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
    status: values.status,
    holeNameSnapshot: "DDH041",
    rigNameSnapshot: "Rig 10",
  };
}

export const ddh041Runs: readonly Run[] = [
  createSeedRun({
    localId: "run-ddh041-215",
    shiftIds: ["shift-ddh041-day-18"],
    runNumber: 215,
    rodNumber: 110,
    startedAt: "2026-03-18T08:10:00.000Z",
    completedAt: "2026-03-18T11:30:00.000Z",
    startedByUserId: "user-driller-hayes",
    startedByNameSnapshot: "Jordan Hayes",
    rodAddedLength: null,
    previousCompletedDepthDm: 6_436,
    measuredStickUpDm: 39,
    rodStringDm: 6_505,
    recoveredLengthDm: 29,
    conditionTagIds: ["run-tag-competent"],
    comment: null,
    correctionIds: [],
    status: "completed",
  }),
  createSeedRun({
    localId: "run-ddh041-216",
    shiftIds: ["shift-ddh041-night-18"],
    runNumber: 216,
    rodNumber: 110,
    startedAt: "2026-03-18T20:20:00.000Z",
    completedAt: "2026-03-18T23:40:00.000Z",
    startedByUserId: "user-driller-ward",
    startedByNameSnapshot: "Casey Ward",
    rodAddedLength: null,
    previousCompletedDepthDm: 6_466,
    measuredStickUpDm: 9,
    rodStringDm: 6_505,
    recoveredLengthDm: 31,
    conditionTagIds: ["run-tag-core-gain"],
    comment: "Core gain confirmed during tray reconciliation.",
    correctionIds: ["correction-ddh041-run-216"],
    status: "corrected",
  }),
  createSeedRun({
    localId: "run-ddh041-217",
    shiftIds: ["shift-ddh041-day-19"],
    runNumber: 217,
    rodNumber: 111,
    startedAt: "2026-03-19T07:10:00.000Z",
    completedAt: "2026-03-19T10:35:00.000Z",
    startedByUserId: "user-driller-hayes",
    startedByNameSnapshot: "Jordan Hayes",
    rodAddedLength: SIX_METRE_ROD_LENGTH,
    previousCompletedDepthDm: 6_496,
    measuredStickUpDm: 39,
    rodStringDm: 6_565,
    recoveredLengthDm: 30,
    conditionTagIds: ["run-tag-competent"],
    comment: "6 m rod added before run.",
    correctionIds: [],
    status: "completed",
  }),
  createSeedRun({
    localId: "run-ddh041-218",
    shiftIds: ["shift-ddh041-night-19"],
    runNumber: 218,
    rodNumber: 111,
    startedAt: "2026-03-19T20:15:00.000Z",
    completedAt: "2026-03-19T23:55:00.000Z",
    startedByUserId: "user-driller-ward",
    startedByNameSnapshot: "Casey Ward",
    rodAddedLength: null,
    previousCompletedDepthDm: 6_526,
    measuredStickUpDm: 9,
    rodStringDm: 6_565,
    recoveredLengthDm: 28,
    conditionTagIds: ["run-tag-broken"],
    comment: "Broken ground and minor wash observed.",
    correctionIds: [],
    status: "completed",
  }),
  createSeedRun({
    localId: "run-ddh041-219",
    shiftIds: ["shift-ddh041-day-20"],
    runNumber: 219,
    rodNumber: 112,
    startedAt: "2026-03-20T07:10:00.000Z",
    completedAt: "2026-03-20T11:00:00.000Z",
    startedByUserId: "user-driller-hayes",
    startedByNameSnapshot: "Jordan Hayes",
    rodAddedLength: SIX_METRE_ROD_LENGTH,
    previousCompletedDepthDm: 6_556,
    measuredStickUpDm: 39,
    rodStringDm: 6_625,
    recoveredLengthDm: 29,
    conditionTagIds: ["run-tag-competent"],
    comment: "6 m rod added before run.",
    correctionIds: [],
    status: "completed",
  }),
  createSeedRun({
    localId: "run-ddh041-220",
    shiftIds: ["shift-ddh041-day-20", "shift-ddh041-night-20"],
    runNumber: 220,
    rodNumber: ddh041CurrentState.rodNumber,
    startedAt: "2026-03-20T17:40:00.000Z",
    completedAt: null,
    startedByUserId: "user-driller-hayes",
    startedByNameSnapshot: "Jordan Hayes",
    rodAddedLength: null,
    previousCompletedDepthDm: 6_586,
    measuredStickUpDm: 10,
    rodStringDm: 6_625,
    recoveredLengthDm: 28,
    conditionTagIds: ["run-tag-competent"],
    comment: "Run continued across day/night handover.",
    correctionIds: [],
    status: "in_progress",
  }),
];

export const ddh041CasingStrings: readonly CasingString[] = [
  {
    ...metadata("casing-pq-ddh041", "2026-07-21T08:00:00.000Z"),
    holeId: "DDH041",
    label: "PQ casing",
    casingSize: "PQ",
    startDepthDm: metresToDecimetres(0),
    currentEndDepthDm: metresToDecimetres(18),
    status: "ACTIVE",
    installedAt: "2026-07-20T06:00:00.000Z",
    installedByUserId: "user-driller-hoffman",
    installedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata("casing-hq-ddh041", "2026-07-20T09:00:00.000Z"),
    holeId: "DDH041",
    label: "HQ casing",
    casingSize: "HQ",
    startDepthDm: metresToDecimetres(0),
    currentEndDepthDm: metresToDecimetres(42),
    status: "ACTIVE",
    installedAt: "2026-07-20T09:00:00.000Z",
    installedByUserId: "user-driller-hoffman",
    installedByNameSnapshot: "M. Hoffman",
  },
];

export const ddh041CasingEvents: readonly CasingEvent[] = [
  {
    ...metadata("casing-event-pq-install", "2026-07-20T06:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-pq-ddh041",
    shiftId: "shift-ddh041-day-2026-07-21",
    eventType: "INSTALL",
    newEndDepthDm: metresToDecimetres(6),
    newStatus: "ACTIVE",
    comment: "Initial PQ casing installed.",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T06:00:00.000Z",
    operationId: "seed-casing-pq-install",
  },
  {
    ...metadata("casing-event-pq-advance", "2026-07-21T08:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-pq-ddh041",
    shiftId: "shift-ddh041-day-2026-07-21",
    eventType: "ADVANCE",
    previousEndDepthDm: metresToDecimetres(6),
    newEndDepthDm: metresToDecimetres(18),
    newStatus: "ACTIVE",
    comment: "PQ casing advanced after collar stabilization.",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-21T08:00:00.000Z",
    operationId: "seed-casing-pq-advance",
  },
  {
    ...metadata("casing-event-hq-install", "2026-07-20T09:00:00.000Z"),
    holeId: "DDH041",
    casingStringId: "casing-hq-ddh041",
    shiftId: "shift-ddh041-day-2026-07-21",
    eventType: "INSTALL",
    newEndDepthDm: metresToDecimetres(42),
    newStatus: "ACTIVE",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T09:00:00.000Z",
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
  const installedAt = "2026-02-01T06:00:00.000Z";
  const removedAt =
    endDepthDm === undefined ? undefined : "2026-03-01T08:00:00.000Z";
  return {
    ...metadata(localId, removedAt ?? "2026-07-21T08:00:00.000Z"),
    componentId,
    holeId,
    componentType,
    startDepthDm: decimetres(startDepthDm),
    endDepthDm:
      endDepthDm === undefined ? undefined : decimetres(endDepthDm),
    installedShiftId: "shift-ddh041-day-18",
    removedShiftId:
      endDepthDm === undefined ? undefined : "shift-ddh041-night-18",
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

export const ddh041Surveys: readonly Survey[] = [
  {
    ...metadata("survey-ddh041-350", "2026-07-20T08:00:00.000Z"),
    holeId: "DDH041",
    surveyToolId: "survey-tool-reflex-01",
    depthDm: metresToDecimetres(350),
    dipTenths: -608,
    azimuthTenths: 1272,
    northReference: "GRID",
    toolNameSnapshot: "EZ-TRAC",
    toolSerialSnapshot: "EZT-18427",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T08:00:00.000Z",
  },
  {
    ...metadata("survey-ddh041-375", "2026-07-20T10:00:00.000Z"),
    holeId: "DDH041",
    surveyToolId: "survey-tool-reflex-01",
    depthDm: metresToDecimetres(375),
    dipTenths: -611,
    azimuthTenths: 1279,
    northReference: "GRID",
    toolNameSnapshot: "EZ-TRAC",
    toolSerialSnapshot: "EZT-18427",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T10:00:00.000Z",
  },
  {
    ...metadata("survey-ddh041-400", "2026-07-20T12:00:00.000Z"),
    holeId: "DDH041",
    surveyToolId: "survey-tool-reflex-01",
    depthDm: metresToDecimetres(400),
    dipTenths: -614,
    azimuthTenths: 1288,
    northReference: "GRID",
    toolNameSnapshot: "EZ-TRAC",
    toolSerialSnapshot: "EZT-18427",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    ...metadata("survey-ddh041-425", "2026-07-20T14:00:00.000Z"),
    holeId: "DDH041",
    surveyToolId: "survey-tool-reflex-01",
    depthDm: metresToDecimetres(425),
    dipTenths: -621,
    azimuthTenths: 1298,
    northReference: "GRID",
    toolNameSnapshot: "EZ-TRAC",
    toolSerialSnapshot: "EZT-18427",
    comment: "Survey completed after Run 148.",
    photoId: "photo-ddh041-survey-425",
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T14:00:00.000Z",
  },
];

export const ddh041HoleEvents: readonly HoleEvent[] = [
  {
    ...metadata("hole-event-ddh041-started"),
    holeId: ddh041.localId,
    shiftId: null,
    eventType: "started",
    occurredAt: "2026-02-01T06:00:00.000Z",
    depth: metresToDecimetres(0),
    summary: "DDH041 drilling commenced",
    details: { plannedDepthDm: 7_500 },
    recordedByNameSnapshot: "Morgan Lee",
  },
  {
    ...metadata("hole-event-ddh041-casing", "2026-02-02T10:00:00.000Z"),
    holeId: ddh041.localId,
    shiftId: null,
    eventType: "casing_changed",
    occurredAt: "2026-02-02T10:00:00.000Z",
    depth: metresToDecimetres(18),
    summary: "PQ casing advanced from 6.0 m to 18.0 m",
    details: { casingSize: "PQ", previousDepthDm: 60, newDepthDm: 180 },
    recordedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata(
      "hole-event-ddh041-components",
      "2026-02-18T08:15:00.000Z",
    ),
    holeId: ddh041.localId,
    shiftId: null,
    eventType: "component_changed",
    occurredAt: "2026-02-18T08:15:00.000Z",
    depth: metresToDecimetres(412.6),
    summary: "Bit changed at 412.6 m",
    details: {
      outgoingBitSerial: "BIT-HQ-001842",
      incomingBitSerial: "BIT-HQ-002193",
    },
    recordedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata("hole-event-ddh041-bha", "2026-03-08T06:00:00.000Z"),
    holeId: ddh041.localId,
    shiftId: null,
    eventType: "configuration_changed",
    occurredAt: "2026-03-08T06:00:00.000Z",
    depth: metresToDecimetres(530),
    summary: "BHA changed from 4.5 m to 4.3 m",
    details: { previousBhaLengthDm: 45, newBhaLengthDm: 43 },
    recordedByNameSnapshot: "Morgan Lee",
  },
  {
    ...metadata(
      "hole-event-ddh041-stick-up",
      "2026-03-18T06:00:00.000Z",
    ),
    holeId: ddh041.localId,
    shiftId: "shift-ddh041-day-18",
    eventType: "configuration_changed",
    occurredAt: "2026-03-18T06:00:00.000Z",
    depth: metresToDecimetres(643.6),
    summary: "Constant stick-up remeasured from 2.0 m to 1.8 m",
    details: {
      previousConstantStickUpDm: 20,
      newConstantStickUpDm: 18,
    },
    recordedByNameSnapshot: "Morgan Lee",
  },
];

export const ddh041Trays: readonly Tray[] = [
  {
    ...metadata("tray-ddh041-109", "2026-03-19T06:00:00.000Z"),
    holeId: "DDH041",
    trayNumber: 109,
    startDepthDm: metresToDecimetres(643.6),
    endDepthDm: metresToDecimetres(649.6),
    comment: "Competent core with minor natural breaks.",
    primaryPhotoId: "photo-ddh041-tray-109",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-03-19T06:00:00.000Z",
  },
  {
    ...metadata("tray-ddh041-110", "2026-03-20T06:00:00.000Z"),
    holeId: "DDH041",
    trayNumber: 110,
    startDepthDm: metresToDecimetres(649.6),
    endDepthDm: metresToDecimetres(655.6),
    comment: "Broken interval recorded near the tray end.",
    primaryPhotoId: "photo-ddh041-tray-110",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-03-20T06:00:00.000Z",
  },
  {
    ...metadata("tray-ddh041-111", "2026-03-20T18:30:00.000Z"),
    holeId: "DDH041",
    trayNumber: 111,
    startDepthDm: metresToDecimetres(655.6),
    endDepthDm: metresToDecimetres(661.6),
    comment: "Completed tray with current metre marks.",
    primaryPhotoId: "photo-ddh041-tray-111-a",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-03-20T18:30:00.000Z",
  },
];

export const ddh041Photos: readonly Photo[] = [
  {
    ...metadata("photo-ddh041-tray-109"),
    holeId: "DDH041",
    entityType: "TRAY",
    entityId: "tray-ddh041-109",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-109.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-109.svg",
    originalFilename: "tray-109.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-03-19T05:40:00.000Z",
    description: "Completed core tray 109",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-tray-110"),
    holeId: "DDH041",
    entityType: "TRAY",
    entityId: "tray-ddh041-110",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-110.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-110.svg",
    originalFilename: "tray-110.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-03-20T05:35:00.000Z",
    description: "Completed core tray 110",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-tray-111-a"),
    holeId: "DDH041",
    entityType: "TRAY",
    entityId: "tray-ddh041-111",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-111.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-111.svg",
    originalFilename: "tray-111.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-03-20T12:10:00.000Z",
    description: "Completed core tray 111",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-survey-425", "2026-07-20T14:00:00.000Z"),
    holeId: "DDH041",
    entityType: "SURVEY",
    entityId: "survey-ddh041-425",
    category: "SURVEY",
    originalStorageKey: "bundled:/images/targetlock/survey-425.svg",
    previewStorageKey: "bundled:/images/targetlock/survey-425.svg",
    originalFilename: "survey-425.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 3_072,
    capturedAt: "2026-07-20T14:00:00.000Z",
    description: "EZ-TRAC result display for the 425.0 m survey",
    createdByUserId: "user-driller-hoffman",
    createdByNameSnapshot: "M. Hoffman",
  },
];

export const ddh041Corrections: readonly Correction[] = [
  {
    ...metadata(
      "correction-ddh041-run-216",
      "2026-03-19T05:50:00.000Z",
      "queued",
    ),
    entityType: "run",
    entityLocalId: "run-ddh041-216",
    fieldName: "recoveredLength",
    previousValue: 30,
    correctedValue: 31,
    reason: "Included 0.1 m of compressed fragments after tray check",
    correctedAt: "2026-03-19T05:50:00.000Z",
    correctedByUserId: "user-geologist-patel",
    correctedByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("correction-ddh041-survey-650", "2026-03-19T12:20:00.000Z"),
    entityType: "survey",
    entityLocalId: "survey-ddh041-650",
    fieldName: "dipDegrees",
    previousValue: -61.1,
    correctedValue: -61.2,
    reason: "Corrected transcription against tool export",
    correctedAt: "2026-03-19T12:20:00.000Z",
    correctedByUserId: "user-geologist-patel",
    correctedByNameSnapshot: "Priya Patel",
  },
];

export const briggsReportRecipients: readonly ReportRecipient[] = [
  {
    ...metadata("report-recipient-client"),
    projectId: briggsProject.localId,
    name: "Alex Chen",
    email: "alex.chen@northridge.example",
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

export const ddh041SentReports: readonly SentReport[] = [
  {
    ...metadata("sent-report-ddh041-19", "2026-03-20T06:20:00.000Z"),
    projectId: briggsProject.localId,
    holeId: ddh041.localId,
    reportType: "daily",
    reportVersion: 1,
    shiftIds: ["shift-ddh041-day-19", "shift-ddh041-night-19"],
    generatedAt: "2026-03-20T06:10:00.000Z",
    sentAt: "2026-03-20T06:20:00.000Z",
    sentByUserId: "user-supervisor-lee",
    sentByNameSnapshot: "Morgan Lee",
    holeDepthSnapshot: metresToDecimetres(655.6),
    recipientIds: ["report-recipient-client", "report-recipient-ops"],
    recipientNamesSnapshot: ["Alex Chen", "Briggs Operations"],
    recipientEmailsSnapshot: [
      "alex.chen@northridge.example",
      "operations@briggs.example",
    ],
    localDocumentPath: "/seed/reports/ddh041-2026-03-19.pdf",
    attachmentsSnapshot: [
      {
        fileName: "ddh041-2026-03-19.pdf",
        localPath: "/seed/reports/ddh041-2026-03-19.pdf",
        mediaType: "application/pdf",
        sizeBytes: 284_160,
      },
      {
        fileName: "ddh041-2026-03-19-runs.csv",
        localPath: "/seed/reports/ddh041-2026-03-19-runs.csv",
        mediaType: "text/csv",
        sizeBytes: 12_844,
      },
    ],
    deliveryStatus: "sent",
  },
  {
    ...metadata("sent-report-ddh041-day-20", "2026-03-20T18:10:00.000Z"),
    projectId: briggsProject.localId,
    holeId: ddh041.localId,
    reportType: "shift",
    reportVersion: 1,
    shiftIds: ["shift-ddh041-day-20"],
    generatedAt: "2026-03-20T18:05:00.000Z",
    sentAt: "2026-03-20T18:10:00.000Z",
    sentByUserId: "user-supervisor-lee",
    sentByNameSnapshot: "Morgan Lee",
    holeDepthSnapshot: ddh041CurrentState.currentHoleDepth,
    recipientIds: ["report-recipient-ops"],
    recipientNamesSnapshot: ["Briggs Operations"],
    recipientEmailsSnapshot: ["operations@briggs.example"],
    localDocumentPath: "/seed/reports/ddh041-day-shift-2026-03-20.pdf",
    attachmentsSnapshot: [
      {
        fileName: "ddh041-day-shift-2026-03-20.pdf",
        localPath: "/seed/reports/ddh041-day-shift-2026-03-20.pdf",
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
      "sync-operation-photo-111-b",
      "2026-03-20T18:21:00.000Z",
      "queued",
    ),
    entityType: "photo",
    entityLocalId: "photo-ddh041-tray-111-b",
    operation: "create",
    operationStatus: "queued",
    queuedAt: "2026-03-20T18:21:00.000Z",
    attemptedAt: null,
    retryCount: 0,
    payload: {
      localPath: "/seed/placeholders/ddh041/tray-111-current-run.jpg",
      holeId: "DDH041",
    },
    lastError: null,
  },
  {
    ...metadata(
      "sync-operation-correction-216",
      "2026-03-20T18:25:00.000Z",
      "queued",
    ),
    entityType: "correction",
    entityLocalId: "correction-ddh041-run-216",
    operation: "create",
    operationStatus: "queued",
    queuedAt: "2026-03-20T18:25:00.000Z",
    attemptedAt: null,
    retryCount: 0,
    payload: {
      entityType: "run",
      entityLocalId: "run-ddh041-216",
      fieldName: "recoveredLength",
      correctedValue: 31,
    },
    lastError: null,
  },
];

export interface TargetLockStage1Seed {
  readonly organisation: Organisation;
  readonly users: readonly User[];
  readonly project: Project;
  readonly rig: Rig;
  readonly hole: Hole;
  readonly holeConfigurations: readonly HoleConfiguration[];
  readonly rodStringConfigurations: readonly RodStringConfiguration[];
  readonly rodEvents: readonly RodAddition[];
  readonly shifts: readonly RunbookShift[];
  readonly runs: readonly Run[];
  readonly runConditionTags: readonly RunConditionTag[];
  readonly casingStrings: readonly CasingString[];
  readonly casingEvents: readonly CasingEvent[];
  readonly components: readonly Component[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly surveys: readonly Survey[];
  readonly surveyTools: readonly SurveyTool[];
  readonly holeEvents: readonly HoleEvent[];
  readonly trays: readonly Tray[];
  readonly photos: readonly Photo[];
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
