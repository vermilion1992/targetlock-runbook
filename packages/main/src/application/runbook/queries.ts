import {
  compareShiftsNewestFirst,
  isSharedRun,
  runBelongsToCompletedShift,
  type AuditEntry,
  type Decimetres,
  type Run,
  type RunbookShift,
} from "@/domain";
import type { SavedRunSnapshot } from "@/infrastructure/drafts";

export interface ShiftRunView {
  readonly id: string;
  readonly runNumber: number;
  readonly startedShiftId: string;
  readonly completedShiftId: string | null;
  readonly startedByNameSnapshot: string;
  readonly completedByNameSnapshot: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly holeDepthDm: Decimetres;
  readonly drilledLengthDm: Decimetres;
  readonly recoveredLengthDm: Decimetres;
  readonly recoveryPercentage: number;
  readonly status: "in_progress" | "completed" | "corrected";
  readonly shared: boolean;
  readonly activeBitSerialNumberSnapshot: string | null;
  readonly activeReamerSerialNumberSnapshot: string | null;
}

export interface ShiftRunGroup {
  readonly shift: RunbookShift;
  readonly runs: readonly ShiftRunView[];
  readonly firstRunNumber?: number;
  readonly lastRunNumber?: number;
  readonly sharedRunCount: number;
}

function seedRunView(run: Run): ShiftRunView {
  return {
    id: run.localId,
    runNumber: run.runNumber,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId,
    startedByNameSnapshot: run.startedByNameSnapshot,
    completedByNameSnapshot: run.completedByNameSnapshot,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    holeDepthDm: run.holeDepth,
    drilledLengthDm: run.drilledLength,
    recoveredLengthDm: run.recoveredLength,
    recoveryPercentage: run.recoveryPercentage,
    status: run.status,
    shared: isSharedRun(run),
    activeBitSerialNumberSnapshot: run.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: run.activeReamerSerialNumberSnapshot,
  };
}

function localRunView(run: SavedRunSnapshot): ShiftRunView {
  return {
    id: run.localId,
    runNumber: run.runNumber,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId,
    startedByNameSnapshot: run.startedByNameSnapshot,
    completedByNameSnapshot: run.completedByNameSnapshot,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    holeDepthDm: run.holeDepthDm as Decimetres,
    drilledLengthDm: run.drilledLengthDm as Decimetres,
    recoveredLengthDm: run.recoveredLengthDm as Decimetres,
    recoveryPercentage: run.recoveryPercentage,
    status: "completed",
    shared: run.startedShiftId !== run.completedShiftId,
    activeBitSerialNumberSnapshot: run.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: run.activeReamerSerialNumberSnapshot,
  };
}

export function getShiftRunGroups(input: {
  readonly shifts: readonly RunbookShift[];
  readonly seedRuns: readonly Run[];
  readonly localRuns: readonly SavedRunSnapshot[];
}): readonly ShiftRunGroup[] {
  const localIds = new Set(input.localRuns.map(({ localId }) => localId));
  const localNumbers = new Set(input.localRuns.map(({ runNumber }) => runNumber));
  const runs = [
    ...input.seedRuns
      .filter(
        (run) =>
          !localIds.has(run.localId) && !localNumbers.has(run.runNumber),
      )
      .map(seedRunView),
    ...input.localRuns.map(localRunView),
  ];

  return [...input.shifts]
    .sort(compareShiftsNewestFirst)
    .map((shift) => {
      const grouped = runs
        .filter((run) => runBelongsToCompletedShift(run, shift.localId))
        .sort((left, right) => left.runNumber - right.runNumber);
      return {
        shift,
        runs: grouped,
        firstRunNumber: grouped.at(0)?.runNumber,
        lastRunNumber: grouped.at(-1)?.runNumber,
        sharedRunCount: grouped.filter(({ shared }) => shared).length,
      };
    });
}

export interface ShiftStatistics {
  readonly dayShiftRuns: number;
  readonly nightShiftRuns: number;
  readonly sharedRuns: number;
  readonly totalHandovers: number;
  readonly runsByPrimaryDriller: Readonly<Record<string, number>>;
}

