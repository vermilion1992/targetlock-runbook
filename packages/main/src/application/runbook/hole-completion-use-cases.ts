import {
  calculateComponentUsage,
  calculateCoreLossOrGain,
  calculateCurrentRodString,
  calculateHoleDepth,
  calculateRodNumber,
  calculateSurveyStatistics,
  calculateTrayStatistics,
  decimetres,
  evaluateHoleCompletion,
  findPreviousTray,
  formatCasingSummary,
  normalizeHoleStatus,
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
  type AuditEntry,
  type CasingString,
  type Component,
  type ComponentAssignment,
  type ComponentType,
  type ComponentUsage,
  type Decimetres,
  type HoleCompletionCheckCode,
  type HoleCompletionComponentOutcome,
  type HoleCompletionDisposition,
  type HoleCompletionEvaluation,
  type HoleCompletionReason,
  type HoleCompletionRecord,
  type HoleCompletionReview,
  type HoleCompletionSnapshot,
  type HoleCompletionTransaction,
  type HoleFinalSurveyResolution,
  type JsonValue,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type SurveyStatistics,
  type Tray,
  type TrayStatistics,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type {
  ComponentAssignmentRepository,
  ComponentRepository,
  ResolveAtHoleCompletionInput as RepositoryResolveAtHoleCompletionInput,
} from "@/infrastructure/components";
import type {
  CanonicalHole,
  CompletedHoleFilters,
  CompletedHoleIndexEntry,
  CompletionHistoryEntry,
  CompletionRepository,
  HoleLifecycleState,
  ReopenHoleResult,
} from "@/infrastructure/completion";
import type { SavedRunSnapshot } from "@/infrastructure/drafts";
import type { TargetLockStage1Seed } from "@/infrastructure/seed";
import type {
  CloseFinalShiftInput,
  ShiftRepository,
} from "@/infrastructure/shifts";
import {
  getCurrentHoleState,
  type CurrentHoleState,
  type CurrentHoleStateDependencies,
} from "./current-hole-state";

const DEVICE_ID = "local-runbook-device";

export interface CompletionActor {
  readonly id: string;
  readonly name: string;
}

export interface CompletionPendingOperationQueries {
  readonly countPendingRodEvents?: (holeId: string) => Promise<number>;
  readonly countPendingMediaOperations?: (holeId: string) => Promise<number>;
  readonly countPendingCorrections?: (holeId: string) => Promise<number>;
}

export interface HoleCompletionContextDependencies {
  readonly currentState: CurrentHoleStateDependencies;
  readonly completion: CompletionRepository;
  readonly pendingOperations?: CompletionPendingOperationQueries;
}

export interface HoleCompletionRodProjection {
  readonly rodNumber: number;
  readonly rodStringDm: Decimetres;
  readonly measuredStickUpDm: Decimetres;
  readonly authoritativeFinalDepthDm: Decimetres;
  readonly projectedHoleDepthDm: Decimetres;
  readonly configuration: RodStringConfiguration;
  readonly events: readonly RodAddition[];
}

export interface HoleCompletionContext {
  readonly holeId: string;
  readonly hole: CanonicalHole;
  readonly projectId: string;
  readonly projectName: string;
  readonly rigId: string;
  readonly rigName: string;
  readonly currentState: CurrentHoleState;
  readonly runs: readonly Run[];
  readonly completedRuns: readonly Run[];
  readonly finalRun: Run | null;
  readonly rodConfiguration: RodStringConfiguration | null;
  readonly rodEvents: readonly RodAddition[];
  readonly rodProjection: HoleCompletionRodProjection | null;
  readonly shifts: readonly RunbookShift[];
  readonly casingStrings: readonly CasingString[];
  readonly components: readonly Component[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly surveys: readonly Survey[];
  readonly trays: readonly Tray[];
  readonly pendingOperations: {
    readonly rodEvents: number;
    readonly media: number;
    readonly corrections: number;
  };
}

export interface HoleCompletionContextSource {
  get(holeId: string): Promise<HoleCompletionContext>;
}

export function createHoleCompletionContextSource(
  dependencies: HoleCompletionContextDependencies,
): HoleCompletionContextSource {
  return {
    get: (holeId) => getHoleCompletionContext(holeId, dependencies),
  };
}

function localRunMetadata(snapshot: SavedRunSnapshot) {
  return {
    localId: snapshot.localId,
    serverId: null,
    syncStatus: "local-only" as const,
    createdAt: snapshot.startedAt,
    updatedAt: snapshot.completedAt,
    deviceId: DEVICE_ID,
    version: snapshot.version,
  };
}

/**
 * Converts the smaller local-storage snapshot into the full domain Run. The
 * snapshot remains authoritative for every measured value; display-only
 * labels are recovered from the immutable seed dictionaries.
 */
export function savedRunSnapshotToRun(
  snapshot: SavedRunSnapshot,
  seed: TargetLockStage1Seed,
): Run {
  const tagLabels = new Map(
    seed.runConditionTags.map((tag) => [tag.localId, tag.label]),
  );
  const singleAddition =
    snapshot.rodEvents.length === 1 &&
    snapshot.rodEvents[0]?.action === "add"
      ? snapshot.rodEvents[0]
      : undefined;
  return {
    ...localRunMetadata(snapshot),
    holeId: snapshot.holeId,
    startedShiftId: snapshot.startedShiftId,
    completedShiftId: snapshot.completedShiftId,
    runNumber: snapshot.runNumber,
    rodNumber: snapshot.rodNumber,
    startedAt: snapshot.startedAt,
    startedByUserId: snapshot.startedByUserId,
    startedByNameSnapshot: snapshot.startedByNameSnapshot,
    completedAt: snapshot.completedAt,
    completedByUserId: snapshot.completedByUserId,
    completedByNameSnapshot: snapshot.completedByNameSnapshot,
    rodEventIds: snapshot.rodEvents.map(({ localId }) => localId),
    rodAddedLength:
      singleAddition === undefined
        ? null
        : singleAddition.rodLengthDm === 30
          ? THREE_METRE_ROD_LENGTH
          : SIX_METRE_ROD_LENGTH,
    previousCompletedDepth: decimetres(snapshot.previousCompletedDepthDm),
    startDepth: decimetres(snapshot.previousCompletedDepthDm),
    measuredStickUp: decimetres(snapshot.measuredStickUpDm),
    rodStringLength: decimetres(snapshot.rodStringDm),
    holeDepth: decimetres(snapshot.holeDepthDm),
    drilledLength: decimetres(snapshot.drilledLengthDm),
    recoveredLength: decimetres(snapshot.recoveredLengthDm),
    recoveryPercentage: snapshot.recoveryPercentage,
    conditionTagIds: [...snapshot.conditionTagIds],
    conditionTagLabelsSnapshot: snapshot.conditionTagIds.map(
      (tagId) => tagLabels.get(tagId) ?? tagId,
    ),
    comment: snapshot.comment.trim() || null,
    correctionIds: [...snapshot.correctionIds],
    activeBitSerialNumberSnapshot:
      snapshot.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot:
      snapshot.activeReamerSerialNumberSnapshot,
    activeBitAssignmentId: snapshot.activeBitAssignmentId,
    activeReamerAssignmentId: snapshot.activeReamerAssignmentId,
    casingSummarySnapshot: snapshot.casingSummarySnapshot,
    status: snapshot.status,
    holeNameSnapshot: seed.hole.name,
    rigNameSnapshot: seed.rig.name,
  };
}

/**
 * Local completed runs replace seed runs with the same run number. Duplicate
 * local run numbers are deliberately retained so domain reconciliation can
 * surface the conflict instead of silently hiding it.
 */
export function mergeCompletionRuns(
  seedRuns: readonly Run[],
  localRuns: readonly SavedRunSnapshot[],
  seed: TargetLockStage1Seed,
): readonly Run[] {
  const localNumbers = new Set(localRuns.map(({ runNumber }) => runNumber));
  return [
    ...seedRuns.filter(({ runNumber }) => !localNumbers.has(runNumber)),
    ...localRuns.map((snapshot) => savedRunSnapshotToRun(snapshot, seed)),
  ].sort(
    (left, right) =>
      left.runNumber - right.runNumber ||
      left.startedAt.localeCompare(right.startedAt) ||
      left.localId.localeCompare(right.localId),
  );
}

function localRodEvents(
  snapshots: readonly SavedRunSnapshot[],
  sequenceStart: number,
): readonly RodAddition[] {
  let sequence = sequenceStart;
  return [...snapshots]
    .sort(
      (left, right) =>
        left.runNumber - right.runNumber ||
        left.completedAt.localeCompare(right.completedAt),
    )
    .flatMap((run) =>
      run.rodEvents.map((event) => {
        sequence += 1;
        return {
          localId: event.localId,
          serverId: null,
          syncStatus: "local-only",
          createdAt: event.occurredAt,
          updatedAt: event.occurredAt,
          deviceId: DEVICE_ID,
          version: 1,
          holeId: run.holeId,
          runId: run.localId,
          shiftId: run.completedShiftId,
          sequence,
          action: event.action,
          rodLength:
            event.rodLengthDm === 30
              ? THREE_METRE_ROD_LENGTH
              : SIX_METRE_ROD_LENGTH,
          affectedRodNumber: event.affectedRodNumber,
          rodNumberAfterEvent: event.rodNumberAfterEvent,
          occurredAt: event.occurredAt,
          recordedByUserId: run.completedByUserId,
          recordedByNameSnapshot: run.completedByNameSnapshot,
        } satisfies RodAddition;
      }),
    );
}

function mergeRodEvents(
  seed: TargetLockStage1Seed,
  snapshots: readonly SavedRunSnapshot[],
): readonly RodAddition[] {
  const replacedNumbers = new Set(snapshots.map(({ runNumber }) => runNumber));
  const seedRunNumbers = new Map(
    seed.runs.map((run) => [run.localId, run.runNumber]),
  );
  const retainedSeedEvents = seed.rodEvents.filter((event) => {
    if (event.runId === null) return true;
    const runNumber = seedRunNumbers.get(event.runId);
    return runNumber === undefined || !replacedNumbers.has(runNumber);
  });
  const maximumSequence = retainedSeedEvents.reduce(
    (maximum, event) => Math.max(maximum, event.sequence),
    0,
  );
  const events = [
    ...retainedSeedEvents,
    ...localRodEvents(snapshots, maximumSequence),
  ];
  const seen = new Set<string>();
  return events
    .filter((event) => {
      if (seen.has(event.localId)) return false;
      seen.add(event.localId);
      return true;
    })
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.localId.localeCompare(right.localId),
    );
}

function unfinishedDraftRun(
  holeId: string,
  currentState: CurrentHoleState,
  seed: TargetLockStage1Seed,
): Run | null {
  if (currentState.draft.status !== "valid") return null;
  const draft = currentState.draft.envelope.payload;
  return {
    localId: draft.localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: draft.startedAt,
    updatedAt: currentState.draft.envelope.savedAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId,
    startedShiftId: draft.startedShiftId,
    completedShiftId: null,
    runNumber: draft.context.runNumber,
    rodNumber: currentState.currentRodNumber,
    startedAt: draft.startedAt,
    startedByUserId: draft.startedByUserId,
    startedByNameSnapshot: draft.startedByNameSnapshot,
    completedAt: null,
    completedByUserId: null,
    completedByNameSnapshot: null,
    rodEventIds: draft.pendingRodEvents.map(({ localId }) => localId),
    rodAddedLength: null,
    previousCompletedDepth: decimetres(
      draft.context.previousCompletedDepthDm,
    ),
    startDepth: decimetres(draft.context.previousCompletedDepthDm),
    measuredStickUp: currentState.measuredStickUpDm ?? decimetres(0),
    rodStringLength: currentState.currentRodStringDm,
    holeDepth: decimetres(draft.context.previousCompletedDepthDm),
    drilledLength: decimetres(0),
    recoveredLength: decimetres(0),
    recoveryPercentage: 0,
    conditionTagIds: [...draft.conditionTagIds],
    conditionTagLabelsSnapshot: draft.conditionTagIds.map(
      (tagId) =>
        seed.runConditionTags.find(({ localId }) => localId === tagId)?.label ??
        tagId,
    ),
    comment: draft.comment.trim() || null,
    correctionIds: [],
    activeBitSerialNumberSnapshot: draft.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot:
      draft.activeReamerSerialNumberSnapshot,
    activeBitAssignmentId: draft.activeBitAssignmentId,
    activeReamerAssignmentId: draft.activeReamerAssignmentId,
    casingSummarySnapshot: draft.casingSummarySnapshot,
    status: "in_progress",
    holeNameSnapshot: seed.hole.name,
    rigNameSnapshot: seed.rig.name,
  };
}

function latestRodConfiguration(
  configurations: readonly RodStringConfiguration[],
): RodStringConfiguration | null {
  return (
    [...configurations].sort(
      (left, right) =>
        right.effectiveAt.localeCompare(left.effectiveAt) ||
        right.localId.localeCompare(left.localId),
    )[0] ?? null
  );
}

function checkedPendingCount(value: number, description: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CompletionApplicationError(
      "INVALID_CONTEXT",
      `${description} must be a non-negative whole number.`,
    );
  }
  return value;
}

