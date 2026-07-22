import {
  decimetres,
  type Decimetres,
} from "./measurements";
import type { NorthReference, Survey } from "./models";

export const DEFAULT_DIP_WARNING_THRESHOLD_TENTHS = 50;
export const DEFAULT_AZIMUTH_WARNING_THRESHOLD_TENTHS = 100;

export type TenthsParseResult =
  | {
      readonly ok: true;
      readonly value: number;
      readonly normalized?: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "empty" | "invalid" | "precision" | "range";
    };

function parseTenths(value: string, signed: boolean): TenthsParseResult {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return { ok: false, reason: "empty" };
  const pattern = signed ? /^[+-]?\d+(?:\.\d+)?$/ : /^\+?\d+(?:\.\d+)?$/;
  if (!pattern.test(normalized)) return { ok: false, reason: "invalid" };

  const unsigned = normalized.replace(/^[+-]/, "");
  const [, fraction = ""] = unsigned.split(".");
  if (fraction.length > 1 && /[1-9]/.test(fraction.slice(1))) {
    return { ok: false, reason: "precision" };
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return { ok: false, reason: "range" };
  return { ok: true, value: Math.round(numeric * 10) };
}

export function parseDipInput(value: string): TenthsParseResult {
  const result = parseTenths(value, true);
  if (!result.ok) return result;
  if (result.value < -900 || result.value > 900) {
    return { ok: false, reason: "range" };
  }
  return result;
}

export function parseAzimuthInput(value: string): TenthsParseResult {
  const result = parseTenths(value, false);
  if (!result.ok) return result;
  if (result.value === 3600) {
    return { ok: true, value: 0, normalized: true };
  }
  if (result.value < 0 || result.value > 3599) {
    return { ok: false, reason: "range" };
  }
  return result;
}

export function formatTenths(value: number): string {
  return (value / 10).toFixed(1);
}

export function calculateCircularAzimuthDifferenceTenths(
  leftTenths: number,
  rightTenths: number,
): number {
  const absolute = Math.abs(leftTenths - rightTenths) % 3600;
  return Math.min(absolute, 3600 - absolute);
}

function compareSurveyOrder(left: Survey, right: Survey): number {
  if (left.depthDm !== right.depthDm) return left.depthDm - right.depthDm;
  return Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
}

export function findLatestSurvey(
  surveys: readonly Survey[],
): Survey | undefined {
  return [...surveys].sort(compareSurveyOrder).at(-1);
}

export function calculateSurveySpacing(
  surveys: readonly Survey[],
): readonly Decimetres[] {
  const depths = [...new Set(surveys.map(({ depthDm }) => Number(depthDm)))].sort(
    (left, right) => left - right,
  );
  return depths.slice(1).map((depth, index) => decimetres(depth - depths[index]!));
}

export function calculateAverageSurveySpacing(
  surveys: readonly Survey[],
): Decimetres | undefined {
  const spacing = calculateSurveySpacing(surveys);
  if (spacing.length === 0) return undefined;
  return decimetres(
    Math.round(spacing.reduce<number>((sum, value) => sum + value, 0) / spacing.length),
  );
}

export function calculateLargestSurveyGap(
  surveys: readonly Survey[],
): Decimetres | undefined {
  const spacing = calculateSurveySpacing(surveys);
  if (spacing.length === 0) return undefined;
  return decimetres(Math.max(...spacing));
}

export function calculateDistanceSinceLatestSurvey(
  currentCompletedDepthDm: Decimetres,
  surveys: readonly Survey[],
): Decimetres | undefined {
  const latest = findLatestSurvey(surveys);
  if (latest === undefined) return undefined;
  return decimetres(Math.max(0, currentCompletedDepthDm - latest.depthDm));
}

export type SurveyIntervalReminder =
  | { readonly status: "DUE_IN"; readonly distanceDm: Decimetres }
  | { readonly status: "EXCEEDED"; readonly distanceDm: Decimetres }
  | { readonly status: "DUE_NOW"; readonly distanceDm: Decimetres };

export function calculateSurveyIntervalReminder(
  currentCompletedDepthDm: Decimetres,
  surveys: readonly Survey[],
  preferredIntervalDm?: Decimetres,
): SurveyIntervalReminder | undefined {
  if (preferredIntervalDm === undefined) return undefined;
  const latest = findLatestSurvey(surveys);
  const baseDepth = latest?.depthDm ?? decimetres(0);
  const dueDepth = baseDepth + preferredIntervalDm;
  if (currentCompletedDepthDm < dueDepth) {
    return {
      status: "DUE_IN",
      distanceDm: decimetres(dueDepth - currentCompletedDepthDm),
    };
  }
  if (currentCompletedDepthDm > dueDepth) {
    return {
      status: "EXCEEDED",
      distanceDm: decimetres(currentCompletedDepthDm - dueDepth),
    };
  }
  return { status: "DUE_NOW", distanceDm: decimetres(0) };
}

export type SurveyWarningCode =
  | "DEPTH_BEYOND_COMPLETED"
  | "DUPLICATE_DEPTH"
  | "LARGE_DIP_CHANGE"
  | "LARGE_AZIMUTH_CHANGE"
  | "REFERENCE_CHANGED"
  | "TOOL_CHANGED";

export interface SurveyWarning {
  readonly code: SurveyWarningCode;
  readonly message: string;
  readonly previousSurvey?: Survey;
}

export interface AssessSurveyInput {
  readonly depthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: NorthReference;
  readonly surveyToolId?: string;
  readonly currentCompletedDepthDm: Decimetres;
  readonly surveys: readonly Survey[];
  readonly dipWarningThresholdTenths?: number;
  readonly azimuthWarningThresholdTenths?: number;
}

export function assessSurveyWarnings(
  input: AssessSurveyInput,
): readonly SurveyWarning[] {
  const warnings: SurveyWarning[] = [];
  const previousSurvey = [...input.surveys]
    .filter(({ depthDm }) => depthDm <= input.depthDm)
    .sort(compareSurveyOrder)
    .at(-1);

  if (input.depthDm > input.currentCompletedDepthDm) {
    warnings.push({
      code: "DEPTH_BEYOND_COMPLETED",
      message: "Survey depth exceeds the current completed hole depth. Check the depth before saving.",
    });
  }
  if (input.surveys.some(({ depthDm }) => depthDm === input.depthDm)) {
    warnings.push({
      code: "DUPLICATE_DEPTH",
      message: "A survey already exists at this depth. Confirm this is a repeated reading.",
      previousSurvey,
    });
  }
  if (previousSurvey !== undefined) {
    const dipDifference = Math.abs(input.dipTenths - previousSurvey.dipTenths);
    if (
      dipDifference >=
      (input.dipWarningThresholdTenths ?? DEFAULT_DIP_WARNING_THRESHOLD_TENTHS)
    ) {
      warnings.push({
        code: "LARGE_DIP_CHANGE",
        message: `Dip changed by ${formatTenths(dipDifference)}°. Check the entered value, survey tool and north reference.`,
        previousSurvey,
      });
    }
    const azimuthDifference = calculateCircularAzimuthDifferenceTenths(
      input.azimuthTenths,
      previousSurvey.azimuthTenths,
    );
    if (
      azimuthDifference >=
      (input.azimuthWarningThresholdTenths ??
        DEFAULT_AZIMUTH_WARNING_THRESHOLD_TENTHS)
    ) {
      warnings.push({
        code: "LARGE_AZIMUTH_CHANGE",
        message: `Azimuth changed by ${formatTenths(azimuthDifference)}°. Check the entered value, survey tool and north reference.`,
        previousSurvey,
      });
    }
    if (previousSurvey.northReference !== input.northReference) {
      warnings.push({
        code: "REFERENCE_CHANGED",
        message: "North reference differs from the previous survey. Check the selected reference.",
        previousSurvey,
      });
    }
    if (previousSurvey.surveyToolId !== input.surveyToolId) {
      warnings.push({
        code: "TOOL_CHANGED",
        message: "Survey tool differs from the previous survey. Check the selected tool and serial.",
        previousSurvey,
      });
    }
  }
  return warnings;
}

export interface SurveyStatistics {
  readonly totalSurveys: number;
  readonly latestSurveyDepthDm?: Decimetres;
  readonly distanceSinceLatestDm?: Decimetres;
  readonly averageSpacingDm?: Decimetres;
  readonly largestGapDm?: Decimetres;
  readonly firstSurveyDepthDm?: Decimetres;
  readonly toolsUsed: number;
  readonly surveysWithPhotographs: number;
  readonly correctedSurveys: number;
  readonly duplicateDepthSurveys: number;
}

export function calculateSurveyStatistics(
  surveys: readonly Survey[],
  currentCompletedDepthDm: Decimetres,
  correctedSurveyIds: ReadonlySet<string> = new Set(),
): SurveyStatistics {
  const ordered = [...surveys].sort(compareSurveyOrder);
  const latest = ordered.at(-1);
  const uniqueTools = new Set(
    surveys
      .map((survey) => survey.surveyToolId ?? survey.toolNameSnapshot)
      .filter((value): value is string => value !== undefined),
  );
  const uniqueDepths = new Set(surveys.map(({ depthDm }) => depthDm));
  return {
    totalSurveys: surveys.length,
    latestSurveyDepthDm: latest?.depthDm,
    distanceSinceLatestDm: calculateDistanceSinceLatestSurvey(
      currentCompletedDepthDm,
      surveys,
    ),
    averageSpacingDm: calculateAverageSurveySpacing(surveys),
    largestGapDm: calculateLargestSurveyGap(surveys),
    firstSurveyDepthDm: ordered[0]?.depthDm,
    toolsUsed: uniqueTools.size,
    surveysWithPhotographs: surveys.filter(({ photoId }) => photoId !== undefined)
      .length,
    correctedSurveys: surveys.filter(({ localId }) =>
      correctedSurveyIds.has(localId),
    ).length,
    duplicateDepthSurveys: surveys.length - uniqueDepths.size,
  };
}
