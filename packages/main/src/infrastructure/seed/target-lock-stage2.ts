import {
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRecoveryPercentage,
  decimetres,
  metresToDecimetres,
  SIX_METRE_ROD_LENGTH,
  type AuditEntry,
  type RodAddition,
  type Run,
  type RunbookShift,
  type SyncMetadata,
} from "@/domain";
import type { RunDraftPayload } from "@/infrastructure/drafts";
import {
  targetLockStage1Seed,
  type TargetLockStage1Seed,
} from "./target-lock-stage1";

const DEVICE_ID = "seed-tablet-rig-10";
const CREATED_AT = "2026-07-21T08:00:00.000Z";

function metadata(localId: string, updatedAt = CREATED_AT): SyncMetadata {
  return {
    localId,
    serverId: `server-${localId}`,
    syncStatus: "synced",
    createdAt: CREATED_AT,
    updatedAt,
    deviceId: DEVICE_ID,
    version: 1,
  };
}

const DAY_SHIFT_ID = "shift-ddh041-day-2026-07-21";
const NIGHT_SHIFT_ID = "shift-ddh041-night-2026-07-21";
const HOFFMAN_ID = "user-driller-hoffman";
const SMITH_ID = "user-driller-smith";

interface Stage2RunSpec {
  readonly runNumber: number;
  readonly previousDepthDm: number;
  readonly rodStringDm: number;
  readonly stickUpDm: number;
  readonly rodNumber: number;
  readonly startedShiftId: string;
  readonly completedShiftId: string;
  readonly startedById: string;
  readonly startedByName: string;
  readonly completedById: string;
  readonly completedByName: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

function createStage2Run(spec: Stage2RunSpec): Run {
  const rodString = decimetres(spec.rodStringDm);
  const stickUp = decimetres(spec.stickUpDm);
  const previousDepth = decimetres(spec.previousDepthDm);
  const holeDepth = calculateHoleDepth(rodString, stickUp);
  const drilled = calculateDrilledLength(holeDepth, previousDepth);
  const recovered = decimetres(Math.max(0, drilled - (spec.runNumber % 4 === 0 ? 1 : 0)));
  const shared = spec.startedShiftId !== spec.completedShiftId;
  return {
    ...metadata(`run-ddh041-${spec.runNumber}`, spec.completedAt),
    holeId: targetLockStage1Seed.hole.localId,
    startedShiftId: spec.startedShiftId,
    completedShiftId: spec.completedShiftId,
    runNumber: spec.runNumber,
    rodNumber: spec.rodNumber,
    startedAt: spec.startedAt,
    startedByUserId: spec.startedById,
    startedByNameSnapshot: spec.startedByName,
    completedAt: spec.completedAt,
    completedByUserId: spec.completedById,
    completedByNameSnapshot: spec.completedByName,
    rodEventIds: [],
    rodAddedLength: null,
    previousCompletedDepth: previousDepth,
    startDepth: previousDepth,
    measuredStickUp: stickUp,
    rodStringLength: rodString,
    holeDepth,
    drilledLength: drilled,
    recoveredLength: recovered,
    recoveryPercentage: calculateRecoveryPercentage(drilled, recovered),
    conditionTagIds: ["run-tag-competent"],
    conditionTagLabelsSnapshot: ["Competent ground"],
    comment: shared ? "Run completed across the day/night handover." : null,
    correctionIds: [],
    activeBitSerialNumberSnapshot: "BIT-HQ-002193",
    activeReamerSerialNumberSnapshot: "REA-HQ-000912",
    activeBitAssignmentId: "assignment-bit-002193-ddh041",
    activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
    casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
    status: "completed",
    holeNameSnapshot: "DDH041",
    rigNameSnapshot: "Rig 10",
  };
}

const dayStates = [
  [221, 6_268, 6_295, 0, 106],
  [222, 6_295, 6_325, 1, 107],
  [223, 6_324, 6_385, 31, 108],
  [224, 6_354, 6_385, 1, 108],
  [225, 6_384, 6_445, 31, 109],
  [226, 6_414, 6_445, 1, 109],
  [227, 6_444, 6_505, 31, 110],
  [228, 6_474, 6_505, 1, 110],
  [229, 6_504, 6_565, 31, 111],
  [230, 6_534, 6_565, 1, 111],
  [231, 6_564, 6_625, 31, 112],
  [232, 6_594, 6_625, 10, 112],
] as const;

const nightStates = [
  [233, 6_615, 6_625, 1, 112],
  [234, 6_624, 6_685, 31, 113],
  [235, 6_654, 6_685, 1, 113],
  [236, 6_684, 6_745, 31, 114],
  [237, 6_714, 6_745, 1, 114],
  [238, 6_744, 6_805, 31, 115],
  [239, 6_774, 6_805, 1, 115],
  [240, 6_804, 6_865, 31, 116],
  [241, 6_834, 6_865, 1, 116],
  [242, 6_864, 6_925, 31, 117],
  [243, 6_894, 6_925, 1, 117],
  [244, 6_924, 6_985, 31, 118],
  [245, 6_954, 6_985, 1, 118],
] as const;

function timestampAfter(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60_000).toISOString();
}