export async function getHoleCompletionContext(
  holeId: string,
  dependencies: HoleCompletionContextDependencies,
): Promise<HoleCompletionContext> {
  const seed = dependencies.currentState.seed;
  const currentState = await getCurrentHoleState(
    holeId,
    dependencies.currentState,
  );
  const seedRunsForHole =
    seed.hole.name === holeId
      ? seed.runs.filter(
          ({ status }) => status !== "in_progress" && status !== "void",
        )
      : [];
  const completedRuns = mergeCompletionRuns(
    seedRunsForHole,
    currentState.completedLocalRuns.filter(({ status }) => status !== "void"),
    seed,
  ).filter(({ status }) => status !== "in_progress" && status !== "void");
  const draftRun =
    seed.hole.name === holeId
      ? unfinishedDraftRun(holeId, currentState, seed)
      : null;
  const runs = draftRun === null ? completedRuns : [...completedRuns, draftRun];
  const finalRun =
    [...completedRuns].sort(
      (left, right) =>
        left.runNumber - right.runNumber ||
        left.completedAt!.localeCompare(right.completedAt!),
    ).at(-1) ?? null;
  const rodConfiguration =
    seed.hole.name === holeId
      ? latestRodConfiguration(seed.rodStringConfigurations)
      : null;
  const rodEvents =
    seed.hole.name === holeId
      ? mergeRodEvents(seed, currentState.completedLocalRuns)
      : localRodEvents(currentState.completedLocalRuns, 0);

  const [
    lifecycle,
    shifts,
    casingStrings,
    componentAssignments,
    surveys,
    trays,
    allComponents,
    queriedRodEvents,
    pendingMedia,
    pendingCorrections,
  ] = await Promise.all([
    dependencies.completion.getLifecycleState(holeId),
    dependencies.currentState.shifts.listByHole(holeId),
    dependencies.currentState.casing.listByHole(holeId),
    dependencies.currentState.componentAssignments.listByHole(holeId),
    dependencies.currentState.surveys.listByHole(holeId),
    dependencies.currentState.trays.listByHole(holeId),
    dependencies.currentState.components.list(),
    dependencies.pendingOperations?.countPendingRodEvents?.(holeId) ??
      Promise.resolve<number | undefined>(undefined),
    dependencies.pendingOperations?.countPendingMediaOperations?.(holeId) ??
      Promise.resolve(0),
    dependencies.pendingOperations?.countPendingCorrections?.(holeId) ??
      Promise.resolve(0),
  ]);
  const assignedComponentIds = new Set(
    componentAssignments.map(({ componentId }) => componentId),
  );
  const components = allComponents.filter(({ localId }) =>
    assignedComponentIds.has(localId),
  );
  const rodEventInputs = rodEvents.map(({ action, rodLength }) => ({
    action,
    rodLength,
  }));
  const projectedRodStringDm =
    rodConfiguration === null
      ? null
      : calculateCurrentRodString(
          rodConfiguration.baseRodStringLength,
          rodEventInputs,
        );
  const rodProjection =
    finalRun === null ||
    rodConfiguration === null ||
    projectedRodStringDm === null
      ? null
      : {
          rodNumber: calculateRodNumber(rodEventInputs),
          rodStringDm: projectedRodStringDm,
          measuredStickUpDm: finalRun.measuredStickUp,
          authoritativeFinalDepthDm: finalRun.holeDepth,
          projectedHoleDepthDm: calculateHoleDepth(
            projectedRodStringDm,
            finalRun.measuredStickUp,
          ),
          configuration: rodConfiguration,
          events: rodEvents,
        };
  const fallbackHole: CanonicalHole = {
    ...seed.hole,
    localId: holeId,
    status: normalizeHoleStatus(seed.hole.status),
  };
  return {
    holeId,
    hole: lifecycle?.hole ?? fallbackHole,
    projectId: seed.project.localId,
    projectName: seed.project.name,
    rigId: seed.rig.localId,
    rigName: seed.rig.name,
    currentState,
    runs,
    completedRuns,
    finalRun,
    rodConfiguration,
    rodEvents,
    rodProjection,
    shifts,
    casingStrings,
    components,
    componentAssignments,
    surveys,
    trays,
    pendingOperations: {
      rodEvents: checkedPendingCount(
        queriedRodEvents ??
          (currentState.draft.status === "valid"
            ? currentState.draft.envelope.payload.pendingRodEvents.length
            : 0),
        "Pending rod-event count",
      ),
      media: checkedPendingCount(pendingMedia, "Pending media count"),
      corrections: checkedPendingCount(
        pendingCorrections,
        "Pending correction count",
      ),
    },
  };
}

