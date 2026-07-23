import {
  calculateBaseRodString,
  calculateCurrentRodString,
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRodNumber,
} from "./rods";
import { classifyRunBoundary } from "./run-results";
import { isActiveShiftStatus } from "./shifts";
import {
  calculateDistanceSinceLatestSurvey,
  findLatestSurvey,
} from "./surveys";
import {
  calculateTrayStatistics,
  findPreviousTray,
} from "./trays";
import { formatCasingSummary, validateCasingRange } from "./casing";
import { calculateComponentUsage } from "./component-usage";
import {
  HOLE_COMPLETION_REASONS,
  HOLE_STATUS_LABELS,
  HOLE_STATUSES,
  type CasingString,
  type ComponentAssignment,
  type HoleCompletionCheck,
  type HoleCompletionCheckClassification,
  type HoleCompletionCheckCode,
  type HoleCompletionComponentOutcome,
  type HoleCompletionReason,
  type HoleCompletionWarningAcknowledgement,
  type HoleFinalSurveyResolution,
  type HoleStatus,
  type LegacyHoleStatus,
  type PersistedHoleStatus,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type Tray,
} from "./models";
import type { Decimetres } from "./measurements";

const LEGACY_HOLE_STATUS_NORMALIZATION: Readonly<
  Record<LegacyHoleStatus, HoleStatus>
> = {
  planned: "DRAFT",
  drilling: "ACTIVE",
  suspended: "SUSPENDED",
  completed: "COMPLETED",
};

const HOLE_COMPLETION_CHECK_LABELS: Readonly<
  Record<HoleCompletionCheckCode, string>
> = {
  FINAL_DEPTH_AVAILABLE: "Final depth available",
  FINAL_DEPTH_RECONCILED: "Final depth reconciled",
  RUNS_FINISHED: "All runs finished",
  RUN_NUMBERS_UNIQUE: "Run numbers unique",
  RUN_SEQUENCE_COMPLETE: "Run sequence complete",
  RUN_DEPTH_GAPS: "No run depth gaps",
  RUN_DEPTH_OVERLAPS: "No run depth overlaps",
  RUN_LENGTHS_POSITIVE: "Run lengths positive",
  RUN_DEPTHS_RECONCILED: "Run depths reconciled",
  ROD_CONFIGURATION_VALID: "Rod configuration valid",
  ROD_FIELDS_COMPLETE: "Rod fields complete",
  ROD_EVENTS_SETTLED: "Rod events settled",
  SHIFTS_CLOSED: "Shifts closed",
  HANDOVERS_RESOLVED: "Handovers resolved",
  CASING_VALID: "Casing depths valid",
  CASING_REVIEWED: "Active casing reviewed",
  COMPONENTS_RESOLVED: "Components resolved",
  FINAL_SURVEY_RESOLVED: "Final survey resolved",
  FINAL_SURVEY_UNAVAILABLE: "Final survey unavailable",
  TRAYS_RECONCILED: "Trays reconciled",
  FINAL_PARTIAL_TRAY: "Final partial tray",
  MEDIA_SETTLED: "Media operations settled",
  CORRECTIONS_SETTLED: "Corrections settled",
  COMPLETION_REASON_PROVIDED: "Completion reason provided",
  COMPLETION_COMMENT_PROVIDED: "Completion comment provided",
};

export interface HoleCompletionPendingOperations {
  readonly rodEvents: number;
  readonly media: number;
  readonly corrections: number;
}

