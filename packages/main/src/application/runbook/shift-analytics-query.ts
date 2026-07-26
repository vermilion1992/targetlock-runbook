import {
  calculateShiftAnalytics,
  calculateSurveyIntervalReminder,
  decimetres,
  toCloseAnalyticsSnapshot,
  type RodAddition,
  type Run,
  type RunbookShift,
  type ShiftAnalytics,
  type ShiftAnalyticsCloseSnapshot,
  type ShiftAnalyticsCorrection,
  type ShiftAnalyticsRun,
} from "@/domain";
import type { CasingRepository } from "@/infrastructure/casing";
import type { ComponentAssignmentRepository } from "@/infrastructure/components";
import type {
  RunCorrectionRepository,
  RunRepository,
  SavedRunSnapshot,
} from "@/infrastructure/drafts";
import type { ShiftRepository } from "@/infrastructure/shifts";
import type { SurveyRepository } from "@/infrastructure/surveys";
import type { TrayRepository } from "@/infrastructure/trays";
import {
  getCurrentHoleState,
  type CurrentHoleStateDependencies,
} from "./current-hole-state";
import { runToEffectiveProjection } from "./run-correction-use-cases";

export interface ShiftAnalyticsQueryServices {
  readonly shifts: ShiftRepository;
  readonly runs: RunRepository;
  readonly runCorrections: RunCorrectionRepository;
  readonly surveys: SurveyRepository;
  readonly trays: TrayRepository;
  readonly casing: CasingRepository;
  readonly componentAssignments: ComponentAssignmentRepository;
  readonly currentState: CurrentHoleStateDependencies;
  readonly seedRuns: readonly Run[];
  readonly seedRodEvents: readonly RodAddition[];
  readonly seedHoleId: string;
  readonly preferredSurveyIntervalDm?: number;
}

function seedToAnalyticsRun(
  run: Run,
  seedRodEvents: readonly RodAddition[],
): ShiftAnalyticsRun {
  const effective = runToEffectiveProjection(run);
  return {
    localId: run.localId,
    runNumber: run.runNumber,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    drilledLengthDm: effective.drilledLengthDm,
    recoveredLengthDm: effective.recoveredLengthDm,
    holeDepthDm: effective.holeDepthDm,
    previousCompletedDepthDm: effective.previousCompletedDepthDm,
    status:
      run.status === "void"
        ? "void"
        : run.status === "corrected"
          ? "corrected"
          : run.status === "in_progress"
            ? "in_progress"
            : "completed",
    rodEvents: seedRodEvents
      .filter((event) => event.runId === run.localId)
      .map((event) => ({
        localId: event.localId,
        action: event.action,
        rodLengthDm: (Number(event.rodLength) === 60 ? 60 : 30) as 30 | 60,
        affectedRodNumber: event.affectedRodNumber,
        rodNumberAfterEvent: event.rodNumberAfterEvent,
        voided: false,
      })),
  };
}

function snapshotToAnalyticsRun(
  snapshot: SavedRunSnapshot,
  rodEventOverrides: readonly {
    readonly rodEventId: string;
    readonly runId: string;
    readonly action: "add" | "remove";
    readonly rodLengthDm: 30 | 60;
    readonly affectedRodNumber: number;
    readonly voided: boolean;
  }[],
): ShiftAnalyticsRun {
  const overrideByEvent = new Map(
    rodEventOverrides
      .filter((item) => item.runId === snapshot.localId)
      .map((item) => [item.rodEventId, item]),
  );
  return {
    localId: snapshot.localId,
    runNumber: snapshot.runNumber,
    startedShiftId: snapshot.startedShiftId,
    completedShiftId: snapshot.completedShiftId,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    drilledLengthDm: snapshot.drilledLengthDm,
    recoveredLengthDm: snapshot.recoveredLengthDm,
    holeDepthDm: snapshot.holeDepthDm,
    previousCompletedDepthDm: snapshot.previousCompletedDepthDm,
    status: snapshot.status,
    rodEvents: snapshot.rodEvents.map((event) => {
      const override = overrideByEvent.get(event.localId);
      return {
        localId: event.localId,
        action: override?.action ?? event.action,
        rodLengthDm: override?.rodLengthDm ?? event.rodLengthDm,
        affectedRodNumber:
          override?.affectedRodNumber ?? event.affectedRodNumber,
        rodNumberAfterEvent: event.rodNumberAfterEvent,
        voided: override?.voided ?? false,
      };
    }),
  };
}

