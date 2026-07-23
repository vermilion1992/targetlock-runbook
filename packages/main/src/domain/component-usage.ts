import { decimetres, type Decimetres } from "./measurements";
import type {
  ComponentAssignment,
  ComponentUsage,
  Run,
} from "./models";

export type UsageRun = Pick<
  Run,
  | "localId"
  | "startDepth"
  | "holeDepth"
  | "drilledLength"
  | "recoveredLength"
  | "recoveryPercentage"
  | "status"
>;

function overlapLength(
  firstStart: Decimetres,
  firstEnd: Decimetres,
  secondStart: Decimetres,
  secondEnd: Decimetres,
): Decimetres {
  return decimetres(
    Math.max(
      0,
      Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart),
    ),
  );
}

function completedRunsInDepthOrder(
  runs: readonly UsageRun[],
): readonly UsageRun[] {
  const completed = runs
    .filter(({ status }) => status !== "in_progress" && status !== "void")
    .sort(
      (left, right) =>
        left.startDepth - right.startDepth || left.holeDepth - right.holeDepth,
    );

  for (let index = 1; index < completed.length; index += 1) {
    const previous = completed[index - 1]!;
    const current = completed[index]!;
    if (current.startDepth < previous.holeDepth) {
      throw new RangeError(
        `Completed runs ${previous.localId} and ${current.localId} overlap.`,
      );
    }
  }

  return completed;
}

/**
 * Calculates exact drilled metres from completed-run and assignment interval
 * overlap. Recovery remains run-level whenever an assignment boundary falls
 * inside a run because recovered core cannot be divided truthfully.
 */
export function calculateComponentUsage(
  assignment: ComponentAssignment,
  runs: readonly UsageRun[],
): ComponentUsage {
  const completedRuns = completedRunsInDepthOrder(runs);
  const deepestCompletedDepth = completedRuns.reduce<number>(
    (deepest, run) => Math.max(deepest, run.holeDepth),
    assignment.startDepthDm,
  );
  const endDepthDm = decimetres(
    assignment.endDepthDm ?? deepestCompletedDepth,
  );

  if (endDepthDm < assignment.startDepthDm) {
    throw new RangeError("Assignment end depth cannot precede its start depth.");
  }

  let drilledMetresDm = 0;
  let fullyCoveredRuns = 0;
  let partiallyCoveredRuns = 0;
  let exactRecoveredDm = 0;
  let exactDrilledDm = 0;
  let estimatedRecoveryTenthsTimesDm = 0;

  for (const run of completedRuns) {
    const overlap = overlapLength(
      assignment.startDepthDm,
      endDepthDm,
      run.startDepth,
      run.holeDepth,
    );
    if (overlap === 0) continue;

    drilledMetresDm += overlap;
    const fullyCovered =
      assignment.startDepthDm <= run.startDepth &&
      endDepthDm >= run.holeDepth;

    if (fullyCovered) {
      fullyCoveredRuns += 1;
      exactRecoveredDm += run.recoveredLength;
      exactDrilledDm += run.drilledLength;
    } else {
      partiallyCoveredRuns += 1;
    }

    estimatedRecoveryTenthsTimesDm +=
      Math.round(run.recoveryPercentage * 10) * overlap;
  }

  const runsTouched = fullyCoveredRuns + partiallyCoveredRuns;
  let averageRecoveryPercentTenths: number | undefined;
  let recoveryEstimateStatus: ComponentUsage["recoveryEstimateStatus"] =
    "UNAVAILABLE";

  if (runsTouched > 0 && drilledMetresDm > 0) {
    if (partiallyCoveredRuns === 0 && exactDrilledDm > 0) {
      averageRecoveryPercentTenths = Math.round(
        (exactRecoveredDm / exactDrilledDm) * 1_000,
      );
      recoveryEstimateStatus = "EXACT_RUN_SET";
    } else {
      averageRecoveryPercentTenths = Math.round(
        estimatedRecoveryTenthsTimesDm / drilledMetresDm,
      );
      recoveryEstimateStatus = "RUN_LEVEL_ESTIMATE";
    }
  }

  return {
    assignmentId: assignment.localId,
    componentId: assignment.componentId,
    holeId: assignment.holeId,
    startDepthDm: assignment.startDepthDm,
    endDepthDm,
    drilledMetresDm: decimetres(drilledMetresDm),
    runsTouched,
    fullyCoveredRuns,
    partiallyCoveredRuns,
    averageRecoveryPercentTenths,
    recoveryEstimateStatus,
  };
}

export function assignmentTouchesRun(
  assignment: ComponentAssignment,
  run: UsageRun,
): boolean {
  const assignmentEnd = assignment.endDepthDm ?? run.holeDepth;
  return (
    overlapLength(
      assignment.startDepthDm,
      assignmentEnd,
      run.startDepth,
      run.holeDepth,
    ) > 0
  );
}

export function summarizeComponentUsage(
  usage: readonly ComponentUsage[],
): {
  readonly drilledMetresDm: Decimetres;
  readonly runsTouched: number;
} {
  return {
    drilledMetresDm: decimetres(
      usage.reduce<number>(
        (total, item) => total + item.drilledMetresDm,
        0,
      ),
    ),
    runsTouched: usage.reduce(
      (total, item) => total + item.runsTouched,
      0,
    ),
  };
}

export function formatRecoveryPercentTenths(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Recovery percent tenths must be a non-negative integer.");
  }
  return `${Math.floor(value / 10)}.${value % 10}%`;
}
