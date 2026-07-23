"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { HoleTrajectoryComparison } from "@/domain";
import {
  formatMetresValue,
  formatSignedMetres,
} from "@/components/trajectory/trajectory-format";

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
      <section
        className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
        data-testid="hole-analytics-trajectory"
      >
        <h2 className="text-lg font-semibold">Trajectory</h2>
        <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
          Trajectory comparison is not available yet.
        </p>
      </section>
    );
  }

  const current = comparison.currentTrackingPoint;
  const planned = comparison.planned;
  const actual = comparison.actual;

  return (
    <section
      className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
      data-testid="hole-analytics-trajectory"
    >
      <h2 className="text-lg font-semibold">Trajectory</h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Planned trajectory</dt>
          <dd>{planned ? "Available" : "Not configured"}</dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Actual trajectory</dt>
          <dd>{actual ? "Available" : "Not configured"}</dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Coordinate mode</dt>
          <dd>
            {planned?.coordinateMode ?? actual?.coordinateMode ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Latest Survey MD</dt>
          <dd>
            {current
              ? formatMetresValue(current.measuredDepthM)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Horizontal deviation</dt>
          <dd>
            {current
              ? formatMetresValue(current.horizontalDeviationM)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Vertical deviation</dt>
          <dd>
            {current ? formatSignedMetres(current.verticalDeviationM) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Spatial deviation</dt>
          <dd>
            {current ? formatMetresValue(current.spatialDeviationM) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Distance to target</dt>
          <dd>
            {comparison.targetTracking
              ? formatMetresValue(
                  comparison.targetTracking.actualEndpointDistanceM,
                )
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Closest approach</dt>
          <dd>
            {comparison.targetTracking
              ? formatMetresValue(
                  comparison.targetTracking.actualClosestApproachM,
                )
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Selected Survey count</dt>
          <dd>{comparison.trackingPoints.length}</dd>
        </div>
        <div>
          <dt className="text-[var(--tl-ink-muted)]">Warning count</dt>
          <dd>{comparison.warnings.length}</dd>
        </div>
      </dl>
      <Link
        href={runbookRoutes.trajectory(holeId)}
        className="inline-flex min-h-11 items-center font-semibold text-[var(--tl-primary)]"
      >
        View trajectory
      </Link>
    </section>
  );
}