export interface HoleFinalRunStatistics {
  readonly totalRuns: number;
  readonly correctedRuns: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly totalLossDm: Decimetres;
  readonly totalGainDm: Decimetres;
  readonly overallRecoveryPercentTenths: number;
  readonly firstRunNumber?: number;
  readonly finalRunNumber?: number;
  readonly finalDepthDm?: Decimetres;
}

export interface HoleFinalRodStatistics {
  readonly configurationId?: string;
  readonly eventCount: number;
  readonly finalRodNumber?: number;
  readonly currentRodStringDm?: Decimetres;
  readonly measuredStickUpDm?: Decimetres;
  readonly bottomHoleAssemblyLengthDm?: Decimetres;
  readonly constantStickUpDm?: Decimetres;
  readonly baseRodStringDm?: Decimetres;
}

export interface HoleFinalShiftStatistics {
  readonly totalShifts: number;
  readonly dayShifts: number;
  readonly nightShifts: number;
  readonly closedShifts: number;
  readonly handovers: number;
  readonly finalShift?: RunbookShift;
  readonly finalShiftLabel?: string;
}

export interface HoleFinalComponentStatistic {
  readonly component: Component | null;
  readonly assignment: ComponentAssignment;
  readonly usage: ComponentUsage;
  readonly outcome?: HoleCompletionComponentOutcome;
}

export interface HoleFinalComponentStatistics {
  readonly totalAssignments: number;
  readonly activeAssignments: number;
  readonly assignments: readonly HoleFinalComponentStatistic[];
  readonly finalBitSummary?: string;
  readonly finalReamerSummary?: string;
}

export interface HoleFinalCasingStatistics {
  readonly totalStrings: number;
  readonly activeStrings: number;
  readonly completedStrings: number;
  readonly removedStrings: number;
  readonly abandonedStrings: number;
  readonly summary: string | null;
}

export interface HoleFinalStatistics {
  readonly runs: HoleFinalRunStatistics;
  readonly rods: HoleFinalRodStatistics;
  readonly shifts: HoleFinalShiftStatistics;
  readonly components: HoleFinalComponentStatistics;
  readonly casing: HoleFinalCasingStatistics;
  readonly surveys: SurveyStatistics;
  readonly trays: TrayStatistics;
  readonly finalSurvey?: Survey;
  readonly finalTray?: Tray;
}

function componentSummary(
  type: ComponentType,
  assignments: readonly HoleFinalComponentStatistic[],
): string | undefined {
  const latest = [...assignments]
    .filter(({ assignment }) => assignment.componentType === type)
    .sort(
      (left, right) =>
        right.assignment.startDepthDm - left.assignment.startDepthDm ||
        right.assignment.installedAt.localeCompare(
          left.assignment.installedAt,
        ),
    )[0];
  if (latest === undefined) return undefined;
  const serial = latest.component?.serialNumber ?? latest.assignment.componentId;
  return latest.outcome === undefined
    ? serial
    : `${serial} · ${latest.outcome.outcome.replaceAll("_", " ")}`;
}

