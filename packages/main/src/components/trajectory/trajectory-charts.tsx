"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  projectOntoSection,
  sectionBearingDegrees,
  type HoleTrajectoryComparison,
} from "@/domain";

import {
  formatCoordinate,
  formatDegrees,
  formatMetresValue,
} from "./trajectory-format";

function unwrapAzimuthSeries(
  points: readonly { md: number; planned?: number; actual?: number }[],
): { md: number; planned?: number; actual?: number }[] {
  let plannedOffset = 0;
  let actualOffset = 0;
  let prevPlanned: number | undefined;
  let prevActual: number | undefined;
  return points.map((point) => {
    let planned = point.planned;
    let actual = point.actual;
    if (planned !== undefined && prevPlanned !== undefined) {
      const delta = planned - prevPlanned;
      if (delta > 180) plannedOffset -= 360;
      if (delta < -180) plannedOffset += 360;
      planned += plannedOffset;
    }
    if (actual !== undefined && prevActual !== undefined) {
      const delta = actual - prevActual;
      if (delta > 180) actualOffset -= 360;
      if (delta < -180) actualOffset += 360;
      actual += actualOffset;
    }
    if (point.planned !== undefined) prevPlanned = point.planned;
    if (point.actual !== undefined) prevActual = point.actual;
    return { md: point.md, planned, actual };
  });
}

