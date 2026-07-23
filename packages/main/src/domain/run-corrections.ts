import {
  calculateCoreLossOrGain,
  calculateRecoveryPercentage,
} from "./run-results";
import {
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRodNumber,
  type RodEventAction,
  type RodEventInput,
  type RodLength,
} from "./rods";
import { decimetres, type Decimetres } from "./measurements";

export type RunCorrectionKind =
  | "MEASURED_STICK_UP"
  | "RECOVERED_LENGTH"
  | "ROD_EVENT"
  | "COMMENT"
  | "OPERATIONAL_NOTE"
  | "COMPONENT_SNAPSHOT"
  | "RUN_NUMBER"
  | "OTHER"
  | "VOID";

export type CorrectionBlockerCode =
  | "NEGATIVE_HOLE_DEPTH"
  | "NEGATIVE_DRILLED"
  | "IMPOSSIBLE_ROD_REMOVAL"
  | "DUPLICATE_ROD_NUMBER"
  | "DEPTH_OVERLAP"
  | "INVALID_ROD_SEQUENCE"
  | "CROSS_HOLE"
  | "VOID_UNSAFE_ROD_EVENT"
  | "LOCKED_HOLE"
  | "ALREADY_VOID"
  | "RUN_NOT_FOUND"
  | "NO_CHANGES";

export type CorrectionWarningCode =
  | "DEPTH_GAP"
  | "UNUSUAL_RUN_LENGTH"
  | "RECOVERY_ABOVE_100"
  | "TRAY_OVERLAP_CHANGED"
  | "COMPONENT_BOUNDARY_CHANGED"
  | "SURVEY_BEYOND_DEPTH"
  | "COMPLETION_MISMATCH"
  | "SHIFT_AMENDED";

export interface CorrectionBlocker {
  readonly code: CorrectionBlockerCode;
  readonly message: string;
}

export interface CorrectionWarning {
  readonly code: CorrectionWarningCode;
  readonly message: string;
}

export interface EffectiveRunProjection {
  readonly localId: string;
  readonly holeId: string;
  readonly runNumber: number;
  readonly rodNumber: number;
  readonly rodStringDm: number;
  readonly measuredStickUpDm: number;
  readonly previousCompletedDepthDm: number;
  readonly holeDepthDm: number;
  readonly drilledLengthDm: number;
  readonly recoveredLengthDm: number;
  readonly recoveryPercentage: number;
  readonly comment: string;
  readonly status: "completed" | "corrected" | "void";
  readonly rodEvents: readonly EffectiveRodEvent[];
  readonly activeBitSerialNumberSnapshot: string | null;
  readonly activeReamerSerialNumberSnapshot: string | null;
  readonly version: number;
}

export interface EffectiveRodEvent {
  readonly localId: string;
  readonly action: RodEventAction;
  readonly rodLengthDm: 30 | 60;
  readonly affectedRodNumber: number;
  readonly rodNumberAfterEvent: number;
  readonly voided: boolean;
}

export interface RunImpactChange {
  readonly runId: string;
  readonly runNumber: number;
  readonly field: string;
  readonly previousValue: number | string | null;
  readonly correctedValue: number | string | null;
}

export interface ShiftImpactChange {
  readonly shiftId: string;
  readonly field: string;
  readonly previousValue: number | string | null;
  readonly correctedValue: number | string | null;
}

export interface RunCorrectionImpact {
  readonly targetRunId: string;
  readonly previousRun: EffectiveRunProjection;
  readonly correctedRun: EffectiveRunProjection;
  readonly projectedRuns: readonly EffectiveRunProjection[];
  readonly affectedRuns: readonly RunImpactChange[];
  readonly affectedShifts: readonly ShiftImpactChange[];
  readonly previousFinalRodNumber: number;
  readonly correctedFinalRodNumber: number;
  readonly previousCurrentRodStringDm: number;
  readonly correctedCurrentRodStringDm: number;
  readonly statisticsChanged: boolean;
  readonly trayOverlapChanged: boolean;
  readonly componentUsageChanged: boolean;
  readonly completionChanged: boolean;
  readonly staleReportIds: readonly string[];
  readonly blockers: readonly CorrectionBlocker[];
  readonly warnings: readonly CorrectionWarning[];
}