export function calculateHoleFinalStatistics(
  context: HoleCompletionContext,
  componentOutcomes: readonly HoleCompletionComponentOutcome[] = [],
): HoleFinalStatistics {
  let totalDrilled = 0;
  let totalRecovered = 0;
  let totalLoss = 0;
  let totalGain = 0;
  for (const run of context.completedRuns) {
    totalDrilled += run.drilledLength;
    totalRecovered += run.recoveredLength;
    const variance = calculateCoreLossOrGain(
      run.drilledLength,
      run.recoveredLength,
    );
    if (variance.kind === "loss") totalLoss += variance.amount;
    if (variance.kind === "gain") totalGain += variance.amount;
  }
  const finalRun = context.finalRun;
  const finalShift =
    (finalRun?.completedShiftId === null ||
    finalRun?.completedShiftId === undefined
      ? undefined
      : context.shifts.find(
          ({ localId }) => localId === finalRun.completedShiftId,
        )) ??
    [...context.shifts].sort(
      (left, right) =>
        (right.closedAt ?? right.startedAt).localeCompare(
          left.closedAt ?? left.startedAt,
        ),
    )[0];
  const componentById = new Map(
    context.components.map((component) => [component.localId, component]),
  );
  const outcomeByAssignment = new Map(
    componentOutcomes.map((outcome) => [outcome.assignmentId, outcome]),
  );
  const componentAssignments = context.componentAssignments.map(
    (assignment): HoleFinalComponentStatistic => ({
      component: componentById.get(assignment.componentId) ?? null,
      assignment,
      usage: calculateComponentUsage(assignment, context.completedRuns),
      outcome: outcomeByAssignment.get(assignment.localId),
    }),
  );
  const finalDepthDm = finalRun?.holeDepth ?? decimetres(0);
  const runs = [...context.completedRuns].sort(
    (left, right) => left.runNumber - right.runNumber,
  );
  return {
    runs: {
      totalRuns: runs.length,
      correctedRuns: runs.filter(({ status }) => status === "corrected").length,
      totalDrilledDm: decimetres(totalDrilled),
      totalRecoveredDm: decimetres(totalRecovered),
      totalLossDm: decimetres(totalLoss),
      totalGainDm: decimetres(totalGain),
      overallRecoveryPercentTenths:
        totalDrilled === 0
          ? 0
          : Math.round((totalRecovered / totalDrilled) * 1_000),
      firstRunNumber: runs[0]?.runNumber,
      finalRunNumber: finalRun?.runNumber,
      finalDepthDm: finalRun?.holeDepth,
    },
    rods: {
      configurationId: context.rodConfiguration?.localId,
      eventCount: context.rodEvents.length,
      finalRodNumber: context.rodProjection?.rodNumber,
      currentRodStringDm: context.rodProjection?.rodStringDm,
      measuredStickUpDm: context.rodProjection?.measuredStickUpDm,
      bottomHoleAssemblyLengthDm:
        context.rodConfiguration?.bottomHoleAssemblyLength,
      constantStickUpDm: context.rodConfiguration?.constantStickUp,
      baseRodStringDm: context.rodConfiguration?.baseRodStringLength,
    },
    shifts: {
      totalShifts: context.shifts.length,
      dayShifts: context.shifts.filter(({ shiftType }) => shiftType === "DAY")
        .length,
      nightShifts: context.shifts.filter(
        ({ shiftType }) => shiftType === "NIGHT",
      ).length,
      closedShifts: context.shifts.filter(({ status }) => status === "CLOSED")
        .length,
      handovers: context.shifts.filter(
        ({ handoverAcceptedAt }) => handoverAcceptedAt !== undefined,
      ).length,
      finalShift,
      finalShiftLabel:
        finalShift === undefined
          ? undefined
          : `${finalShift.shiftDate} ${finalShift.shiftType === "DAY" ? "Day" : "Night"} shift`,
    },
    components: {
      totalAssignments: componentAssignments.length,
      activeAssignments: componentAssignments.filter(
        ({ assignment }) => assignment.status === "ACTIVE",
      ).length,
      assignments: componentAssignments,
      finalBitSummary: componentSummary("BIT", componentAssignments),
      finalReamerSummary: componentSummary("REAMER", componentAssignments),
    },
    casing: {
      totalStrings: context.casingStrings.length,
      activeStrings: context.casingStrings.filter(
        ({ status }) => status === "ACTIVE",
      ).length,
      completedStrings: context.casingStrings.filter(
        ({ status }) => status === "COMPLETED",
      ).length,
      removedStrings: context.casingStrings.filter(
        ({ status }) => status === "REMOVED",
      ).length,
      abandonedStrings: context.casingStrings.filter(
        ({ status }) => status === "ABANDONED",
      ).length,
      summary: formatCasingSummary(context.casingStrings),
    },
    surveys: calculateSurveyStatistics(context.surveys, finalDepthDm),
    trays: calculateTrayStatistics(context.trays),
    finalSurvey: [...context.surveys]
      .filter(({ depthDm }) => depthDm <= finalDepthDm)
      .sort(
        (left, right) =>
          right.depthDm - left.depthDm ||
          right.recordedAt.localeCompare(left.recordedAt),
      )[0],
    finalTray: findPreviousTray(context.trays),
  };
}

function evaluationInput(
  context: HoleCompletionContext,
  review?: Pick<
    HoleCompletionReview,
    | "reason"
    | "comment"
    | "componentOutcomes"
    | "finalSurveyResolution"
    | "warningAcknowledgements"
  >,
) {
  return {
    holeId: context.holeId,
    runs: context.runs,
    rodConfiguration: context.rodConfiguration ?? undefined,
    rodEvents: context.rodEvents,
    shifts: context.shifts,
    casingStrings: context.casingStrings,
    componentAssignments: context.componentAssignments,
    componentOutcomes: review?.componentOutcomes ?? [],
    surveys: context.surveys,
    finalSurveyResolution: review?.finalSurveyResolution,
    trays: context.trays,
    pendingOperations: context.pendingOperations,
    completionReason: review?.reason,
    completionComment: review?.comment,
    warningAcknowledgements: review?.warningAcknowledgements ?? [],
  };
}

export function evaluateCompletionContext(
  context: HoleCompletionContext,
  review?: Pick<
    HoleCompletionReview,
    | "reason"
    | "comment"
    | "componentOutcomes"
    | "finalSurveyResolution"
    | "warningAcknowledgements"
  >,
): HoleCompletionEvaluation {
  return evaluateHoleCompletion(evaluationInput(context, review));
}

export interface HoleCompletionApplicationServices {
  readonly context: HoleCompletionContextSource;
  readonly completion: CompletionRepository;
  readonly shifts: CompletionShiftRepository;
  readonly components: ComponentRepository;
  readonly componentAssignments: CompletionComponentAssignmentRepository;
  readonly audits: AuditRepository;
}

export async function evaluateHoleCompletionApplication(
  holeId: string,
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
  review?: HoleCompletionReview,
): Promise<{
  readonly context: HoleCompletionContext;
  readonly review: HoleCompletionReview | null;
  readonly evaluation: HoleCompletionEvaluation;
  readonly statistics: HoleFinalStatistics;
}> {
  const context = await services.context.get(holeId);
  const currentReview =
    review ?? (await services.completion.getCurrentReview(holeId));
  return {
    context,
    review: currentReview,
    evaluation: evaluateCompletionContext(
      context,
      currentReview ?? undefined,
    ),
    statistics: calculateHoleFinalStatistics(
      context,
      currentReview?.componentOutcomes,
    ),
  };
}

export type CompletionApplicationErrorCode =
  | "COMPLETION_BLOCKED"
  | "INTERRUPTED_BEFORE_SNAPSHOT"
  | "INVALID_CONTEXT"
  | "INVALID_REVIEW"
  | "NOT_FOUND";

export class CompletionApplicationError extends Error {
  constructor(
    readonly code: CompletionApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompletionApplicationError";
  }
}

export interface BeginHoleCompletionReviewInput {
  readonly operationId: string;
  readonly reviewId: string;
  readonly holeId: string;
  readonly expectedHoleVersion: number;
  readonly startedAt: string;
  readonly actor: CompletionActor;
}

export interface CompletionReviewResult {
  readonly review: HoleCompletionReview;
  readonly evaluation: HoleCompletionEvaluation;
}