export async function loadShiftAnalyticsRuns(
  holeId: string,
  services: ShiftAnalyticsQueryServices,
): Promise<readonly ShiftAnalyticsRun[]> {
  const completed = services.runs.readCompletedRuns(holeId);
  if (completed.status === "invalid") {
    throw new Error(completed.reason);
  }
  const envelope = await services.runCorrections.getEnvelope(holeId);
  const local = completed.snapshots;
  const localIds = new Set(local.map((snapshot) => snapshot.localId));
  const localNumbers = new Set(local.map((snapshot) => snapshot.runNumber));
  const fromSeed = services.seedRuns
    .filter(
      (run) =>
        run.holeId === holeId &&
        !localIds.has(run.localId) &&
        !localNumbers.has(run.runNumber),
    )
    .map((run) => seedToAnalyticsRun(run, services.seedRodEvents));
  const fromLocal = local.map((snapshot) =>
    snapshotToAnalyticsRun(snapshot, envelope?.rodEventOverrides ?? []),
  );
  return [...fromSeed, ...fromLocal].sort(
    (left, right) => left.runNumber - right.runNumber,
  );
}

async function loadCorrections(
  holeId: string,
  services: ShiftAnalyticsQueryServices,
): Promise<readonly ShiftAnalyticsCorrection[]> {
  const envelope = await services.runCorrections.getEnvelope(holeId);
  if (envelope === null) return [];
  return envelope.corrections.map((correction) => ({
    id: correction.id,
    runId: correction.runId,
    correctionType: correction.correctionType,
    createdAt: correction.correctedAt,
  }));
}

export interface LoadShiftAnalyticsOptions {
  readonly includeActiveComponentHandoverItems?: boolean;
  readonly nowIso?: string;
}

/**
 * Repository-backed Shift analytics for UI and reports.
 * Always recomputes from effective records; closed Shifts may also expose
 * the immutable closeAnalyticsSnapshot for amendment comparison.
 */
export async function loadShiftAnalytics(
  holeId: string,
  shiftId: string,
  services: ShiftAnalyticsQueryServices,
  options: LoadShiftAnalyticsOptions = {},
): Promise<ShiftAnalytics> {
  const shift = await services.shifts.getById(shiftId, holeId);
  if (shift === null) {
    throw new Error("The shift was not found.");
  }
  return loadShiftAnalyticsForShift(shift, services, options);
}

