"use client";

import Link from "next/link";

import type { MiniTargetLockResult } from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

export function TrajectoryFieldDetails({
  result,
  holeId,
}: {
  result: MiniTargetLockResult;
  holeId: string;
}) {
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

      {curved?.warnings.some((w) => w.code === "STEERING_LIMIT_EXCEEDED") ? (
        <section
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
          data-testid="steering-envelope-review-banner"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-warning)]">
            Guidance withheld
          </h2>
          <p className="mt-2 text-sm text-[var(--tl-ink)]">
            {
              curved.warnings.find(
                (warning) => warning.code === "STEERING_LIMIT_EXCEEDED",
              )?.message
            }
          </p>
          <Link
            href={runbookRoutes.surveySettings(holeId, {
              returnTo: runbookRoutes.trajectory(holeId),
            })}
            className="mt-3 inline-flex min-h-10 items-center font-bold text-[var(--tl-primary)]"
          >
            Review steering envelope
          </Link>
        </section>
      ) : null}

      {reviewCurvature &&
      !curved?.warnings.some(
        (w) =>
          w.code === "TARGET_MD_REVIEW_REQUIRED" ||
          w.code === "ADVANCED_PATH_REVIEW_REQUIRED" ||
          w.code === "STEERING_LIMIT_EXCEEDED",
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
    </div>
  );
}
