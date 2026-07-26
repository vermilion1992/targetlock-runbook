import {
  calculateComponentUsage,
  type UsageRun,
} from "./component-usage";
import {
  decimetres,
  formatMetres,
  type Decimetres,
} from "./measurements";
import type {
  CasingEvent,
  CasingString,
  Component,
  ComponentAssignment,
  ComponentRemovalReason,
  ComponentUsage,
  NorthReference,
  RunbookShift,
  Survey,
  Tray,
} from "./models";
import {
  averageInteger,
  elapsedMinutesBetween,
  medianInteger,
} from "./numeric";
import { classifyRunBoundary, calculateCoreLossOrGain } from "./run-results";
import {
  calculateShiftAnalytics,
  type ShiftAnalytics,
  type ShiftAnalyticsCorrection,
  type ShiftAnalyticsRun,
} from "./shift-analytics";
import { isSharedRun } from "./shifts";
import {
  calculateSurveyStatistics,
  calculateSurveySpacing,
  findLatestSurvey,
} from "./surveys";
import { calculateTrayStatistics } from "./trays";

/** Documented pilot thresholds for unusually short / long Runs (dm). */
export const SHORT_RUN_LENGTH_DM = 15;
export const LONG_RUN_LENGTH_DM = 60;

export const MIXED_NORTH_REFERENCE_WARNING =
  "Multiple north references are present. Trajectory analysis requires conversion to a common reference.";

export type CompletenessStatus =
  | "Complete"
  | "Review recommended"
  | "Incomplete"
  | "Not applicable";

export interface HoleProductionAnalytics {
  readonly startingDepthDm: Decimetres;
  readonly currentOrFinalDepthDm: Decimetres;
  readonly plannedDepthDm: Decimetres;
  /** Signed integer dm: positive = deeper than planned. */
  readonly differenceFromPlannedDm: number;
  readonly totalDrilledDm: Decimetres;
  readonly totalRecoveredDm: Decimetres;
  readonly totalCoreLossDm: Decimetres;
  readonly totalCoreGainDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
  readonly totalCompletedRuns: number;
  readonly totalVoidedRuns: number;
  readonly totalCorrectedRuns: number;
  readonly averageRunLengthDm?: Decimetres;
  readonly medianRunLengthDm?: Decimetres;
  readonly shortestValidRunDm?: Decimetres;
  readonly longestValidRunDm?: Decimetres;
}

export interface HoleShiftAnalytics {
  readonly totalDayShifts: number;
  readonly totalNightShifts: number;
  readonly completedShifts: number;
  readonly handovers: number;
  readonly sharedRuns: number;
  readonly averageMetresPerCompletedShiftDm?: Decimetres;
  readonly medianMetresPerCompletedShiftDm?: Decimetres;
  readonly averageDayShiftMetresDm?: Decimetres;
  readonly medianDayShiftMetresDm?: Decimetres;
  readonly averageNightShiftMetresDm?: Decimetres;
  readonly medianNightShiftMetresDm?: Decimetres;
  readonly highestShiftMetresDm?: Decimetres;
  readonly lowestShiftMetresDm?: Decimetres;
  readonly averageDayWeightedRecoveryTenths?: number;
  readonly averageNightWeightedRecoveryTenths?: number;
  readonly grossMetresPerElapsedShiftHourTenths?: number;
  readonly perShift: readonly {
    readonly shiftId: string;
    readonly shiftType: "DAY" | "NIGHT";
    readonly shiftDate: string;
    readonly metresCompletedDm: Decimetres;
    readonly endingDepthDm: Decimetres;
    readonly weightedRecoveryTenths?: number;
    readonly analyticsAmended: boolean;
    readonly sharedRunCount: number;
    readonly completedRunCount: number;
  }[];
}

export interface HoleRodAnalytics {
  readonly startingRodNumber: number;
  readonly finalOrCurrentRodNumber: number;
  readonly rodsAdded3m: number;
  readonly rodsAdded6m: number;
  readonly rodsRemoved: number;
  readonly netPhysicalRodChange: number;
  readonly startingRodStringDm: Decimetres;
  readonly finalOrCurrentRodStringDm: Decimetres;
  readonly bhaConfigurationChanges: number;
  readonly constantStickUpChanges: number;
  readonly correctedRodEvents: number;
  readonly voidedRodEvents: number;
}

export interface HoleComponentAssignmentAnalytics {
  readonly assignmentId: string;
  readonly componentId: string;
  readonly componentType: "BIT" | "REAMER";
  readonly serialNumber: string;
  readonly size: string;
  readonly manufacturer?: string;
  readonly modelOrMatrix?: string;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm: Decimetres;
  readonly recordedMetresDm: Decimetres;
  readonly runsTouched: number;
  readonly completeRunsCovered: number;
  readonly partialBoundaryRuns: number;
  readonly observedRecoveryTenths?: number;
  readonly recoveryEstimateStatus: ComponentUsage["recoveryEstimateStatus"];
  readonly installedAt: string;
  readonly removedAt?: string;
  readonly removalReason?: ComponentRemovalReason;
  readonly finalStatus: "ACTIVE" | "CLOSED";
}

export interface HoleComponentAnalytics {
  readonly bitsUsed: number;
  readonly reamersUsed: number;
  readonly averageRecordedMetresPerBitDm?: Decimetres;
  readonly averageRecordedMetresPerReamerDm?: Decimetres;
  readonly longestBitIntervalDm?: Decimetres;
  readonly longestReamerIntervalDm?: Decimetres;
  readonly removalReasonsByCount: readonly {
    readonly reason: ComponentRemovalReason | "UNSPECIFIED";
    readonly count: number;
  }[];
  readonly assignments: readonly HoleComponentAssignmentAnalytics[];
}

export interface HoleCasingAnalytics {
  readonly stringCount: number;
  readonly sizes: readonly string[];
  readonly installCount: number;
  readonly advancementCount: number;
  readonly correctionCount: number;
  readonly deepestCasingDm?: Decimetres;
  readonly timeline: readonly {
    readonly casingId: string;
    readonly size: string;
    readonly startDepthDm: Decimetres;
    readonly endDepthDm: Decimetres;
    readonly status: string;
  }[];
}