export async function loadShiftAnalyticsForShift(
  shift: RunbookShift,
  services: ShiftAnalyticsQueryServices,
  options: LoadShiftAnalyticsOptions = {},
): Promise<ShiftAnalytics> {
  const holeId = shift.holeId;
  const [
    runs,
    surveys,
    trays,
    casingEvents,
    componentAssignments,
    corrections,
    state,
  ] = await Promise.all([
    loadShiftAnalyticsRuns(holeId, services),
    services.surveys.listByHole(holeId),
    services.trays.listByHole(holeId),
    services.casing.listEvents(holeId),
    services.componentAssignments.listByHole(holeId),
    loadCorrections(holeId, services),
    getCurrentHoleState(holeId, services.currentState).catch(() => null),
  ]);

  const unfinishedFromState =
    state?.draft.status === "valid"
      ? state.draft.envelope.payload.context.runNumber
      : undefined;
  const unfinishedRunNumber =
    shift.status === "OPEN"
      ? unfinishedFromState
      : shift.status === "HANDOVER_PENDING"
        ? (shift.handoverRunNumber ?? unfinishedFromState)
        : undefined;

  const preferredInterval =
    holeId !== services.seedHoleId ||
    services.preferredSurveyIntervalDm === undefined
      ? undefined
      : decimetres(services.preferredSurveyIntervalDm);

  const endingDepth =
    shift.endingDepthDm ?? state?.currentDepthDm ?? shift.startingDepthDm;

  const surveyIntervalReminder =
    options.includeActiveComponentHandoverItems === true
      ? (state?.surveyIntervalReminder ??
        calculateSurveyIntervalReminder(
          endingDepth,
          surveys,
          preferredInterval,
        ))
      : undefined;

  return calculateShiftAnalytics({
    shift,
    runs,
    surveys,
    trays,
    casingEvents,
    componentAssignments,
    corrections,
    nowIso: options.nowIso ?? new Date().toISOString(),
    liveEndingDepthDm: state?.currentDepthDm,
    liveEndingRodNumber: state?.currentRodNumber,
    liveEndingRodStringDm: state?.currentRodStringDm,
    unfinishedRunNumber,
    surveyIntervalReminder,
    inProgressTrayNumber: undefined,
    activeBitSerial: state?.activeBitSerialNumber,
    activeReamerSerial: state?.activeReamerSerialNumber,
    measuredStickUpMissing:
      (shift.status === "OPEN" || shift.status === "HANDOVER_PENDING") &&
      state?.measuredStickUpDm === undefined &&
      unfinishedRunNumber !== undefined,
    includeActiveComponentHandoverItems:
      options.includeActiveComponentHandoverItems === true,
  });
}

export async function loadAnalyticsForAllShifts(
  holeId: string,
  services: ShiftAnalyticsQueryServices,
): Promise<ReadonlyMap<string, ShiftAnalytics>> {
  const shifts = await services.shifts.listByHole(holeId);
  const entries = await Promise.all(
    shifts.map(async (shift) => {
      const analytics = await loadShiftAnalyticsForShift(shift, services);
      return [shift.localId, analytics] as const;
    }),
  );
  return new Map(entries);
}

/**
 * Build the immutable close snapshot from current effective analytics.
 */
export async function buildCloseAnalyticsSnapshot(
  holeId: string,
  shiftId: string,
  closedAt: string,
  services: ShiftAnalyticsQueryServices,
): Promise<ShiftAnalyticsCloseSnapshot> {
  const analytics = await loadShiftAnalytics(holeId, shiftId, services, {
    nowIso: closedAt,
    includeActiveComponentHandoverItems: true,
  });
  return toCloseAnalyticsSnapshot(analytics, closedAt);
}

/** Bind seed + browser services into a ShiftAnalyticsQueryServices. */
export function createShiftAnalyticsQueryServices(
  browser: {
    readonly shifts: ShiftRepository;
    readonly runs: RunRepository;
    readonly runCorrections: RunCorrectionRepository;
    readonly surveys: SurveyRepository;
    readonly trays: TrayRepository;
    readonly casing: CasingRepository;
    readonly componentAssignments: ComponentAssignmentRepository;
    readonly currentState: CurrentHoleStateDependencies;
  },
  seed: {
    readonly runs: readonly Run[];
    readonly rodEvents: readonly RodAddition[];
    readonly holeId: string;
    readonly preferredSurveyIntervalDm?: number;
  },
): ShiftAnalyticsQueryServices {
  return {
    shifts: browser.shifts,
    runs: browser.runs,
    runCorrections: browser.runCorrections,
    surveys: browser.surveys,
    trays: browser.trays,
    casing: browser.casing,
    componentAssignments: browser.componentAssignments,
    currentState: browser.currentState,
    seedRuns: seed.runs,
    seedRodEvents: seed.rodEvents,
    seedHoleId: seed.holeId,
    preferredSurveyIntervalDm: seed.preferredSurveyIntervalDm,
  };
}