export function getShiftStatistics(
  groups: readonly ShiftRunGroup[],
): ShiftStatistics {
  const runsByPrimaryDriller: Record<string, number> = {};
  let dayShiftRuns = 0;
  let nightShiftRuns = 0;
  let sharedRuns = 0;
  let totalHandovers = 0;

  for (const group of groups) {
    if (group.shift.shiftType === "DAY") dayShiftRuns += group.runs.length;
    else nightShiftRuns += group.runs.length;
    sharedRuns += group.sharedRunCount;
    if (group.shift.handoverAcceptedAt !== undefined) totalHandovers += 1;
    runsByPrimaryDriller[group.shift.primaryDrillerNameSnapshot] =
      (runsByPrimaryDriller[group.shift.primaryDrillerNameSnapshot] ?? 0) +
      group.runs.length;
  }
  return {
    dayShiftRuns,
    nightShiftRuns,
    sharedRuns,
    totalHandovers,
    runsByPrimaryDriller,
  };
}

export interface ShiftTimelineEntry {
  readonly id: string;
  readonly depthDm: Decimetres;
  readonly occurredAt: string;
  readonly title: string;
  readonly detail: string;
}

export function getShiftTimelineEntries(
  entries: readonly AuditEntry[],
): readonly ShiftTimelineEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.depthDm !== undefined &&
        [
          "shift_started",
          "shift_close_requested",
          "handover_accepted",
          "unfinished_run_transferred",
        ].includes(entry.action),
    )
    .map((entry) => ({
      id: entry.localId,
      depthDm: entry.depthDm!,
      occurredAt: entry.timestamp,
      title:
        entry.action === "shift_started"
          ? "Runbook shift started"
          : entry.action === "shift_close_requested"
            ? "Shift closed for handover"
            : entry.action === "handover_accepted"
              ? "Shift handover accepted"
              : "Shared run transferred between shifts",
      detail: `${entry.userNameSnapshot} · ${entry.action.replaceAll("_", " ")}`,
    }));
}

export interface OperationalTimelineEntry extends ShiftTimelineEntry {
  readonly category: "Casing" | "Component" | "Shift" | "Hole";
  readonly entityType: string;
  readonly entityId: string;
}

const operationalActions = new Set([
  "shift_started",
  "shift_close_requested",
  "handover_accepted",
  "unfinished_run_transferred",
  "casing_installed",
  "casing_advanced",
  "casing_shortened",
  "casing_corrected",
  "casing_removed",
  "casing_status_changed",
  "component_assigned",
  "bit_changed",
  "reamer_changed",
  "component_lost_downhole",
  "component_assignment_corrected",
  "hole_completed_timeline",
  "hole_abandoned_timeline",
  "hole_reopened_timeline",
]);

export function getOperationalTimelineEntries(
  entries: readonly AuditEntry[],
): readonly OperationalTimelineEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.depthDm !== undefined && operationalActions.has(entry.action),
    )
    .map((entry) => {
      const category =
        entry.entityType === "casing"
          ? "Casing"
          : entry.entityType.startsWith("component")
            ? "Component"
            : entry.entityType === "hole" || entry.entityType === "hole_timeline"
              ? "Hole"
              : "Shift";
      const title =
        entry.action === "bit_changed"
          ? "Bit changed"
          : entry.action === "reamer_changed"
            ? "Reamer changed"
            : entry.action === "component_lost_downhole"
              ? "Component lost downhole"
              : entry.action === "component_assigned"
                ? "Component assigned"
                : entry.action === "component_assignment_corrected"
                  ? "Component assignment corrected"
                  : entry.action.startsWith("casing_")
                    ? entry.action.replaceAll("_", " ")
                    : entry.action === "shift_started"
                      ? "Runbook shift started"
                      : entry.action === "shift_close_requested"
                        ? "Shift closed for handover"
                        : entry.action === "handover_accepted"
                          ? "Shift handover accepted"
                          : entry.action === "unfinished_run_transferred"
                            ? "Shared run transferred between shifts"
                            : entry.action === "hole_completed_timeline"
                              ? "Hole completed"
                              : entry.action === "hole_abandoned_timeline"
                                ? "Hole abandoned"
                                : entry.action === "hole_reopened_timeline"
                                  ? "Hole reopened"
                                  : entry.action.replaceAll("_", " ");
      const outgoing = entry.metadata.outgoingSerialNumber;
      const incoming = entry.metadata.incomingSerialNumber;
      const detail =
        typeof outgoing === "string" && typeof incoming === "string"
          ? `${outgoing} → ${incoming} · ${entry.userNameSnapshot}`
          : `${entry.userNameSnapshot} · ${entry.action.replaceAll("_", " ")}`;
      return {
        id: entry.localId,
        depthDm: entry.depthDm!,
        occurredAt: entry.timestamp,
        title,
        detail,
        category,
        entityType: entry.entityType,
        entityId: entry.entityId,
      };
    });
}