export interface RodEventCorrectionInput {
  readonly rodEventId: string;
  readonly action: RodEventAction;
  readonly rodLengthDm: 30 | 60;
  readonly affectedRodNumber: number;
  /** When true, treat the event as removed from the operational chain. */
  readonly voided?: boolean;
}

export interface PreviewRunCorrectionInput {
  readonly holeId: string;
  readonly runId: string;
  readonly correctionType: Exclude<RunCorrectionKind, "VOID">;
  readonly reason: string;
  readonly comment?: string;
  readonly measuredStickUpDm?: number;
  readonly recoveredLengthDm?: number;
  readonly runNumber?: number;
  readonly operationalNote?: string;
  readonly activeBitSerialNumberSnapshot?: string | null;
  readonly activeReamerSerialNumberSnapshot?: string | null;
  readonly rodEvent?: RodEventCorrectionInput;
  /** Optional: add a missing rod event (no original event id). */
  readonly addRodEvent?: {
    readonly action: RodEventAction;
    readonly rodLengthDm: 30 | 60;
    readonly affectedRodNumber: number;
  };
  readonly runs: readonly EffectiveRunProjection[];
  readonly surveyDepthsDm?: readonly number[];
  readonly reportIdsByFingerprintRelevance?: readonly string[];
  readonly holeLocked?: boolean;
  readonly closedShiftEndingDepthByShiftId?: Readonly<
    Record<string, { readonly shiftId: string; readonly endingDepthDm: number }>
  >;
}

export interface PreviewVoidRunInput {
  readonly holeId: string;
  readonly runId: string;
  readonly reason: string;
  readonly comment?: string;
  readonly rodEventResolution: "VOID_WITH_RUN" | "REASSIGN" | "CANCEL";
  readonly reassignToRunId?: string;
  readonly runs: readonly EffectiveRunProjection[];
  readonly surveyDepthsDm?: readonly number[];
  readonly reportIdsByFingerprintRelevance?: readonly string[];
  readonly holeLocked?: boolean;
}

const UNUSUAL_RUN_LENGTH_DM = 120;

function cloneRun(run: EffectiveRunProjection): EffectiveRunProjection {
  return {
    ...run,
    rodEvents: run.rodEvents.map((event) => ({ ...event })),
  };
}

function operationalRuns(
  runs: readonly EffectiveRunProjection[],
): EffectiveRunProjection[] {
  return [...runs]
    .filter((run) => run.status !== "void")
    .sort((left, right) => left.runNumber - right.runNumber);
}

function asRodLength(value: 30 | 60): RodLength {
  return decimetres(value) as RodLength;
}

function rodInputsFromEvents(
  events: readonly EffectiveRodEvent[],
): RodEventInput[] {
  return events
    .filter((event) => !event.voided)
    .map((event) => ({
      action: event.action,
      rodLength: asRodLength(event.rodLengthDm),
    }));
}

function resequenceRodEvents(
  events: readonly EffectiveRodEvent[],
  startingRodNumber: number,
): EffectiveRodEvent[] {
  let rodNumber = startingRodNumber;
  const activeNumbers = new Set<number>();
  return events.map((event) => {
    if (event.voided) {
      return { ...event, rodNumberAfterEvent: rodNumber };
    }
    if (event.action === "add") {
      const affected = event.affectedRodNumber;
      if (activeNumbers.has(affected)) {
        throw new RangeError(`Duplicate active rod number ${affected}.`);
      }
      activeNumbers.add(affected);
      rodNumber += 1;
      return {
        ...event,
        affectedRodNumber: affected,
        rodNumberAfterEvent: rodNumber,
      };
    }
    if (!activeNumbers.has(event.affectedRodNumber) && rodNumber <= 0) {
      throw new RangeError("Rod removal target is not active.");
    }
    activeNumbers.delete(event.affectedRodNumber);
    rodNumber -= 1;
    if (rodNumber < 0) {
      throw new RangeError("Rod removal cannot reduce rod number below zero.");
    }
    return {
      ...event,
      rodNumberAfterEvent: rodNumber,
    };
  });
}

function eventLengthContribution(events: readonly EffectiveRodEvent[]): number {
  return events
    .filter((event) => !event.voided)
    .reduce(
      (total, event) =>
        total + (event.action === "add" ? event.rodLengthDm : -event.rodLengthDm),
      0,
    );
}

