"use client";

import { Crosshair, Target } from "lucide-react";

import type { MiniTargetLockResult } from "@/domain";

import { formatMetresValue } from "./trajectory-format";

function ProjectionStatusChip({ result }: { result: MiniTargetLockResult }) {
  if (!result.projection || !result.target) {
    return (
      <div className="inline-flex items-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-3 py-2">
        <Target aria-hidden className="size-4 text-[var(--tl-ink-muted)]" />
        <p className="text-sm font-bold">No target configured</p>
      </div>
    );
  }
  const intersects = result.projection.intersectsTarget;
  const tone = intersects
    ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)] text-[var(--tl-success)]"
    : "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]";
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[var(--tl-radius-md)] border px-3 py-2 ${tone}`}
      data-testid="trajectory-target-status"
    >
      <Crosshair aria-hidden className="size-4" />
      <div>
        <p className="text-sm font-bold">
          {intersects
            ? "Projected to intersect target"
            : "Projected to miss target"}
        </p>
        <p className="text-[0.68rem] font-semibold opacity-80">
          Hold miss{" "}
          {formatMetresValue(result.projection.endpointMissOutsideTargetM)} ·
          radius {(result.target.diameterM / 2).toFixed(1)} m
        </p>
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
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
          {result.target?.measuredDepthM !== undefined
            ? ` · Target MD ${formatMetresValue(result.target.measuredDepthM)}`
            : ""}
          {` · ${north}`}
        </p>
      </div>
      <div className="flex flex-col items-start gap-3 lg:items-end">
        <ProjectionStatusChip result={result} />
      </div>
    </header>
  );
}