export interface HoleSurveyAnalytics {
  readonly totalSurveys: number;
  readonly firstSurveyDepthDm?: Decimetres;
  readonly latestSurveyDepthDm?: Decimetres;
  readonly finalDipTenths?: number;
  readonly finalAzimuthTenths?: number;
  readonly finalNorthReference?: NorthReference;
  readonly distanceFromFinalDepthToLatestDm?: Decimetres;
  readonly averageSurveySpacingDm?: Decimetres;
  readonly medianSurveySpacingDm?: Decimetres;
  readonly largestSurveyGapDm?: Decimetres;
  readonly duplicateDepthSurveyCount: number;
  readonly correctedSurveyCount: number;
  readonly surveysWithPhotographs: number;
  readonly surveyToolsUsed: readonly string[];
  readonly northReferenceDistribution: readonly {
    readonly reference: NorthReference;
    readonly count: number;
  }[];
  readonly mixedNorthReferences: boolean;
  readonly mixedNorthReferenceWarning?: string;
  readonly records: readonly {
    readonly surveyId: string;
    readonly depthDm: Decimetres;
    readonly dipTenths: number;
    readonly azimuthTenths: number;
    readonly northReference: NorthReference;
    readonly toolName?: string;
    readonly toolSerialNumber?: string;
    readonly recordedAt: string;
    readonly corrected: boolean;
    readonly hasPhotograph: boolean;
  }[];
}

export interface HoleTrayAnalytics {
  readonly totalTrays: number;
  readonly firstTrayNumber?: number;
  readonly latestTrayNumber?: number;
  readonly traysWithDepthRanges: number;
  readonly finalPartialTrays: number;
  readonly photographReplacements: number;
  readonly depthCoverageDm: Decimetres;
  readonly coverageGaps: number;
  readonly depthOverlaps: number;
  readonly duplicateNumberConflicts: number;
  readonly latestTrayEndDepthDm?: Decimetres;
  readonly uncoveredIntervalToHoleDepthDm?: Decimetres;
}

export interface HoleCompletenessCategory {
  readonly category:
    | "Runs"
    | "Shifts"
    | "Surveys"
    | "Trays"
    | "Components"
    | "Casing";
  readonly status: CompletenessStatus;
  readonly notes: readonly string[];
}

export interface HoleCompletenessAnalytics {
  readonly categories: readonly HoleCompletenessCategory[];
}

export interface HoleBarrelAnalytics {
  readonly currentSerialNumber?: string;
  readonly changeCount: number;
  readonly changes: readonly {
    readonly setupId: string;
    readonly effectiveAt: string;
    readonly previousSerialNumber: string;
    readonly serialNumber: string;
    readonly bottomHoleAssemblyLengthDm: Decimetres;
    readonly reason: string;
    readonly recordedByName: string;
  }[];
}

export interface HoleDrillerOperationalRow {
  readonly drillerId: string;
  readonly drillerName: string;
  readonly shiftsWorked: number;
  readonly runsCompleted: number;
  readonly metresAttributedDm: Decimetres;
  readonly weightedRecoveryTenths?: number;
}

export interface HoleChartDatasets {
  readonly metresByShift: {
    readonly summary: string;
    readonly points: readonly {
      readonly shiftId: string;
      readonly label: string;
      readonly shiftType: "DAY" | "NIGHT";
      readonly metresDm: number;
      readonly amended: boolean;
    }[];
  };
  readonly cumulativeDepthByShift: {
    readonly summary: string;
    readonly points: readonly {
      readonly shiftId: string;
      readonly label: string;
      readonly endingDepthDm: number;
      readonly isCompletionPoint: boolean;
    }[];
  };
  readonly recoveryByDepth: {
    readonly summary: string;
    readonly points: readonly {
      readonly runNumber: number;
      readonly depthDm: number;
      readonly recoveryPercentTenths: number;
    }[];
  };
  readonly runLengthByDepth: {
    readonly summary: string;
    readonly points: readonly {
      readonly runNumber: number;
      readonly depthDm: number;
      readonly drilledLengthDm: number;
      readonly highlight: "short" | "long" | "normal";
    }[];
  };
  readonly coreLossGainByDepth: {
    readonly summary: string;
    readonly points: readonly {
      readonly runNumber: number;
      readonly depthDm: number;
      readonly lossDm: number;
      readonly gainDm: number;
    }[];
  };
  readonly componentIntervals: {
    readonly summary: string;
    readonly points: readonly {
      readonly assignmentId: string;
      readonly componentType: "BIT" | "REAMER";
      readonly serialNumber: string;
      readonly startDepthDm: number;
      readonly endDepthDm: number;
      readonly partialBoundaryRuns: number;
    }[];
  };
}

export interface HoleAnalytics {
  readonly holeId: string;
  readonly completionId?: string;
  readonly calculatedAt: string;
  readonly production: HoleProductionAnalytics;
  readonly shifts: HoleShiftAnalytics;
  readonly rods: HoleRodAnalytics;
  readonly components: HoleComponentAnalytics;
  readonly casing: HoleCasingAnalytics;
  readonly surveys: HoleSurveyAnalytics;
  readonly trays: HoleTrayAnalytics;
  readonly completeness: HoleCompletenessAnalytics;
  readonly barrels: HoleBarrelAnalytics;
  readonly charts: HoleChartDatasets;
  readonly drillerOperational: readonly HoleDrillerOperationalRow[];
}

export interface CalculateHoleAnalyticsInput {
  readonly holeId: string;
  readonly calculatedAt: string;
  readonly completionId?: string;
  readonly startingDepthDm: Decimetres;
  readonly plannedDepthDm: Decimetres;
  readonly currentOrFinalDepthDm: Decimetres;
  readonly runs: readonly ShiftAnalyticsRun[];
  readonly shifts: readonly RunbookShift[];
  readonly surveys: readonly Survey[];
  readonly trays: readonly Tray[];
  readonly casingStrings: readonly CasingString[];
  readonly casingEvents: readonly CasingEvent[];
  readonly components: readonly Component[];
  readonly componentAssignments: readonly ComponentAssignment[];
  readonly corrections: readonly ShiftAnalyticsCorrection[];
  readonly correctedSurveyIds?: ReadonlySet<string>;
  readonly preferredSurveyIntervalDm?: number;
  readonly photographReplacements?: number;
  readonly bhaConfigurationChanges?: number;
  readonly constantStickUpChanges?: number;
  readonly correctedRodEventCount?: number;
  readonly bhaSetups?: readonly {
    readonly localId: string;
    readonly effectiveAt: string;
    readonly bottomHoleAssemblyLengthDm: Decimetres;
    readonly barrelSerialNumber?: string;
    readonly reason: string;
    readonly recordedByNameSnapshot: string;
  }[];
  /** Precomputed per-shift analytics when available (avoids double work). */
  readonly shiftAnalyticsById?: ReadonlyMap<string, ShiftAnalytics>;
}

