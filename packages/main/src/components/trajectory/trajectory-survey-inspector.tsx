"use client";

import type { TrajectoryTrackingPoint } from "@/domain";

import {
  formatAzimuthDifferenceNarrative,
  formatCoordinate,
  formatDegrees,
  formatDeviationNarrative,
  formatDipDifferenceNarrative,
  formatMetresValue,
  formatSignedMetres,
} from "./trajectory-format";
import { mapTrackingStatusLabel } from "./trajectory-status-model";

export function TrajectorySurveyInspector({
  point,
  toleranceConfigured,
  trackingPoints,
  selectedSurveyId,
  onSelectSurveyId,
}: {
  point?: TrajectoryTrackingPoint | null;
  toleranceConfigured: boolean;
  trackingPoints: readonly TrajectoryTrackingPoint[];
  selectedSurveyId: string | null;
  onSelectSurveyId: (id: string | null) => void;
}) {
  const index = point
    ? trackingPoints.findIndex((p) => p.actualSurveyId === point.actualSurveyId)
    : -1;

  function selectRelative(delta: number) {
    if (trackingPoints.length === 0) return;
    const nextIndex =
      index < 0
        ? delta > 0
          ? 0
          : trackingPoints.length - 1
        : Math.min(
            trackingPoints.length - 1,
            Math.max(0, index + delta),
          );
    onSelectSurveyId(trackingPoints[nextIndex]!.actualSurveyId);
  }

  return (
    <aside
      className="flex h-full min-h-0 flex-col rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]"
      data-testid="trajectory-inspection-callout"
    >
      <div className="border-b border-[var(--tl-border)] px-4 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
          Selected Survey
        </p>
        <p
          className="mt-1 text-2xl font-semibold tabular-nums"
          data-testid="trajectory-current-tracking-callout"
        >
          {point ? formatMetresValue(point.measuredDepthM) : "—"}
        </p>
        {point ? (
          <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
            {mapTrackingStatusLabel(
              point.status,
              toleranceConfigured,
              point.spatialDeviationM,
            )}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="survey-inspect">
            Inspect Survey
          </label>
          <select
            id="survey-inspect"
            className="min-h-11 min-w-0 flex-1 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-transparent px-3 text-sm"
            value={selectedSurveyId ?? ""}
            onChange={(event) =>
              onSelectSurveyId(event.target.value || null)
            }
          >
            <option value="">Latest tracking</option>
            {trackingPoints.map((row) => (
              <option key={row.actualSurveyId} value={row.actualSurveyId}>
                {row.measuredDepthM.toFixed(1)} m
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 text-sm font-semibold"
            onClick={() => selectRelative(-1)}
            disabled={index <= 0}
          >
            Prev
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 text-sm font-semibold"
            onClick={() => selectRelative(1)}
            disabled={index < 0 || index >= trackingPoints.length - 1}
          >
            Next
          </button>
        </div>
      </div>

      {!point ? (
        <p className="p-4 text-sm text-[var(--tl-ink-muted)]">
          No Survey tracking point available.
        </p>
      ) : (
        <div className="space-y-4 overflow-y-auto p-4 text-sm">
          <section className="space-y-2">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
              Actual
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-[var(--tl-ink-muted)]">Dip</dt>
              <dd className="text-right font-medium">
                {formatDegrees(point.actualDipDegrees)}
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Azimuth</dt>
              <dd className="text-right font-medium">
                {formatDegrees(point.actualAzimuthDegrees)} Grid
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Easting</dt>
              <dd className="text-right font-medium">
                {formatCoordinate(point.actualPosition.eastingM)} m
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Northing</dt>
              <dd className="text-right font-medium">
                {formatCoordinate(point.actualPosition.northingM)} m
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">RL</dt>
              <dd className="text-right font-medium">
                {formatCoordinate(point.actualPosition.rlM)} m
              </dd>
            </dl>
          </section>

          <section className="space-y-2 border-t border-[var(--tl-border)] pt-4">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
              Difference from plan
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-[var(--tl-ink-muted)]">East</dt>
              <dd className="text-right text-base font-semibold">
                {formatSignedMetres(point.deltaEastingM)}
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">North</dt>
              <dd className="text-right text-base font-semibold">
                {formatSignedMetres(point.deltaNorthingM)}
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Vertical</dt>
              <dd className="text-right text-base font-semibold">
                {formatSignedMetres(point.deltaRlM)}
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Horizontal</dt>
              <dd className="text-right font-medium">
                {formatMetresValue(point.horizontalDeviationM)}
              </dd>
              <dt className="text-[var(--tl-ink-muted)]">Spatial</dt>
              <dd className="text-right text-base font-semibold">
                {formatMetresValue(point.spatialDeviationM)}
              </dd>
            </dl>
            <p className="text-xs leading-relaxed text-[var(--tl-ink-muted)]">
              {formatDeviationNarrative(point)}
            </p>
          </section>

          <section className="space-y-2 border-t border-[var(--tl-border)] pt-4">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
              Attitude
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="text-[var(--tl-ink-muted)]">
                    <th className="py-1 pr-2 font-medium"> </th>
                    <th className="py-1 pr-2 font-medium">Planned</th>
                    <th className="py-1 pr-2 font-medium">Actual</th>
                    <th className="py-1 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 pr-2 text-[var(--tl-ink-muted)]">Dip</td>
                    <td className="py-1 pr-2">
                      {formatDegrees(point.plannedDipDegrees)}
                    </td>
                    <td className="py-1 pr-2 font-medium">
                      {formatDegrees(point.actualDipDegrees)}
                    </td>
                    <td className="py-1">
                      {formatDipDifferenceNarrative(point.dipDifferenceDegrees)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 text-[var(--tl-ink-muted)]">
                      Azimuth
                    </td>
                    <td className="py-1 pr-2">
                      {formatDegrees(point.plannedAzimuthDegrees)}
                    </td>
                    <td className="py-1 pr-2 font-medium">
                      {formatDegrees(point.actualAzimuthDegrees)}
                    </td>
                    <td className="py-1">
                      {formatAzimuthDifferenceNarrative(
                        point.circularAzimuthDifferenceDegrees,
                        point.plannedAzimuthDegrees,
                        point.actualAzimuthDegrees,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