/**
 * Recalculate absolute depths for a chain of runs.
 *
 * Stick-up corrections keep later absolute end depths (own R/S − stick-up) and
 * only rewrite the following run's previousCompletedDepth + drilled.
 * Rod-event corrections recompute later R/S and depths from the shared string.
 *
 * `baselines` must be the pre-correction projections so the first-run rod-string
 * baseline is derived from original events, not already-corrected events.
 */
export function projectRunChain(
  runs: readonly EffectiveRunProjection[],
  mode: "stick-up" | "rod-event" | "recovery" | "metadata" | "void",
  baselines: readonly EffectiveRunProjection[] = runs,
): EffectiveRunProjection[] {
  const ordered = operationalRuns(runs).map(cloneRun);
  if (ordered.length === 0) return [];
  const baselineById = new Map(baselines.map((run) => [run.localId, run]));

  if (mode === "recovery" || mode === "metadata") {
    return ordered.map((run) => {
      if (run.drilledLengthDm <= 0) return run;
      return {
        ...run,
        recoveryPercentage: calculateRecoveryPercentage(
          decimetres(run.drilledLengthDm),
          decimetres(run.recoveredLengthDm),
        ),
      };
    });
  }

  if (mode === "stick-up") {
    for (let index = 0; index < ordered.length; index += 1) {
      const run = ordered[index]!;
      let holeDepthDm: number;
      try {
        holeDepthDm = Number(
          calculateHoleDepth(
            decimetres(run.rodStringDm),
            decimetres(run.measuredStickUpDm),
          ),
        );
      } catch {
        holeDepthDm = run.rodStringDm - run.measuredStickUpDm;
      }
      const previousCompletedDepthDm =
        index === 0
          ? run.previousCompletedDepthDm
          : ordered[index - 1]!.holeDepthDm;
      let drilledLengthDm: number;
      try {
        drilledLengthDm = Number(
          calculateDrilledLength(
            decimetres(Math.max(0, holeDepthDm)),
            decimetres(previousCompletedDepthDm),
          ),
        );
      } catch {
        drilledLengthDm = holeDepthDm - previousCompletedDepthDm;
      }
      ordered[index] = {
        ...run,
        previousCompletedDepthDm,
        holeDepthDm,
        drilledLengthDm,
        recoveryPercentage:
          drilledLengthDm > 0
            ? calculateRecoveryPercentage(
                decimetres(drilledLengthDm),
                decimetres(run.recoveredLengthDm),
              )
            : run.recoveryPercentage,
      };
    }
    return ordered;
  }

  // rod-event / void: rebuild from pre-correction baseline, apply corrected events
  const firstBaseline = baselineById.get(ordered[0]!.localId) ?? ordered[0]!;
  let currentRodString =
    firstBaseline.rodStringDm - eventLengthContribution(firstBaseline.rodEvents);
  let currentRodNumber = firstBaseline.rodNumber;
  for (const event of firstBaseline.rodEvents) {
    if (event.voided) continue;
    currentRodNumber += event.action === "add" ? -1 : 1;
  }
  currentRodNumber = Math.max(0, currentRodNumber);

  for (let index = 0; index < ordered.length; index += 1) {
    const run = ordered[index]!;
    const events = resequenceRodEvents(run.rodEvents, currentRodNumber);
    for (const event of events) {
      if (event.voided) continue;
      currentRodString +=
        event.action === "add" ? event.rodLengthDm : -event.rodLengthDm;
      currentRodNumber = event.rodNumberAfterEvent;
    }
    let holeDepthDm: number;
    try {
      holeDepthDm = Number(
        calculateHoleDepth(
          decimetres(currentRodString),
          decimetres(run.measuredStickUpDm),
        ),
      );
    } catch {
      holeDepthDm = currentRodString - run.measuredStickUpDm;
    }
    const previousCompletedDepthDm =
      index === 0
        ? run.previousCompletedDepthDm
        : ordered[index - 1]!.holeDepthDm;
    let drilledLengthDm: number;
    try {
      drilledLengthDm = Number(
        calculateDrilledLength(
          decimetres(Math.max(0, holeDepthDm)),
          decimetres(previousCompletedDepthDm),
        ),
      );
    } catch {
      drilledLengthDm = holeDepthDm - previousCompletedDepthDm;
    }
    ordered[index] = {
      ...run,
      rodEvents: events,
      rodNumber: currentRodNumber,
      rodStringDm: currentRodString,
      previousCompletedDepthDm,
      holeDepthDm,
      drilledLengthDm,
      recoveryPercentage:
        drilledLengthDm > 0
          ? calculateRecoveryPercentage(
              decimetres(drilledLengthDm),
              decimetres(run.recoveredLengthDm),
            )
          : run.recoveryPercentage,
    };
  }

  return ordered;
}