export const ddh041Stage2Runs: readonly Run[] = [
  ...dayStates.map(([runNumber, previousDepthDm, rodStringDm, stickUpDm, rodNumber], index) =>
    createStage2Run({
      runNumber,
      previousDepthDm,
      rodStringDm,
      stickUpDm,
      rodNumber,
      startedShiftId: DAY_SHIFT_ID,
      completedShiftId: DAY_SHIFT_ID,
      startedById: HOFFMAN_ID,
      startedByName: "M. Hoffman",
      completedById: HOFFMAN_ID,
      completedByName: "M. Hoffman",
      startedAt: `2026-07-21T${String(8 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "05" : "35"}:00.000Z`,
      completedAt: `2026-07-21T${String(8 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "30" : "59"}:00.000Z`,
    }),
  ),
  ...nightStates.map(([runNumber, previousDepthDm, rodStringDm, stickUpDm, rodNumber], index) =>
    createStage2Run({
      runNumber,
      previousDepthDm,
      rodStringDm,
      stickUpDm,
      rodNumber,
      startedShiftId: runNumber === 233 ? DAY_SHIFT_ID : NIGHT_SHIFT_ID,
      completedShiftId: NIGHT_SHIFT_ID,
      startedById: runNumber === 233 ? HOFFMAN_ID : SMITH_ID,
      startedByName: runNumber === 233 ? "M. Hoffman" : "J. Smith",
      completedById: SMITH_ID,
      completedByName: "J. Smith",
      startedAt:
        runNumber === 233
          ? "2026-07-21T17:52:00.000Z"
          : timestampAfter("2026-07-21T18:15:00.000Z", index * 30),
      completedAt:
        runNumber === 233
          ? "2026-07-21T18:24:00.000Z"
          : timestampAfter("2026-07-21T18:40:00.000Z", index * 30),
    }),
  ),
];

// Stage 1 rod events already end at rod 112 / R/S 662.5 m (end of the Stage 2
// Day Shift). Only Night Shift Stage 2 additions are appended so projection
// remains continuous through rod 118 / R/S 698.5 m.
const stage2AdditionSpecs = [234, 236, 238, 240, 242, 244] as const;

const stage1RodEventSequenceEnd = targetLockStage1Seed.rodEvents.reduce(
  (maximum, event) => Math.max(maximum, event.sequence),
  0,
);

export const ddh041Stage2RodEvents: readonly RodAddition[] =
  stage2AdditionSpecs.map((runNumber, index) => {
    const startingRod = 112;
    return {
      ...metadata(`rod-event-ddh041-stage2-${index + 1}`),
      holeId: targetLockStage1Seed.hole.localId,
      runId: `run-ddh041-${runNumber}`,
      shiftId: NIGHT_SHIFT_ID,
      sequence: stage1RodEventSequenceEnd + index + 1,
      action: "add",
      rodLength: SIX_METRE_ROD_LENGTH,
      affectedRodNumber: startingRod + index + 1,
      rodNumberAfterEvent: startingRod + index + 1,
      occurredAt: ddh041Stage2Runs.find((run) => run.runNumber === runNumber)!
        .startedAt,
      recordedByUserId: SMITH_ID,
      recordedByNameSnapshot: "J. Smith",
    };
  });

