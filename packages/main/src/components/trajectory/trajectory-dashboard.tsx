"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  buildTrajectoryViewModel,
  type HoleTrajectoryComparison,
} from "@/domain";

import { TrajectoryGraphicsViewer } from "./trajectory-3d-viewer";
import {
  formatStationCoordinateRow,
  TrajectoryAzimuthTrend,
  TrajectoryDipTrend,
  TrajectoryLegendNote,
  TrajectoryPlanView,
  TrajectoryVerticalSection,
} from "./trajectory-charts";
import {
  formatCoordinate,
  formatDegrees,
  formatEastOfPlan,
  formatMetresValue,
  formatNorthOfPlan,
  formatSignedMetres,
  formatVerticalOfPlan,
} from "./trajectory-format";

export function TrajectoryDashboard({ holeId }: { holeId: string }) {
  const [comparison, setComparison] = useState<HoleTrajectoryComparison | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (active) {
          setMessage("Browser storage is unavailable.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
    void services.trajectoryComparison
      .getComparison(holeId)
      .then((next) => {
        if (!active) return;
        setComparison(next);
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load trajectory comparison.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [holeId]);

  function exportTrackingCsv() {
    if (!comparison) return;
    const headers = [
      "MD_m",
      "Planned_E",
      "Actual_E",
      "Delta_E",
      "Planned_N",
      "Actual_N",
      "Delta_N",
      "Planned_RL",
      "Actual_RL",
      "Delta_RL",
      "Horizontal_m",
      "Spatial_m",
      "Planned_dip",
      "Actual_dip",
      "Dip_diff",
      "Planned_az",
      "Actual_az",
      "Az_diff",
      "Status",
    ];
    const rows = comparison.trackingPoints.map((point) =>
      [
        point.measuredDepthM.toFixed(1),
        point.plannedPosition.eastingM.toFixed(1),
        point.actualPosition.eastingM.toFixed(1),
        point.deltaEastingM.toFixed(1),
        point.plannedPosition.northingM.toFixed(1),
        point.actualPosition.northingM.toFixed(1),
        point.deltaNorthingM.toFixed(1),
        point.plannedPosition.rlM.toFixed(1),
        point.actualPosition.rlM.toFixed(1),
        point.deltaRlM.toFixed(1),
        point.horizontalDeviationM.toFixed(1),
        point.spatialDeviationM.toFixed(1),
        point.plannedDipDegrees.toFixed(1),
        point.actualDipDegrees.toFixed(1),
        point.dipDifferenceDegrees.toFixed(1),
        point.plannedAzimuthDegrees.toFixed(1),
        point.actualAzimuthDegrees.toFixed(1),
        point.circularAzimuthDifferenceDegrees.toFixed(1),
        point.status,
      ].join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${holeId}-trajectory-tracking.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const current = comparison?.currentTrackingPoint;
  const target = comparison?.targetTracking;

  return (
    <div className="space-y-4" data-testid="trajectory-dashboard">
      <StagePageHeader
        eyebrow="Trajectory"
        title="Planned versus actual trajectory"
        description="Minimum-curvature planned and surveyed paths with same-depth tracking and target status."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={runbookRoutes.trajectoryPlan(holeId)}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
            >
              Plan
            </Link>
            <Link
              href={runbookRoutes.trajectorySetup(holeId)}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
            >
              Setup
            </Link>
          </div>
        }
      />

      {loading ? <p className="text-sm">Loading trajectory…</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-[var(--tl-danger, #b91c1c)]">
          {message}
        </p>
      ) : null}

      {comparison ? (
        <>
          <TrajectoryLegendNote />

          {!comparison.blocked ? (
            <TrajectoryGraphicsViewer
              model={buildTrajectoryViewModel(comparison)}
            />
          ) : null}

          <section
            className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            data-testid="current-trajectory-tracking"
          >
            <h2 className="text-lg font-semibold">Current trajectory tracking</h2>
            {comparison.planned ? (
              <p className="text-sm" data-testid="active-plan-name">
                Active plan:{" "}
                <strong>
                  {comparison.activePlanName ?? "Configured plan"}
                </strong>
                {" · "}
                Coordinate mode {comparison.planned.coordinateMode}
                {" · "}
                Engine {comparison.planned.engineVersion}
              </p>
            ) : null}
            {comparison.blocked ? (
              <p role="alert" className="text-sm">
                Calculation blocked: {comparison.blockReason}
              </p>
            ) : null}
            {current ? (
              <div className="space-y-1 text-sm">
                <p>Survey depth {formatMetresValue(current.measuredDepthM)}</p>
                <p>
                  Planned position — E {formatCoordinate(current.plannedPosition.eastingM)},
                  N {formatCoordinate(current.plannedPosition.northingM)}, RL{" "}
                  {formatCoordinate(current.plannedPosition.rlM)}
                </p>
                <p>
                  Actual surveyed position — E{" "}
                  {formatCoordinate(current.actualPosition.eastingM)}, N{" "}
                  {formatCoordinate(current.actualPosition.northingM)}, RL{" "}
                  {formatCoordinate(current.actualPosition.rlM)}
                </p>
                <p>
                  Difference from plan — East {formatSignedMetres(current.deltaEastingM)},
                  North {formatSignedMetres(current.deltaNorthingM)}, Vertical{" "}
                  {formatSignedMetres(current.deltaRlM)}
                </p>
                <p>
                  {formatEastOfPlan(current.deltaEastingM)};{" "}
                  {formatNorthOfPlan(current.deltaNorthingM)};{" "}
                  {formatVerticalOfPlan(current.deltaRlM)}
                </p>
                <p>
                  Horizontal deviation {formatMetresValue(current.horizontalDeviationM)}
                </p>
                <p>3D deviation {formatMetresValue(current.spatialDeviationM)}</p>
                <p>
                  Dip planned {formatDegrees(current.plannedDipDegrees)}, actual{" "}
                  {formatDegrees(current.actualDipDegrees)}, difference{" "}
                  {formatDegrees(current.dipDifferenceDegrees)}
                </p>
                <p>
                  Azimuth planned {formatDegrees(current.plannedAzimuthDegrees)},
                  actual {formatDegrees(current.actualAzimuthDegrees)}, difference{" "}
                  {formatDegrees(current.circularAzimuthDifferenceDegrees)}
                </p>
              </div>
            ) : (
              <p className="text-sm">No current tracking point available.</p>
            )}
          </section>

          <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
            <h2 className="mb-2 text-lg font-semibold">Plan view</h2>
            <TrajectoryPlanView comparison={comparison} />
          </section>

          <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
            <h2 className="mb-2 text-lg font-semibold">Vertical section</h2>
            <TrajectoryVerticalSection comparison={comparison} />
          </section>

          <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
            <h2 className="mb-2 text-lg font-semibold">Dip trend</h2>
            <TrajectoryDipTrend comparison={comparison} />
          </section>

          <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
            <h2 className="mb-2 text-lg font-semibold">Azimuth trend</h2>
            <TrajectoryAzimuthTrend comparison={comparison} />
          </section>

          <section
            className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            data-testid="trajectory-tracking-table"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Tracking by Survey</h2>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
                onClick={exportTrackingCsv}
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">MD</th>
                    <th className="p-2">Planned E</th>
                    <th className="p-2">Actual E</th>
                    <th className="p-2">ΔE</th>
                    <th className="p-2">Planned N</th>
                    <th className="p-2">Actual N</th>
                    <th className="p-2">ΔN</th>
                    <th className="p-2">Planned RL</th>
                    <th className="p-2">Actual RL</th>
                    <th className="p-2">3D</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.trackingPoints.map((point) => (
                    <tr
                      key={point.actualSurveyId}
                      className="border-t border-[var(--tl-border)]"
                    >
                      <td className="p-2">
                        {formatMetresValue(point.measuredDepthM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.plannedPosition.eastingM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.actualPosition.eastingM)}
                      </td>
                      <td className="p-2">
                        {formatSignedMetres(point.deltaEastingM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.plannedPosition.northingM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.actualPosition.northingM)}
                      </td>
                      <td className="p-2">
                        {formatSignedMetres(point.deltaNorthingM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.plannedPosition.rlM)}
                      </td>
                      <td className="p-2">
                        {formatCoordinate(point.actualPosition.rlM)}
                      </td>
                      <td className="p-2">
                        {formatMetresValue(point.spatialDeviationM)}
                      </td>
                      <td className="p-2">{point.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            data-testid="trajectory-target-status"
          >
            <h2 className="text-lg font-semibold">Target status</h2>
            {target ? (
              <div className="space-y-1 text-sm">
                <p>
                  Target E {formatCoordinate(target.targetEastingM)}, N{" "}
                  {formatCoordinate(target.targetNorthingM)}, RL{" "}
                  {formatCoordinate(target.targetRlM)}
                  {target.targetRadiusM !== undefined
                    ? `, radius ${formatMetresValue(target.targetRadiusM)}`
                    : ""}
                </p>
                <p>
                  Planned endpoint distance to target{" "}
                  {formatMetresValue(target.plannedEndpointDistanceM)}
                  {target.plannedWithinTargetRadius === undefined
                    ? ""
                    : target.plannedWithinTargetRadius
                      ? " — inside target radius"
                      : " — outside target radius"}
                </p>
                <p>
                  Actual endpoint distance to target{" "}
                  {formatMetresValue(target.actualEndpointDistanceM)}
                </p>
                <p>
                  Planned closest approach{" "}
                  {formatMetresValue(target.plannedClosestApproachM)} at{" "}
                  {formatMetresValue(
                    target.plannedClosestApproachMeasuredDepthM,
                  )}
                </p>
                <p>
                  Actual closest approach{" "}
                  {formatMetresValue(target.actualClosestApproachM)} at{" "}
                  {formatMetresValue(
                    target.actualClosestApproachMeasuredDepthM,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm">No target coordinates supplied.</p>
            )}
          </section>

          <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
            <h2 className="text-lg font-semibold">Coordinate tables</h2>
            <h3 className="font-medium">Planned stations</h3>
            <StationTable stations={comparison.planned?.stations ?? []} />
            <h3 className="font-medium">Actual Survey stations</h3>
            <StationTable stations={comparison.actual?.stations ?? []} />
          </section>

          <section
            className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            data-testid="trajectory-warnings"
          >
            <h2 className="text-lg font-semibold">Warnings and source information</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {comparison.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>
                  <strong>{warning.severity}</strong>: {warning.message}
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--tl-ink-muted)]">
              Engine {comparison.planned?.engineVersion ??
                comparison.actual?.engineVersion ??
                "minimum-curvature-v1"}
              . Source versions: {comparison.sourceVersions.length}.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StationTable({
  stations,
}: {
  stations: readonly {
    measuredDepthM: number;
    dipDegrees: number;
    azimuthDegrees: number;
    eastingM: number;
    northingM: number;
    rlM: number;
    tvdM: number;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr>
            <th className="p-2">MD</th>
            <th className="p-2">Dip</th>
            <th className="p-2">Azimuth</th>
            <th className="p-2">E</th>
            <th className="p-2">N</th>
            <th className="p-2">RL</th>
            <th className="p-2">TVD</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => {
            const row = formatStationCoordinateRow(station);
            return (
              <tr
                key={`${row.md}-${row.dip}-${row.az}`}
                className="border-t border-[var(--tl-border)]"
              >
                <td className="p-2">{row.md}</td>
                <td className="p-2">{row.dip}</td>
                <td className="p-2">{row.az}</td>
                <td className="p-2">{row.e}</td>
                <td className="p-2">{row.n}</td>
                <td className="p-2">{row.rl}</td>
                <td className="p-2">{row.tvd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