export async function beginHoleCompletionReview(
  input: BeginHoleCompletionReviewInput,
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  const context = await services.context.get(input.holeId);
  const evaluation = evaluateCompletionContext(context);
  const review = await services.completion.beginReview({
    operationId: input.operationId,
    reviewId: input.reviewId,
    holeId: input.holeId,
    expectedHoleVersion: input.expectedHoleVersion,
    startedAt: input.startedAt,
    startedByUserId: input.actor.id,
    startedByNameSnapshot: input.actor.name,
    reviewStatus: evaluation.canComplete ? "READY" : "BLOCKED",
    checklist: evaluation.checks,
  });
  return { review, evaluation };
}

export interface SaveReviewBaseInput {
  readonly operationId: string;
  readonly reviewId: string;
  readonly holeId: string;
  readonly expectedVersion: number;
  readonly savedAt: string;
}

interface CompletionReviewChanges {
  readonly disposition?: HoleCompletionDisposition;
  readonly reason?: HoleCompletionReason;
  readonly comment?: string;
  readonly finalSurveyResolution?: HoleFinalSurveyResolution;
  readonly componentOutcomes?: readonly HoleCompletionComponentOutcome[];
  readonly warningAcknowledgements?: HoleCompletionReview["warningAcknowledgements"];
}

async function saveCompletionReviewChanges(
  input: SaveReviewBaseInput,
  changes: CompletionReviewChanges,
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  const current = await services.completion.getCurrentReview(input.holeId);
  if (
    current === null ||
    current.localId !== input.reviewId ||
    current.version !== input.expectedVersion
  ) {
    throw new CompletionApplicationError(
      "INVALID_REVIEW",
      "The current completion review does not match this save request.",
    );
  }
  const candidate = {
    ...current,
    ...changes,
  };
  const context = await services.context.get(input.holeId);
  const evaluation = evaluateCompletionContext(context, candidate);
  const review = await services.completion.saveReviewDraft({
    ...input,
    reviewStatus: evaluation.canComplete ? "READY" : "BLOCKED",
    disposition: candidate.disposition,
    reason: candidate.reason,
    comment: candidate.comment,
    finalSurveyResolution: candidate.finalSurveyResolution,
    componentOutcomes: candidate.componentOutcomes,
    warningAcknowledgements: candidate.warningAcknowledgements,
    checklist: evaluation.checks,
  });
  return { review, evaluation };
}

export function dispositionForCompletionReason(
  reason: HoleCompletionReason,
): HoleCompletionDisposition {
  return reason === "HOLE_ABANDONED" ? "ABANDONED" : "COMPLETED";
}

export function saveCompletionReasonAndDisposition(
  input: SaveReviewBaseInput & {
    readonly reason: HoleCompletionReason;
    readonly disposition?: HoleCompletionDisposition;
    readonly comment?: string;
  },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return saveCompletionReviewChanges(
    input,
    {
      reason: input.reason,
      disposition:
        input.disposition ?? dispositionForCompletionReason(input.reason),
      comment: input.comment,
    },
    services,
  );
}

export function saveCompletionComment(
  input: SaveReviewBaseInput & { readonly comment: string },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return saveCompletionReviewChanges(
    input,
    { comment: input.comment },
    services,
  );
}

export function saveCompletionDisposition(
  input: SaveReviewBaseInput & {
    readonly disposition: HoleCompletionDisposition;
  },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return saveCompletionReviewChanges(
    input,
    { disposition: input.disposition },
    services,
  );
}

export function acknowledgeCompletionWarning(
  input: SaveReviewBaseInput & {
    readonly checkCode: HoleCompletionCheckCode;
    readonly reason: string;
    readonly actor: CompletionActor;
  },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return services.completion
    .getCurrentReview(input.holeId)
    .then((review) => {
      if (review === null) {
        throw new CompletionApplicationError(
          "INVALID_REVIEW",
          "Completion review was not found.",
        );
      }
      const acknowledgements = [
        ...review.warningAcknowledgements.filter(
          ({ checkCode }) => checkCode !== input.checkCode,
        ),
        {
          checkCode: input.checkCode,
          reason: input.reason.trim(),
          acknowledgedAt: input.savedAt,
          acknowledgedByUserId: input.actor.id,
          acknowledgedByNameSnapshot: input.actor.name,
        },
      ];
      return saveCompletionReviewChanges(
        input,
        { warningAcknowledgements: acknowledgements },
        services,
      );
    });
}

export function selectFinalCompletionSurvey(
  input: SaveReviewBaseInput & { readonly surveyId: string },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return saveCompletionReviewChanges(
    input,
    {
      finalSurveyResolution: {
        status: "RECORDED",
        surveyId: input.surveyId,
      },
    },
    services,
  );
}

export function markFinalCompletionSurveyUnavailable(
  input: SaveReviewBaseInput & { readonly reason: string },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return saveCompletionReviewChanges(
    input,
    {
      finalSurveyResolution: {
        status: "UNAVAILABLE",
        reason: input.reason.trim(),
      },
    },
    services,
  );
}

export function confirmFinalPartialTray(
  input: SaveReviewBaseInput & {
    readonly actor: CompletionActor;
    readonly reason?: string;
  },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return acknowledgeCompletionWarning(
    {
      ...input,
      checkCode: "FINAL_PARTIAL_TRAY",
      reason:
        input.reason?.trim() ||
        "The final partial tray position was physically confirmed.",
    },
    services,
  );
}

export function saveCompletionComponentOutcome(
  input: SaveReviewBaseInput & {
    readonly outcome: HoleCompletionComponentOutcome;
  },
  services: Pick<HoleCompletionApplicationServices, "context" | "completion">,
): Promise<CompletionReviewResult> {
  return services.completion
    .getCurrentReview(input.holeId)
    .then((review) => {
      if (review === null) {
        throw new CompletionApplicationError(
          "INVALID_REVIEW",
          "Completion review was not found.",
        );
      }
      return saveCompletionReviewChanges(
        input,
        {
          componentOutcomes: [
            ...review.componentOutcomes.filter(
              ({ assignmentId }) =>
                assignmentId !== input.outcome.assignmentId,
            ),
            input.outcome,
          ],
        },
        services,
      );
    });
}

export type CloseFinalShiftRepositoryInput = CloseFinalShiftInput;
export type CompletionShiftRepository = ShiftRepository;

export interface CloseFinalCompletionShiftInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly shiftId: string;
  readonly expectedVersion: number;
  readonly closedAt: string;
  readonly actor: CompletionActor;
}

