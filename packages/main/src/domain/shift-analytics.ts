import {
  decimetres,
  formatMetres,
  type Decimetres,
} from "./measurements";
import type {
  CasingEvent,
  ComponentAssignment,
  RunbookShift,
  ShiftAnalyticsCloseSnapshot,
  Survey,
  Tray,
} from "./models";
import {
  averageInteger,
  elapsedMinutesBetween,
  medianInteger,
} from "./numeric";
import type { EffectiveRodEvent } from "./run-corrections";
import { calculateCoreLossOrGain } from "./run-results";
import { isSharedRun, runBelongsToCompletedShift } from "./shifts";
import { type SurveyIntervalReminder } from "./surveys";

export type { ShiftAnalyticsCloseSnapshot };

/** Run projection enriched with Shift attribution for analytics. */
export interface ShiftAnalyticsRun {
  readonly localId: string;
  readonly runNumber: number;
  readonly startedShiftId: string;
  readonly completedShiftId: string | null;
  readonly startedAt?: string;
  readonly completedAt?: string | null;
  readonly drilledLengthDm: number;
  readonly recoveredLengthDm: number;
  readonly holeDepthDm: number;
  readonly previousCompletedDepthDm: number;
  readonly status: "in_progress" | "completed" | "corrected" | "void";
  readonly rodEvents: readonly EffectiveRodEvent[];
}

/** Lightweight correction attribution for Shift-scoped counts. */
export interface ShiftAnalyticsCorrection {
  readonly id: string;
  readonly runId: string;
  readonly correctionType: string;
  readonly createdAt: string;
  /** Shift that owned the Run when the correction was applied, when known. */
  readonly shiftId?: string;
}

export type ShiftHandoverItemCode =
  | "UNFINISHED_RUN"
  | "SURVEY_INTERVAL"
  | "TRAY_IN_PROGRESS"
  | "ACTIVE_BIT"
  | "ACTIVE_REAMER"
  | "PENDING_STICK_UP";

export interface ShiftHandoverItem {
  readonly code: ShiftHandoverItemCode;
  readonly message: string;
}

export interface ShiftAnalytics {
  readonly shiftId: string;
  readonly holeId: string;

  readonly startingDepthDm: Decimetres;
  readonly endingDepthDm: Decimetres;
  readonly metresCompletedDm: Decimetres;

  readonly completedRunCount: number;
  readonly sharedRunCount: number;
  readonly voidedRunCount: number;
  readonly correctedRunCount: number;
  readonly unfinishedRunCount: number;

  readonly firstRunNumber?: number;
  readonly lastRunNumber?: number;

  readonly averageRunLengthDm?: Decimetres;
  readonly medianRunLengthDm?: Decimetres;
  readonly shortestRunLengthDm?: Decimetres;
  readonly longestRunLengthDm?: Decimetres;

  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
  readonly totalCoreLossDm: Decimetres;
  readonly totalCoreGainDm: Decimetres;

  readonly startingRodNumber: number;
  readonly endingRodNumber: number;
  readonly rodsAdded3m: number;
  readonly rodsAdded6m: number;
  readonly rodsRemoved: number;
  readonly netPhysicalRodChange: number;

  readonly startingRodStringDm: Decimetres;
  readonly endingRodStringDm: Decimetres;

  readonly bhaOrStickUpConfigChangeCount: number;

  readonly surveyCount: number;
  readonly trayCount: number;
  readonly casingEventCount: number;
  readonly bitChangeCount: number;
  readonly reamerChangeCount: number;
  /** Non-void Run correction events attributable to this Shift. */
  readonly runCorrectionCount: number;
  readonly warningAcknowledgementCount: number;

  readonly elapsedMinutes?: number;
  readonly grossMetresPerElapsedHourTenths?: number;
  readonly averageRecordedRunCycleMinutes?: number;
  readonly medianRecordedRunCycleMinutes?: number;

  readonly runLengthsByRunNumber: readonly {
    readonly runNumber: number;
    readonly drilledLengthDm: Decimetres;
    readonly recoveryPercentTenths: number;
    readonly shared: boolean;
  }[];

