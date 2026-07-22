import {
  type Decimetres,
  decimetres,
  subtractDecimetres,
} from "./measurements";

export type CoreRecoveryVariance =
  | {
      readonly kind: "exact";
      readonly amount: Decimetres;
    }
  | {
      readonly kind: "loss";
      readonly amount: Decimetres;
    }
  | {
      readonly kind: "gain";
      readonly amount: Decimetres;
    };

export type RunBoundary =
  | {
      readonly kind: "contiguous";
      readonly amount: Decimetres;
    }
  | {
      readonly kind: "gap";
      readonly amount: Decimetres;
    }
  | {
      readonly kind: "overlap";
      readonly amount: Decimetres;
    };

/**
 * Returns a percentage number rounded to one decimal place for display.
 * Values above 100% are intentionally retained because measured core gain is
 * a valid field observation.
 */
export function calculateRecoveryPercentage(
  drilledLength: Decimetres,
  recoveredLength: Decimetres,
): number {
  if (drilledLength === 0) {
    throw new RangeError(
      "Recovery percentage is undefined when drilled length is zero.",
    );
  }

  return Math.round((recoveredLength / drilledLength) * 1_000) / 10;
}

export function formatRecoveryPercentage(percentage: number): string {
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new RangeError(
      `Recovery percentage must be finite and non-negative; received ${String(percentage)}.`,
    );
  }

  return `${percentage.toFixed(1)}%`;
}

export function calculateCoreLossOrGain(
  drilledLength: Decimetres,
  recoveredLength: Decimetres,
): CoreRecoveryVariance {
  if (recoveredLength === drilledLength) {
    return { kind: "exact", amount: decimetres(0) };
  }

  if (recoveredLength < drilledLength) {
    return {
      kind: "loss",
      amount: subtractDecimetres(drilledLength, recoveredLength),
    };
  }

  return {
    kind: "gain",
    amount: subtractDecimetres(recoveredLength, drilledLength),
  };
}

/**
 * Classifies the boundary between the previous completed depth and the next
 * run's recorded start depth without mutating either run.
 */
export function classifyRunBoundary(
  previousCompletedDepth: Decimetres,
  nextRunStartDepth: Decimetres,
): RunBoundary {
  if (nextRunStartDepth === previousCompletedDepth) {
    return { kind: "contiguous", amount: decimetres(0) };
  }

  if (nextRunStartDepth > previousCompletedDepth) {
    return {
      kind: "gap",
      amount: subtractDecimetres(
        nextRunStartDepth,
        previousCompletedDepth,
      ),
    };
  }

  return {
    kind: "overlap",
    amount: subtractDecimetres(
      previousCompletedDepth,
      nextRunStartDepth,
    ),
  };
}