export const ddh041Stage2Shifts: readonly RunbookShift[] = [
  {
    ...metadata(DAY_SHIFT_ID, "2026-07-21T18:00:00.000Z"),
    holeId: "DDH041",
    rigId: targetLockStage1Seed.rig.localId,
    shiftType: "DAY",
    shiftDate: "2026-07-21",
    primaryDrillerId: HOFFMAN_ID,
    primaryDrillerNameSnapshot: "M. Hoffman",
    crewMembers: [{ userId: HOFFMAN_ID, name: "M. Hoffman", role: "Driller" }],
    startedAt: "2026-07-21T06:00:00.000Z",
    closedAt: "2026-07-21T18:00:00.000Z",
    startingDepthDm: metresToDecimetres(626.8),
    endingDepthDm: metresToDecimetres(661.5),
    startingRodNumber: 106,
    endingRodNumber: 112,
    startingRodStringDm: metresToDecimetres(629.5),
    endingRodStringDm: metresToDecimetres(662.5),
    startingMeasuredStickUpDm: metresToDecimetres(2.7),
    endingMeasuredStickUpDm: metresToDecimetres(1),
    startingRunNumber: 221,
    endingRunNumber: 232,
    handoverNote: "Core slightly broken near the end of the last run.",
    handoverRunId: "run-ddh041-233",
    handoverRunNumber: 233,
    handoverAcceptedBy: SMITH_ID,
    handoverAcceptedByNameSnapshot: "J. Smith",
    handoverAcceptedAt: "2026-07-21T18:02:00.000Z",
    status: "CLOSED",
  },
  {
    ...metadata(NIGHT_SHIFT_ID, "2026-07-22T06:00:00.000Z"),
    holeId: "DDH041",
    rigId: targetLockStage1Seed.rig.localId,
    shiftType: "NIGHT",
    shiftDate: "2026-07-21",
    primaryDrillerId: SMITH_ID,
    primaryDrillerNameSnapshot: "J. Smith",
    crewMembers: [{ userId: SMITH_ID, name: "J. Smith", role: "Driller" }],
    startedAt: "2026-07-21T18:02:00.000Z",
    closedAt: "2026-07-22T06:00:00.000Z",
    startingDepthDm: metresToDecimetres(661.5),
    endingDepthDm: metresToDecimetres(698.4),
    startingRodNumber: 112,
    endingRodNumber: 118,
    startingRodStringDm: metresToDecimetres(662.5),
    endingRodStringDm: metresToDecimetres(698.5),
    startingMeasuredStickUpDm: metresToDecimetres(1),
    endingMeasuredStickUpDm: metresToDecimetres(0.1),
    startingRunNumber: 233,
    endingRunNumber: 245,
    handoverNote: "Shared run 233 completed; string and trays reconciled.",
    status: "CLOSED",
  },
];

export const ddh041Stage2UnfinishedDraft: RunDraftPayload = {
  localId: "run-ddh041-246",
  startedAt: "2026-07-22T05:52:00.000Z",
  startedShiftId: NIGHT_SHIFT_ID,
  startedByUserId: SMITH_ID,
  startedByNameSnapshot: "J. Smith",
  context: {
    runNumber: 246,
    rodNumber: 118,
    currentRodStringDm: 6_985,
    previousCompletedDepthDm: 6_984,
  },
  pendingRodEvents: [
    {
      localId: "pending-rod-ddh041-246",
      action: "add",
      rodLengthDm: 30,
    },
  ],
  stickUpMetresInput: "",
  recoveredMetresInput: "",
  conditionTagIds: [],
  comment: "Draft fixture for unfinished-run handover coverage.",
  activeBitAssignmentId: "assignment-bit-002193-ddh041",
  activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
  activeBitSerialNumberSnapshot: "BIT-HQ-002193",
  activeReamerSerialNumberSnapshot: "REA-HQ-000912",
  casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
};

function stage2Audit(
  id: string,
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  timestamp: string,
  depthDm: number,
): AuditEntry {
  return {
    ...metadata(id, timestamp),
    holeId: "DDH041",
    entityType: action.includes("run") ? "run" : "shift",
    entityId,
    action,
    userId,
    userNameSnapshot: userName,
    timestamp,
    depthDm: decimetres(depthDm),
    metadata: {},
  };
}

export const ddh041Stage2AuditEntries: readonly AuditEntry[] = [
  stage2Audit("audit-stage2-day-started", DAY_SHIFT_ID, "shift_started", HOFFMAN_ID, "M. Hoffman", "2026-07-21T06:00:00.000Z", 6_268),
  stage2Audit("audit-stage2-day-close", DAY_SHIFT_ID, "shift_close_requested", HOFFMAN_ID, "M. Hoffman", "2026-07-21T18:00:00.000Z", 6_615),
  stage2Audit("audit-stage2-handover", DAY_SHIFT_ID, "handover_accepted", SMITH_ID, "J. Smith", "2026-07-21T18:02:00.000Z", 6_615),
  stage2Audit("audit-stage2-shared-run", "run-ddh041-233", "unfinished_run_transferred", SMITH_ID, "J. Smith", "2026-07-21T18:02:00.000Z", 6_615),
];

export const ddh041Stage2CurrentState = {
  activeThreeMetreRods: 4,
  activeSixMetreRods: 114,
  activeRodLength: metresToDecimetres(696),
  rodNumber: 118,
  bottomHoleAssemblyLength: metresToDecimetres(4.3),
  constantStickUp: metresToDecimetres(1.8),
  baseRodStringLength: metresToDecimetres(2.5),
  currentRodString: metresToDecimetres(698.5),
  measuredStickUp: metresToDecimetres(0.1),
  currentHoleDepth: metresToDecimetres(698.4),
  previousCompletedDepth: metresToDecimetres(698.4),
  drilledLength: metresToDecimetres(0),
  recoveredLength: metresToDecimetres(0),
  recoveryPercentage: 0,
} as const;

export const targetLockStage2Seed: TargetLockStage1Seed = {
  ...targetLockStage1Seed,
  shifts: ddh041Stage2Shifts,
  runs: ddh041Stage2Runs,
  rodEvents: [
    ...targetLockStage1Seed.rodEvents,
    ...ddh041Stage2RodEvents,
  ],
};
