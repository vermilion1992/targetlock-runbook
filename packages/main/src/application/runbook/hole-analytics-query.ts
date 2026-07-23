import {
  calculateHoleAnalytics,
  decimetres,
  type HoleAnalytics,
  type HoleCompletionRecord,
  type RodAddition,
  type Run,
} from "@/domain";
import type { CasingRepository } from "@/infrastructure/casing";
import type { CompletionRepository } from "@/infrastructure/completion";
import type {
  ComponentAssignmentRepository,
  ComponentRepository,
} from "@/infrastructure/components";
import type {
  RunCorrectionRepository,
  RunRepository,
} from "@/infrastructure/drafts";
import type { ShiftRepository } from "@/infrastructure/shifts";
import type { SurveyRepository } from "@/infrastructure/surveys";
import type { TrayRepository } from "@/infrastructure/trays";
import {
  getCurrentHoleState,
  type CurrentHoleStateDependencies,
} from "./current-hole-state";
import {
  loadAnalyticsForAllShifts,
  loadShiftAnalyticsRuns,
  type ShiftAnalyticsQueryServices,
} from "./shift-analytics-query";

export interface HoleAnalyticsQueryServices {
  readonly shifts: ShiftRepository;
  readonly runs: RunRepository;
  readonly runCorrections: RunCorrectionRepository;
  readonly surveys: SurveyRepository;
  readonly trays: TrayRepository;
  readonly casing: CasingRepository;
  readonly components: ComponentRepository;
  readonly componentAssignments: ComponentAssignmentRepository;
  readonly completion: CompletionRepository;
  readonly currentState: CurrentHoleStateDependencies;
  readonly shiftAnalytics: ShiftAnalyticsQueryServices;
  readonly seedRuns: readonly Run[];
  readonly seedRodEvents: readonly RodAddition[];
  readonly plannedDepthDm: number;
  readonly preferredSurveyIntervalDm?: number;
}

export interface GetHoleAnalyticsOptions {
  readonly completionId?: string;
  readonly asOf?: string;
}

function filterAsOf<T extends { readonly recordedAt?: string; readonly installedAt?: string; readonly createdAt?: string; readonly startedAt?: string }>(
  items: readonly T[],
  asOf: string | undefined,
  timestampOf: (item: T) => string | undefined,
): readonly T[] {
  if (asOf === undefined) return items;
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) return items;
  return items.filter((item) => {
    const stamp = timestampOf(item);
    if (stamp === undefined) return true;
    const parsed = Date.parse(stamp);
    return Number.isFinite(parsed) ? parsed <= cutoff : true;
  });
}

async function resolveCompletion(
  holeId: string,
  completionId: string | undefined,
  services: HoleAnalyticsQueryServices,
): Promise<HoleCompletionRecord | null> {
  if (completionId === undefined) return null;
  const history = await services.completion.getCompletionHistoryEntries(holeId);
  return (
    history.find((entry) => entry.completion.localId === completionId)
      ?.completion ?? null
  );
}

async function loadCorrectedSurveyIds(
  holeId: string,
  services: HoleAnalyticsQueryServices,
): Promise<ReadonlySet<string>> {
  const surveys = await services.surveys.listByHole(holeId);
  const ids = new Set<string>();
  await Promise.all(
    surveys.map(async (survey) => {
      const corrections = await services.surveys.listCorrections(survey.localId);
      if (corrections.length > 0) ids.add(survey.localId);
    }),
  );
  return ids;
}

/**
 * Repository-backed Hole analytics for Statistics UI and reports.
 * Always recomputes from effective records. Optional completionId scopes
 * analytics to a historical completion snapshot without merging post-reopen work.
 */