function toDm(value: number): Decimetres {
  return decimetres(Math.max(0, Math.round(value)));
}

function recoveryPercentTenths(drilledDm: number, recoveredDm: number): number {
  if (drilledDm <= 0) return 0;
  return Math.round((recoveredDm / drilledDm) * 1_000);
}

function usageRunFromAnalytics(run: ShiftAnalyticsRun): UsageRun {
  return {
    localId: run.localId,
    startDepth: toDm(run.previousCompletedDepthDm),
    holeDepth: toDm(run.holeDepthDm),
    drilledLength: toDm(run.drilledLengthDm),
    recoveredLength: toDm(run.recoveredLengthDm),
    recoveryPercentage:
      run.drilledLengthDm <= 0
        ? 0
        : Math.round((run.recoveredLengthDm / run.drilledLengthDm) * 1_000) / 10,
    status: run.status,
  };
}

function completedOperationalRuns(
  runs: readonly ShiftAnalyticsRun[],
): readonly ShiftAnalyticsRun[] {
  return runs.filter(
    (run) => run.status === "completed" || run.status === "corrected",
  );
}

function buildProduction(
  input: CalculateHoleAnalyticsInput,
  completed: readonly ShiftAnalyticsRun[],
): HoleProductionAnalytics {
  const voided = input.runs.filter((run) => run.status === "void");
  const corrected = completed.filter((run) => run.status === "corrected");
  const positiveLengths = completed
    .map((run) => run.drilledLengthDm)
    .filter((length) => length > 0);

  let totalDrilled = 0;
  let totalRecovered = 0;
  let totalLoss = 0;
  let totalGain = 0;
  for (const run of completed) {
    totalDrilled += Math.max(0, run.drilledLengthDm);
    totalRecovered += Math.max(0, run.recoveredLengthDm);
    if (run.drilledLengthDm <= 0) continue;
    const variance = calculateCoreLossOrGain(
      toDm(run.drilledLengthDm),
      toDm(run.recoveredLengthDm),
    );
    if (variance.kind === "loss") totalLoss += variance.amount;
    if (variance.kind === "gain") totalGain += variance.amount;
  }

  const avg = averageInteger(positiveLengths);
  const median = medianInteger(positiveLengths);
  const shortest =
    positiveLengths.length === 0 ? undefined : Math.min(...positiveLengths);
  const longest =
    positiveLengths.length === 0 ? undefined : Math.max(...positiveLengths);

  const difference =
    Number(input.currentOrFinalDepthDm) - Number(input.plannedDepthDm);

  return {
    startingDepthDm: input.startingDepthDm,
    currentOrFinalDepthDm: input.currentOrFinalDepthDm,
    plannedDepthDm: input.plannedDepthDm,
    differenceFromPlannedDm: Math.round(difference),
    totalDrilledDm: toDm(totalDrilled),
    totalRecoveredDm: toDm(totalRecovered),
    totalCoreLossDm: toDm(totalLoss),
    totalCoreGainDm: toDm(totalGain),
    weightedRecoveryTenths:
      totalDrilled === 0
        ? undefined
        : recoveryPercentTenths(totalDrilled, totalRecovered),
    totalCompletedRuns: completed.length,
    totalVoidedRuns: voided.length,
    totalCorrectedRuns: corrected.length,
    averageRunLengthDm: avg === undefined ? undefined : toDm(avg),
    medianRunLengthDm: median === undefined ? undefined : toDm(median),
    shortestValidRunDm: shortest === undefined ? undefined : toDm(shortest),
    longestValidRunDm: longest === undefined ? undefined : toDm(longest),
  };
}

function resolveShiftAnalytics(
  input: CalculateHoleAnalyticsInput,
): readonly ShiftAnalytics[] {
  return input.shifts.map((shift) => {
    const cached = input.shiftAnalyticsById?.get(shift.localId);
    if (cached !== undefined) return cached;
    return calculateShiftAnalytics({
      shift,
      runs: input.runs,
      surveys: input.surveys,
      trays: input.trays,
      casingEvents: input.casingEvents,
      componentAssignments: input.componentAssignments,
      corrections: input.corrections,
    });
  });
}

