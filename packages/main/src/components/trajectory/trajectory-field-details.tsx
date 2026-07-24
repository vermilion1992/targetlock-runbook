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
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const latest = result.latestSurvey;
  const next = result.nextSurveyGuidance;
  const target = result.target;
  const projection = result.projection;
  const curved = result.curvedSolution;

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
            href={runbookRoutes.surveySettings(holeId)}
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

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
          Latest Survey details
        </h2>
        {latest ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Measured depth</dt>
              <dd className="font-semibold tabular-nums">
                {formatMetresValue(latest.measuredDepthM)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Dip / azimuth</dt>
              <dd className="font-semibold tabular-nums">
                {formatDegrees(latest.dipDegrees)} /{" "}
                {formatDegrees(latest.azimuthDegrees)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Easting / Northing</dt>
              <dd className="font-semibold tabular-nums">
                {latest.eastingM.toFixed(1)} / {latest.northingM.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">RL</dt>
              <dd className="font-semibold tabular-nums">
                {latest.rlM.toFixed(1)} m
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            No Survey position available.
          </p>
        )}
      </section>

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
          Next-Survey guidance
        </h2>
        <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
          Calculated next-Survey dip and azimuth describe a geometric
          minimum-curvature path to the target. They do not confirm that the
          path is achievable by the active steering tool, ground conditions or
          available build/turn rate.
        </p>
        {next ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Next Survey MD</dt>
              <dd className="font-semibold tabular-nums">
                {formatMetresValue(next.measuredDepthM)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Next-Survey dip</dt>
              <dd className="font-semibold tabular-nums">
                {formatDegrees(next.dipDegrees)} (
                {next.requiredDipChangeDegrees >= 0 ? "+" : ""}
                {next.requiredDipChangeDegrees.toFixed(1)}°)
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Next-Survey azimuth</dt>
              <dd className="font-semibold tabular-nums">
                {formatDegrees(next.azimuthDegrees)} (
                {next.requiredAzimuthChangeDegrees >= 0 ? "+" : ""}
                {next.requiredAzimuthChangeDegrees.toFixed(1)}°)
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Solution status</dt>
              <dd className="font-semibold">
                {curved?.status === "SOLVED" ||
                curved?.status === "REVIEW_REQUIRED"
                  ? "Geometric solution available"
                  : curved?.status ?? "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            Next-Survey KPIs unavailable until Survey interval and target MD are
            set.
          </p>
        )}
      </section>

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
          Target details
        </h2>
        {target ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
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
                {target.eastingM.toFixed(1)} / {target.northingM.toFixed(1)} /{" "}
                {target.rlM.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Diameter / radius</dt>
              <dd className="font-semibold tabular-nums">
                {target.diameterM.toFixed(1)} m /{" "}
                {(target.diameterM / 2).toFixed(1)} m
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Attitude mode</dt>
              <dd className="font-semibold">{target.attitudeMode}</dd>
            </div>
            {projection ? (
              <>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Projected closest approach
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMetresValue(projection.closestApproachM)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--tl-ink-muted)]">
                    Outside target by
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMetresValue(projection.missOutsideTargetM)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            No target configured.
          </p>
        )}
      </section>

      {curved &&
      (curved.status === "SOLVED" || curved.status === "REVIEW_REQUIRED") ? (
        <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Geometric path information
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Endpoint residual</dt>
              <dd className="font-semibold tabular-nums">
                {curved.targetResidualM !== null
                  ? formatMetresValue(curved.targetResidualM)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Remaining MD</dt>
              <dd className="font-semibold tabular-nums">
                {curved.remainingMeasuredDepthM !== null &&
                curved.remainingMeasuredDepthM >= 0
                  ? formatMetresValue(curved.remainingMeasuredDepthM)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Max dogleg</dt>
              <dd className="font-semibold tabular-nums">
                {curved.maximumDoglegDegrees !== undefined
                  ? formatDegrees(curved.maximumDoglegDegrees)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--tl-ink-muted)]">Max dogleg / 30 m</dt>
              <dd className="font-semibold tabular-nums">
                {curved.maximumDoglegPer30mDegrees !== undefined
                  ? `${curved.maximumDoglegPer30mDegrees.toFixed(1)}°/30 m`
                  : "—"}
              </dd>
            </div>
          </dl>
          {curved.status === "REVIEW_REQUIRED" ? (
            <p className="mt-3 text-sm text-[var(--tl-warning)]">
              REVIEW CURVATURE — A geometric path was found, but the required
              curvature may exceed practical steering capability.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]"
          onClick={() => setTechnicalOpen((value) => !value)}
        >
          Technical details
          <span>{technicalOpen ? "−" : "+"}</span>
        </button>
        {technicalOpen ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Engine:{" "}
              <span className="font-semibold tabular-nums">
                {result.actualTrajectory?.engineVersion ??
                  "minimum-curvature-v1"}
              </span>
            </p>
            <p>
              Solver:{" "}
              <span className="font-semibold tabular-nums">
                {curved?.solverVersion ?? "—"}
              </span>
            </p>
            <p>
              Calculation north:{" "}
              <span className="font-semibold">
                {result.calculationNorthReference ?? "—"}
              </span>
            </p>
            <ul className="space-y-1 text-xs text-[var(--tl-ink-muted)]">
              {result.sourceVersions.map((version) => (
                <li key={`${version.entityType}-${version.entityId}`}>
                  {version.entityType} {version.entityId} v{version.version}
                </li>
              ))}
            </ul>
            {curved?.warnings.map((warning) => (
              <p
                key={warning.code}
                className="whitespace-pre-line text-xs text-[var(--tl-warning)]"
              >
                {warning.message}
              </p>
            ))}
            {result.warnings.length > 0 ? (
              <ul className="space-y-1 text-xs text-[var(--tl-warning)]">
                {result.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