export function TrajectoryPlanView({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const planned = comparison.planned?.renderPath.map((point) => ({
    e: point.eastingM,
    n: point.northingM,
    kind: "planned",
  })) ?? [];
  const actual = comparison.actual?.renderPath.map((point) => ({
    e: point.eastingM,
    n: point.northingM,
    kind: "actual",
  })) ?? [];
  const target =
    comparison.targetTracking === undefined
      ? []
      : [
          {
            e: comparison.targetTracking.targetEastingM,
            n: comparison.targetTracking.targetNorthingM,
            kind: "target",
          },
        ];

  const all = [...planned, ...actual, ...target];
  if (all.length === 0) {
    return <p className="text-sm">No plan-view path available.</p>;
  }
  const minE = Math.min(...all.map((p) => p.e));
  const maxE = Math.max(...all.map((p) => p.e));
  const minN = Math.min(...all.map((p) => p.n));
  const maxN = Math.max(...all.map((p) => p.n));
  const span = Math.max(maxE - minE, maxN - minN, 1);

  return (
    <div data-testid="trajectory-plan-view">
      <p className="mb-2 text-sm text-[var(--tl-ink-muted)]">
        Plan view — equal-scale Easting / Northing. Dashed = Planned, Solid =
        Actual. North is up.
      </p>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="e"
              name="Easting"
              domain={[minE - span * 0.1, minE + span * 1.1]}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <YAxis
              type="number"
              dataKey="n"
              name="Northing"
              domain={[minN - span * 0.1, minN + span * 1.1]}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                typeof value === "number" ? value.toFixed(1) : value,
                name,
              ]}
            />
            <Legend />
            <Scatter
              name="Planned (dashed path)"
              data={planned}
              line={{ strokeDasharray: "6 4" }}
              fill="var(--tl-ink-muted)"
              shape="circle"
            />
            <Scatter
              name="Actual (solid path)"
              data={actual}
              line
              fill="var(--tl-primary)"
              shape="circle"
            />
            {target.length > 0 ? (
              <Scatter
                name="Target"
                data={target}
                fill="var(--tl-warning, #b45309)"
                shape="diamond"
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrajectoryVerticalSection({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const originE = comparison.planned?.collar.eastingM ??
    comparison.actual?.collar.eastingM ??
    0;
  const originN = comparison.planned?.collar.northingM ??
    comparison.actual?.collar.northingM ??
    0;

  let bearing: number | null = null;
  let bearingSource = "unavailable";
  if (comparison.targetTracking) {
    bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.targetTracking.targetEastingM,
      toNorthingM: comparison.targetTracking.targetNorthingM,
    });
    bearingSource = "collar-to-target";
  }
  if (bearing === null && comparison.planned) {
    bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.planned.endpoint.eastingM,
      toNorthingM: comparison.planned.endpoint.northingM,
    });
    bearingSource = "planned collar-to-endpoint";
  }
  if (bearing === null && comparison.actual) {
    bearing = sectionBearingDegrees({
      fromEastingM: originE,
      fromNorthingM: originN,
      toEastingM: comparison.actual.endpoint.eastingM,
      toNorthingM: comparison.actual.endpoint.northingM,
    });
    bearingSource = "actual collar-to-endpoint";
  }
  if (bearing === null) {
    return <p className="text-sm">Vertical section bearing unavailable.</p>;
  }

  const project = (eastingM: number, northingM: number, rlM: number) => ({
    section: projectOntoSection({
      eastingM,
      northingM,
      originEastingM: originE,
      originNorthingM: originN,
      bearingDegrees: bearing,
    }),
    rl: rlM,
  });

  const planned =
    comparison.planned?.renderPath.map((point) =>
      project(point.eastingM, point.northingM, point.rlM),
    ) ?? [];
  const actual =
    comparison.actual?.renderPath.map((point) =>
      project(point.eastingM, point.northingM, point.rlM),
    ) ?? [];

  return (
    <div data-testid="trajectory-vertical-section">
      <p className="mb-2 text-sm text-[var(--tl-ink-muted)]">
        Vertical section bearing {formatDegrees(bearing)} (
        {comparison.planned?.northReference ?? "GRID"}) — source: {bearingSource}.
        This is a section view, not an unoriented side view.
      </p>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="section"
              name="Section distance"
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <YAxis
              type="number"
              dataKey="rl"
              name="RL"
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <Tooltip />
            <Legend />
            <Scatter
              name="Planned (dashed)"
              data={planned}
              line={{ strokeDasharray: "6 4" }}
              fill="var(--tl-ink-muted)"
            />
            <Scatter
              name="Actual (solid)"
              data={actual}
              line
              fill="var(--tl-primary)"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrajectoryDipTrend({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const planned =
    comparison.planned?.renderPath.map((point) => ({
      md: point.measuredDepthM,
      planned: point.dipDegrees,
    })) ?? [];
  const actual =
    comparison.actual?.stations.map((point) => ({
      md: point.measuredDepthM,
      actual: point.dipDegrees,
    })) ?? [];
  const mdSet = new Map<number, { md: number; planned?: number; actual?: number }>();
  for (const point of planned) {
    mdSet.set(point.md, { ...mdSet.get(point.md), ...point });
  }
  for (const point of actual) {
    mdSet.set(point.md, { ...mdSet.get(point.md), ...point });
  }
  const data = [...mdSet.values()].sort((a, b) => a.md - b.md);
  const current = comparison.currentTrackingPoint;

  return (
    <div data-testid="trajectory-dip-trend">
      {current ? (
        <p className="mb-2 text-sm">
          At {formatMetresValue(current.measuredDepthM)}: planned{" "}
          {formatDegrees(current.plannedDipDegrees)}, actual{" "}
          {formatDegrees(current.actualDipDegrees)}, difference{" "}
          {formatDegrees(current.dipDifferenceDegrees)}
        </p>
      ) : null}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="md" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planned dip"
              stroke="var(--tl-ink-muted)"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual dip"
              stroke="var(--tl-primary)"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrajectoryAzimuthTrend({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const planned =
    comparison.planned?.renderPath.map((point) => ({
      md: point.measuredDepthM,
      planned: point.azimuthDegrees,
    })) ?? [];
  const actual =
    comparison.actual?.stations.map((point) => ({
      md: point.measuredDepthM,
      actual: point.azimuthDegrees,
    })) ?? [];
  const mdSet = new Map<number, { md: number; planned?: number; actual?: number }>();
  for (const point of planned) {
    mdSet.set(point.md, { ...mdSet.get(point.md), ...point });
  }
  for (const point of actual) {
    mdSet.set(point.md, { ...mdSet.get(point.md), ...point });
  }
  const data = unwrapAzimuthSeries(
    [...mdSet.values()].sort((a, b) => a.md - b.md),
  );
  const current = comparison.currentTrackingPoint;

  return (
    <div data-testid="trajectory-azimuth-trend">
      {current ? (
        <p className="mb-2 text-sm">
          At {formatMetresValue(current.measuredDepthM)}: planned{" "}
          {formatDegrees(current.plannedAzimuthDegrees)}, actual{" "}
          {formatDegrees(current.actualAzimuthDegrees)}, circular difference{" "}
          {formatDegrees(current.circularAzimuthDifferenceDegrees)}. Chart
          unwraps 0°/360° for display continuity; tables keep original azimuths.
        </p>
      ) : null}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="md" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planned azimuth"
              stroke="var(--tl-ink-muted)"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual azimuth"
              stroke="var(--tl-primary)"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrajectoryLegendNote() {
  return (
    <p className="text-sm text-[var(--tl-ink-muted)]">
      Legend: Planned (dashed line), Actual (solid line), Target (marker). Paths
      are distinguished by pattern and text, not colour alone.
    </p>
  );
}

export function formatStationCoordinateRow(station: {
  measuredDepthM: number;
  dipDegrees: number;
  azimuthDegrees: number;
  eastingM: number;
  northingM: number;
  rlM: number;
  tvdM: number;
}) {
  return {
    md: formatMetresValue(station.measuredDepthM),
    dip: formatDegrees(station.dipDegrees),
    az: formatDegrees(station.azimuthDegrees),
    e: formatCoordinate(station.eastingM),
    n: formatCoordinate(station.northingM),
    rl: formatCoordinate(station.rlM),
    tvd: formatMetresValue(station.tvdM),
  };
}
