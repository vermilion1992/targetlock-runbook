"use client";

import Link from "next/link";

import type { HoleTrajectoryComparison } from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

import { formatMetresValue } from "./trajectory-format";
import {
  buildPlanToTargetStatus,
  type PlanToTargetStatusView,
} from "./trajectory-status-model";

function PlanStatusChip({ status }: { status: PlanToTargetStatusView }) {
  const tone =
    status.kind === "PLAN_REVIEW_REQUIRED"
      ? "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]"
      : status.kind === "PLAN_WITHIN_TARGET"
        ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)] text-[var(--tl-success)]"
        : "border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-[var(--tl-ink-muted)]";

  return (
    <div
      className={`min-w-[12rem] rounded-[var(--tl-radius-md)] border px-3 py-2 ${tone}`}
      data-testid="trajectory-target-status"
    >
      <p className="text-xs font-bold uppercase tracking-wide">{status.title}</p>
      <p className="mt-1 text-sm tabular-nums leading-snug">{status.detail}</p>
      {status.targetRadiusLabel ? (
        <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
          Target radius {status.targetRadiusLabel}
        </p>
      ) : null}
    </div>
  );
}

export function TrajectoryCockpitHeader({
  holeId,
  comparison,
  onExportCsv,
}: {
  holeId: string;
  comparison: HoleTrajectoryComparison;
  onExportCsv: () => void;
}) {
  const current = comparison.currentTrackingPoint;
  const planStatus = buildPlanToTargetStatus(comparison);
  const coordinateMode =
    comparison.planned?.coordinateMode ??
    comparison.actual?.coordinateMode ??
    "—";
  const surveyCount = comparison.trackingPoints.length;

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tl-ink-muted)]">
          {holeId} / TRAJECTORY
        </p>
        <h1
          className="text-2xl font-semibold tracking-tight"
          data-testid="active-plan-name"
        >
          {comparison.activePlanName ?? "Trajectory"}
        </h1>
        <p className="text-sm text-[var(--tl-ink-muted)]">
          {coordinateMode === "RELATIVE"
            ? "Relative coordinates"
            : "Mine-grid coordinates"}
          {current
            ? ` · Latest Survey ${formatMetresValue(current.measuredDepthM)}`
            : ""}
          {` · ${surveyCount} selected Survey${surveyCount === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={runbookRoutes.trajectoryPlan(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
          >
            Plan
          </Link>
          <Link
            href={runbookRoutes.trajectorySetup(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
          >
            Setup
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
            onClick={onExportCsv}
          >
            Export
          </button>
        </div>
      </div>
      <PlanStatusChip status={planStatus} />
    </header>
  );
}
