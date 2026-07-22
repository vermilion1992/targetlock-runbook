import type { Run, RunbookShift, ShiftStatus, ShiftType } from "./models";

export function isActiveShiftStatus(status: ShiftStatus): boolean {
  return status === "OPEN" || status === "HANDOVER_PENDING";
}

export function isRunbookShiftActive(shift: RunbookShift): boolean {
  return isActiveShiftStatus(shift.status);
}

export function shiftTypeLabel(shiftType: ShiftType): string {
  return shiftType === "DAY" ? "Day Shift" : "Night Shift";
}

export function isSharedRun(
  run: Pick<Run, "startedShiftId" | "completedShiftId">,
): boolean {
  return (
    run.completedShiftId !== null &&
    run.startedShiftId !== run.completedShiftId
  );
}

export function runBelongsToCompletedShift(
  run: Pick<Run, "startedShiftId" | "completedShiftId">,
  shiftId: string,
): boolean {
  return (run.completedShiftId ?? run.startedShiftId) === shiftId;
}

export function compareShiftsNewestFirst(
  left: Pick<RunbookShift, "startedAt">,
  right: Pick<RunbookShift, "startedAt">,
): number {
  return Date.parse(right.startedAt) - Date.parse(left.startedAt);
}
