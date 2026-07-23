/**
 * Shared integer-domain numeric helpers for analytics.
 * Prefer these over floating-point averages where values are already integers.
 */

/**
 * Median of integer-domain values.
 * - Odd count: middle value after sort
 * - Even count: average of the two middle values (truncated toward nearest
 *   integer when the sum is even; otherwise keeps half via integer division
 *   of the sum so dm / minutes stay integer when both middles share parity)
 * - Empty: undefined
 */
export function medianInteger(
  values: readonly number[],
): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  const left = sorted[mid - 1]!;
  const right = sorted[mid]!;
  // Average of two integers; keep integer domain when possible.
  return Math.round((left + right) / 2);
}

/**
 * Arithmetic mean rounded to nearest integer. Empty → undefined.
 */
export function averageInteger(
  values: readonly number[],
): number | undefined {
  if (values.length === 0) return undefined;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round(sum / values.length);
}

/**
 * True when a timestamp parses to a finite epoch millisecond value.
 */
export function isTrustworthyTimestamp(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim().length === 0) {
    return false;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * Elapsed whole minutes between two ISO timestamps, or undefined when either
 * is missing/unreliable or the span is negative.
 */
export function elapsedMinutesBetween(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): number | undefined {
  if (!isTrustworthyTimestamp(startedAt) || !isTrustworthyTimestamp(endedAt)) {
    return undefined;
  }
  const startMs = Date.parse(startedAt!);
  const endMs = Date.parse(endedAt!);
  if (endMs < startMs) return undefined;
  return Math.round((endMs - startMs) / 60_000);
}