export async function closeFinalCompletionShift(
  input: CloseFinalCompletionShiftInput,
  services: Pick<
    HoleCompletionApplicationServices,
    "context" | "shifts" | "audits"
  > & {
    readonly shiftAnalytics?: import("./shift-analytics-query").ShiftAnalyticsQueryServices;
  },
): Promise<RunbookShift> {
  const context = await services.context.get(input.holeId);
  if (context.currentState.draft.status === "valid") {
    throw new CompletionApplicationError(
      "COMPLETION_BLOCKED",
      "Complete or discard the unfinished run before closing the final shift.",
    );
  }
  if (context.finalRun === null || context.rodProjection === null) {
    throw new CompletionApplicationError(
      "INVALID_CONTEXT",
      "A reconciled completed run and rod projection are required.",
    );
  }
  const { buildCloseAnalyticsSnapshot } = await import(
    "./shift-analytics-query"
  );
  const closeAnalyticsSnapshot =
    services.shiftAnalytics === undefined
      ? undefined
      : await buildCloseAnalyticsSnapshot(
          input.holeId,
          input.shiftId,
          input.closedAt,
          services.shiftAnalytics,
        );
  const result = await services.shifts.closeFinalShift({
    operationId: input.operationId,
    holeId: input.holeId,
    shiftId: input.shiftId,
    expectedVersion: input.expectedVersion,
    closedAt: input.closedAt,
    endingState: {
      depthDm: context.finalRun.holeDepth,
      rodNumber: context.rodProjection.rodNumber,
      rodStringDm: context.rodProjection.rodStringDm,
      measuredStickUpDm: context.finalRun.measuredStickUp,
      runNumber: context.finalRun.runNumber,
    },
    closeAnalyticsSnapshot,
  });
  const shift = result.shift;
  await services.audits.append(
    lifecycleAudit({
      id: `audit-${input.operationId}-final-shift-closed`,
      holeId: input.holeId,
      entityType: "shift",
      entityId: shift.localId,
      action: "final_shift_closed",
      actor: input.actor,
      timestamp: input.closedAt,
      depthDm: context.finalRun.holeDepth,
      metadata: {
        operationId: input.operationId,
        finalRunNumber: context.finalRun.runNumber,
      },
    }),
  );
  return shift;
}

export type ResolveAtHoleCompletionInput =
  RepositoryResolveAtHoleCompletionInput;
export type CompletionComponentAssignmentRepository =
  ComponentAssignmentRepository;

