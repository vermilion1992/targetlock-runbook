"use client";

import { Fragment, useState } from "react";

import type { HoleTrajectoryComparison } from "@/domain";

import { formatStationCoordinateRow } from "./trajectory-charts";
import {
  formatCoordinate,
  formatDegrees,
  formatMetresValue,
  formatSignedMetres,
} from "./trajectory-format";
import { mapTrackingStatusLabel } from "./trajectory-status-model";

type DetailTab = "TRACKING" | "COORDINATES" | "TECHNICAL";

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
      <table className="min-w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="text-[var(--tl-ink-muted)]">
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

export function TrajectoryDetailTabs({
  comparison,
  onExportCsv,
}: {
  comparison: HoleTrajectoryComparison;
  onExportCsv: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("TRACKING");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "TRACKING", label: "Survey tracking" },
    { id: "COORDINATES", label: "Coordinates" },
    { id: "TECHNICAL", label: "Technical details" },
  ];

  return (
    <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tl-border)] px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] px-3 text-sm font-semibold ${
                tab === item.id
                  ? "bg-[var(--tl-primary)] text-white"
                  : "border border-[var(--tl-border)]"
              }`}
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === "TRACKING" ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
            onClick={onExportCsv}
          >
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="p-3">
        {tab === "TRACKING" ? (
          <div
            className="overflow-x-auto"
            data-testid="trajectory-tracking-table"
          >
            <table className="min-w-full text-left text-sm tabular-nums">
              <thead>
                <tr className="text-[var(--tl-ink-muted)]">
                  <th className="p-2">MD</th>
                  <th className="p-2">Horizontal</th>
                  <th className="p-2">Vertical</th>
                  <th className="p-2">3D</th>
                  <th className="p-2">Dip Δ</th>
                  <th className="p-2">Azi Δ</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.trackingPoints.map((point) => {
                  const open = expandedId === point.actualSurveyId;
                  return (
                    <Fragment key={point.actualSurveyId}>
                      <tr className="border-t border-[var(--tl-border)]">
                        <td className="p-2">
                          <button
                            type="button"
                            className="min-h-11 font-semibold underline-offset-2 hover:underline"
                            onClick={() =>
                              setExpandedId(open ? null : point.actualSurveyId)
                            }
                          >
                            {formatMetresValue(point.measuredDepthM)}
                          </button>
                        </td>
                        <td className="p-2">
                          {formatMetresValue(point.horizontalDeviationM)}
                        </td>
                        <td className="p-2">
                          {formatSignedMetres(point.verticalDeviationM)}
                        </td>
                        <td className="p-2">
                          {formatMetresValue(point.spatialDeviationM)}
                        </td>
                        <td className="p-2">
                          {formatDegrees(point.dipDifferenceDegrees)}
                        </td>
                        <td className="p-2">
                          {formatDegrees(
                            point.circularAzimuthDifferenceDegrees,
                          )}
                        </td>
                        <td className="p-2">
                          {mapTrackingStatusLabel(
                            point.status,
                            comparison.toleranceConfigured,
                            point.spatialDeviationM,
                          )}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-t border-[var(--tl-border)] bg-[var(--tl-surface-sunken)]">
                          <td colSpan={7} className="p-3 text-xs">
                            <p>
                              Planned E{" "}
                              {formatCoordinate(
                                point.plannedPosition.eastingM,
                              )}
                              , N{" "}
                              {formatCoordinate(
                                point.plannedPosition.northingM,
                              )}
                              , RL{" "}
                              {formatCoordinate(point.plannedPosition.rlM)}
                            </p>
                            <p>
                              Actual E{" "}
                              {formatCoordinate(point.actualPosition.eastingM)}
                              , N{" "}
                              {formatCoordinate(
                                point.actualPosition.northingM,
                              )}
                              , RL{" "}
                              {formatCoordinate(point.actualPosition.rlM)}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "COORDINATES" ? (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold">Planned stations</h3>
              <StationTable stations={comparison.planned?.stations ?? []} />
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Actual Survey stations</h3>
              <StationTable stations={comparison.actual?.stations ?? []} />
            </div>
          </div>
        ) : null}

        {tab === "TECHNICAL" ? (
          <div className="space-y-2 text-sm text-[var(--tl-ink-muted)]">
            <p>
              Engine{" "}
              <span className="font-medium text-[var(--tl-ink)]">
                {comparison.planned?.engineVersion ??
                  comparison.actual?.engineVersion ??
                  "minimum-curvature-v1"}
              </span>
            </p>
            <p>
              Coordinate mode{" "}
              <span className="font-medium text-[var(--tl-ink)]">
                {comparison.planned?.coordinateMode ??
                  comparison.actual?.coordinateMode ??
                  "—"}
              </span>
            </p>
            <p>
              North reference{" "}
              <span className="font-medium text-[var(--tl-ink)]">
                {comparison.planned?.northReference ??
                  comparison.actual?.northReference ??
                  "—"}
              </span>
            </p>
            <p>
              Tolerance{" "}
              <span className="font-medium text-[var(--tl-ink)]">
                {comparison.toleranceConfigured
                  ? comparison.toleranceSource ?? "configured"
                  : "not configured"}
              </span>
            </p>
            <p>
              Source versions: {comparison.sourceVersions.length}. Exact
              calculation coordinates are preserved from minimum-curvature-v1;
              graphics are for operational review only and are not certified
              anti-collision software.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {comparison.sourceVersions.map((source) => (
                <li key={`${source.entityType}-${source.entityId}`}>
                  {source.entityType} {source.entityId} v{source.version}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