function collectFieldChanges(
  previous: readonly EffectiveRunProjection[],
  next: readonly EffectiveRunProjection[],
): RunImpactChange[] {
  const previousById = new Map(previous.map((run) => [run.localId, run]));
  const changes: RunImpactChange[] = [];
  const fields = [
    "runNumber",
    "rodNumber",
    "rodStringDm",
    "measuredStickUpDm",
    "previousCompletedDepthDm",
    "holeDepthDm",
    "drilledLengthDm",
    "recoveredLengthDm",
    "recoveryPercentage",
    "comment",
    "status",
  ] as const;

  for (const run of next) {
    const before = previousById.get(run.localId);
    if (before === undefined) continue;
    for (const field of fields) {
      if (before[field] !== run[field]) {
        changes.push({
          runId: run.localId,
          runNumber: run.runNumber,
          field,
          previousValue: before[field],
          correctedValue: run[field],
        });
      }
    }
  }
  return changes;
}

function validateChain(
  projected: readonly EffectiveRunProjection[],
  surveyDepthsDm: readonly number[] = [],
): {
  readonly blockers: CorrectionBlocker[];
  readonly warnings: CorrectionWarning[];
} {
  const blockers: CorrectionBlocker[] = [];
  const warnings: CorrectionWarning[] = [];
  const ordered = operationalRuns(projected);

  for (let index = 0; index < ordered.length; index += 1) {
    const run = ordered[index]!;
    if (run.holeDepthDm < 0) {
      blockers.push({
        code: "NEGATIVE_HOLE_DEPTH",
        message: `Run ${run.runNumber} would have a negative hole depth.`,
      });
    }
    if (run.drilledLengthDm < 0) {
      blockers.push({
        code: "NEGATIVE_DRILLED",
        message: `Run ${run.runNumber} would have a negative drilled length.`,
      });
    }
    if (run.drilledLengthDm > UNUSUAL_RUN_LENGTH_DM) {
      warnings.push({
        code: "UNUSUAL_RUN_LENGTH",
        message: `Run ${run.runNumber} drilled length ${run.drilledLengthDm / 10} m is unusually long.`,
      });
    }
    if (run.recoveryPercentage > 100) {
      warnings.push({
        code: "RECOVERY_ABOVE_100",
        message: `Run ${run.runNumber} recovery would be ${run.recoveryPercentage.toFixed(1)}%.`,
      });
    }
    if (index > 0) {
      const previous = ordered[index - 1]!;
      if (run.previousCompletedDepthDm < previous.holeDepthDm) {
        blockers.push({
          code: "DEPTH_OVERLAP",
          message: `Run ${run.runNumber} would overlap run ${previous.runNumber}.`,
        });
      } else if (run.previousCompletedDepthDm > previous.holeDepthDm) {
        warnings.push({
          code: "DEPTH_GAP",
          message: `A depth gap would appear between run ${previous.runNumber} and run ${run.runNumber}.`,
        });
      }
    }

    try {
      calculateRodNumber(rodInputsFromEvents(run.rodEvents), 0);
    } catch (error) {
      blockers.push({
        code: "INVALID_ROD_SEQUENCE",
        message:
          error instanceof Error
            ? error.message
            : `Run ${run.runNumber} rod sequence is invalid.`,
      });
    }

    const active = new Set<number>();
    for (const event of run.rodEvents) {
      if (event.voided) continue;
      if (event.action === "add") {
        if (active.has(event.affectedRodNumber)) {
          blockers.push({
            code: "DUPLICATE_ROD_NUMBER",
            message: `Duplicate active rod number ${event.affectedRodNumber} on run ${run.runNumber}.`,
          });
        }
        active.add(event.affectedRodNumber);
      } else if (!active.has(event.affectedRodNumber) && active.size === 0) {
        blockers.push({
          code: "IMPOSSIBLE_ROD_REMOVAL",
          message: `Rod ${event.affectedRodNumber} cannot be removed on run ${run.runNumber}.`,
        });
      } else {
        active.delete(event.affectedRodNumber);
      }
    }
  }

  const finalDepth = ordered.at(-1)?.holeDepthDm ?? 0;
  for (const surveyDepth of surveyDepthsDm) {
    if (surveyDepth > finalDepth) {
      warnings.push({
        code: "SURVEY_BEYOND_DEPTH",
        message: `Survey at ${surveyDepth / 10} m now exceeds the corrected completed hole depth of ${finalDepth / 10} m.`,
      });
    }
  }

  return { blockers, warnings };
}

