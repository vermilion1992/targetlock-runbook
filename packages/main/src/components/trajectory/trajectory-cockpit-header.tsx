"use client";

import Link from "next/link";

import type { MiniTargetLockResult } from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

import { formatMetresValue } from "./trajectory-format";

function ProjectionStatusChip({ result }: { result: MiniTargetLockResult }) {
  if (!result.projection || !result.target) {
    return (
      <div className="min-w-[12rem] rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide">No target</p>
        <p className="mt-1 text-sm leading-snug">Set a target to track miss</p>
      </div>
    );
  }
  const intersects = result.projection.intersectsTarget;
  const tone = intersects
    ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)] text-[var(--tl-success)]"
    : "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]";
  return (
    <div
      className={`min-w-[12rem] rounded-[var(--tl-radius-md)] border px-3 py-2 ${tone}`}
      data-testid="trajectory-target-status"
    >
      <p className="text-xs font-bold uppercase tracking-wide">
        {intersects
          ? "Projected to intersect target"
          : "Projected to miss target"}
      </p>
      <p className="mt-1 text-sm tabular-nums leading-snug">
        Closest approach {formatMetresValue(result.projection.closestApproachM)}
      </p>
      <p className="mt-1 text-xs opacity-80">
        Target diameter {result.target.diameterM.toFixed(1)} m (radius{" "}
        {(result.target.diameterM / 2).toFixed(1)} m)
      </p>
    </div>
  );
}

export function TrajectoryCockpitHeader({
  holeId,
  result,
  onExportImage,
  onEditTarget,
}: {
  holeId: string;
  result: MiniTargetLockResult;
  onExportImage: () => void;
  onEditTarget: () => void;
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
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tl-ink-muted)]">
          {holeId} — TRAJECTORY
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Trajectory</h1>
        <p className="text-sm text-[var(--tl-ink-muted)]">
          {latest
            ? `Latest Survey ${formatMetresValue(latest.measuredDepthM)}`
            : "No Survey yet"}
          {result.target?.measuredDepthM !== undefined
            ? ` · Target MD ${formatMetresValue(result.target.measuredDepthM)}`
            : ""}
          {` · ${north}`}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
            onClick={onEditTarget}
            data-testid="trajectory-edit-target"
          >
            {result.target ? "Edit Target" : "Set Target"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
            onClick={onExportImage}
            data-testid="trajectory-export-image"
          >
            Export Image
          </button>
          <Link
            href={runbookRoutes.surveySettings(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
          >
            Survey Settings
          </Link>
        </div>
      </div>
      <ProjectionStatusChip result={result} />
    </header>
  );
}