export async function getHoleAnalytics(
  holeId: string,
  services: HoleAnalyticsQueryServices,
  options: GetHoleAnalyticsOptions = {},
): Promise<HoleAnalytics> {
  const completion = await resolveCompletion(
    holeId,
    options.completionId,
    services,
  );
  const asOf = options.asOf ?? completion?.snapshot.capturedAt;
  const runIdFilter =
    completion === null ? undefined : new Set(completion.snapshot.runIds);

  const [
    runs,
    shifts,
    surveys,
    trays,
    casingStrings,
    casingEvents,
    componentAssignments,
    components,
    correctedSurveyIds,
    state,
    shiftAnalyticsById,
  ] = await Promise.all([
    loadShiftAnalyticsRuns(holeId, services.shiftAnalytics),
    services.shifts.listByHole(holeId),
    services.surveys.listByHole(holeId),
    services.trays.listByHole(holeId),
    services.casing.listByHole(holeId),
    services.casing.listEvents(holeId),
    services.componentAssignments.listByHole(holeId),
    services.components.list(),
    loadCorrectedSurveyIds(holeId, services),
    getCurrentHoleState(holeId, services.currentState).catch(() => null),
    loadAnalyticsForAllShifts(holeId, services.shiftAnalytics),
  ]);

  const scopedRuns =
    runIdFilter === undefined
      ? runs
      : runs.filter((run) => runIdFilter.has(run.localId));

  const scopedShifts = filterAsOf(shifts, asOf, (shift) => shift.startedAt);
  const scopedSurveys = filterAsOf(surveys, asOf, (survey) => survey.recordedAt);
  const scopedTrays = filterAsOf(trays, asOf, (tray) => tray.recordedAt);
  const scopedCasingEvents = filterAsOf(
    casingEvents,
    asOf,
    (event) => event.recordedAt,
  );
  const scopedAssignments = filterAsOf(
    componentAssignments,
    asOf,
    (assignment) => assignment.installedAt,
  );
  const scopedCasingStrings = filterAsOf(
    casingStrings,
    asOf,
    (string) => string.installedAt,
  );

  const orderedRuns = [...scopedRuns].sort(
    (left, right) => left.runNumber - right.runNumber,
  );
  const startingDepthDm =
    completion?.snapshot.finalDepthDm !== undefined && orderedRuns.length > 0
      ? decimetres(
          Math.min(
            ...orderedRuns.map((run) => run.previousCompletedDepthDm),
            Number(scopedShifts[0]?.startingDepthDm ?? 0),
          ),
        )
      : (scopedShifts
          .slice()
          .sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0]
          ?.startingDepthDm ??
        state?.currentDepthDm ??
        decimetres(0));

  const currentOrFinalDepthDm =
    completion?.snapshot.finalDepthDm ??
    state?.currentDepthDm ??
    (orderedRuns.length > 0
      ? decimetres(Math.max(...orderedRuns.map((run) => run.holeDepthDm)))
      : startingDepthDm);

  const plannedDepthDm = decimetres(
    completion?.snapshot.plannedDepthDm ?? services.plannedDepthDm,
  );

  const scopedShiftAnalytics = new Map(
    [...shiftAnalyticsById.entries()].filter(([shiftId]) =>
      scopedShifts.some((shift) => shift.localId === shiftId),
    ),
  );

  return calculateHoleAnalytics({
    holeId,
    calculatedAt: new Date().toISOString(),
    completionId: completion?.localId,
    startingDepthDm:
      orderedRuns.length > 0
        ? decimetres(
            Math.min(
              ...orderedRuns.map((run) => run.previousCompletedDepthDm),
            ),
          )
        : startingDepthDm,
    plannedDepthDm,
    currentOrFinalDepthDm,
    runs: scopedRuns,
    shifts: scopedShifts,
    surveys: scopedSurveys,
    trays: scopedTrays,
    casingStrings: scopedCasingStrings,
    casingEvents: scopedCasingEvents,
    components,
    componentAssignments: scopedAssignments,
    corrections: [],
    correctedSurveyIds,
    preferredSurveyIntervalDm: services.preferredSurveyIntervalDm,
    shiftAnalyticsById: scopedShiftAnalytics,
  });
}

export async function listHoleAnalyticsVersions(
  holeId: string,
  services: HoleAnalyticsQueryServices,
): Promise<
  readonly {
    readonly completionId: string;
    readonly completedAt: string;
    readonly finalStatus: string;
    readonly superseded: boolean;
    readonly label: string;
  }[]
> {
  const history = await services.completion.getCompletionHistoryEntries(holeId);
  return history.map((entry, index) => ({
    completionId: entry.completion.localId,
    completedAt: entry.completion.completedAt,
    finalStatus: entry.completion.finalStatus,
    superseded: entry.superseded,
    label: `Completion Version ${history.length - index} — ${new Date(
      entry.completion.completedAt,
    ).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
  }));
}

/** Bind seed + browser services into HoleAnalyticsQueryServices. */
export function createHoleAnalyticsQueryServices(
  browser: {
    readonly shifts: ShiftRepository;
    readonly runs: RunRepository;
    readonly runCorrections: RunCorrectionRepository;
    readonly surveys: SurveyRepository;
    readonly trays: TrayRepository;
    readonly casing: CasingRepository;
    readonly components: ComponentRepository;
    readonly componentAssignments: ComponentAssignmentRepository;
    readonly completion: CompletionRepository;
    readonly currentState: CurrentHoleStateDependencies;
    readonly shiftAnalytics: ShiftAnalyticsQueryServices;
  },
  seed: {
    readonly runs: readonly Run[];
    readonly rodEvents: readonly RodAddition[];
    readonly plannedDepthDm: number;
    readonly preferredSurveyIntervalDm?: number;
  },
): HoleAnalyticsQueryServices {
  return {
    shifts: browser.shifts,
    runs: browser.runs,
    runCorrections: browser.runCorrections,
    surveys: browser.surveys,
    trays: browser.trays,
    casing: browser.casing,
    components: browser.components,
    componentAssignments: browser.componentAssignments,
    completion: browser.completion,
    currentState: browser.currentState,
    shiftAnalytics: browser.shiftAnalytics,
    seedRuns: seed.runs,
    seedRodEvents: seed.rodEvents,
    plannedDepthDm: seed.plannedDepthDm,
    preferredSurveyIntervalDm: seed.preferredSurveyIntervalDm,
  };
}