function finalOperational(runs: readonly EffectiveRunProjection[]) {
  const ordered = operationalRuns(runs);
  const last = ordered.at(-1);
  return {
    rodNumber: last?.rodNumber ?? 0,
    rodStringDm: last?.rodStringDm ?? 0,
  };
}

export function previewRunCorrection(
  input: PreviewRunCorrectionInput,
): RunCorrectionImpact {
  const blockers: CorrectionBlocker[] = [];
  const warnings: CorrectionWarning[] = [];

  if (input.holeLocked) {
    blockers.push({
      code: "LOCKED_HOLE",
      message:
        "This hole is completed and locked. Reopen the hole before correcting operational run data.",
    });
  }

  const target = input.runs.find((run) => run.localId === input.runId);
  if (target === undefined) {
    return emptyImpact(input.runId, blockers.concat({
      code: "RUN_NOT_FOUND",
      message: "The run was not found.",
    }));
  }
  if (target.holeId !== input.holeId) {
    blockers.push({
      code: "CROSS_HOLE",
      message: "The run does not belong to this hole.",
    });
  }
  if (target.status === "void") {
    blockers.push({
      code: "ALREADY_VOID",
      message: "A voided run cannot be corrected. Restore is not supported in this release.",
    });
  }

  const working = input.runs.map(cloneRun);
  const index = working.findIndex((run) => run.localId === input.runId);
  let current = cloneRun(working[index]!);
  let mode: "stick-up" | "rod-event" | "recovery" | "metadata" = "metadata";

  switch (input.correctionType) {
    case "MEASURED_STICK_UP": {
      if (input.measuredStickUpDm === undefined) {
        blockers.push({ code: "NO_CHANGES", message: "Enter a corrected stick-up." });
        break;
      }
      if (input.measuredStickUpDm === current.measuredStickUpDm) {
        blockers.push({ code: "NO_CHANGES", message: "Corrected stick-up matches the current value." });
        break;
      }
      current = { ...current, measuredStickUpDm: input.measuredStickUpDm };
      mode = "stick-up";
      break;
    }
    case "RECOVERED_LENGTH": {
      if (input.recoveredLengthDm === undefined) {
        blockers.push({ code: "NO_CHANGES", message: "Enter a corrected recovered length." });
        break;
      }
      if (input.recoveredLengthDm === current.recoveredLengthDm) {
        blockers.push({ code: "NO_CHANGES", message: "Corrected recovered length matches the current value." });
        break;
      }
      current = { ...current, recoveredLengthDm: input.recoveredLengthDm };
      mode = "recovery";
      break;
    }
    case "COMMENT":
    case "OPERATIONAL_NOTE": {
      const nextComment =
        input.correctionType === "COMMENT"
          ? (input.comment ?? current.comment)
          : (input.operationalNote ?? current.comment);
      if (nextComment === current.comment) {
        blockers.push({ code: "NO_CHANGES", message: "Corrected comment matches the current value." });
        break;
      }
      current = { ...current, comment: nextComment };
      mode = "metadata";
      break;
    }
    case "COMPONENT_SNAPSHOT": {
      const bit =
        input.activeBitSerialNumberSnapshot === undefined
          ? current.activeBitSerialNumberSnapshot
          : input.activeBitSerialNumberSnapshot;
      const reamer =
        input.activeReamerSerialNumberSnapshot === undefined
          ? current.activeReamerSerialNumberSnapshot
          : input.activeReamerSerialNumberSnapshot;
      if (
        bit === current.activeBitSerialNumberSnapshot &&
        reamer === current.activeReamerSerialNumberSnapshot
      ) {
        blockers.push({
          code: "NO_CHANGES",
          message: "Component snapshots match the current values.",
        });
        break;
      }
      current = {
        ...current,
        activeBitSerialNumberSnapshot: bit,
        activeReamerSerialNumberSnapshot: reamer,
      };
      mode = "metadata";
      warnings.push({
        code: "COMPONENT_BOUNDARY_CHANGED",
        message:
          "Component snapshot correction updates the run display only. Assignment boundaries are not changed.",
      });
      break;
    }
    case "RUN_NUMBER": {
      if (input.runNumber === undefined) {
        blockers.push({ code: "NO_CHANGES", message: "Enter a corrected run number." });
        break;
      }
      if (input.runNumber === current.runNumber) {
        blockers.push({ code: "NO_CHANGES", message: "Corrected run number matches the current value." });
        break;
      }
      const duplicate = operationalRuns(working).some(
        (run) =>
          run.localId !== current.localId && run.runNumber === input.runNumber,
      );
      if (duplicate) {
        blockers.push({
          code: "DEPTH_OVERLAP",
          message: `Run number ${input.runNumber} is already used. Prefer voiding a duplicate instead of mass renumbering.`,
        });
        break;
      }
      current = { ...current, runNumber: input.runNumber };
      mode = "metadata";
      break;
    }
    case "ROD_EVENT": {
      mode = "rod-event";
      if (input.addRodEvent !== undefined) {
        const added: EffectiveRodEvent = {
          localId: `added-rod-${current.localId}-${current.rodEvents.length + 1}`,
          action: input.addRodEvent.action,
          rodLengthDm: input.addRodEvent.rodLengthDm,
          affectedRodNumber: input.addRodEvent.affectedRodNumber,
          rodNumberAfterEvent: current.rodNumber,
          voided: false,
        };
        current = { ...current, rodEvents: [...current.rodEvents, added] };
      } else if (input.rodEvent !== undefined) {
        const eventIndex = current.rodEvents.findIndex(
          (event) => event.localId === input.rodEvent!.rodEventId,
        );
        if (eventIndex < 0) {
          blockers.push({
            code: "INVALID_ROD_SEQUENCE",
            message: "The rod event to correct was not found on this run.",
          });
          break;
        }
        const existing = current.rodEvents[eventIndex]!;
        const nextEvents = [...current.rodEvents];
        nextEvents[eventIndex] = {
          ...existing,
          action: input.rodEvent.action,
          rodLengthDm: input.rodEvent.rodLengthDm,
          affectedRodNumber: input.rodEvent.affectedRodNumber,
          voided: input.rodEvent.voided ?? false,
        };
        current = { ...current, rodEvents: nextEvents };
      } else {
        blockers.push({
          code: "NO_CHANGES",
          message: "Provide a rod event correction or missing addition.",
        });
      }
      break;
    }
    case "OTHER": {
      blockers.push({
        code: "NO_CHANGES",
        message: "Choose a specific correction type.",
      });
      break;
    }
  }

  working[index] = {
    ...current,
    status: current.status === "void" ? "void" : "corrected",
  };

  let projected: EffectiveRunProjection[] = working;
  try {
    const chain = projectRunChain(working, mode, input.runs);
    const byId = new Map(chain.map((run) => [run.localId, run]));
    projected = working.map((run) =>
      run.status === "void" ? run : (byId.get(run.localId) ?? run),
    );
  } catch (error) {
    blockers.push({
      code:
        error instanceof RangeError &&
        error.message.toLowerCase().includes("duplicate")
          ? "DUPLICATE_ROD_NUMBER"
          : error instanceof RangeError &&
              error.message.toLowerCase().includes("removal")
            ? "IMPOSSIBLE_ROD_REMOVAL"
            : "INVALID_ROD_SEQUENCE",
      message:
        error instanceof Error
          ? error.message
          : "Rod projection failed for this correction.",
    });
  }

  const validation = validateChain(projected, input.surveyDepthsDm);
  blockers.push(...validation.blockers);
  warnings.push(...validation.warnings);

  const previousFinal = finalOperational(input.runs);
  const correctedFinal = finalOperational(projected);
  const affectedRuns = collectFieldChanges(input.runs, projected);
  const statisticsChanged = affectedRuns.some((change) =>
    [
      "holeDepthDm",
      "drilledLengthDm",
      "recoveredLengthDm",
      "recoveryPercentage",
      "status",
      "rodNumber",
      "rodStringDm",
    ].includes(change.field),
  );

  const correctedTarget =
    projected.find((run) => run.localId === input.runId) ?? current;
  const depthChanged = affectedRuns.some(
    (change) =>
      change.field === "holeDepthDm" || change.field === "drilledLengthDm",
  );

  return {
    targetRunId: input.runId,
    previousRun: target,
    correctedRun: correctedTarget,
    projectedRuns: projected,
    affectedRuns,
    affectedShifts: [],
    previousFinalRodNumber: previousFinal.rodNumber,
    correctedFinalRodNumber: correctedFinal.rodNumber,
    previousCurrentRodStringDm: previousFinal.rodStringDm,
    correctedCurrentRodStringDm: correctedFinal.rodStringDm,
    statisticsChanged,
    trayOverlapChanged: depthChanged,
    componentUsageChanged: depthChanged,
    completionChanged: depthChanged || affectedRuns.some((c) => c.field === "status"),
    staleReportIds: statisticsChanged
      ? [...(input.reportIdsByFingerprintRelevance ?? [])]
      : [],
    blockers,
    warnings,
  };
}