export interface EvaluateHoleCompletionInput {
  readonly holeId: string;
  readonly runs: readonly Run[];
  readonly rodConfiguration?: RodStringConfiguration;
  readonly rodEvents: readonly RodAddition[];
  readonly shifts: readonly RunbookShift[];
  readonly casingStrings: readonly CasingString[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly componentOutcomes: readonly HoleCompletionComponentOutcome[];
  readonly surveys: readonly Survey[];
  readonly finalSurveyResolution?: HoleFinalSurveyResolution;
  readonly trays: readonly Tray[];
  readonly pendingOperations: HoleCompletionPendingOperations;
  readonly completionReason?: HoleCompletionReason;
  readonly completionComment?: string;
  readonly warningAcknowledgements?: readonly HoleCompletionWarningAcknowledgement[];
}

export interface HoleCompletionEvaluation {
  readonly checks: readonly HoleCompletionCheck[];
  readonly blockers: readonly HoleCompletionCheck[];
  readonly advisories: readonly HoleCompletionCheck[];
  readonly unacknowledgedAdvisories: readonly HoleCompletionCheck[];
  readonly finalDepthDm?: Decimetres;
  readonly finalRunNumber?: number;
  readonly canComplete: boolean;
}

type LockedHoleStatus = Extract<
  HoleStatus,
  "COMPLETED" | "ABANDONED" | "ARCHIVED"
>;

export class HoleLockedError extends Error {
  readonly code = "HOLE_LOCKED" as const;