  readonly unresolvedItems: readonly ShiftHandoverItem[];

  readonly closeSnapshot?: ShiftAnalyticsCloseSnapshot;
  readonly analyticsAmended: boolean;
  readonly amendmentSummary?: {
    readonly originalMetresCompletedDm: Decimetres;
    readonly currentMetresCompletedDm: Decimetres;
    readonly originalWeightedRecoveryTenths?: number;
    readonly currentWeightedRecoveryTenths?: number;
    readonly responsibleCorrectionIds: readonly string[];
  };
}

export interface CalculateShiftAnalyticsInput {
  readonly shift: RunbookShift;
  readonly runs: readonly ShiftAnalyticsRun[];
  readonly surveys: readonly Survey[];
  readonly trays: readonly Tray[];
  readonly casingEvents: readonly CasingEvent[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly corrections: readonly ShiftAnalyticsCorrection[];
  /** Wall-clock "now" for open Shift elapsed duration. */
  readonly nowIso?: string;
  /** Live ending depth for open Shifts when Shift.endingDepthDm is unset. */
  readonly liveEndingDepthDm?: Decimetres;
  readonly liveEndingRodNumber?: number;
  readonly liveEndingRodStringDm?: Decimetres;
  readonly unfinishedRunNumber?: number;
  readonly surveyIntervalReminder?: SurveyIntervalReminder;
  readonly inProgressTrayNumber?: number;
  readonly activeBitSerial?: string;
  readonly activeReamerSerial?: string;
  readonly measuredStickUpMissing?: boolean;
  /** Include active-component handover notes (handover / close contexts). */
  readonly includeActiveComponentHandoverItems?: boolean;
  readonly warningAcknowledgementCount?: number;
  /** BHA / constant-stick-up configuration changes attributable to this Shift. */
  readonly bhaOrStickUpConfigChangeCount?: number;
}

function toDm(value: number): Decimetres {
  return decimetres(Math.max(0, Math.round(value)));
}

function recoveryPercentTenths(drilledDm: number, recoveredDm: number): number {
  if (drilledDm <= 0) return 0;
  return Math.round((recoveredDm / drilledDm) * 1_000);
}

export function toCloseAnalyticsSnapshot(
  analytics: ShiftAnalytics,
  capturedAt: string,
): ShiftAnalyticsCloseSnapshot {
  return {
    capturedAt,
    startingDepthDm: analytics.startingDepthDm,
    endingDepthDm: analytics.endingDepthDm,
    metresCompletedDm: analytics.metresCompletedDm,
    completedRunCount: analytics.completedRunCount,
    totalRecoveredDm: analytics.totalRecoveredDm,
    weightedRecoveryTenths: analytics.weightedRecoveryTenths,
    totalCoreLossDm: analytics.totalCoreLossDm,
    totalCoreGainDm: analytics.totalCoreGainDm,
    rodsAdded3m: analytics.rodsAdded3m,
    rodsAdded6m: analytics.rodsAdded6m,
    rodsRemoved: analytics.rodsRemoved,
  };
}

export function buildShiftHandoverItems(input: {
  readonly unfinishedRunNumber?: number;
  readonly surveyIntervalReminder?: SurveyIntervalReminder;
  readonly inProgressTrayNumber?: number;
  readonly activeBitSerial?: string;
  readonly activeReamerSerial?: string;
  readonly measuredStickUpMissing?: boolean;
  readonly includeActiveComponentHandoverItems?: boolean;
}): readonly ShiftHandoverItem[] {
  const items: ShiftHandoverItem[] = [];

  if (input.unfinishedRunNumber !== undefined) {
    items.push({
      code: "UNFINISHED_RUN",
      message: `Run ${input.unfinishedRunNumber} remains unfinished`,
    });
  }

  if (input.surveyIntervalReminder !== undefined) {
    const reminder = input.surveyIntervalReminder;
    if (reminder.status === "DUE_IN") {
      items.push({
        code: "SURVEY_INTERVAL",
        message: `Survey interval due in approximately ${formatMetres(reminder.distanceDm)}`,
      });
    } else if (reminder.status === "EXCEEDED") {
      items.push({
        code: "SURVEY_INTERVAL",
        message: `Survey interval exceeded by ${formatMetres(reminder.distanceDm)}`,
      });
    } else {
      items.push({
        code: "SURVEY_INTERVAL",
        message: "Survey interval is due now",
      });
    }
  }

  if (input.inProgressTrayNumber !== undefined) {
    items.push({
      code: "TRAY_IN_PROGRESS",
      message: `Tray ${input.inProgressTrayNumber} is in progress`,
    });
  }

  if (input.includeActiveComponentHandoverItems) {
    if (input.activeBitSerial !== undefined && input.activeBitSerial.length > 0) {
      items.push({
        code: "ACTIVE_BIT",
        message: `Bit ${input.activeBitSerial} remains active`,
      });
    }
    if (
      input.activeReamerSerial !== undefined &&
      input.activeReamerSerial.length > 0
    ) {
      items.push({
        code: "ACTIVE_REAMER",
        message: `Front reamer ${input.activeReamerSerial} remains active`,
      });
    }
  }

  if (input.measuredStickUpMissing) {
    items.push({
      code: "PENDING_STICK_UP",
      message: "Measured stick-up has not yet been entered",
    });
  }

  return items;
}

/**
 * Pure Shift analytics from repository-backed effective records.
 * Shared across close, handover, detail, history, Overview, and reports.
 */
export function calculateShiftAnalytics(
  input: CalculateShiftAnalyticsInput,
): ShiftAnalytics {
  const { shift } = input;
  const shiftId = shift.localId;

  const attributed = input.runs.filter((run) =>
    runBelongsToCompletedShift(run, shiftId),
  );
  const voided = attributed.filter((run) => run.status === "void");
  const operational = attributed.filter((run) => run.status !== "void");
  const completed = operational.filter(
    (run) => run.status === "completed" || run.status === "corrected",
  );
  const shared = completed.filter((run) => isSharedRun(run));
  const correctedRunCount = completed.filter(
    (run) => run.status === "corrected",
  ).length;

  const positiveLengths = completed
    .map((run) => run.drilledLengthDm)
    .filter((length) => length > 0);

  const totalDrilled = completed.reduce(
    (sum, run) => sum + Math.max(0, run.drilledLengthDm),
    0,
  );
  const totalRecovered = completed.reduce(
    (sum, run) => sum + Math.max(0, run.recoveredLengthDm),
    0,
  );

  let totalLoss = 0;
  let totalGain = 0;
  for (const run of completed) {
    if (run.drilledLengthDm <= 0) continue;
    const variance = calculateCoreLossOrGain(
      toDm(run.drilledLengthDm),
      toDm(run.recoveredLengthDm),
    );
    if (variance.kind === "loss") totalLoss += variance.amount;
    if (variance.kind === "gain") totalGain += variance.amount;
  }

  const weightedRecoveryTenths =
    totalDrilled === 0
      ? undefined
      : recoveryPercentTenths(totalDrilled, totalRecovered);

  const avgLength = averageInteger(positiveLengths);
  const medianLength = medianInteger(positiveLengths);
  const shortest =
    positiveLengths.length === 0 ? undefined : Math.min(...positiveLengths);
  const longest =
    positiveLengths.length === 0 ? undefined : Math.max(...positiveLengths);

  let rodsAdded3m = 0;
  let rodsAdded6m = 0;
  let rodsRemoved = 0;
  for (const run of completed) {
    for (const event of run.rodEvents) {
      if (event.voided) continue;
      if (event.action === "add") {
        if (event.rodLengthDm === 30) rodsAdded3m += 1;
        else if (event.rodLengthDm === 60) rodsAdded6m += 1;
      } else if (event.action === "remove") {
        rodsRemoved += 1;
      }
    }
  }

  const endingDepthDm =
    shift.endingDepthDm ??
    input.liveEndingDepthDm ??
    (completed.length > 0
      ? toDm(Math.max(...completed.map((run) => run.holeDepthDm)))
      : shift.startingDepthDm);
  const endingRodNumber =
    shift.endingRodNumber ??
    input.liveEndingRodNumber ??
    shift.startingRodNumber;
  const endingRodStringDm =
    shift.endingRodStringDm ??
    input.liveEndingRodStringDm ??
    shift.startingRodStringDm;

  const metresCompletedDm = toDm(
    Math.max(0, Number(endingDepthDm) - Number(shift.startingDepthDm)),
  );

  const surveyCount = input.surveys.filter(
    (survey) => survey.shiftId === shiftId,
  ).length;
  const trayCount = input.trays.filter((tray) => tray.shiftId === shiftId).length;
  const casingEventCount = input.casingEvents.filter(
    (event) => event.shiftId === shiftId,
  ).length;
  const bitChangeCount = input.componentAssignments.filter(
    (assignment) =>
      assignment.componentType === "BIT" &&
      (assignment.installedShiftId === shiftId ||
        assignment.removedShiftId === shiftId),
  ).length;
  const reamerChangeCount = input.componentAssignments.filter(
    (assignment) =>
      assignment.componentType === "REAMER" &&
      (assignment.installedShiftId === shiftId ||
        assignment.removedShiftId === shiftId),
  ).length;

  const attributedRunIds = new Set(attributed.map((run) => run.localId));
  const shiftCorrections = input.corrections.filter(
    (correction) =>
      correction.shiftId === shiftId ||
      attributedRunIds.has(correction.runId),
  );
  const voidedRunCount = voided.length;
  const runCorrectionCount = shiftCorrections.filter(
    (correction) => correction.correctionType !== "VOID",
  ).length;

  const endForElapsed =
    shift.closedAt ??
    (shift.status === "OPEN" || shift.status === "HANDOVER_PENDING"
      ? input.nowIso
      : undefined);
  const elapsedMinutes = elapsedMinutesBetween(shift.startedAt, endForElapsed);

  let grossMetresPerElapsedHourTenths: number | undefined;
  if (elapsedMinutes !== undefined && elapsedMinutes > 0) {
    const hours = elapsedMinutes / 60;
    // metresCompletedDm is decimetres; result is tenths of metres/hour (3.0 → 30).
    grossMetresPerElapsedHourTenths = Math.round(
      Number(metresCompletedDm) / hours,
    );
    if (!Number.isFinite(grossMetresPerElapsedHourTenths)) {
      grossMetresPerElapsedHourTenths = undefined;
    }
  }

  const cycleMinutes = completed
    .map((run) => elapsedMinutesBetween(run.startedAt, run.completedAt))
    .filter((value): value is number => value !== undefined && value >= 0);

  const sortedCompleted = [...completed].sort(
    (left, right) => left.runNumber - right.runNumber,
  );

  const unresolvedItems = buildShiftHandoverItems({
    unfinishedRunNumber: input.unfinishedRunNumber,
    surveyIntervalReminder: input.surveyIntervalReminder,
    inProgressTrayNumber: input.inProgressTrayNumber,
    activeBitSerial: input.activeBitSerial,
    activeReamerSerial: input.activeReamerSerial,
    measuredStickUpMissing: input.measuredStickUpMissing,
    includeActiveComponentHandoverItems:
      input.includeActiveComponentHandoverItems === true,
  });

  const closeSnapshot = shift.closeAnalyticsSnapshot;
  let analyticsAmended = false;
  let amendmentSummary: ShiftAnalytics["amendmentSummary"];

  if (closeSnapshot !== undefined && shift.closedAt !== undefined) {
    const metresChanged =
      Number(closeSnapshot.metresCompletedDm) !== Number(metresCompletedDm);
    const recoveryChanged =
      closeSnapshot.weightedRecoveryTenths !== weightedRecoveryTenths;
    const depthChanged =
      Number(closeSnapshot.endingDepthDm) !== Number(endingDepthDm);
    analyticsAmended = metresChanged || recoveryChanged || depthChanged;
    if (analyticsAmended) {
      const postCloseCorrections = shiftCorrections
        .filter(
          (correction) =>
            Date.parse(correction.createdAt) >= Date.parse(shift.closedAt!),
        )
        .map((correction) => correction.id);
      amendmentSummary = {
        originalMetresCompletedDm: closeSnapshot.metresCompletedDm,
        currentMetresCompletedDm: metresCompletedDm,
        originalWeightedRecoveryTenths: closeSnapshot.weightedRecoveryTenths,
        currentWeightedRecoveryTenths: weightedRecoveryTenths,
        responsibleCorrectionIds: postCloseCorrections,
      };
    }
  } else if (
    shift.endingDepthDm !== undefined &&
    shift.closedAt !== undefined &&
    Number(endingDepthDm) !== Number(shift.endingDepthDm)
  ) {
    // Legacy closed Shifts without analytics snapshot: depth-only amendment.
    analyticsAmended = true;
    amendmentSummary = {
      originalMetresCompletedDm: toDm(
        Math.max(0, Number(shift.endingDepthDm) - Number(shift.startingDepthDm)),
      ),
      currentMetresCompletedDm: metresCompletedDm,
      responsibleCorrectionIds: shiftCorrections
        .filter(
          (correction) =>
            Date.parse(correction.createdAt) >= Date.parse(shift.closedAt!),
        )
        .map((correction) => correction.id),
    };
  }

  return {
    shiftId,
    holeId: shift.holeId,
    startingDepthDm: shift.startingDepthDm,
    endingDepthDm,
    metresCompletedDm,
    completedRunCount: completed.length,
    sharedRunCount: shared.length,
    voidedRunCount,
    correctedRunCount,
    unfinishedRunCount: input.unfinishedRunNumber !== undefined ? 1 : 0,
    firstRunNumber: sortedCompleted.at(0)?.runNumber,
    lastRunNumber: sortedCompleted.at(-1)?.runNumber,
    averageRunLengthDm:
      avgLength === undefined ? undefined : toDm(avgLength),
    medianRunLengthDm:
      medianLength === undefined ? undefined : toDm(medianLength),
    shortestRunLengthDm:
      shortest === undefined ? undefined : toDm(shortest),
    longestRunLengthDm: longest === undefined ? undefined : toDm(longest),
    totalDrilledDm: toDm(totalDrilled),
    totalRecoveredDm: toDm(totalRecovered),
    weightedRecoveryTenths,
    totalCoreLossDm: toDm(totalLoss),
    totalCoreGainDm: toDm(totalGain),
    startingRodNumber: shift.startingRodNumber,
    endingRodNumber,
    rodsAdded3m,
    rodsAdded6m,
    rodsRemoved,
    netPhysicalRodChange: rodsAdded3m + rodsAdded6m - rodsRemoved,
    startingRodStringDm: shift.startingRodStringDm,
    endingRodStringDm,
    bhaOrStickUpConfigChangeCount: input.bhaOrStickUpConfigChangeCount ?? 0,
    surveyCount,
    trayCount,
    casingEventCount,
    bitChangeCount,
    reamerChangeCount,
    runCorrectionCount,
    warningAcknowledgementCount: input.warningAcknowledgementCount ?? 0,
    elapsedMinutes,
    grossMetresPerElapsedHourTenths,
    averageRecordedRunCycleMinutes: averageInteger(cycleMinutes),
    medianRecordedRunCycleMinutes: medianInteger(cycleMinutes),
    runLengthsByRunNumber: sortedCompleted.map((run) => ({
      runNumber: run.runNumber,
      drilledLengthDm: toDm(Math.max(0, run.drilledLengthDm)),
      recoveryPercentTenths: recoveryPercentTenths(
        run.drilledLengthDm,
        run.recoveredLengthDm,
      ),
      shared: isSharedRun(run),
    })),
    unresolvedItems,
    closeSnapshot,
    analyticsAmended,
    amendmentSummary,
  };
}

