"use client";

import type { MiniTargetLockResult } from "@/domain";

import { formatDegrees, formatMetresValue } from "./trajectory-format";

function MetricCell({
  label,
  primary,
  secondary,
  tertiary,
  testId,
}: {
  label: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
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
      {tertiary ? (
        <p className="mt-0.5 text-xs tabular-nums text-[var(--tl-ink-muted)]">
          {tertiary}
        </p>
      ) : null}
    </div>
  );
}

function northLabel(result: MiniTargetLockResult): string {
  const ref = result.calculationNorthReference;
  if (ref === "GRID") return "Grid";
  if (ref === "TRUE") return "True";
  if (ref === "MAGNETIC") return "Magnetic";
  return "Azimuth";
}

function formatSignedDegrees(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}°`;
}

export function TrajectoryMetricStrip({
  result,
}: {
  result: MiniTargetLockResult;
}) {
  const latest = result.latestSurvey;
  const next = result.nextSurveyGuidance;
  const projection = result.projection;
  const distanceM = result.directToTarget?.distanceM;
  const remaining = result.remainingMeasuredDepthM;
  const intervalMissing =
    result.target?.measuredDepthM !== undefined &&
    result.surveyIntervalM === null;
  const targetMdReview = result.curvedSolution?.warnings.some(
    (warning) => warning.code === "TARGET_MD_REVIEW_REQUIRED",
  );
  const advancedPathReview = result.curvedSolution?.warnings.some(
    (warning) => warning.code === "ADVANCED_PATH_REVIEW_REQUIRED",
  );
  const guidanceUnavailable = Boolean(targetMdReview || advancedPathReview);
  const guidanceReviewLabel = targetMdReview
    ? "Review target MD"
    : advancedPathReview
      ? "Review entry direction"
      : undefined;

  return (
    <section
      className="grid grid-cols-2 gap-0 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 py-1 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="current-trajectory-tracking"
    >
      <MetricCell
        label="Next-Survey Dip"
        primary={
          guidanceUnavailable
            ? "Unavailable"
            : next
              ? formatDegrees(next.dipDegrees)
              : "—"
        }
        secondary={
          guidanceUnavailable
            ? guidanceReviewLabel
            : next
              ? `At ${formatMetresValue(next.measuredDepthM)} MD`
              : intervalMissing
                ? "Survey interval required"
                : undefined
        }
        tertiary={
          !guidanceUnavailable && next
            ? `Current ${formatDegrees(next.currentDipDegrees)} · Required change ${formatSignedDegrees(next.requiredDipChangeDegrees)}`
            : undefined
        }
        testId="trajectory-metric-required-dip"
      />
      <MetricCell
        label="Next-Survey Azimuth"
        primary={
          guidanceUnavailable
            ? "Unavailable"
            : next
              ? `${formatDegrees(next.azimuthDegrees)} ${northLabel(result)}`
              : "—"
        }
        secondary={
          guidanceUnavailable
            ? guidanceReviewLabel
            : next
              ? `At ${formatMetresValue(next.measuredDepthM)} MD`
              : intervalMissing
                ? "Survey interval required"
                : undefined
        }
        tertiary={
          !guidanceUnavailable && next
            ? `Current ${formatDegrees(next.currentAzimuthDegrees)} · Required change ${formatSignedDegrees(next.requiredAzimuthChangeDegrees)}`
            : undefined
        }
        testId="trajectory-metric-required-azimuth"
      />
      <MetricCell
        label="Projected Miss"
        primary={
          projection
            ? projection.intersectsTarget
              ? "0.0 m"
              : formatMetresValue(projection.missOutsideTargetM)
            : "—"
        }
        secondary={
          projection
            ? projection.intersectsTarget
              ? "Intersects if attitude held"
              : "Outside if current attitude held"
            : result.target
              ? undefined
              : "Set a target"
        }
        tertiary={
          projection && result.target
            ? `Closest approach ${formatMetresValue(projection.closestApproachM)} · Radius ${formatMetresValue(result.target.diameterM / 2)}`
            : latest
              ? "Hold current Survey attitude"
              : undefined
        }
        testId="trajectory-metric-projected-miss"
      />
      <MetricCell
        label="Distance to Target"
        primary={
          distanceM !== undefined && distanceM !== null
            ? formatMetresValue(distanceM)
            : "—"
        }
        secondary={
          result.curvedSolution &&
          (result.curvedSolution.status === "SOLVED" ||
            result.curvedSolution.status === "REVIEW_REQUIRED") &&
          result.curvedSolution.targetResidualM !== null &&
          !guidanceUnavailable
            ? `Recovery residual ${formatMetresValue(result.curvedSolution.targetResidualM)}`
            : "Straight spatial distance"
        }
        tertiary={
          remaining !== null &&
          remaining !== undefined &&
          remaining >= 0
            ? `Remaining MD ${formatMetresValue(remaining)}`
            : undefined
        }
        testId="trajectory-metric-target"
      />
    </section>
  );
}
