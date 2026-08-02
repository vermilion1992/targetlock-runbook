"use client";

import { Crosshair, Target } from "lucide-react";

import type { MiniTargetLockResult } from "@/domain";

import { formatMetresValue } from "./trajectory-format";
import { classifyTargetProjectionAlert } from "./trajectory-status-model";

function ProjectionStatusBanner({ result }: { result: MiniTargetLockResult }) {
  const alert = classifyTargetProjectionAlert({
    hasTarget: Boolean(result.target),
    intersectsTarget: result.projection?.intersectsTarget,
    endpointMissOutsideTargetM: result.projection?.endpointMissOutsideTargetM,
    nearMissOutsideTargetM: result.nearMissOutsideTargetM,
  });

  const toneClass =
    alert.tone === "success"
      ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)] text-[var(--tl-success)]"
      : alert.tone === "warning"
        ? "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]"
        : alert.tone === "danger"
          ? "border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] text-[var(--tl-danger)]"
          : "border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-[var(--tl-ink)]";

  const Icon = alert.kind === "NO_TARGET" ? Target : Crosshair;

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-[var(--tl-radius-md)] border px-4 py-3 ${toneClass}`}
      data-testid="trajectory-target-status"
      data-alert-kind={alert.kind}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold sm:text-lg">{alert.title}</p>
        {alert.detail ? (
          <p className="mt-0.5 text-sm font-semibold opacity-90">
            {alert.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TrajectoryCockpitHeader({
  holeId,
  result,
}: {
  holeId: string;
  result: MiniTargetLockResult;
}) {
  const latest = result.latestSurvey;
  const north =
    result.calculationNorthReference === "GRID"
      ? "Grid North"
      : result.calculationNorthReference === "TRUE"
        ? "True North"
        : result.calculationNorthReference === "MAGNETIC"
          ? "Magnetic North"
          : "Azimuth reference";

  return (
    <header className="space-y-4">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
          {holeId} — TRAJECTORY
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--tl-ink)] sm:text-3xl">
          Trajectory guidance
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--tl-ink-muted)] sm:text-base">
          {latest
            ? `Latest Survey ${formatMetresValue(latest.measuredDepthM)}`
            : "No Survey yet"}
          {` · ${north}`}
        </p>
      </div>
      <ProjectionStatusBanner result={result} />
    </header>
  );
}
