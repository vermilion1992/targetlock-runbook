/** Shared Recharts axis helpers for the Trajectory Cockpit. */

export const CHART_MARGIN = { top: 20, right: 24, bottom: 28, left: 48 };

export const CHART_GRID_STROKE = "var(--tl-border)";
export const CHART_TICK_FILL = "var(--tl-ink-muted)";
export const PLANNED_STROKE = "var(--tl-ink-muted)";
export const ACTUAL_STROKE = "var(--tl-primary)";
export const TARGET_FILL = "var(--tl-warning, #b86e00)";
export const SPATIAL_STROKE = "var(--tl-ink)";
export const VERTICAL_STROKE = "var(--tl-warning, #b86e00)";

export function niceTicks(
  min: number,
  max: number,
  maxTicks = 6,
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (Math.abs(max - min) < 1e-9) {
    return [min];
  }
  const span = max - min;
  const rough = span / Math.max(maxTicks - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(rough)));
  const residual = rough / magnitude;
  let niceStep = magnitude;
  if (residual > 5) niceStep = 10 * magnitude;
  else if (residual > 2) niceStep = 5 * magnitude;
  else if (residual > 1) niceStep = 2 * magnitude;

  const start = Math.floor(min / niceStep) * niceStep;
  const end = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let value = start; value <= end + niceStep * 0.5; value += niceStep) {
    ticks.push(Number(value.toFixed(6)));
    if (ticks.length > 12) break;
  }
  return ticks.length > 0 ? ticks : [min, max];
}

export function formatAxisMetres(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

export function formatAxisDegrees(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(0);
}

export function mdDomain(
  values: readonly number[],
): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 1e-9) return [min - 1, max + 1];
  const pad = (max - min) * 0.04;
  return [min - pad, max + pad];
}
