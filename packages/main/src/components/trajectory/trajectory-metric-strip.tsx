"use client";

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Compass,
  Gauge,
  Target,
} from "lucide-react";
import type { ComponentType } from "react";

import type { MiniTargetLockResult } from "@/domain";
import { cn } from "@/lib/utils";

import { formatDegrees, formatMetresValue } from "./trajectory-format";

function GuidanceCard({
  label,
  value,
  target,
  supporting,
  icon: Icon,
  emphasis = false,
  testId,
}: {
  label: string;
  value: string;
  target?: string;
  supporting?: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <article
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[var(--tl-radius-lg)] border bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5",
        emphasis
          ? "border-[color-mix(in_srgb,var(--tl-primary)_35%,var(--tl-border))]"
          : "border-[var(--tl-border)]",
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "absolute right-3 top-3 flex size-9 items-center justify-center rounded-full",
          emphasis
            ? "bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]"
            : "bg-[var(--tl-surface-sunken)] text-[var(--tl-ink-muted)]",
        )}
      >
        <Icon aria-hidden className="size-4.5" />
      </div>
      <p className="pr-10 text-xs font-bold uppercase tracking-[0.09em] text-[var(--tl-ink-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 break-words font-bold tracking-[-0.035em] text-[var(--tl-ink)]",
          emphasis ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
        )}
      >
        {value}
      </p>
      {target ? (
        <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--tl-ink)]">
          {target}
        </p>
      ) : null}
      {supporting ? (
        <p className="mt-1 text-xs leading-5 text-[var(--tl-ink-muted)]">
          {supporting}
        </p>
      ) : null}
    </article>
  );
}

function northLabel(result: MiniTargetLockResult): string {
  const ref = result.calculationNorthReference;
  if (ref === "GRID") return "Grid";
  if (ref === "TRUE") return "True";
  if (ref === "MAGNETIC") return "Magnetic";
  return "Azimuth";
}

function actionValue(
  action: "LIFT" | "DROP" | "LEFT" | "RIGHT" | "HOLD" | "UNAVAILABLE",
  adjustmentDegrees: number,
): string {
  if (action === "UNAVAILABLE") return "REVIEW";
  if (action === "HOLD") return "HOLD";
  return `${action} ${adjustmentDegrees.toFixed(1)}°`;
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
  const steeringLimitExceeded = result.curvedSolution?.warnings.some(
    (warning) => warning.code === "STEERING_LIMIT_EXCEEDED",
  );
  const guidanceUnavailable = Boolean(
    targetMdReview || advancedPathReview || steeringLimitExceeded,
  );
  const guidanceReviewLabel = targetMdReview
    ? "Review target MD"
    : advancedPathReview
      ? "Review entry direction"
      : steeringLimitExceeded
        ? "Outside configured steering envelope"
      : undefined;
  const nextMd = next
    ? `At ${formatMetresValue(next.measuredDepthM)} MD`
    : intervalMissing
      ? "Survey interval required"
      : guidanceReviewLabel;
  const verticalIcon =
    next?.verticalAction === "DROP" ? ArrowDownRight : ArrowUpRight;

  return (
    <section
      className="space-y-3"
      data-testid="current-trajectory-tracking"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GuidanceCard
          label="Latest dip"
          value={latest ? formatDegrees(latest.dipDegrees) : "—"}
          supporting={
            latest
              ? `Latest Survey · ${formatMetresValue(latest.measuredDepthM)} MD`
              : "No Survey recorded"
          }
          icon={Gauge}
          testId="trajectory-metric-latest-dip"
        />
        <GuidanceCard
          label="Latest azimuth"
          value={latest ? formatDegrees(latest.azimuthDegrees) : "—"}
          supporting={`${northLabel(result)} North${
            latest ? ` · ${formatMetresValue(latest.measuredDepthM)} MD` : ""
          }`}
          icon={Compass}
          testId="trajectory-metric-latest-azimuth"
        />
        <GuidanceCard
          label="Swing"
          value={
            guidanceUnavailable
              ? "REVIEW"
              : next
                ? actionValue(
                    next.horizontalAction,
                    next.azimuthAdjustmentDegrees,
                  )
                : "—"
          }
          target={
            !guidanceUnavailable && next
              ? `Target ${formatDegrees(next.azimuthDegrees)} · ${nextMd}`
              : undefined
          }
          supporting={
            guidanceUnavailable
              ? guidanceReviewLabel
              : next?.horizontalAction === "UNAVAILABLE"
                ? "Azimuth is unstable near vertical"
                : undefined
          }
          icon={ArrowLeftRight}
          emphasis
          testId="trajectory-metric-required-azimuth"
        />
        <GuidanceCard
          label="Vertical steer"
          value={
            guidanceUnavailable
              ? "REVIEW"
              : next
                ? actionValue(
                    next.verticalAction,
                    next.dipAdjustmentDegrees,
                  )
                : "—"
          }
          target={
            !guidanceUnavailable && next
              ? `Target ${formatDegrees(next.dipDegrees)} · ${nextMd}`
              : undefined
          }
          supporting={guidanceUnavailable ? guidanceReviewLabel : undefined}
          icon={verticalIcon}
          emphasis
          testId="trajectory-metric-required-dip"
        />
      </div>

      <div className="grid gap-px overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-border)] sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="bg-[var(--tl-surface)] px-4 py-3"
          data-testid="trajectory-metric-projected-miss"
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Hold miss at target MD
          </p>
          <p className="mt-1 font-bold tabular-nums">
            {projection
              ? formatMetresValue(projection.endpointMissOutsideTargetM)
              : "—"}
          </p>
        </div>
        <div
          className="bg-[var(--tl-surface)] px-4 py-3"
          data-testid="trajectory-metric-target"
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Distance to target
          </p>
          <p className="mt-1 font-bold tabular-nums">
            {distanceM !== undefined && distanceM !== null
              ? formatMetresValue(distanceM)
              : "—"}
          </p>
        </div>
        <div className="bg-[var(--tl-surface)] px-4 py-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Remaining MD
          </p>
          <p className="mt-1 font-bold tabular-nums">
            {remaining !== null && remaining !== undefined && remaining >= 0
              ? formatMetresValue(remaining)
              : "—"}
          </p>
        </div>
        <div className="bg-[var(--tl-surface)] px-4 py-3">
          <p className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            <Target aria-hidden className="size-3" />
            Guidance status
          </p>
          <p className="mt-1 font-bold">
            {next
              ? "Within steering envelope"
              : guidanceReviewLabel ?? "Awaiting target solution"}
          </p>
        </div>
      </div>
    </section>
  );
}