function buildShiftRollup(
  input: CalculateHoleAnalyticsInput,
  allShiftAnalytics: readonly ShiftAnalytics[],
): HoleShiftAnalytics {
  const byId = new Map(
    allShiftAnalytics.map((analytics) => [analytics.shiftId, analytics]),
  );
  const dayShifts = input.shifts.filter((shift) => shift.shiftType === "DAY");
  const nightShifts = input.shifts.filter((shift) => shift.shiftType === "NIGHT");
  const completedShifts = input.shifts.filter(
    (shift) => shift.status === "CLOSED",
  );
  const handovers = input.shifts.filter(
    (shift) => shift.handoverAcceptedAt !== undefined,
  ).length;

  const sharedRuns = completedOperationalRuns(input.runs).filter((run) =>
    isSharedRun(run),
  ).length;

  const completedMetres = completedShifts.map((shift) =>
    Number(byId.get(shift.localId)?.metresCompletedDm ?? 0),
  );
  const dayMetres = completedShifts
    .filter((shift) => shift.shiftType === "DAY")
    .map((shift) => Number(byId.get(shift.localId)?.metresCompletedDm ?? 0));
  const nightMetres = completedShifts
    .filter((shift) => shift.shiftType === "NIGHT")
    .map((shift) => Number(byId.get(shift.localId)?.metresCompletedDm ?? 0));

  const dayRecoveries = completedShifts
    .filter((shift) => shift.shiftType === "DAY")
    .map((shift) => byId.get(shift.localId)?.weightedRecoveryTenths)
    .filter((value): value is number => value !== undefined);
  const nightRecoveries = completedShifts
    .filter((shift) => shift.shiftType === "NIGHT")
    .map((shift) => byId.get(shift.localId)?.weightedRecoveryTenths)
    .filter((value): value is number => value !== undefined);

  let totalMetres = 0;
  let totalElapsedMinutes = 0;
  let elapsedSamples = 0;
  for (const shift of completedShifts) {
    const analytics = byId.get(shift.localId);
    if (analytics === undefined) continue;
    totalMetres += Number(analytics.metresCompletedDm);
    const elapsed = elapsedMinutesBetween(shift.startedAt, shift.closedAt);
    if (elapsed !== undefined && elapsed > 0) {
      totalElapsedMinutes += elapsed;
      elapsedSamples += 1;
    }
  }

  let grossMetresPerElapsedShiftHourTenths: number | undefined;
  if (elapsedSamples > 0 && totalElapsedMinutes > 0) {
    const hours = totalElapsedMinutes / 60;
    grossMetresPerElapsedShiftHourTenths = Math.round(totalMetres / hours);
    if (!Number.isFinite(grossMetresPerElapsedShiftHourTenths)) {
      grossMetresPerElapsedShiftHourTenths = undefined;
    }
  }

  const avg = averageInteger(completedMetres);
  const median = medianInteger(completedMetres);
  const dayAvg = averageInteger(dayMetres);
  const dayMedian = medianInteger(dayMetres);
  const nightAvg = averageInteger(nightMetres);
  const nightMedian = medianInteger(nightMetres);

  const orderedCompleted = [...completedShifts].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );

  return {
    totalDayShifts: dayShifts.length,
    totalNightShifts: nightShifts.length,
    completedShifts: completedShifts.length,
    handovers,
    sharedRuns,
    averageMetresPerCompletedShiftDm:
      avg === undefined ? undefined : toDm(avg),
    medianMetresPerCompletedShiftDm:
      median === undefined ? undefined : toDm(median),
    averageDayShiftMetresDm: dayAvg === undefined ? undefined : toDm(dayAvg),
    medianDayShiftMetresDm:
      dayMedian === undefined ? undefined : toDm(dayMedian),
    averageNightShiftMetresDm:
      nightAvg === undefined ? undefined : toDm(nightAvg),
    medianNightShiftMetresDm:
      nightMedian === undefined ? undefined : toDm(nightMedian),
    highestShiftMetresDm:
      completedMetres.length === 0
        ? undefined
        : toDm(Math.max(...completedMetres)),
    lowestShiftMetresDm:
      completedMetres.length === 0
        ? undefined
        : toDm(Math.min(...completedMetres)),
    averageDayWeightedRecoveryTenths: averageInteger(dayRecoveries),
    averageNightWeightedRecoveryTenths: averageInteger(nightRecoveries),
    grossMetresPerElapsedShiftHourTenths,
    perShift: orderedCompleted.map((shift) => {
      const analytics = byId.get(shift.localId)!;
      return {
        shiftId: shift.localId,
        shiftType: shift.shiftType,
        shiftDate: shift.shiftDate,
        metresCompletedDm: analytics.metresCompletedDm,
        endingDepthDm: analytics.endingDepthDm,
        weightedRecoveryTenths: analytics.weightedRecoveryTenths,
        analyticsAmended: analytics.analyticsAmended,
        sharedRunCount: analytics.sharedRunCount,
        completedRunCount: analytics.completedRunCount,
      };
    }),
  };
}

function buildRodAnalytics(
  input: CalculateHoleAnalyticsInput,
  completed: readonly ShiftAnalyticsRun[],
): HoleRodAnalytics {
  const orderedShifts = [...input.shifts].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );
  const firstShift = orderedShifts[0];
  const lastShift = orderedShifts.at(-1);

  let rodsAdded3m = 0;
  let rodsAdded6m = 0;
  let rodsRemoved = 0;
  let voidedRodEvents = 0;
  let endingRodFromEvents: number | undefined;

  for (const run of completed) {
    for (const event of run.rodEvents) {
      if (event.voided) {
        voidedRodEvents += 1;
        continue;
      }
      if (event.action === "add") {
        if (event.rodLengthDm === 30) rodsAdded3m += 1;
        else if (event.rodLengthDm === 60) rodsAdded6m += 1;
      } else if (event.action === "remove") {
        rodsRemoved += 1;
      }
      endingRodFromEvents = event.rodNumberAfterEvent;
    }
  }

  const startingRodNumber = firstShift?.startingRodNumber ?? 0;
  const finalOrCurrentRodNumber =
    lastShift?.endingRodNumber ??
    endingRodFromEvents ??
    startingRodNumber;
  const startingRodStringDm =
    firstShift?.startingRodStringDm ?? decimetres(0);
  const finalOrCurrentRodStringDm =
    lastShift?.endingRodStringDm ??
    (completed.length > 0
      ? toDm(
          Math.max(
            ...completed.map((run) => run.holeDepthDm),
            Number(startingRodStringDm),
          ),
        )
      : startingRodStringDm);

  return {
    startingRodNumber,
    finalOrCurrentRodNumber,
    rodsAdded3m,
    rodsAdded6m,
    rodsRemoved,
    netPhysicalRodChange: rodsAdded3m + rodsAdded6m - rodsRemoved,
    startingRodStringDm,
    finalOrCurrentRodStringDm,
    bhaConfigurationChanges: input.bhaConfigurationChanges ?? 0,
    constantStickUpChanges: input.constantStickUpChanges ?? 0,
    correctedRodEvents: input.correctedRodEventCount ?? 0,
    voidedRodEvents,
  };
}