export function previewVoidRun(input: PreviewVoidRunInput): RunCorrectionImpact {
  const blockers: CorrectionBlocker[] = [];
  const warnings: CorrectionWarning[] = [];

  if (input.holeLocked) {
    blockers.push({
      code: "LOCKED_HOLE",
      message:
        "This hole is completed and locked. Reopen the hole before voiding operational run data.",
    });
  }

  const target = input.runs.find((run) => run.localId === input.runId);
  if (target === undefined) {
    return emptyImpact(input.runId, [
      { code: "RUN_NOT_FOUND", message: "The run was not found." },
    ]);
  }
  if (target.holeId !== input.holeId) {
    blockers.push({
      code: "CROSS_HOLE",
      message: "The run does not belong to this hole.",
    });
  }
  if (target.status === "void") {
    blockers.push({
      code: "ALREADY_VOID",
      message: "This run is already voided.",
    });
  }

  if (
    target.rodEvents.some((event) => !event.voided) &&
    input.rodEventResolution === "CANCEL"
  ) {
    blockers.push({
      code: "VOID_UNSAFE_ROD_EVENT",
      message: "Cancel and correct the run instead of voiding.",
    });
  }
  if (
    target.rodEvents.some((event) => !event.voided) &&
    input.rodEventResolution === "REASSIGN" &&
    !input.reassignToRunId
  ) {
    blockers.push({
      code: "VOID_UNSAFE_ROD_EVENT",
      message: "Choose a run to reassign associated rod events, or void them with the run.",
    });
  }

  const working = input.runs.map(cloneRun);
  const index = working.findIndex((run) => run.localId === input.runId);
  let current = cloneRun(working[index]!);

  if (input.rodEventResolution === "VOID_WITH_RUN") {
    current = {
      ...current,
      rodEvents: current.rodEvents.map((event) => ({
        ...event,
        voided: true,
      })),
    };
  } else if (
    input.rodEventResolution === "REASSIGN" &&
    input.reassignToRunId
  ) {
    const targetIndex = working.findIndex(
      (run) => run.localId === input.reassignToRunId,
    );
    if (targetIndex < 0) {
      blockers.push({
        code: "VOID_UNSAFE_ROD_EVENT",
        message: "The reassignment target run was not found.",
      });
    } else {
      const destination = cloneRun(working[targetIndex]!);
      working[targetIndex] = {
        ...destination,
        rodEvents: [
          ...destination.rodEvents,
          ...current.rodEvents.map((event, eventIndex) => ({
            ...event,
            localId: `${event.localId}-reassigned-${eventIndex + 1}`,
            voided: false,
          })),
        ],
      };
      current = {
        ...current,
        rodEvents: current.rodEvents.map((event) => ({
          ...event,
          voided: true,
        })),
      };
    }
  } else if (target.rodEvents.some((event) => !event.voided)) {
    blockers.push({
      code: "VOID_UNSAFE_ROD_EVENT",
      message:
        "Associated rod events must be voided with the run or explicitly reassigned.",
    });
  }

  current = { ...current, status: "void" };
  working[index] = current;

  let projected = working;
  try {
    const chain = projectRunChain(working, "void", input.runs);
    const byId = new Map(chain.map((run) => [run.localId, run]));
    projected = working.map((run) =>
      run.status === "void" ? run : (byId.get(run.localId) ?? run),
    );
  } catch (error) {
    blockers.push({
      code: "INVALID_ROD_SEQUENCE",
      message:
        error instanceof Error
          ? error.message
          : "Voiding this run corrupts the rod sequence.",
    });
  }

  const validation = validateChain(projected, input.surveyDepthsDm);
  blockers.push(...validation.blockers);
  warnings.push(...validation.warnings);

  const previousFinal = finalOperational(input.runs);
  const correctedFinal = finalOperational(projected);
  const affectedRuns = collectFieldChanges(input.runs, projected);

  return {
    targetRunId: input.runId,
    previousRun: target,
    correctedRun: projected.find((run) => run.localId === input.runId) ?? current,
    projectedRuns: projected,
    affectedRuns,
    affectedShifts: [],
    previousFinalRodNumber: previousFinal.rodNumber,
    correctedFinalRodNumber: correctedFinal.rodNumber,
    previousCurrentRodStringDm: previousFinal.rodStringDm,
    correctedCurrentRodStringDm: correctedFinal.rodStringDm,
    statisticsChanged: true,
    trayOverlapChanged: true,
    componentUsageChanged: true,
    completionChanged: true,
    staleReportIds: [...(input.reportIdsByFingerprintRelevance ?? [])],
    blockers,
    warnings,
  };
}

