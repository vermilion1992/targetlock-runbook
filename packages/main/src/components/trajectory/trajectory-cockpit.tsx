"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildFieldTrajectoryViewModel,
  type HoleTrajectoryComparison,
  type MiniTargetLockResult,
} from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

import { TrajectoryCollarCoordinatesDialog } from "./trajectory-collar-coordinates-dialog";
import { TrajectoryCockpitHeader } from "./trajectory-cockpit-header";
import { TrajectoryFieldDetails } from "./trajectory-field-details";
import { TrajectoryMetricStrip } from "./trajectory-metric-strip";

const TrajectoryR3FViewer = dynamic(
  () =>
    import("./trajectory-r3f-viewer").then((mod) => mod.TrajectoryR3FViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[28rem] items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-sm text-[var(--tl-ink-muted)]">
        Loading 3D viewer…
      </div>
    ),
  },
);

function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function TrajectoryCockpit({
  holeId,
  result,
  comparison,
  onReload,
}: {
  holeId: string;
  result: MiniTargetLockResult;
  comparison?: HoleTrajectoryComparison | null;
  onReload: () => void;
}) {
  const model = useMemo(
    () => buildFieldTrajectoryViewModel(result, comparison),
    [comparison, result],
  );
  const [collarOpen, setCollarOpen] = useState(false);
  const [useCanvasFallback] = useState(() => !supportsWebGL());

  const missingCollar =
    result.blocked && result.blockCode === "MISSING_COLLAR_COORDINATES";

  if (missingCollar) {
    return (
      <div className="space-y-4" data-testid="trajectory-cockpit">
        <TrajectoryCockpitHeader holeId={holeId} result={result} />
        <div
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-6 py-12 text-center"
          data-testid="trajectory-collar-empty-state"
        >
          <h2 className="text-xl font-semibold text-[var(--tl-ink)]">
            Collar coordinates required
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--tl-ink-muted)]">
            Add collar Easting, Northing and RL to calculate the spatial
            trajectory and target guidance.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 text-sm font-semibold uppercase tracking-wide text-white"
              onClick={() => setCollarOpen(true)}
            >
              Add collar coordinates
            </button>
            <Link
              href={runbookRoutes.surveySettings(holeId, {
                returnTo: runbookRoutes.trajectory(holeId),
              })}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold uppercase tracking-wide"
            >
              Open Survey Settings
            </Link>
          </div>
        </div>
        <TrajectoryCollarCoordinatesDialog
          holeId={holeId}
          open={collarOpen}
          onClose={() => setCollarOpen(false)}
          onSaved={onReload}
        />
      </div>
    );
  }

  if (result.blocked) {
    return (
      <div className="space-y-3" data-testid="trajectory-cockpit">
        <TrajectoryCockpitHeader holeId={holeId} result={result} />
        <p role="alert" className="text-sm text-[var(--tl-danger)]">
          {result.blockReason ?? "Trajectory calculation is blocked."}
        </p>
        {result.blockCode === "MISSING_ACTUAL_CONFIGURATION" ? (
          <Link
            href={runbookRoutes.surveySettings(holeId, {
              returnTo: runbookRoutes.trajectory(holeId),
            })}
            className="inline-flex text-sm font-semibold text-[var(--tl-primary)]"
          >
            Open Survey Settings
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="trajectory-cockpit">
      <TrajectoryCockpitHeader holeId={holeId} result={result} />

      <TrajectoryMetricStrip result={result} />

      <section className="space-y-3" aria-label="Trajectory visualisation">
        {useCanvasFallback ? (
          <div
            className="flex h-[28rem] items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-sm text-[var(--tl-ink-muted)]"
            data-testid="trajectory-webgl-fallback"
          >
            3D viewer unavailable on this device. Guidance metrics above remain
            available.
          </div>
        ) : (
          <TrajectoryR3FViewer model={model} />
        )}
      </section>

      <TrajectoryFieldDetails result={result} holeId={holeId} />

      <TrajectoryCollarCoordinatesDialog
        holeId={holeId}
        open={collarOpen}
        onClose={() => setCollarOpen(false)}
        onSaved={onReload}
      />
    </div>
  );
}
