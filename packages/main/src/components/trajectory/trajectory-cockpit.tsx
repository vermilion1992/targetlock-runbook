"use client";

import dynamic from "next/dynamic";
import { PanelsTopLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildFieldTrajectoryViewModel,
  type HoleTrajectoryComparison,
  type MiniTargetLockResult,
} from "@/domain";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { exportTrajectoryPng } from "@/infrastructure/trajectory";

import { TrajectoryCollarCoordinatesDialog } from "./trajectory-collar-coordinates-dialog";
import { TrajectoryCockpitHeader } from "./trajectory-cockpit-header";
import { TrajectoryFieldDetails } from "./trajectory-field-details";
import { TrajectoryMetricStrip } from "./trajectory-metric-strip";
import { TrajectorySetTargetDialog } from "./trajectory-set-target-dialog";
import { TrajectoryWorkspace } from "./trajectory-workspace";

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

function targetDialogProps(result: MiniTargetLockResult) {
  const endpoint = result.curvedSolution?.endpoint;
  const residual = result.curvedSolution?.targetAttitudeResidual;
  return {
    initial: result.target
      ? {
          measuredDepthM: result.target.measuredDepthM,
          eastingM: result.target.eastingM,
          northingM: result.target.northingM,
          rlM: result.target.rlM,
          diameterM: result.target.diameterM,
          attitudeMode: result.target.attitudeMode,
          desiredDipDegrees: result.target.desiredDipDegrees,
          desiredAzimuthDegrees: result.target.desiredAzimuthDegrees,
          desiredNorthReference: result.target.desiredNorthReference,
        }
      : undefined,
    calculatedEntry: endpoint
      ? {
          dipDegrees: endpoint.dipDegrees,
          azimuthDegrees: endpoint.azimuthDegrees,
          northReference: result.calculationNorthReference,
          residualDipDegrees: residual?.dipDegrees,
          residualAzimuthDegrees: residual?.azimuthDegrees,
        }
      : undefined,
  };
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
  const [targetOpen, setTargetOpen] = useState(false);
  const [collarOpen, setCollarOpen] = useState(false);
  const [useCanvas3d, setUseCanvas3d] = useState(() => !supportsWebGL());
  const [showPlanSection, setShowPlanSection] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(
    result.latestSurvey?.sourceId ?? null,
  );

  const missingCollar =
    result.blocked && result.blockCode === "MISSING_COLLAR_COORDINATES";

  function handleExportImage() {
    void exportTrajectoryPng({
      model,
      viewMode: "VIEW_3D",
      verticalScaleMode: "EQUAL",
    }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${holeId}-trajectory.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  if (missingCollar) {
    return (
      <div className="space-y-4" data-testid="trajectory-cockpit">
        <TrajectoryCockpitHeader
          holeId={holeId}
          result={result}
          onExportImage={handleExportImage}
          onEditTarget={() => setTargetOpen(true)}
        />
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
        <TrajectorySetTargetDialog
          holeId={holeId}
          open={targetOpen}
          onClose={() => setTargetOpen(false)}
          onSaved={onReload}
          {...targetDialogProps(result)}
        />
      </div>
    );
  }

  if (result.blocked) {
    return (
      <div className="space-y-3" data-testid="trajectory-cockpit">
        <TrajectoryCockpitHeader
          holeId={holeId}
          result={result}
          onExportImage={handleExportImage}
          onEditTarget={() => setTargetOpen(true)}
        />
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
        <TrajectorySetTargetDialog
          holeId={holeId}
          open={targetOpen}
          onClose={() => setTargetOpen(false)}
          onSaved={onReload}
          {...targetDialogProps(result)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="trajectory-cockpit">
      <TrajectoryCockpitHeader
        holeId={holeId}
        result={result}
        onExportImage={handleExportImage}
        onEditTarget={() => setTargetOpen(true)}
      />

      <TrajectoryMetricStrip result={result} />

      <section className="space-y-3" aria-label="Trajectory visualisation">
        {!useCanvas3d ? (
          <div className="space-y-3">
            <TrajectoryR3FViewer model={model} />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 text-xs font-bold text-[var(--tl-ink)]"
                onClick={() => setShowPlanSection((value) => !value)}
                data-testid="trajectory-toggle-plan-section"
              >
                <PanelsTopLeft aria-hidden className="size-4 text-[var(--tl-primary)]" />
                {showPlanSection
                  ? "Hide technical canvas"
                  : "Open technical canvas"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--tl-radius-sm)] px-3 text-xs font-bold text-[var(--tl-ink-muted)]"
                onClick={() => setUseCanvas3d(true)}
              >
                <RefreshCcw aria-hidden className="size-4" />
                Compatibility view
              </button>
            </div>
          </div>
        ) : null}
        {useCanvas3d || showPlanSection ? (
          <TrajectoryWorkspace
            model={model}
            comparison={
              comparison ??
              ({
                holeId,
                planned: null,
                actual: result.actualTrajectory,
                trackingPoints: [],
                warnings: [...result.warnings],
                sourceVersions: [...result.sourceVersions],
                blocked: false,
                toleranceConfigured: false,
              } satisfies HoleTrajectoryComparison)
            }
            selectedSurveyId={selectedSurveyId}
            onSelectSurveyId={setSelectedSurveyId}
          />
        ) : null}
      </section>

      <TrajectoryFieldDetails result={result} holeId={holeId} />

      <TrajectorySetTargetDialog
        holeId={holeId}
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        onSaved={onReload}
        {...targetDialogProps(result)}
      />
      <TrajectoryCollarCoordinatesDialog
        holeId={holeId}
        open={collarOpen}
        onClose={() => setCollarOpen(false)}
        onSaved={onReload}
      />
    </div>
  );
}
