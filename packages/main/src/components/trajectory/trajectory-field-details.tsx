"use client";

import { useState } from "react";
import Link from "next/link";

import type { MiniTargetLockResult } from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

import { formatDegrees, formatMetresValue } from "./trajectory-format";

export function TrajectoryFieldDetails({
  result,
  holeId,
}: {
  result: MiniTargetLockResult;
  holeId: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const latest = result.latestSurvey;
  const next = result.nextSurveyGuidance;
  const target = result.target;
  const projection = result.projection;
  const curved = result.curvedSolution;
  const reviewCurvature = curved?.status === "REVIEW_REQUIRED";

  return (
    <div className="space-y-3" data-testid="trajectory-field-details">
      {result.guidanceFromCollarOnly ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
          data-testid="collar-guidance-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            No downhole Survey exists
          </h2>
          <p className="mt-2 text-sm text-[var(--tl-ink)]">
            Target guidance is currently based on the collar direction.
          </p>
        </section>
      ) : null}

      {!result.target ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-6 py-8 text-center"
          data-testid="target-empty-state"
        >
          <h2 className="text-lg font-semibold">Target not set</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--tl-ink-muted)]">
            Add target MD and target coordinates to calculate the curved
            recovery path and projected miss.
          </p>
        </section>
      ) : null}

      {result.target && result.surveyIntervalM === null ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-6 py-8 text-center"
          data-testid="survey-interval-empty-state"
        >
          <h2 className="text-lg font-semibold">Survey interval required</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--tl-ink-muted)]">
            Set the default Survey interval before TargetLock can calculate the
            next-Survey dip and azimuth.
          </p>
          <Link
            href={runbookRoutes.surveySettings(holeId, {
              returnTo: runbookRoutes.trajectory(holeId),
            })}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 text-sm font-semibold uppercase tracking-wide text-white"
          >
            Open Survey Settings
          </Link>
        </section>
      ) : null}

      {curved?.status === "NO_SOLUTION" &&
      curved.warnings.some((w) =>
        /TARGET CANNOT BE REACHED/i.test(w.message),
      ) ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-surface)] p-4"
          data-testid="target-unreachable-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Target cannot be reached at the entered MD
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm">
            {
              curved.warnings.find((w) =>
                /TARGET CANNOT BE REACHED/i.test(w.message),
              )?.message
            }
          </p>
        </section>
      ) : null}

      {curved?.warnings.some((w) => w.code === "TARGET_MD_REVIEW_REQUIRED") ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-surface)] p-4"
          data-testid="target-md-review-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-warning)]">
            Target depth requires review
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm">
            {
              curved.warnings.find((w) => w.code === "TARGET_MD_REVIEW_REQUIRED")
                ?.message
            }
          </p>
        </section>
      ) : null}

      {curved?.warnings.some(
        (w) => w.code === "ADVANCED_PATH_REVIEW_REQUIRED",
      ) ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-surface)] p-4"
          data-testid="advanced-path-review-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-warning)]">
            Target entry direction requires a complex path
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm">
            {
              curved.warnings.find(
                (w) => w.code === "ADVANCED_PATH_REVIEW_REQUIRED",
              )?.message
            }
          </p>
        </section>
      ) : null}

      {reviewCurvature &&
      !curved?.warnings.some(
        (w) =>
          w.code === "TARGET_MD_REVIEW_REQUIRED" ||
          w.code === "ADVANCED_PATH_REVIEW_REQUIRED",
      ) ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-surface)] p-4"
          data-testid="review-curvature-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-warning)]">
            Review curvature
          </h2>
          <p className="mt-2 text-sm text-[var(--tl-ink)]">
            {curved.warnings.some((warning) =>
              /curvature is concentrated/i.test(warning.message),
            )
              ? "A geometric path reaches the target, but the required curvature is concentrated and may not be practically achievable"
              : "A geometric path reaches the target, but required curvature may exceed practical steering capability"}
            {curved.maximumDoglegPer30mDegrees !== undefined
              ? ` (${curved.maximumDoglegPer30mDegrees.toFixed(1)}°/30 m)`
              : ""}
            .
          </p>
        </section>
      ) : null}

      {next || latest ? (
        <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Next-Survey guidance
          </h2>
          <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
            Geometric minimum-curvature guidance — not steering-tool
            certification.
          </p>
          {next ? (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--tl-ink-muted)]">Next Survey MD</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMetresValue(next.measuredDepthM)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--tl-ink-muted)]">Dip</dt>
                <dd className="font-semibold tabular-nums">
                  {formatDegrees(next.dipDegrees)} (
                  {next.requiredDipChangeDegrees >= 0 ? "+" : ""}
                  {next.requiredDipChangeDegrees.toFixed(1)}°)
                </dd>
              </div>
              <div>
                <dt className="text-[var(--tl-ink-muted)]">Azimuth</dt>
                <dd className="font-semibold tabular-nums">
                  {formatDegrees(next.azimuthDegrees)} (
                  {next.requiredAzimuthChangeDegrees >= 0 ? "+" : ""}
                  {next.requiredAzimuthChangeDegrees.toFixed(1)}°)
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
              Next-Survey KPIs unavailable until Survey interval and target MD
              are set.
            </p>
          )}
          {latest ? (
            <p className="mt-3 text-xs text-[var(--tl-ink-muted)]">
              Latest Survey {formatMetresValue(latest.measuredDepthM)} ·{" "}
              {formatDegrees(latest.dipDegrees)} /{" "}
              {formatDegrees(latest.azimuthDegrees)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]"
          onClick={() => setDetailsOpen((value) => !value)}
          data-testid="trajectory-more-details-toggle"
        >
          More details
          <span>{detailsOpen ? "−" : "+"}</span>
        </button>
        {detailsOpen ? (
          <div className="mt-3 space-y-4 text-sm">
            {target ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">Target MD</dt>
                  <dd className="font-semibold tabular-nums">
                    {target.measuredDepthM !== undefined
                      ? formatMetresValue(target.measuredDepthM)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">Centre E / N / RL</dt>
                  <dd className="font-semibold tabular-nums">
                    {target.eastingM.toFixed(1)} / {target.northingM.toFixed(1)}{" "}
                    / {target.rlM.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Diameter / radius
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {target.diameterM.toFixed(1)} m /{" "}
                    {(target.diameterM / 2).toFixed(1)} m
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Target entry direction
                  </dt>
                  <dd
                    className="font-semibold tabular-nums"
                    data-testid="target-entry-mode"
                  >
                    {target.attitudeMode === "MATCH_ENTRY_DIRECTION" ||
                    target.attitudeMode === "CUSTOM"
                      ? "Specified"
                      : target.attitudeMode === "SAME_AS_COLLAR"
                        ? "Same as collar"
                        : "Automatic smoothest path"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Hold-attitude miss
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {projection
                      ? projection.intersectsTarget
                        ? "Intersects target"
                        : `${formatMetresValue(projection.missOutsideTargetM)} outside`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Recommended recovery residual
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {curved?.targetResidualM !== null &&
                    curved?.targetResidualM !== undefined
                      ? formatMetresValue(curved.targetResidualM)
                      : "—"}
                  </dd>
                </div>
                {curved?.maximumDoglegPer30mDegrees !== undefined ? (
                  <div>
                    <dt className="text-[var(--tl-ink-muted)]">
                      Max dogleg / 30 m
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {curved.maximumDoglegPer30mDegrees.toFixed(1)}°/30 m
                    </dd>
                  </div>
                ) : null}
                {curved?.remainingMeasuredDepthM !== null &&
                curved?.remainingMeasuredDepthM !== undefined &&
                curved.remainingMeasuredDepthM >= 0 ? (
                  <div>
                    <dt className="text-[var(--tl-ink-muted)]">Remaining MD</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatMetresValue(curved.remainingMeasuredDepthM)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="space-y-1 border-t border-[var(--tl-border)] pt-3 text-xs text-[var(--tl-ink-muted)]">
              <p>
                Engine:{" "}
                <span className="font-semibold tabular-nums text-[var(--tl-ink)]">
                  {result.actualTrajectory?.engineVersion ??
                    "minimum-curvature-v1"}
                </span>
              </p>
              <p>
                Solver:{" "}
                <span className="font-semibold tabular-nums text-[var(--tl-ink)]">
                  {curved?.solverVersion ?? "—"}
                </span>
              </p>
              <p>
                Calculation north:{" "}
                <span className="font-semibold text-[var(--tl-ink)]">
                  {result.calculationNorthReference ?? "—"}
                </span>
              </p>
              {result.sourceVersions.length > 0 ? (
                <ul className="space-y-1 pt-1">
                  {result.sourceVersions.map((version) => (
                    <li key={`${version.entityType}-${version.entityId}`}>
                      {version.entityType} {version.entityId} v{version.version}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
