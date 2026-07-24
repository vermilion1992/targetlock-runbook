"use client";

import type { HoleTrajectoryComparison } from "@/domain";

import {
  formatEastShort,
  formatMetresValue,
  formatNorthShort,
  formatVerticalOfPlan,
} from "./trajectory-format";

function MetricCell({
  label,
  primary,
  secondary,
  testId,
}: {
  label: string;
  primary: string;
  secondary?: string;
  testId?: string;
}) {
  return (
    <div
      className="min-w-0 border-l border-[var(--tl-border)] px-3 py-2 first:border-l-0 first:pl-0"
      data-testid={testId}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums leading-tight">
        {primary}
      </p>
      {secondary ? (
        <p className="mt-0.5 text-xs tabular-nums text-[var(--tl-ink-muted)]">
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

export function TrajectoryMetricStrip({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const current = comparison.currentTrackingPoint;
  const target = comparison.targetTracking;

  return (
    <section
      className="grid grid-cols-2 gap-0 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 py-1 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="current-trajectory-tracking"
    >
      <MetricCell
        label="Latest Survey"
        primary={
          current ? formatMetresValue(current.measuredDepthM) : "—"
        }
        secondary={
          comparison.activePlanName
            ? comparison.activePlanName
            : undefined
        }
      />
      <MetricCell
        label="Horizontal"
        primary={
          current
            ? formatMetresValue(current.horizontalDeviationM)
            : "—"
        }
        secondary={
          current
            ? `${formatEastShort(current.deltaEastingM)} / ${formatNorthShort(current.deltaNorthingM)}`
            : undefined
        }
      />
      <MetricCell
        label="Vertical"
        primary={
          current
            ? formatMetresValue(Math.abs(current.verticalDeviationM))
            : "—"
        }
        secondary={
          current ? formatVerticalOfPlan(current.deltaRlM) : undefined
        }
      />
      <MetricCell
        label="3D Deviation"
        primary={
          current ? formatMetresValue(current.spatialDeviationM) : "—"
        }
        secondary={
          comparison.toleranceConfigured
            ? undefined
            : "No project tolerance configured"
        }
      />
      <MetricCell
        label="Target"
        primary={
          target
            ? formatMetresValue(target.actualEndpointDistanceM)
            : "—"
        }
        secondary={target ? "away" : "No target"}
        testId="trajectory-metric-target"
      />
    </section>
  );
}
