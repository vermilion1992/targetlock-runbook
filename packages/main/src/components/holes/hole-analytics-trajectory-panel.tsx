"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { CollapsibleFieldSection } from "@/components/shifts/collapsible-field-section";
import type { HoleTrajectoryComparison } from "@/domain";
import { formatMetresValue } from "@/components/trajectory/trajectory-format";

export function HoleAnalyticsTrajectoryPanel({ holeId }: { holeId: string }) {
  const [comparison, setComparison] = useState<HoleTrajectoryComparison | null>(
    null,
  );

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (!services?.trajectoryComparison) return;
    void services.trajectoryComparison.getComparison(holeId).then(setComparison);
  }, [holeId]);

  if (!comparison) {
    return (
      <CollapsibleFieldSection
        title="Trajectory"
        description="Latest path and target-position measures."
      >
        <p
          className="text-sm text-[var(--tl-ink-muted)]"
          data-testid="hole-analytics-trajectory"
        >
          Trajectory comparison is not available yet.
        </p>
      </CollapsibleFieldSection>
    );
  }

  const current = comparison.currentTrackingPoint;

  return (
    <CollapsibleFieldSection
      title="Trajectory"
      description="Latest path and target-position measures."
    >
      <div
        className="space-y-3"
        data-testid="hole-analytics-trajectory"
      >
        <p className="text-sm text-[var(--tl-ink-muted)]">
          Planned {comparison.planned ? "available" : "not configured"} · Actual{" "}
          {comparison.actual ? "available" : "not configured"}
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3">
            <dt className="text-[var(--tl-ink-muted)]">Latest Survey MD</dt>
            <dd className="mt-1 font-bold">
              {current ? formatMetresValue(current.measuredDepthM) : "—"}
            </dd>
          </div>
          <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3">
            <dt className="text-[var(--tl-ink-muted)]">Spatial deviation</dt>
            <dd className="mt-1 font-bold">
              {current ? formatMetresValue(current.spatialDeviationM) : "—"}
            </dd>
          </div>
          <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3">
            <dt className="text-[var(--tl-ink-muted)]">Distance to target</dt>
            <dd className="mt-1 font-bold">
              {comparison.targetTracking
                ? formatMetresValue(
                    comparison.targetTracking.actualEndpointDistanceM,
                  )
                : "—"}
            </dd>
          </div>
          <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3">
            <dt className="text-[var(--tl-ink-muted)]">Warnings</dt>
            <dd className="mt-1 font-bold">{comparison.warnings.length}</dd>
          </div>
        </dl>
        <Link
          href={runbookRoutes.trajectory(holeId)}
          className="inline-flex min-h-11 items-center font-semibold text-[var(--tl-primary)]"
        >
          View trajectory
        </Link>
      </div>
    </CollapsibleFieldSection>
  );
}