  constructor(
    readonly holeId: string,
    readonly holeStatus: LockedHoleStatus,
    readonly completionRecordId?: string,
  ) {
    super(
      `Hole ${holeId} is ${HOLE_STATUS_LABELS[holeStatus].toLowerCase()} and is locked.`,
    );
    this.name = "HoleLockedError";
  }
}

export function isHoleLockedError(error: unknown): error is HoleLockedError {
  return error instanceof HoleLockedError && error.code === "HOLE_LOCKED";
}

export function parseHoleStatus(value: unknown): HoleStatus | undefined {
  if (typeof value !== "string") return undefined;
  if ((HOLE_STATUSES as readonly string[]).includes(value)) {
    return value as HoleStatus;
  }
  return LEGACY_HOLE_STATUS_NORMALIZATION[value as LegacyHoleStatus];
}

export function normalizeHoleStatus(
  value: HoleStatus | LegacyHoleStatus,
): HoleStatus {
  const normalized = parseHoleStatus(value);
  if (normalized === undefined) {
    throw new RangeError(`Unsupported hole status: ${String(value)}.`);
  }
  return normalized;
}

export function assertHoleUnlocked(
  holeId: string,
  status: PersistedHoleStatus,
  completionRecordId?: string,
): void {
  const normalized = normalizeHoleStatus(status);
  if (
    normalized === "COMPLETED" ||
    normalized === "ABANDONED" ||
    normalized === "ARCHIVED"
  ) {
    throw new HoleLockedError(holeId, normalized, completionRecordId);
  }
}

function check(
  code: HoleCompletionCheckCode,
  classification: HoleCompletionCheckClassification,
  passed: boolean,
  passMessage: string,
  failMessage: string,
  context: Pick<HoleCompletionCheck, "entityIds" | "amountDm"> = {},
): HoleCompletionCheck {
  return {
    code,
    label: HOLE_COMPLETION_CHECK_LABELS[code],
    classification,
    status: passed ? "PASS" : "FAIL",
    message: passed ? passMessage : failMessage,
    ...context,
  };
}

function isOperationalLength(value: unknown): value is Decimetres {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isNonNegativeCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function completionRunOrder(left: Run, right: Run): number {
  return (
    left.runNumber - right.runNumber ||
    left.startedAt.localeCompare(right.startedAt) ||
    left.localId.localeCompare(right.localId)
  );
}

function outcomeResolvesAssignment(
  holeId: string,
  assignment: ComponentAssignment,
  runs: readonly Run[],
  outcomes: readonly HoleCompletionComponentOutcome[],
): boolean {
  try {
    calculateComponentUsage(assignment, runs);
  } catch {
    return false;
  }
  const matches = outcomes.filter(
    (outcome) =>
      outcome.assignmentId === assignment.localId &&
      outcome.componentId === assignment.componentId &&
      outcome.componentType === assignment.componentType,
  );
  if (matches.length !== 1) return false;
  return matches[0]!.outcome !== "CARRIED_FORWARD" ||
    matches[0]!.targetHoleId === undefined ||
    matches[0]!.targetHoleId !== holeId;
}

function isAcknowledged(
  code: HoleCompletionCheckCode,
  acknowledgements: readonly HoleCompletionWarningAcknowledgement[],
): boolean {
  return acknowledgements.some(
    (acknowledgement) =>
      acknowledgement.checkCode === code &&
      hasText(acknowledgement.reason) &&
      hasText(acknowledgement.acknowledgedAt) &&
      hasText(acknowledgement.acknowledgedByUserId) &&
      hasText(acknowledgement.acknowledgedByNameSnapshot),
  );
}

/**
 * Reconciles the complete hole state without mutating any supplied record.
 * Every operational length remains in integer decimetres.
 */
export function evaluateHoleCompletion(
  input: EvaluateHoleCompletionInput,
): HoleCompletionEvaluation {
  const checks: HoleCompletionCheck[] = [];
  const completedRuns = input.runs
    .filter(({ status }) => status !== "in_progress" && status !== "void")
    .sort(completionRunOrder);
  const unfinishedRuns = input.runs.filter(
    ({ status }) => status === "in_progress",
  );
  const finalRun = completedRuns.at(-1);
  const finalDepthDm = finalRun?.holeDepth;

  checks.push(
    check(
      "FINAL_DEPTH_AVAILABLE",
      "BLOCKING",
      finalRun !== undefined && isOperationalLength(finalDepthDm),
      `Final depth is ${String(finalDepthDm)} dm from run ${String(finalRun?.runNumber)}.`,
      "No valid completed run is available to establish final depth.",
      finalRun === undefined ? {} : { entityIds: [finalRun.localId] },
    ),
  );

  checks.push(
    check(
      "RUNS_FINISHED",
      "BLOCKING",
      unfinishedRuns.length === 0,
      "There are no unfinished runs.",
      `${unfinishedRuns.length} unfinished run${unfinishedRuns.length === 1 ? "" : "s"} must be completed or discarded.`,
      { entityIds: unfinishedRuns.map(({ localId }) => localId) },
    ),
  );

  const runNumberCounts = new Map<number, number>();
  for (const run of completedRuns) {
    runNumberCounts.set(
      run.runNumber,
      (runNumberCounts.get(run.runNumber) ?? 0) + 1,
    );
  }
  const duplicateRunNumbers = [...runNumberCounts]
    .filter(([, count]) => count > 1)
    .map(([runNumber]) => runNumber);
  checks.push(
    check(
      "RUN_NUMBERS_UNIQUE",
      "BLOCKING",
      duplicateRunNumbers.length === 0,
      "Completed run numbers are unique.",
      `Duplicate completed run number${duplicateRunNumbers.length === 1 ? "" : "s"}: ${duplicateRunNumbers.join(", ")}.`,
      {
        entityIds: completedRuns
          .filter(({ runNumber }) => duplicateRunNumbers.includes(runNumber))
          .map(({ localId }) => localId),
      },
    ),
  );

  const uniqueRunNumbers = [...runNumberCounts.keys()].sort(
    (left, right) => left - right,
  );
  const missingRunNumbers: number[] = [];
  const lowestRunNumber = uniqueRunNumbers[0] ?? 0;
  const highestRunNumber = uniqueRunNumbers.at(-1) ?? 0;
  for (
    let runNumber = lowestRunNumber;
    runNumber <= highestRunNumber;
    runNumber += 1
  ) {
    if (!runNumberCounts.has(runNumber)) missingRunNumbers.push(runNumber);
  }
  checks.push(
    check(
      "RUN_SEQUENCE_COMPLETE",
      "ADVISORY",
      missingRunNumbers.length === 0,
      "Completed run numbers form a complete sequence.",
      `Missing completed run number${missingRunNumbers.length === 1 ? "" : "s"}: ${missingRunNumbers.join(", ")}.`,
    ),
  );

  const gapRunIds: string[] = [];
  const overlapRunIds: string[] = [];
  let totalGapDm = 0;
  let totalOverlapDm = 0;
  for (let index = 1; index < completedRuns.length; index += 1) {
    const previous = completedRuns[index - 1]!;
    const current = completedRuns[index]!;
    if (
      !isOperationalLength(previous.holeDepth) ||
      !isOperationalLength(current.startDepth)
    ) {
      continue;
    }
    const boundary = classifyRunBoundary(
      previous.holeDepth,
      current.startDepth,
    );
    if (boundary.kind === "gap") {
      gapRunIds.push(previous.localId, current.localId);
      totalGapDm += boundary.amount;
    } else if (boundary.kind === "overlap") {
      overlapRunIds.push(previous.localId, current.localId);
      totalOverlapDm += boundary.amount;
    }
  }
  checks.push(
    check(
      "RUN_DEPTH_GAPS",
      "ADVISORY",
      gapRunIds.length === 0,
      "Completed run depths are contiguous.",
      `Completed runs contain ${totalGapDm} dm of depth gaps.`,
      {
        entityIds: [...new Set(gapRunIds)],
        amountDm: totalGapDm as Decimetres,
      },
    ),
    check(
      "RUN_DEPTH_OVERLAPS",
      "BLOCKING",
      overlapRunIds.length === 0,
      "Completed run depths do not overlap.",
      `Completed runs contain ${totalOverlapDm} dm of depth overlap.`,
      {
        entityIds: [...new Set(overlapRunIds)],
        amountDm: totalOverlapDm as Decimetres,
      },
    ),
  );

  const nonPositiveRuns = completedRuns.filter(
    (run) =>
      !isOperationalLength(run.startDepth) ||
      !isOperationalLength(run.holeDepth) ||
      !isOperationalLength(run.drilledLength) ||
      run.holeDepth <= run.startDepth ||
      run.drilledLength <= 0,
  );
  checks.push(
    check(
      "RUN_LENGTHS_POSITIVE",
      "BLOCKING",
      nonPositiveRuns.length === 0,
      "Every completed run has a positive drilled interval.",
      `${nonPositiveRuns.length} completed run${nonPositiveRuns.length === 1 ? " has" : "s have"} a non-positive drilled interval.`,
      { entityIds: nonPositiveRuns.map(({ localId }) => localId) },
    ),
  );

  const unreconciledRunIds = completedRuns.flatMap((run) => {
    if (
      !isOperationalLength(run.startDepth) ||
      !isOperationalLength(run.previousCompletedDepth) ||
      !isOperationalLength(run.holeDepth) ||
      !isOperationalLength(run.drilledLength) ||
      run.previousCompletedDepth !== run.startDepth
    ) {
      return [run.localId];
    }
    try {
      const calculated = calculateDrilledLength(
        run.holeDepth,
        run.startDepth,
      );
      return calculated === run.drilledLength ? [] : [run.localId];
    } catch {
      return [run.localId];
    }
  });
  checks.push(
    check(
      "RUN_DEPTHS_RECONCILED",
      "BLOCKING",
      unreconciledRunIds.length === 0,
      "Recorded run depths and drilled lengths reconcile.",
      `${unreconciledRunIds.length} completed run${unreconciledRunIds.length === 1 ? "" : "s"} do not reconcile.`,
      { entityIds: unreconciledRunIds },
    ),
  );

  let rodConfigurationValid = false;
  if (input.rodConfiguration !== undefined) {
    const configuration = input.rodConfiguration;
    try {
      rodConfigurationValid =
        isOperationalLength(configuration.bottomHoleAssemblyLength) &&
        isOperationalLength(configuration.constantStickUp) &&
        isOperationalLength(configuration.baseRodStringLength) &&
        calculateBaseRodString(
          configuration.bottomHoleAssemblyLength,
          configuration.constantStickUp,
        ) === configuration.baseRodStringLength;
    } catch {
      rodConfigurationValid = false;
    }
  }
  checks.push(
    check(
      "ROD_CONFIGURATION_VALID",
      "BLOCKING",
      rodConfigurationValid,
      "The current rod-string configuration reconciles.",
      "A valid current rod-string configuration is required.",
      input.rodConfiguration === undefined
        ? {}
        : { entityIds: [input.rodConfiguration.localId] },
    ),
  );

  const runsWithInvalidRodFields = completedRuns.flatMap((run) => {
    if (
      !Number.isSafeInteger(run.rodNumber) ||
      run.rodNumber < 0 ||
      !isOperationalLength(run.rodStringLength) ||
      !isOperationalLength(run.measuredStickUp) ||
      !isOperationalLength(run.holeDepth)
    ) {
      return [run.localId];
    }
    try {
      return calculateHoleDepth(run.rodStringLength, run.measuredStickUp) ===
        run.holeDepth
        ? []
        : [run.localId];
    } catch {
      return [run.localId];
    }
  });
  checks.push(
    check(
      "ROD_FIELDS_COMPLETE",
      "BLOCKING",
      runsWithInvalidRodFields.length === 0,
      "Completed-run rod fields are present and reconcile.",
      `${runsWithInvalidRodFields.length} completed run${runsWithInvalidRodFields.length === 1 ? " has" : "s have"} invalid rod fields.`,
      { entityIds: runsWithInvalidRodFields },
    ),
  );

  const pendingRodEventsValid = isNonNegativeCount(
    input.pendingOperations.rodEvents,
  );
  checks.push(
    check(
      "ROD_EVENTS_SETTLED",
      "BLOCKING",
      pendingRodEventsValid && input.pendingOperations.rodEvents === 0,
      "There are no pending rod events.",
      pendingRodEventsValid
        ? `${input.pendingOperations.rodEvents} rod event${input.pendingOperations.rodEvents === 1 ? " is" : "s are"} still pending.`
        : "The pending rod-event count is invalid.",
    ),
  );

  let finalDepthReconciled = false;
  if (
    finalRun !== undefined &&
    finalDepthDm !== undefined &&
    input.rodConfiguration !== undefined &&
    rodConfigurationValid &&
    runsWithInvalidRodFields.length === 0
  ) {
    try {
      const orderedRodEvents = [...input.rodEvents].sort(
        (left, right) => left.sequence - right.sequence,
      );
      const eventInputs = orderedRodEvents.map(({ action, rodLength }) => ({
        action,
        rodLength,
      }));
      const projectedRodString = calculateCurrentRodString(
        input.rodConfiguration.baseRodStringLength,
        eventInputs,
      );
      const projectedRodNumber = calculateRodNumber(eventInputs);
      const projectedDepth = calculateHoleDepth(
        projectedRodString,
        finalRun.measuredStickUp,
      );
      finalDepthReconciled =
        projectedRodString === finalRun.rodStringLength &&
        projectedRodNumber === finalRun.rodNumber &&
        projectedDepth === finalDepthDm;
    } catch {
      finalDepthReconciled = false;
    }
  }
  checks.push(
    check(
      "FINAL_DEPTH_RECONCILED",
      "BLOCKING",
      finalDepthReconciled,
      "Final completed-run depth matches the rod-state projection.",
      "Final completed-run depth does not match the rod-state projection.",
      finalRun === undefined ? {} : { entityIds: [finalRun.localId] },
    ),
  );

  const openShifts = input.shifts.filter(
    ({ status }) => isActiveShiftStatus(status) && status === "OPEN",
  );
  const pendingHandovers = input.shifts.filter(
    ({ status }) =>
      isActiveShiftStatus(status) && status === "HANDOVER_PENDING",
  );
  checks.push(
    check(
      "SHIFTS_CLOSED",
      "BLOCKING",
      openShifts.length === 0,
      "There are no open shifts.",
      `${openShifts.length} shift${openShifts.length === 1 ? " is" : "s are"} still open.`,
      { entityIds: openShifts.map(({ localId }) => localId) },
    ),
    check(
      "HANDOVERS_RESOLVED",
      "BLOCKING",
      pendingHandovers.length === 0,
      "There are no pending handovers.",
      `${pendingHandovers.length} handover${pendingHandovers.length === 1 ? " is" : "s are"} still pending.`,
      { entityIds: pendingHandovers.map(({ localId }) => localId) },
    ),
  );

  const invalidCasing = input.casingStrings.filter((casing) => {
    if (
      !isOperationalLength(casing.startDepthDm) ||
      !isOperationalLength(casing.currentEndDepthDm)
    ) {
      return true;
    }
    const validation = validateCasingRange(
      casing.startDepthDm,
      casing.currentEndDepthDm,
      finalDepthDm ?? casing.currentEndDepthDm,
    );
    return !validation.ok || validation.requiresDepthConfirmation;
  });
  checks.push(
    check(
      "CASING_VALID",
      "BLOCKING",
      invalidCasing.length === 0,
      "Casing ranges are valid at final depth.",
      `${invalidCasing.length} casing string${invalidCasing.length === 1 ? "" : "s"} has an invalid final range.`,
      { entityIds: invalidCasing.map(({ localId }) => localId) },
    ),
  );

  const activeCasing = input.casingStrings.filter(
    ({ status }) => status === "ACTIVE",
  );
  checks.push(
    check(
      "CASING_REVIEWED",
      "ADVISORY",
      activeCasing.length === 0,
      "No casing string remains active.",
      `Active casing remains at completion: ${formatCasingSummary(activeCasing) ?? "review required"}.`,
      { entityIds: activeCasing.map(({ localId }) => localId) },
    ),
  );

  const activeAssignments = input.componentAssignments.filter(
    ({ status }) => status === "ACTIVE",
  );
  const unresolvedAssignments = activeAssignments.filter(
    (assignment) =>
      !outcomeResolvesAssignment(
        input.holeId,
        assignment,
        completedRuns,
        input.componentOutcomes,
      ),
  );
  checks.push(
    check(
      "COMPONENTS_RESOLVED",
      "BLOCKING",
      unresolvedAssignments.length === 0,
      "Every active component has one valid completion outcome.",
      `${unresolvedAssignments.length} active component assignment${unresolvedAssignments.length === 1 ? "" : "s"} requires a valid outcome.`,
      { entityIds: unresolvedAssignments.map(({ localId }) => localId) },
    ),
  );

  const latestSurveyAtFinalDepth =
    finalDepthDm === undefined
      ? undefined
      : findLatestSurvey(
          input.surveys.filter(({ depthDm }) => depthDm <= finalDepthDm),
        );
  let finalSurveyResolved = false;
  if (input.finalSurveyResolution?.status === "RECORDED") {
    finalSurveyResolved =
      latestSurveyAtFinalDepth?.localId ===
      input.finalSurveyResolution.surveyId;
  } else if (input.finalSurveyResolution?.status === "UNAVAILABLE") {
    finalSurveyResolved = hasText(input.finalSurveyResolution.reason);
  }
  const distanceSinceSurvey =
    finalDepthDm === undefined
      ? undefined
      : calculateDistanceSinceLatestSurvey(finalDepthDm, input.surveys);
  checks.push(
    check(
      "FINAL_SURVEY_RESOLVED",
      "BLOCKING",
      finalSurveyResolved,
      "The final survey is recorded or has a documented unavailable reason.",
      "Select the latest valid survey or document why a final survey is unavailable.",
      latestSurveyAtFinalDepth === undefined
        ? {}
        : {
            entityIds: [latestSurveyAtFinalDepth.localId],
            amountDm: distanceSinceSurvey,
          },
    ),
  );

  const finalSurveyUnavailable =
    input.finalSurveyResolution?.status === "UNAVAILABLE" &&
    hasText(input.finalSurveyResolution.reason);
  checks.push(
    check(
      "FINAL_SURVEY_UNAVAILABLE",
      "ADVISORY",
      !finalSurveyUnavailable,
      "A final survey is available.",
      `Final survey is unavailable: ${input.finalSurveyResolution?.status === "UNAVAILABLE" ? input.finalSurveyResolution.reason.trim() : ""}`,
    ),
  );

  const trayStatistics = calculateTrayStatistics(input.trays);
  const finalTray = findPreviousTray(input.trays);
  const finalPartialTrays = input.trays.filter(
    ({ isFinalPartial }) => isFinalPartial,
  );
  const partialTrayIsFinal =
    finalPartialTrays.length === 0 ||
    (finalPartialTrays.length === 1 &&
      finalPartialTrays[0]?.localId === finalTray?.localId);
  const traysReconciled =
    finalTray !== undefined &&
    finalTray.startDepthDm !== undefined &&
    finalTray.endDepthDm !== undefined &&
    finalDepthDm !== undefined &&
    finalTray.endDepthDm === finalDepthDm &&
    trayStatistics.duplicateNumberConflicts === 0 &&
    trayStatistics.depthGaps === 0 &&
    trayStatistics.depthOverlaps === 0 &&
    partialTrayIsFinal;
  checks.push(
    check(
      "TRAYS_RECONCILED",
      "ADVISORY",
      traysReconciled,
      "Tray numbering and depth coverage reconcile to final depth.",
      "Tray numbering or depth coverage does not reconcile to final depth.",
      finalTray === undefined ? {} : { entityIds: [finalTray.localId] },
    ),
    check(
      "FINAL_PARTIAL_TRAY",
      "ADVISORY",
      partialTrayIsFinal,
      finalPartialTrays.length === 0
        ? "A final partial tray is not required."
        : "The last tray is confirmed as the final partial tray.",
      "A tray marked final partial is not the last tray.",
      { entityIds: finalPartialTrays.map(({ localId }) => localId) },
    ),
  );

  const pendingMediaValid = isNonNegativeCount(input.pendingOperations.media);
  const pendingCorrectionsValid = isNonNegativeCount(
    input.pendingOperations.corrections,
  );
  checks.push(
    check(
      "MEDIA_SETTLED",
      "BLOCKING",
      pendingMediaValid && input.pendingOperations.media === 0,
      "There are no pending media operations.",
      pendingMediaValid
        ? `${input.pendingOperations.media} media operation${input.pendingOperations.media === 1 ? " is" : "s are"} still pending.`
        : "The pending media-operation count is invalid.",
    ),
    check(
      "CORRECTIONS_SETTLED",
      "BLOCKING",
      pendingCorrectionsValid && input.pendingOperations.corrections === 0,
      "There are no pending corrections.",
      pendingCorrectionsValid
        ? `${input.pendingOperations.corrections} correction${input.pendingOperations.corrections === 1 ? " is" : "s are"} still pending.`
        : "The pending correction count is invalid.",
    ),
  );

  const completionReasonValid =
    input.completionReason !== undefined &&
    (HOLE_COMPLETION_REASONS as readonly string[]).includes(
      input.completionReason,
    );
  checks.push(
    check(
      "COMPLETION_REASON_PROVIDED",
      "BLOCKING",
      completionReasonValid,
      "A valid completion reason is selected.",
      "A valid completion reason is required.",
    ),
    check(
      "COMPLETION_COMMENT_PROVIDED",
      "BLOCKING",
      input.completionReason !== "OTHER" || hasText(input.completionComment),
      hasText(input.completionComment)
        ? "A completion comment is recorded."
        : "A completion comment is optional for this reason.",
      "A completion comment is required when Other is selected.",
    ),
  );

  const blockers = checks.filter(
    ({ classification, status }) =>
      classification === "BLOCKING" && status === "FAIL",
  );
  const advisories = checks.filter(
    ({ classification, status }) =>
      classification === "ADVISORY" && status === "FAIL",
  );
  const acknowledgements = input.warningAcknowledgements ?? [];
  const unacknowledgedAdvisories = advisories.filter(
    ({ code }) => !isAcknowledged(code, acknowledgements),
  );

  return {
    checks,
    blockers,
    advisories,
    unacknowledgedAdvisories,
    finalDepthDm,
    finalRunNumber: finalRun?.runNumber,
    canComplete:
      blockers.length === 0 && unacknowledgedAdvisories.length === 0,
  };
}
