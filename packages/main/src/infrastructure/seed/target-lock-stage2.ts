import { decimetres, type AuditEntry, type SyncMetadata } from "@/domain";
import type { RunDraftPayload } from "@/infrastructure/drafts";
import {
  ddh041CurrentState,
  ddh041RodEvents,
  ddh041Runs,
  ddh041Shifts,
  targetLockStage1Seed,
  type TargetLockStage1Seed,
} from "./target-lock-stage1";

const DEVICE_ID = "seed-tablet-rig-10";

function metadata(localId: string, updatedAt: string): SyncMetadata {
  return {
    localId,
    serverId: `server-${localId}`,
    syncStatus: "synced",
    createdAt: updatedAt,
    updatedAt,
    deviceId: DEVICE_ID,
    version: 1,
  };
}

/**
 * Stage 2 previously layered a short recent-shift fixture on Stage 1.
 * The mid-hole demo sandbox is now the full operational story, so Stage 2
 * re-exports that sandbox and keeps an unfinished-draft fixture for recovery.
 */
export const ddh041Stage2Shifts = ddh041Shifts;
export const ddh041Stage2Runs = ddh041Runs;
export const ddh041Stage2RodEvents = ddh041RodEvents.filter(
  ({ runId }) => runId !== null,
);
export const ddh041Stage2CurrentState = ddh041CurrentState;

const openShift = ddh041Stage2Shifts.find(({ status }) => status === "OPEN");
const openRun = ddh041Stage2Runs.find(({ status }) => status === "in_progress");

export const ddh041Stage2UnfinishedDraft: RunDraftPayload = {
  localId: openRun?.localId ?? "run-ddh041-open-draft",
  startedAt: openRun?.startedAt ?? "2026-06-30T07:20:00.000Z",
  startedShiftId: openShift?.localId ?? "shift-ddh041-day-open",
  startedByUserId: openRun?.startedByUserId ?? "user-driller-hayes",
  startedByNameSnapshot: openRun?.startedByNameSnapshot ?? "Jordan Hayes",
  context: {
    runNumber: openRun?.runNumber ?? ddh041Stage2CurrentState.rodNumber,
    rodNumber: ddh041Stage2CurrentState.rodNumber,
    currentRodStringDm: Number(ddh041Stage2CurrentState.currentRodString),
    previousCompletedDepthDm: Number(
      ddh041Stage2CurrentState.previousCompletedDepth,
    ),
  },
  pendingRodEvents: [],
  stickUpMetresInput: "",
  recoveredMetresInput: "",
  conditionTagIds: [],
  comment: "Open mid-hole demo run draft for unfinished-run recovery coverage.",
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

const lastClosed = [...ddh041Stage2Shifts]
  .reverse()
  .find(({ status }) => status === "CLOSED");

export const ddh041Stage2AuditEntries: readonly AuditEntry[] = [
  stage2Audit(
    "audit-stage2-open-started",
    openShift?.localId ?? "shift-ddh041-open",
    "shift_started",
    openShift?.primaryDrillerId ?? "user-driller-hayes",
    openShift?.primaryDrillerNameSnapshot ?? "Jordan Hayes",
    openShift?.startedAt ?? "2026-06-30T06:00:00.000Z",
    Number(openShift?.startingDepthDm ?? 6_270),
  ),
  stage2Audit(
    "audit-stage2-last-close",
    lastClosed?.localId ?? "shift-ddh041-closed",
    "shift_close_requested",
    lastClosed?.primaryDrillerId ?? "user-driller-smith",
    lastClosed?.primaryDrillerNameSnapshot ?? "J. Smith",
    lastClosed?.closedAt ?? "2026-06-30T06:00:00.000Z",
    Number(lastClosed?.endingDepthDm ?? 6_270),
  ),
  stage2Audit(
    "audit-stage2-open-run",
    openRun?.localId ?? "run-ddh041-open",
    "run_started",
    openRun?.startedByUserId ?? "user-driller-hayes",
    openRun?.startedByNameSnapshot ?? "Jordan Hayes",
    openRun?.startedAt ?? "2026-06-30T07:20:00.000Z",
    Number(openRun?.previousCompletedDepth ?? 6_270),
  ),
];

export const targetLockStage2Seed: TargetLockStage1Seed = {
  ...targetLockStage1Seed,
  shifts: ddh041Stage2Shifts,
  runs: ddh041Stage2Runs,
  rodEvents: ddh041RodEvents,
};