function buildComponentAnalytics(
  input: CalculateHoleAnalyticsInput & {
    readonly currentOrFinalDepthDm?: Decimetres;
  },
  completed: readonly ShiftAnalyticsRun[],
): HoleComponentAnalytics {
  const usageRuns = completed.map(usageRunFromAnalytics);
  const componentById = new Map(
    input.components.map((component) => [component.localId, component]),
  );

  const assignments = input.componentAssignments.map(
    (assignment): HoleComponentAssignmentAnalytics => {
      const component = componentById.get(assignment.componentId);
      let usage: ComponentUsage;
      try {
        usage = calculateComponentUsage(assignment, usageRuns);
      } catch {
        const endDepthDm =
          assignment.endDepthDm ?? input.currentOrFinalDepthDm ?? assignment.startDepthDm;
        usage = {
          assignmentId: assignment.localId,
          componentId: assignment.componentId,
          holeId: assignment.holeId,
          startDepthDm: assignment.startDepthDm,
          endDepthDm,
          drilledMetresDm: toDm(
            Math.max(0, Number(endDepthDm) - Number(assignment.startDepthDm)),
          ),
          runsTouched: 0,
          fullyCoveredRuns: 0,
          partiallyCoveredRuns: 0,
          recoveryEstimateStatus: "UNAVAILABLE",
        };
      }
      return {
        assignmentId: assignment.localId,
        componentId: assignment.componentId,
        componentType: assignment.componentType,
        serialNumber: component?.serialNumber ?? assignment.componentId,
        size: component?.size ?? "—",
        manufacturer: component?.manufacturer,
        modelOrMatrix: component?.model ?? component?.matrix,
        startDepthDm: usage.startDepthDm,
        endDepthDm: usage.endDepthDm,
        recordedMetresDm: usage.drilledMetresDm,
        runsTouched: usage.runsTouched,
        completeRunsCovered: usage.fullyCoveredRuns,
        partialBoundaryRuns: usage.partiallyCoveredRuns,
        observedRecoveryTenths: usage.averageRecoveryPercentTenths,
        recoveryEstimateStatus: usage.recoveryEstimateStatus,
        installedAt: assignment.installedAt,
        removedAt: assignment.removedAt,
        removalReason: assignment.removalReason,
        finalStatus: assignment.status,
      };
    },
  );

  const bits = assignments.filter((item) => item.componentType === "BIT");
  const reamers = assignments.filter((item) => item.componentType === "REAMER");
  const bitMetres = bits.map((item) => Number(item.recordedMetresDm));
  const reamerMetres = reamers.map((item) => Number(item.recordedMetresDm));

  const reasonCounts = new Map<ComponentRemovalReason | "UNSPECIFIED", number>();
  for (const assignment of assignments) {
    if (assignment.finalStatus !== "CLOSED") continue;
    const reason = assignment.removalReason ?? "UNSPECIFIED";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const bitAvg = averageInteger(bitMetres);
  const reamerAvg = averageInteger(reamerMetres);

  return {
    bitsUsed: bits.length,
    reamersUsed: reamers.length,
    averageRecordedMetresPerBitDm:
      bitAvg === undefined ? undefined : toDm(bitAvg),
    averageRecordedMetresPerReamerDm:
      reamerAvg === undefined ? undefined : toDm(reamerAvg),
    longestBitIntervalDm:
      bitMetres.length === 0 ? undefined : toDm(Math.max(...bitMetres)),
    longestReamerIntervalDm:
      reamerMetres.length === 0 ? undefined : toDm(Math.max(...reamerMetres)),
    removalReasonsByCount: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    assignments,
  };
}

function buildCasingAnalytics(
  input: CalculateHoleAnalyticsInput,
): HoleCasingAnalytics {
  const sizes = [
    ...new Set(input.casingStrings.map((string) => string.casingSize)),
  ].sort();
  const deepest =
    input.casingStrings.length === 0
      ? undefined
      : toDm(
          Math.max(
            ...input.casingStrings.map((string) =>
              Number(string.currentEndDepthDm),
            ),
          ),
        );

  return {
    stringCount: input.casingStrings.length,
    sizes,
    installCount: input.casingEvents.filter(
      (event) => event.eventType === "INSTALL",
    ).length,
    advancementCount: input.casingEvents.filter(
      (event) => event.eventType === "ADVANCE",
    ).length,
    correctionCount: input.casingEvents.filter(
      (event) => event.eventType === "CORRECT",
    ).length,
    deepestCasingDm: deepest,
    timeline: [...input.casingStrings]
      .sort(
        (left, right) =>
          Number(left.startDepthDm) - Number(right.startDepthDm) ||
          Number(left.currentEndDepthDm) - Number(right.currentEndDepthDm),
      )
      .map((string) => ({
        casingId: string.localId,
        size: string.casingSize,
        startDepthDm: string.startDepthDm,
        endDepthDm: string.currentEndDepthDm,
        status: string.status,
      })),
  };
}

function buildSurveyAnalytics(
  input: CalculateHoleAnalyticsInput,
): HoleSurveyAnalytics {
  const stats = calculateSurveyStatistics(
    input.surveys,
    input.currentOrFinalDepthDm,
    input.correctedSurveyIds ?? new Set(),
  );
  const spacing = calculateSurveySpacing(input.surveys).map(Number);
  const medianSpacing = medianInteger(spacing);
  const latest = findLatestSurvey(input.surveys);

  const referenceCounts = new Map<NorthReference, number>();
  for (const survey of input.surveys) {
    referenceCounts.set(
      survey.northReference,
      (referenceCounts.get(survey.northReference) ?? 0) + 1,
    );
  }
  const northReferenceDistribution = [...referenceCounts.entries()]
    .map(([reference, count]) => ({ reference, count }))
    .sort((left, right) => right.count - left.count);

  const distinctRefs = northReferenceDistribution.filter(
    (item) => item.reference !== "NOT_SPECIFIED",
  );
  const mixedNorthReferences = distinctRefs.length > 1;

  const tools = [
    ...new Set(
      input.surveys
        .map((survey) => survey.toolNameSnapshot ?? survey.surveyToolId)
        .filter((value): value is string => value !== undefined && value.length > 0),
    ),
  ].sort();

  return {
    totalSurveys: stats.totalSurveys,
    firstSurveyDepthDm: stats.firstSurveyDepthDm,
    latestSurveyDepthDm: stats.latestSurveyDepthDm,
    finalDipTenths: latest?.dipTenths,
    finalAzimuthTenths: latest?.azimuthTenths,
    finalNorthReference: latest?.northReference,
    distanceFromFinalDepthToLatestDm: stats.distanceSinceLatestDm,
    averageSurveySpacingDm: stats.averageSpacingDm,
    medianSurveySpacingDm:
      medianSpacing === undefined ? undefined : toDm(medianSpacing),
    largestSurveyGapDm: stats.largestGapDm,
    duplicateDepthSurveyCount: stats.duplicateDepthSurveys,
    correctedSurveyCount: stats.correctedSurveys,
    surveysWithPhotographs: stats.surveysWithPhotographs,
    surveyToolsUsed: tools,
    northReferenceDistribution,
    mixedNorthReferences,
    mixedNorthReferenceWarning: mixedNorthReferences
      ? MIXED_NORTH_REFERENCE_WARNING
      : undefined,
    records: [...input.surveys]
      .sort(
        (left, right) =>
          Number(left.depthDm) - Number(right.depthDm) ||
          left.recordedAt.localeCompare(right.recordedAt),
      )
      .map((survey) => ({
        surveyId: survey.localId,
        depthDm: survey.depthDm,
        dipTenths: survey.dipTenths,
        azimuthTenths: survey.azimuthTenths,
        northReference: survey.northReference,
        toolName: survey.toolNameSnapshot,
        toolSerialNumber: survey.toolSerialSnapshot,
        recordedAt: survey.recordedAt,
        corrected: (input.correctedSurveyIds ?? new Set()).has(survey.localId),
        hasPhotograph: survey.photoId !== undefined,
      })),
  };
}

function buildBarrelAnalytics(
  input: CalculateHoleAnalyticsInput,
): HoleBarrelAnalytics {
  const ordered = [...(input.bhaSetups ?? [])].sort((left, right) =>
    left.effectiveAt.localeCompare(right.effectiveAt),
  );
  const changes: HoleBarrelAnalytics["changes"][number][] = [];
  let previousSerialNumber: string | undefined;

  for (const setup of ordered) {
    const serialNumber = setup.barrelSerialNumber?.trim();
    if (!serialNumber) continue;
    if (
      previousSerialNumber !== undefined &&
      serialNumber !== previousSerialNumber
    ) {
      changes.push({
        setupId: setup.localId,
        effectiveAt: setup.effectiveAt,
        previousSerialNumber,
        serialNumber,
        bottomHoleAssemblyLengthDm: setup.bottomHoleAssemblyLengthDm,
        reason: setup.reason,
        recordedByName: setup.recordedByNameSnapshot,
      });
    }
    previousSerialNumber = serialNumber;
  }

  return {
    currentSerialNumber: previousSerialNumber,
    changeCount: changes.length,
    changes,
  };
}

function buildTrayAnalytics(
  input: CalculateHoleAnalyticsInput,
): HoleTrayAnalytics {
  const stats = calculateTrayStatistics(
    input.trays,
    input.photographReplacements ?? 0,
  );
  const latestEnd =
    input.trays.length === 0
      ? undefined
      : input.trays
          .map((tray) => tray.endDepthDm)
          .filter((value): value is Decimetres => value !== undefined)
          .sort((left, right) => Number(right) - Number(left))[0];

  const uncovered =
    latestEnd === undefined
      ? Number(input.currentOrFinalDepthDm) > 0
        ? input.currentOrFinalDepthDm
        : undefined
      : toDm(
          Math.max(
            0,
            Number(input.currentOrFinalDepthDm) - Number(latestEnd),
          ),
        );

  return {
    totalTrays: stats.totalTrays,
    firstTrayNumber: stats.firstTrayNumber,
    latestTrayNumber: stats.latestTrayNumber,
    traysWithDepthRanges: stats.traysWithDepthRanges,
    finalPartialTrays: stats.finalPartialTrays,
    photographReplacements: stats.replacedPhotographs,
    depthCoverageDm: stats.trayDepthCoverageDm,
    coverageGaps: stats.depthGaps,
    depthOverlaps: stats.depthOverlaps,
    duplicateNumberConflicts: stats.duplicateNumberConflicts,
    latestTrayEndDepthDm: latestEnd,
    uncoveredIntervalToHoleDepthDm: uncovered,
  };
}

function buildCompleteness(
  input: CalculateHoleAnalyticsInput,
  production: HoleProductionAnalytics,
  surveys: HoleSurveyAnalytics,
  trays: HoleTrayAnalytics,
  components: HoleComponentAnalytics,
): HoleCompletenessAnalytics {
  const completed = completedOperationalRuns(input.runs);
  const sorted = [...completed].sort((left, right) => left.runNumber - right.runNumber);

  let runNumberGaps = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.runNumber !== sorted[index - 1]!.runNumber + 1) {
      runNumberGaps += 1;
    }
  }

  let depthGaps = 0;
  let depthOverlaps = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const boundary = classifyRunBoundary(
      toDm(previous.holeDepthDm),
      toDm(current.previousCompletedDepthDm),
    );
    if (boundary.kind === "gap") depthGaps += 1;
    if (boundary.kind === "overlap") depthOverlaps += 1;
  }

  const runNotes: string[] = [];
  if (production.totalVoidedRuns > 0) {
    runNotes.push(`${production.totalVoidedRuns} voided Run(s)`);
  }
  if (production.totalCorrectedRuns > 0) {
    runNotes.push(`${production.totalCorrectedRuns} corrected Run(s)`);
  }
  if (runNumberGaps > 0) runNotes.push(`${runNumberGaps} Run-number gap(s)`);
  if (depthGaps > 0) runNotes.push(`${depthGaps} depth gap(s)`);
  if (depthOverlaps > 0) runNotes.push(`${depthOverlaps} depth overlap(s)`);

  let runsStatus: CompletenessStatus = "Complete";
  if (sorted.length === 0 && input.runs.length === 0) {
    runsStatus = "Not applicable";
  } else if (depthOverlaps > 0 || runNumberGaps > 0) {
    runsStatus = "Incomplete";
  } else if (
    production.totalVoidedRuns > 0 ||
    production.totalCorrectedRuns > 0 ||
    depthGaps > 0
  ) {
    runsStatus = "Review recommended";
  }

  const closed = input.shifts.filter((shift) => shift.status === "CLOSED");
  const incompleteClose = closed.filter(
    (shift) =>
      shift.endingDepthDm === undefined || shift.closeAnalyticsSnapshot === undefined,
  ).length;
  const unfinishedHandovers = input.shifts.filter(
    (shift) => shift.status === "HANDOVER_PENDING",
  ).length;
  const amended = closed.filter((shift) => {
    const analytics = input.shiftAnalyticsById?.get(shift.localId);
    return analytics?.analyticsAmended === true;
  }).length;

  const shiftNotes: string[] = [];
  if (incompleteClose > 0) {
    shiftNotes.push(`${incompleteClose} closed Shift(s) missing complete snapshots`);
  }
  if (unfinishedHandovers > 0) {
    shiftNotes.push(`${unfinishedHandovers} unfinished handover(s)`);
  }
  if (amended > 0) {
    shiftNotes.push(`${amended} amended closed Shift(s)`);
  }

  let shiftsStatus: CompletenessStatus = "Complete";
  if (input.shifts.length === 0) {
    shiftsStatus = "Not applicable";
  } else if (unfinishedHandovers > 0 || incompleteClose > 0) {
    shiftsStatus = "Incomplete";
  } else if (amended > 0) {
    shiftsStatus = "Review recommended";
  }

  const surveyNotes: string[] = [];
  if (surveys.mixedNorthReferences) {
    surveyNotes.push("Mixed north references");
  }
  if (surveys.duplicateDepthSurveyCount > 0) {
    surveyNotes.push(`${surveys.duplicateDepthSurveyCount} duplicate Survey depth(s)`);
  }
  const preferred = input.preferredSurveyIntervalDm;
  if (
    preferred !== undefined &&
    surveys.distanceFromFinalDepthToLatestDm !== undefined &&
    Number(surveys.distanceFromFinalDepthToLatestDm) > preferred
  ) {
    surveyNotes.push("Survey interval exceeded");
  }
  if (
    surveys.distanceFromFinalDepthToLatestDm !== undefined &&
    Number(surveys.distanceFromFinalDepthToLatestDm) > 0
  ) {
    surveyNotes.push(
      `Latest Survey ${formatMetres(surveys.distanceFromFinalDepthToLatestDm)} behind hole depth`,
    );
  }

  let surveysStatus: CompletenessStatus = "Complete";
  if (surveys.totalSurveys === 0) {
    surveysStatus = "Not applicable";
  } else if (surveys.duplicateDepthSurveyCount > 0) {
    surveysStatus = "Incomplete";
  } else if (surveyNotes.length > 0) {
    surveysStatus = "Review recommended";
  }

  const trayNotes: string[] = [];
  if (trays.duplicateNumberConflicts > 0) {
    trayNotes.push(`${trays.duplicateNumberConflicts} duplicate Tray number(s)`);
  }
  if (trays.coverageGaps > 0) trayNotes.push(`${trays.coverageGaps} Tray depth gap(s)`);
  if (trays.depthOverlaps > 0) {
    trayNotes.push(`${trays.depthOverlaps} Tray depth overlap(s)`);
  }
  if (trays.finalPartialTrays > 0) {
    trayNotes.push(`${trays.finalPartialTrays} final partial Tray(s)`);
  }

  let traysStatus: CompletenessStatus = "Complete";
  if (trays.totalTrays === 0) {
    traysStatus = "Not applicable";
  } else if (
    trays.duplicateNumberConflicts > 0 ||
    trays.depthOverlaps > 0
  ) {
    traysStatus = "Incomplete";
  } else if (trays.coverageGaps > 0 || trays.finalPartialTrays > 0) {
    traysStatus = "Review recommended";
  }

  const unresolvedAssignments = components.assignments.filter(
    (assignment) => assignment.finalStatus === "ACTIVE",
  ).length;
  const componentNotes: string[] = [];
  if (unresolvedAssignments > 0) {
    componentNotes.push(
      `${unresolvedAssignments} unresolved component assignment(s)`,
    );
  }
  const partialEstimates = components.assignments.filter(
    (assignment) => assignment.recoveryEstimateStatus === "RUN_LEVEL_ESTIMATE",
  ).length;
  if (partialEstimates > 0) {
    componentNotes.push(
      `${partialEstimates} assignment(s) with partial-Run recovery estimates`,
    );
  }

  let componentsStatus: CompletenessStatus = "Complete";
  if (components.assignments.length === 0) {
    componentsStatus = "Not applicable";
  } else if (unresolvedAssignments > 0) {
    componentsStatus = "Review recommended";
  }

  const activeCasing = input.casingStrings.filter(
    (string) => string.status === "ACTIVE",
  ).length;
  const casingNotes: string[] = [];
  if (activeCasing > 0) {
    casingNotes.push(`${activeCasing} active casing string(s)`);
  }

  let casingStatus: CompletenessStatus = "Complete";
  if (input.casingStrings.length === 0) {
    casingStatus = "Not applicable";
  } else if (activeCasing > 0) {
    casingStatus = "Review recommended";
  }

  return {
    categories: [
      { category: "Runs", status: runsStatus, notes: runNotes },
      { category: "Shifts", status: shiftsStatus, notes: shiftNotes },
      { category: "Surveys", status: surveysStatus, notes: surveyNotes },
      { category: "Trays", status: traysStatus, notes: trayNotes },
      { category: "Components", status: componentsStatus, notes: componentNotes },
      { category: "Casing", status: casingStatus, notes: casingNotes },
    ],
  };
}

