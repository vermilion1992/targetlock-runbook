import { decimetres, type Decimetres } from "./measurements";
import type { Tray } from "./models";

export function suggestNextTrayNumber(trays: readonly Tray[]): number {
  const positiveNumbers = trays
    .map(({ trayNumber }) => trayNumber)
    .filter((value) => Number.isInteger(value) && value > 0);
  return positiveNumbers.length === 0 ? 1 : Math.max(...positiveNumbers) + 1;
}

export function findPreviousTray(trays: readonly Tray[]): Tray | undefined {
  return [...trays].sort((left, right) => {
    if (left.trayNumber !== right.trayNumber) {
      return left.trayNumber - right.trayNumber;
    }
    return Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
  }).at(-1);
}

export interface TraySuggestions {
  readonly trayNumber: number;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm: Decimetres;
}

export function suggestTrayValues(
  trays: readonly Tray[],
  currentCompletedDepthDm: Decimetres,
): TraySuggestions {
  return {
    trayNumber: suggestNextTrayNumber(trays),
    startDepthDm: findPreviousTray(trays)?.endDepthDm,
    endDepthDm: currentCompletedDepthDm,
  };
}

export type TrayValidationCode =
  | "INVALID_TRAY_NUMBER"
  | "NEGATIVE_DEPTH"
  | "END_BEFORE_START";

export type TrayWarningCode =
  | "STARTS_BEFORE_PREVIOUS"
  | "DEPTH_GAP"
  | "DEPTH_OVERLAP"
  | "END_BEYOND_COMPLETED"
  | "ZERO_LENGTH"
  | "DUPLICATE_NUMBER"
  | "NUMBER_SEQUENCE_GAP";

export interface TrayValidationIssue {
  readonly code: TrayValidationCode | TrayWarningCode;
  readonly message: string;
}

export interface ValidateTrayInput {
  readonly trayNumber: number;
  readonly startDepthDm?: number;
  readonly endDepthDm?: number;
  readonly currentCompletedDepthDm: Decimetres;
  readonly trays: readonly Tray[];
}

export interface TrayValidationResult {
  readonly errors: readonly TrayValidationIssue[];
  readonly warnings: readonly TrayValidationIssue[];
}

export function validateTrayInput(
  input: ValidateTrayInput,
): TrayValidationResult {
  const errors: TrayValidationIssue[] = [];
  const warnings: TrayValidationIssue[] = [];
  if (!Number.isInteger(input.trayNumber) || input.trayNumber <= 0) {
    errors.push({
      code: "INVALID_TRAY_NUMBER",
      message: "Tray number must be a positive whole number.",
    });
  }
  if (
    (input.startDepthDm !== undefined && input.startDepthDm < 0) ||
    (input.endDepthDm !== undefined && input.endDepthDm < 0)
  ) {
    errors.push({
      code: "NEGATIVE_DEPTH",
      message: "Tray depths cannot be negative.",
    });
  }
  if (
    input.startDepthDm !== undefined &&
    input.endDepthDm !== undefined &&
    input.endDepthDm < input.startDepthDm
  ) {
    errors.push({
      code: "END_BEFORE_START",
      message: "Tray end depth cannot be shallower than its start depth.",
    });
  }
  if (errors.length > 0) return { errors, warnings };

  const previous = findPreviousTray(input.trays);
  if (input.trays.some(({ trayNumber }) => trayNumber === input.trayNumber)) {
    warnings.push({
      code: "DUPLICATE_NUMBER",
      message: `Tray ${input.trayNumber} already exists. View it or replace its photograph instead.`,
    });
  }
  const expected = suggestNextTrayNumber(input.trays);
  if (input.trays.length > 0 && input.trayNumber !== expected) {
    warnings.push({
      code: "NUMBER_SEQUENCE_GAP",
      message: `The next suggested tray number is ${expected}. Check the physical tray number before saving.`,
    });
  }
  if (
    input.startDepthDm !== undefined &&
    previous?.startDepthDm !== undefined &&
    input.startDepthDm < previous.startDepthDm
  ) {
    warnings.push({
      code: "STARTS_BEFORE_PREVIOUS",
      message: "This tray starts before the previous tray. Check the written tray depths.",
    });
  }
  if (
    input.startDepthDm !== undefined &&
    previous?.endDepthDm !== undefined
  ) {
    if (input.startDepthDm > previous.endDepthDm) {
      warnings.push({
        code: "DEPTH_GAP",
        message: "There is a depth gap after the previous tray. Check both tray labels.",
      });
    } else if (input.startDepthDm < previous.endDepthDm) {
      warnings.push({
        code: "DEPTH_OVERLAP",
        message: "This depth range overlaps the previous tray. Check both tray labels.",
      });
    }
  }
  if (
    input.endDepthDm !== undefined &&
    input.endDepthDm > input.currentCompletedDepthDm
  ) {
    warnings.push({
      code: "END_BEYOND_COMPLETED",
      message: "Tray end depth exceeds the current completed hole depth. Check the tray label.",
    });
  }
  if (
    input.startDepthDm !== undefined &&
    input.endDepthDm === input.startDepthDm
  ) {
    warnings.push({
      code: "ZERO_LENGTH",
      message: "Tray start and end depths are the same. Confirm this is intentional.",
    });
  }
  return { errors, warnings };
}