function emptyImpact(
  targetRunId: string,
  blockers: CorrectionBlocker[],
): RunCorrectionImpact {
  const emptyRun: EffectiveRunProjection = {
    localId: targetRunId,
    holeId: "",
    runNumber: 0,
    rodNumber: 0,
    rodStringDm: 0,
    measuredStickUpDm: 0,
    previousCompletedDepthDm: 0,
    holeDepthDm: 0,
    drilledLengthDm: 0,
    recoveredLengthDm: 0,
    recoveryPercentage: 0,
    comment: "",
    status: "completed",
    rodEvents: [],
    activeBitSerialNumberSnapshot: null,
    activeReamerSerialNumberSnapshot: null,
    version: 1,
  };
  return {
    targetRunId,
    previousRun: emptyRun,
    correctedRun: emptyRun,
    projectedRuns: [],
    affectedRuns: [],
    affectedShifts: [],
    previousFinalRodNumber: 0,
    correctedFinalRodNumber: 0,
    previousCurrentRodStringDm: 0,
    correctedCurrentRodStringDm: 0,
    statisticsChanged: false,
    trayOverlapChanged: false,
    componentUsageChanged: false,
    completionChanged: false,
    staleReportIds: [],
    blockers,
    warnings: [],
  };
}

export function recoveryPreview(input: {
  readonly drilledLengthDm: number;
  readonly previousRecoveredDm: number;
  readonly correctedRecoveredDm: number;
}) {
  const previousRecovery = calculateRecoveryPercentage(
    decimetres(input.drilledLengthDm) as Decimetres,
    decimetres(input.previousRecoveredDm) as Decimetres,
  );
  const correctedRecovery = calculateRecoveryPercentage(
    decimetres(input.drilledLengthDm) as Decimetres,
    decimetres(input.correctedRecoveredDm) as Decimetres,
  );
  return {
    previousRecovery,
    correctedRecovery,
    previousLossOrGain: calculateCoreLossOrGain(
      decimetres(input.drilledLengthDm),
      decimetres(input.previousRecoveredDm),
    ),
    correctedLossOrGain: calculateCoreLossOrGain(
      decimetres(input.drilledLengthDm),
      decimetres(input.correctedRecoveredDm),
    ),
  };
}