function buildDrillerOperational(
  input: CalculateHoleAnalyticsInput,
  allShiftAnalytics: readonly ShiftAnalytics[],
): readonly HoleDrillerOperationalRow[] {
  const byDriller = new Map<
    string,
    {
      name: string;
      shifts: number;
      runs: number;
      metres: number;
      drilled: number;
      recovered: number;
    }
  >();

  const analyticsByShift = new Map(
    allShiftAnalytics.map((item) => [item.shiftId, item]),
  );

  for (const shift of input.shifts) {
    const analytics = analyticsByShift.get(shift.localId);
    if (analytics === undefined) continue;
    const existing = byDriller.get(shift.primaryDrillerId) ?? {
      name: shift.primaryDrillerNameSnapshot,
      shifts: 0,
      runs: 0,
      metres: 0,
      drilled: 0,
      recovered: 0,
    };
    existing.shifts += 1;
    existing.runs += analytics.completedRunCount;
    existing.metres += Number(analytics.metresCompletedDm);
    existing.drilled += Number(analytics.totalDrilledDm);
    existing.recovered += Number(analytics.totalRecoveredDm);
    byDriller.set(shift.primaryDrillerId, existing);
  }

  return [...byDriller.entries()]
    .map(([drillerId, value]) => ({
      drillerId,
      drillerName: value.name,
      shiftsWorked: value.shifts,
      runsCompleted: value.runs,
      metresAttributedDm: toDm(value.metres),
      weightedRecoveryTenths:
        value.drilled === 0
          ? undefined
          : recoveryPercentTenths(value.drilled, value.recovered),
    }))
    .sort((left, right) => left.drillerName.localeCompare(right.drillerName));
}