export interface TrayOverlapRun {
  readonly localId: string;
  readonly runNumber: number;
  readonly startDepthDm: Decimetres;
  readonly endDepthDm: Decimetres;
  readonly status: "completed" | "corrected" | "in_progress";
}

export function findTrayRunOverlaps(
  tray: Pick<Tray, "startDepthDm" | "endDepthDm">,
  runs: readonly TrayOverlapRun[],
): readonly TrayOverlapRun[] {
  if (
    tray.startDepthDm === undefined ||
    tray.endDepthDm === undefined ||
    tray.endDepthDm <= tray.startDepthDm
  ) {
    return [];
  }
  return runs
    .filter(
      (run) =>
        run.status !== "in_progress" &&
        Math.max(tray.startDepthDm!, run.startDepthDm) <
          Math.min(tray.endDepthDm!, run.endDepthDm),
    )
    .sort((left, right) => left.runNumber - right.runNumber);
}

export interface TrayStatistics {
  readonly totalTrays: number;
  readonly photographedTrays: number;
  readonly firstTrayNumber?: number;
  readonly latestTrayNumber?: number;
  readonly finalPartialTrays: number;
  readonly traysWithDepthRanges: number;
  readonly trayDepthCoverageDm: Decimetres;
  readonly duplicateNumberConflicts: number;
  readonly depthGaps: number;
  readonly depthOverlaps: number;
  readonly replacedPhotographs: number;
}

function calculateDepthRangeSummary(trays: readonly Tray[]): {
  readonly coverageDm: Decimetres;
  readonly gaps: number;
  readonly overlaps: number;
} {
  const ranges = trays
    .flatMap(({ startDepthDm, endDepthDm }) =>
      startDepthDm === undefined ||
      endDepthDm === undefined ||
      endDepthDm < startDepthDm
        ? []
        : [{ start: Number(startDepthDm), end: Number(endDepthDm) }],
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  if (ranges.length === 0) {
    return { coverageDm: decimetres(0), gaps: 0, overlaps: 0 };
  }

  let coverage = 0;
  let gaps = 0;
  let overlaps = 0;
  let mergedStart = ranges[0]!.start;
  let mergedEnd = ranges[0]!.end;
  for (const range of ranges.slice(1)) {
    if (range.start > mergedEnd) {
      coverage += mergedEnd - mergedStart;
      gaps += 1;
      mergedStart = range.start;
      mergedEnd = range.end;
    } else {
      if (range.start < mergedEnd) overlaps += 1;
      mergedEnd = Math.max(mergedEnd, range.end);
    }
  }
  coverage += mergedEnd - mergedStart;
  return { coverageDm: decimetres(coverage), gaps, overlaps };
}

export function calculateTrayStatistics(
  trays: readonly Tray[],
  replacedPhotographs = 0,
): TrayStatistics {
  const numbers = trays.map(({ trayNumber }) => trayNumber);
  const uniqueNumbers = new Set(numbers);
  const ranges = calculateDepthRangeSummary(trays);
  return {
    totalTrays: trays.length,
    photographedTrays: trays.filter(({ primaryPhotoId }) => primaryPhotoId.length > 0)
      .length,
    firstTrayNumber: numbers.length === 0 ? undefined : Math.min(...numbers),
    latestTrayNumber: numbers.length === 0 ? undefined : Math.max(...numbers),
    finalPartialTrays: trays.filter(({ isFinalPartial }) => isFinalPartial).length,
    traysWithDepthRanges: trays.filter(
      ({ startDepthDm, endDepthDm }) =>
        startDepthDm !== undefined && endDepthDm !== undefined,
    ).length,
    trayDepthCoverageDm: ranges.coverageDm,
    duplicateNumberConflicts: trays.length - uniqueNumbers.size,
    depthGaps: ranges.gaps,
    depthOverlaps: ranges.overlaps,
    replacedPhotographs,
  };
}