function lifecycleAudit(input: {
  readonly id: string;
  readonly holeId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actor: CompletionActor;
  readonly timestamp: string;
  readonly depthDm?: Decimetres;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}): AuditEntry {
  return {
    localId: input.id,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    userId: input.actor.id,
    userNameSnapshot: input.actor.name,
    timestamp: input.timestamp,
    depthDm: input.depthDm,
    metadata: input.metadata ?? {},
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function requiredCompletionValues(
  context: HoleCompletionContext,
  review: HoleCompletionReview,
  evaluation: HoleCompletionEvaluation,
) {
  if (
    review.disposition === undefined ||
    review.reason === undefined ||
    context.finalRun === null ||
    context.rodConfiguration === null ||
    context.rodProjection === null ||
    evaluation.finalDepthDm === undefined ||
    evaluation.finalRunNumber === undefined
  ) {
    throw new CompletionApplicationError(
      "INVALID_REVIEW",
      "The completion review is missing final lifecycle values.",
    );
  }
  return {
    disposition: review.disposition,
    reason: review.reason,
    finalRun: context.finalRun,
    rodConfiguration: context.rodConfiguration,
    rodProjection: context.rodProjection,
    finalDepthDm: evaluation.finalDepthDm,
    finalRunNumber: evaluation.finalRunNumber,
  };
}

export interface CompleteHoleInput {
  readonly operationId: string;
  readonly completionRecordId?: string;
  readonly holeId: string;
  readonly reviewId: string;
  readonly expectedReviewVersion: number;
  readonly expectedHoleVersion: number;
  readonly completedAt: string;
  readonly actor: CompletionActor;
}

function completionRecord(
  input: CompleteHoleInput,
  context: HoleCompletionContext,
  review: HoleCompletionReview,
  evaluation: HoleCompletionEvaluation,
): HoleCompletionRecord {
  const required = requiredCompletionValues(context, review, evaluation);
  const statistics = calculateHoleFinalStatistics(
    context,
    review.componentOutcomes,
  );
  const finalSurvey = review.finalSurveyResolution;
  const finalTrayCheck = evaluation.checks.find(
    ({ code }) => code === "FINAL_PARTIAL_TRAY",
  );
  const finalPartialTrayConfirmed =
    finalTrayCheck?.status === "PASS" ||
    review.warningAcknowledgements.some(
      ({ checkCode }) => checkCode === "FINAL_PARTIAL_TRAY",
    );
  const snapshot: HoleCompletionSnapshot = {
    holeId: input.holeId,
    projectId: context.projectId,
    projectNameSnapshot: context.projectName,
    rigId: context.rigId,
    rigNameSnapshot: context.rigName,
    finalStatus: required.disposition,
    finalDepthDm: required.finalDepthDm,
    plannedDepthDm: context.hole.plannedDepth,
    finalRunNumber: required.finalRunNumber,
    runIds: context.completedRuns.map(({ localId }) => localId),
    finalRodNumber: required.rodProjection.rodNumber,
    currentRodStringDm: required.rodProjection.rodStringDm,
    measuredStickUpDm: required.finalRun.measuredStickUp,
    bottomHoleAssemblyLengthDm:
      required.rodConfiguration.bottomHoleAssemblyLength,
    constantStickUpDm: required.rodConfiguration.constantStickUp,
    baseRodStringDm: required.rodConfiguration.baseRodStringLength,
    rodStringConfigurationId: required.rodConfiguration.localId,
    finalShiftId: statistics.shifts.finalShift?.localId,
    finalShiftLabel: statistics.shifts.finalShiftLabel,
    casingSummary: statistics.casing.summary,
    finalBitSummary: statistics.components.finalBitSummary,
    finalReamerSummary: statistics.components.finalReamerSummary,
    finalSurveyId:
      finalSurvey?.status === "RECORDED" ? finalSurvey.surveyId : undefined,
    finalSurveyUnavailableReason:
      finalSurvey?.status === "UNAVAILABLE" ? finalSurvey.reason : undefined,
    finalTrayId: statistics.finalTray?.localId,
    finalPartialTrayConfirmed,
    surveyCount: statistics.surveys.totalSurveys,
    trayCount: statistics.trays.totalTrays,
    totalRuns: statistics.runs.totalRuns,
    totalDrilledDm: statistics.runs.totalDrilledDm,
    totalRecoveredDm: statistics.runs.totalRecoveredDm,
    totalLossDm: statistics.runs.totalLossDm,
    totalGainDm: statistics.runs.totalGainDm,
    overallRecoveryPercentTenths:
      statistics.runs.overallRecoveryPercentTenths,
    reason: required.reason,
    comment: review.comment,
    checklist: evaluation.checks.map((check) => ({
      ...check,
      entityIds:
        check.entityIds === undefined ? undefined : [...check.entityIds],
    })),
    componentOutcomes: review.componentOutcomes.map((outcome) => ({
      ...outcome,
    })),
    warningAcknowledgements: review.warningAcknowledgements.map(
      (acknowledgement) => ({ ...acknowledgement }),
    ),
    completedByUserId: input.actor.id,
    completedByNameSnapshot: input.actor.name,
    capturedAt: input.completedAt,
  };
  return deepFreeze({
    localId:
      input.completionRecordId ?? `completion-${input.operationId}`,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.completedAt,
    updatedAt: input.completedAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    reviewId: input.reviewId,
    finalStatus: required.disposition,
    completedAt: input.completedAt,
    completedByUserId: input.actor.id,
    completedByNameSnapshot: input.actor.name,
    snapshot,
    operationId: input.operationId,
  }) as HoleCompletionRecord;
}

export interface CompleteHoleResult {
  readonly lifecycle: HoleLifecycleState;
  readonly completion: HoleCompletionRecord;
  readonly transaction: HoleCompletionTransaction | null;
  readonly status: "completed" | "already-completed" | "recovered";
}

async function requireLifecycle(
  holeId: string,
  completion: CompletionRepository,
): Promise<HoleLifecycleState> {
  const lifecycle = await completion.getLifecycleState(holeId);
  if (lifecycle === null) {
    throw new CompletionApplicationError(
      "NOT_FOUND",
      `Hole ${holeId} was not found.`,
    );
  }
  return lifecycle;
}

async function resolveCompletionComponents(
  record: HoleCompletionRecord,
  services: Pick<
    HoleCompletionApplicationServices,
    "componentAssignments"
  >,
): Promise<void> {
  await services.componentAssignments.recoverInterruptedCompletionResolution();
  // The component repository stages one resolution at a time. Sequential
  // execution also makes interrupted two-component closure deterministic.
  for (const outcome of record.snapshot.componentOutcomes) {
    const assignment =
      await services.componentAssignments.getAssignmentById(
        outcome.assignmentId,
      );
    if (
      assignment === null ||
      assignment.componentId !== outcome.componentId ||
      assignment.componentType !== outcome.componentType
    ) {
      throw new CompletionApplicationError(
        "INVALID_CONTEXT",
        `Component assignment ${outcome.assignmentId} is unavailable or changed.`,
      );
    }
    await services.componentAssignments.resolveAtHoleCompletion({
        operationId: `${record.operationId}-component-${outcome.assignmentId}`,
        holeId: record.holeId,
        assignmentId: outcome.assignmentId,
        componentId: outcome.componentId,
        componentType: outcome.componentType,
        expectedVersion:
          assignment.status === "ACTIVE"
            ? assignment.version
            : Math.max(1, assignment.version - 1),
        outcome: outcome.outcome,
        targetHoleId: outcome.targetHoleId,
        finalDepthDm: record.snapshot.finalDepthDm,
        shiftId: record.snapshot.finalShiftId,
        comment: outcome.comment,
        occurredAt: record.completedAt,
        userId: record.completedByUserId,
        userNameSnapshot: record.completedByNameSnapshot,
      });
  }
}

function completionEvent(
  record: HoleCompletionRecord,
  kind: "timeline" | "audit",
): AuditEntry {
  const actor = {
    id: record.completedByUserId,
    name: record.completedByNameSnapshot,
  };
  const abandoned = record.finalStatus === "ABANDONED";
  return lifecycleAudit({
    id: `audit-${record.operationId}-${kind}`,
    holeId: record.holeId,
    entityType: kind === "timeline" ? "hole_timeline" : "hole",
    entityId: record.holeId,
    action:
      kind === "timeline"
        ? abandoned
          ? "hole_abandoned_timeline"
          : "hole_completed_timeline"
        : abandoned
          ? "hole_abandoned"
          : "hole_completed",
    actor,
    timestamp: record.completedAt,
    depthDm: record.snapshot.finalDepthDm,
    metadata: {
      operationId: record.operationId,
      completionRecordId: record.localId,
      reviewId: record.reviewId,
      finalStatus: record.finalStatus,
      reason: record.snapshot.reason,
      finalRunNumber: record.snapshot.finalRunNumber,
    },
  });
}

async function finishStagedCompletion(
  record: HoleCompletionRecord,
  services: Pick<
    HoleCompletionApplicationServices,
    "completion" | "componentAssignments" | "audits"
  >,
  recovered: boolean,
): Promise<CompleteHoleResult> {
  let transaction = await services.completion.inspectPendingCompletionOperation(
    record.holeId,
  );
  if (
    transaction !== null &&
    transaction.operationId !== record.operationId
  ) {
    throw new CompletionApplicationError(
      "INVALID_REVIEW",
      "Another completion operation is pending for this hole.",
    );
  }
  if (transaction === null) {
    const lifecycle = await requireLifecycle(record.holeId, services.completion);
    return {
      lifecycle,
      completion: record,
      transaction: lifecycle.pendingCompletionOperation,
      status: "already-completed",
    };
  }

  if (transaction.stage === "REVIEW_CREATED") {
    throw new CompletionApplicationError(
      "INTERRUPTED_BEFORE_SNAPSHOT",
      "The completion operation stopped before its immutable snapshot was saved. Retry the original complete command.",
    );
  }
  if (transaction.stage === "SNAPSHOT_PERSISTED") {
    await resolveCompletionComponents(record, services);
    transaction = await services.completion.advanceCompletionOperation({
      operationId: record.operationId,
      stage: "COMPONENTS_CLOSED",
      updatedAt: record.completedAt,
    });
  }
  if (transaction.stage === "COMPONENTS_CLOSED") {
    const lifecycle = await requireLifecycle(record.holeId, services.completion);
    const locked = await services.completion.lockHole({
      operationId: record.operationId,
      holeId: record.holeId,
      completionRecordId: record.localId,
      expectedHoleVersion: lifecycle.hole.version,
      lockedAt: record.completedAt,
    });
    transaction =
      locked.transaction ??
      (await services.completion.inspectPendingCompletionOperation(
        record.holeId,
      ));
    if (transaction === null) {
      throw new CompletionApplicationError(
        "INVALID_REVIEW",
        "The completion transaction disappeared while locking the hole.",
      );
    }
  }
  if (transaction.stage === "HOLE_LOCKED") {
    await services.audits.append(completionEvent(record, "timeline"));
    transaction = await services.completion.advanceCompletionOperation({
      operationId: record.operationId,
      stage: "TIMELINE_APPENDED",
      updatedAt: record.completedAt,
    });
  }
  if (transaction.stage === "TIMELINE_APPENDED") {
    await services.audits.append(completionEvent(record, "audit"));
    transaction = await services.completion.advanceCompletionOperation({
      operationId: record.operationId,
      stage: "AUDIT_APPENDED",
      updatedAt: record.completedAt,
    });
  }
  if (transaction.stage === "AUDIT_APPENDED") {
    const committed = await services.completion.commitCompletion({
      operationId: record.operationId,
      holeId: record.holeId,
      completionRecordId: record.localId,
      committedAt: record.completedAt,
    });
    transaction = committed.transaction;
  }
  const lifecycle = await requireLifecycle(record.holeId, services.completion);
  return {
    lifecycle,
    completion: record,
    transaction,
    status: recovered ? "recovered" : "completed",
  };
}

export async function completeHole(
  input: CompleteHoleInput,
  services: HoleCompletionApplicationServices,
): Promise<CompleteHoleResult> {
  const existing = await services.completion.getLatestCompletion(input.holeId);
  if (existing?.operationId === input.operationId) {
    return finishStagedCompletion(existing, services, true);
  }
  const context = await services.context.get(input.holeId);
  const review = await services.completion.getCurrentReview(input.holeId);
  if (
    review === null ||
    review.localId !== input.reviewId ||
    review.version !== input.expectedReviewVersion ||
    review.reviewStatus !== "READY"
  ) {
    throw new CompletionApplicationError(
      "INVALID_REVIEW",
      "The completion review is not the expected ready review.",
    );
  }
  if (context.hole.version !== input.expectedHoleVersion) {
    throw new CompletionApplicationError(
      "INVALID_CONTEXT",
      "The hole changed after the completion command was prepared.",
    );
  }
  const evaluation = evaluateCompletionContext(context, review);
  if (!evaluation.canComplete) {
    throw new CompletionApplicationError(
      "COMPLETION_BLOCKED",
      [
        ...evaluation.blockers,
        ...evaluation.unacknowledgedAdvisories,
      ]
        .map(({ message }) => message)
        .join(" "),
    );
  }
  const record = completionRecord(input, context, review, evaluation);
  await services.completion.beginCompletionOperation({
    operationId: input.operationId,
    holeId: input.holeId,
    reviewId: input.reviewId,
    startedAt: input.completedAt,
    fingerprint: canonicalJson({
      operationId: input.operationId,
      completionRecordId: record.localId,
      holeId: input.holeId,
      reviewId: input.reviewId,
      reviewVersion: review.version,
      finalStatus: record.finalStatus,
      finalDepthDm: record.snapshot.finalDepthDm,
      runIds: record.snapshot.runIds,
      actor: input.actor,
    }),
  });
  await services.completion.persistCompletionRecord(record);
  return finishStagedCompletion(record, services, false);
}

export async function recoverInterruptedCompletion(
  holeId: string,
  services: Pick<
    HoleCompletionApplicationServices,
    "completion" | "componentAssignments" | "audits"
  >,
): Promise<CompleteHoleResult | null> {
  const transaction =
    await services.completion.inspectPendingCompletionOperation(holeId);
  if (transaction === null) return null;
  const record = await services.completion.getLatestCompletion(holeId);
  if (
    record === null ||
    record.operationId !== transaction.operationId
  ) {
    throw new CompletionApplicationError(
      "INTERRUPTED_BEFORE_SNAPSHOT",
      "The pending completion operation has no immutable snapshot. Retry the original complete command.",
    );
  }
  return finishStagedCompletion(record, services, true);
}

export function getCompletedHoleState(
  holeId: string,
  services: Pick<HoleCompletionApplicationServices, "completion">,
): Promise<HoleLifecycleState | null> {
  return services.completion.getLifecycleState(holeId);
}

export function listCompletedHoles(
  filters: CompletedHoleFilters = {},
  services: Pick<HoleCompletionApplicationServices, "completion">,
): Promise<readonly CompletedHoleIndexEntry[]> {
  return services.completion.listCompletedHoles(filters);
}

export function getHoleCompletionHistory(
  holeId: string,
  services: Pick<HoleCompletionApplicationServices, "completion">,
): Promise<readonly CompletionHistoryEntry[]> {
  return services.completion.getCompletionHistoryEntries(holeId);
}

export interface ReopenCompletedHoleInput {
  readonly operationId: string;
  readonly reopenRecordId?: string;
  readonly holeId: string;
  readonly completionRecordId?: string;
  readonly expectedHoleVersion: number;
  readonly reason: string;
  readonly comment?: string;
  readonly reopenedAt: string;
  readonly actor: CompletionActor;
}

function reopenEvent(
  result: ReopenHoleResult,
  input: ReopenCompletedHoleInput,
  kind: "timeline" | "audit",
): AuditEntry {
  return lifecycleAudit({
    id: `audit-${input.operationId}-${kind}`,
    holeId: input.holeId,
    entityType: kind === "timeline" ? "hole_timeline" : "hole",
    entityId: input.holeId,
    action: kind === "timeline" ? "hole_reopened_timeline" : "hole_reopened",
    actor: input.actor,
    timestamp: input.reopenedAt,
    depthDm: result.completion.snapshot.finalDepthDm,
    metadata: {
      operationId: input.operationId,
      completionRecordId: result.completion.localId,
      reopenRecordId: result.reopenRecord.localId,
      previousStatus: result.reopenRecord.previousStatus,
      reason: result.reopenRecord.reason,
    },
  });
}

export async function reopenHole(
  input: ReopenCompletedHoleInput,
  services: Pick<
    HoleCompletionApplicationServices,
    "completion" | "audits"
  >,
): Promise<ReopenHoleResult> {
  if (!input.reason.trim()) {
    throw new CompletionApplicationError(
      "INVALID_REVIEW",
      "A reopen reason is required.",
    );
  }
  const result = await services.completion.reopenHole({
    operationId: input.operationId,
    reopenRecordId:
      input.reopenRecordId ?? `reopen-${input.operationId}`,
    holeId: input.holeId,
    completionRecordId: input.completionRecordId,
    expectedHoleVersion: input.expectedHoleVersion,
    reason: input.reason,
    comment: input.comment,
    reopenedAt: input.reopenedAt,
    reopenedByUserId: input.actor.id,
    reopenedByNameSnapshot: input.actor.name,
  });
  await services.audits.append(reopenEvent(result, input, "timeline"));
  await services.audits.append(reopenEvent(result, input, "audit"));
  return result;
}

export interface CompletionRepositoryBackedStatistics {
  readonly completedHoles: number;
  readonly abandonedHoles: number;
  readonly totalFinalDepthDm: Decimetres;
  readonly totalRuns: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly totalLossDm: Decimetres;
  readonly totalGainDm: Decimetres;
  readonly totalShiftsWithFinalLabels: number;
  readonly componentOutcomes: number;
  readonly casingSummaries: number;
  readonly surveys: number;
  readonly trays: number;
}

export async function getCompletedHoleStatistics(
  filters: CompletedHoleFilters = {},
  services: Pick<HoleCompletionApplicationServices, "completion">,
): Promise<CompletionRepositoryBackedStatistics> {
  const entries = await services.completion.listCompletedHoles(filters);
  return entries.reduce<CompletionRepositoryBackedStatistics>(
    (totals, { completion }) => {
      const snapshot = completion.snapshot;
      return {
        completedHoles:
          totals.completedHoles +
          (completion.finalStatus === "COMPLETED" ? 1 : 0),
        abandonedHoles:
          totals.abandonedHoles +
          (completion.finalStatus === "ABANDONED" ? 1 : 0),
        totalFinalDepthDm: decimetres(
          totals.totalFinalDepthDm + snapshot.finalDepthDm,
        ),
        totalRuns: totals.totalRuns + snapshot.totalRuns,
        totalDrilledDm: decimetres(
          totals.totalDrilledDm + snapshot.totalDrilledDm,
        ),
        totalRecoveredDm: decimetres(
          totals.totalRecoveredDm + snapshot.totalRecoveredDm,
        ),
        totalLossDm: decimetres(
          totals.totalLossDm + snapshot.totalLossDm,
        ),
        totalGainDm: decimetres(
          totals.totalGainDm + snapshot.totalGainDm,
        ),
        totalShiftsWithFinalLabels:
          totals.totalShiftsWithFinalLabels +
          (snapshot.finalShiftLabel === undefined ? 0 : 1),
        componentOutcomes:
          totals.componentOutcomes + snapshot.componentOutcomes.length,
        casingSummaries:
          totals.casingSummaries + (snapshot.casingSummary === null ? 0 : 1),
        surveys: totals.surveys + snapshot.surveyCount,
        trays: totals.trays + snapshot.trayCount,
      };
    },
    {
      completedHoles: 0,
      abandonedHoles: 0,
      totalFinalDepthDm: decimetres(0),
      totalRuns: 0,
      totalDrilledDm: decimetres(0),
      totalRecoveredDm: decimetres(0),
      totalLossDm: decimetres(0),
      totalGainDm: decimetres(0),
      totalShiftsWithFinalLabels: 0,
      componentOutcomes: 0,
      casingSummaries: 0,
      surveys: 0,
      trays: 0,
    },
  );
}