function buildCharts(
  input: CalculateHoleAnalyticsInput,
  shifts: HoleShiftAnalytics,
  components: HoleComponentAnalytics,
  completed: readonly ShiftAnalyticsRun[],
): HoleChartDatasets {
  const metresPoints = shifts.perShift.map((shift) => ({
    shiftId: shift.shiftId,
    label: `${shift.shiftDate} ${shift.shiftType === "DAY" ? "Day" : "Night"}`,
    shiftType: shift.shiftType,
    metresDm: Number(shift.metresCompletedDm),
    amended: shift.analyticsAmended,
  }));

  const completionShiftId = shifts.perShift.at(-1)?.shiftId;
  const cumulativePoints = shifts.perShift.map((shift) => ({
    shiftId: shift.shiftId,
    label: `${shift.shiftDate} ${shift.shiftType === "DAY" ? "Day" : "Night"}`,
    endingDepthDm: Number(shift.endingDepthDm),
    isCompletionPoint: shift.shiftId === completionShiftId,
  }));

  const recoveryPoints = completed.map((run) => ({
    runNumber: run.runNumber,
    depthDm: run.holeDepthDm,
    recoveryPercentTenths: recoveryPercentTenths(
      run.drilledLengthDm,
      run.recoveredLengthDm,
    ),
  }));

  const runLengthPoints = completed.map((run) => {
    let highlight: "short" | "long" | "normal" = "normal";
    if (run.drilledLengthDm > 0 && run.drilledLengthDm < SHORT_RUN_LENGTH_DM) {
      highlight = "short";
    } else if (run.drilledLengthDm > LONG_RUN_LENGTH_DM) {
      highlight = "long";
    }
    return {
      runNumber: run.runNumber,
      depthDm: run.holeDepthDm,
      drilledLengthDm: run.drilledLengthDm,
      highlight,
    };
  });

  const lossGainPoints = completed.map((run) => {
    let lossDm = 0;
    let gainDm = 0;
    if (run.drilledLengthDm > 0) {
      const variance = calculateCoreLossOrGain(
        toDm(run.drilledLengthDm),
        toDm(run.recoveredLengthDm),
      );
      if (variance.kind === "loss") lossDm = Number(variance.amount);
      if (variance.kind === "gain") gainDm = Number(variance.amount);
    }
    return {
      runNumber: run.runNumber,
      depthDm: run.holeDepthDm,
      lossDm,
      gainDm,
    };
  });

  const componentPoints = components.assignments.map((assignment) => ({
    assignmentId: assignment.assignmentId,
    componentType: assignment.componentType,
    serialNumber: assignment.serialNumber,
    startDepthDm: Number(assignment.startDepthDm),
    endDepthDm: Number(assignment.endDepthDm),
    partialBoundaryRuns: assignment.partialBoundaryRuns,
  }));

  const metresSummary =
    metresPoints.length === 0
      ? "No completed Shifts."
      : `Metres by Shift: ${metresPoints
          .map(
            (point) =>
              `${point.label} ${formatMetres(toDm(point.metresDm))}${point.amended ? " (amended)" : ""}`,
          )
          .join("; ")}.`;

  const cumulativeSummary =
    cumulativePoints.length === 0
      ? "No cumulative depth series."
      : `Cumulative depth by Shift ends at ${formatMetres(
          toDm(cumulativePoints.at(-1)!.endingDepthDm),
        )}.`;

  const avgRecovery =
    recoveryPoints.length === 0
      ? undefined
      : averageInteger(recoveryPoints.map((point) => point.recoveryPercentTenths));
  const recoverySummary =
    recoveryPoints.length === 0
      ? "No completed Runs for recovery chart."
      : `Recovery by depth across ${recoveryPoints.length} Run(s)${
          avgRecovery === undefined
            ? ""
            : `; mean of Run recoveries ${formatRecoveryTenthsLabel(avgRecovery)} (chart uses per-Run values; Hole metric uses weighted recovery)`
        }.`;

  const shortCount = runLengthPoints.filter((point) => point.highlight === "short").length;
  const longCount = runLengthPoints.filter((point) => point.highlight === "long").length;
  const runLengthSummary =
    runLengthPoints.length === 0
      ? "No completed Runs for Run-length chart."
      : `Run length by depth for ${runLengthPoints.length} Run(s); ${shortCount} short (<${formatMetres(toDm(SHORT_RUN_LENGTH_DM))}), ${longCount} long (>${formatMetres(toDm(LONG_RUN_LENGTH_DM))}).`;

  const totalLoss = lossGainPoints.reduce((sum, point) => sum + point.lossDm, 0);
  const totalGain = lossGainPoints.reduce((sum, point) => sum + point.gainDm, 0);
  const lossGainSummary =
    lossGainPoints.length === 0
      ? "No completed Runs for loss/gain chart."
      : `Core loss ${formatMetres(toDm(totalLoss))}, core gain ${formatMetres(toDm(totalGain))} across ${lossGainPoints.length} Run(s).`;

  const componentSummary =
    componentPoints.length === 0
      ? "No component assignments."
      : `Component intervals: ${componentPoints
          .map(
            (point) =>
              `${point.componentType} ${point.serialNumber} ${formatMetres(toDm(point.startDepthDm))}–${formatMetres(toDm(point.endDepthDm))}${
                point.partialBoundaryRuns > 0 ? " (partial boundary Runs)" : ""
              }`,
          )
          .join("; ")}.`;

  return {
    metresByShift: { summary: metresSummary, points: metresPoints },
    cumulativeDepthByShift: {
      summary: cumulativeSummary,
      points: cumulativePoints,
    },
    recoveryByDepth: { summary: recoverySummary, points: recoveryPoints },
    runLengthByDepth: { summary: runLengthSummary, points: runLengthPoints },
    coreLossGainByDepth: { summary: lossGainSummary, points: lossGainPoints },
    componentIntervals: {
      summary: componentSummary,
      points: componentPoints,
    },
  };
}

function formatRecoveryTenthsLabel(tenths: number): string {
  return `${(tenths / 10).toFixed(1)}%`;
}

/**
 * Pure Hole analytics from repository-backed effective records.
 * Shared across Statistics UI, completed-Hole teaser, and reports.
 */
export function calculateHoleAnalytics(
  input: CalculateHoleAnalyticsInput,
): HoleAnalytics {
  const completed = completedOperationalRuns(input.runs);
  const allShiftAnalytics = resolveShiftAnalytics(input);
  const shiftAnalyticsById = new Map(
    allShiftAnalytics.map((item) => [item.shiftId, item]),
  );
  const enrichedInput: CalculateHoleAnalyticsInput = {
    ...input,
    shiftAnalyticsById,
  };

  const production = buildProduction(enrichedInput, completed);
  const shifts = buildShiftRollup(enrichedInput, allShiftAnalytics);
  const rods = buildRodAnalytics(enrichedInput, completed);
  const components = buildComponentAnalytics(enrichedInput, completed);
  const casing = buildCasingAnalytics(enrichedInput);
  const surveys = buildSurveyAnalytics(enrichedInput);
  const trays = buildTrayAnalytics(enrichedInput);
  const completeness = buildCompleteness(
    enrichedInput,
    production,
    surveys,
    trays,
    components,
  );
  const barrels = buildBarrelAnalytics(enrichedInput);
  const charts = buildCharts(enrichedInput, shifts, components, completed);
  const drillerOperational = buildDrillerOperational(
    enrichedInput,
    allShiftAnalytics,
  );

  return {
    holeId: input.holeId,
    completionId: input.completionId,
    calculatedAt: input.calculatedAt,
    production,
    shifts,
    rods,
    components,
    casing,
    surveys,
    trays,
    completeness,
    barrels,
    charts,
    drillerOperational,
  };
}
