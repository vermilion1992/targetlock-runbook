"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
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
  type TrajectoryTrackingPoint,
} from "@/domain";

import {
  ACTUAL_STROKE,
  CHART_GRID_STROKE,
  CHART_MARGIN,
  CHART_TICK_FILL,
  formatAxisDegrees,
  formatAxisMetres,
  mdDomain,
  niceTicks,
  PLANNED_STROKE,
  SPATIAL_STROKE,
  TARGET_FILL,
  VERTICAL_STROKE,
} from "./trajectory-chart-axis";
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

function ChartFrame({
  children,
  heightClass = "h-80 md:h-[22rem]",
}: {
  children: ReactNode;
  heightClass?: string;
}) {
  return <div className={`w-full ${heightClass}`}>{children}</div>;
}

export function TrajectoryPlanView({
  comparison,
  selectedPoint,
}: {
  comparison: HoleTrajectoryComparison;
  selectedPoint?: TrajectoryTrackingPoint | null;
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
  const domainE: [number, number] = [minE - span * 0.1, minE + span * 1.1];
  const domainN: [number, number] = [minN - span * 0.1, minN + span * 1.1];
  const focus = selectedPoint ?? comparison.currentTrackingPoint;

  return (
    <div data-testid="trajectory-plan-view">
      <p className="mb-2 text-sm text-[var(--tl-ink-muted)]">
        Plan view — equal-scale Easting / Northing. Dashed = Planned, Solid =
        Actual. North is up.
      </p>
      {focus ? (
        <p className="mb-2 text-sm tabular-nums">
          At {formatMetresValue(focus.measuredDepthM)} MD ·{" "}
          {Math.abs(focus.deltaEastingM).toFixed(1)} m{" "}
          {focus.deltaEastingM >= 0 ? "east" : "west"} of plan ·{" "}
          {Math.abs(focus.deltaNorthingM).toFixed(1)} m{" "}
          {focus.deltaNorthingM >= 0 ? "north" : "south"} of plan ·{" "}
          {formatMetresValue(focus.horizontalDeviationM)} horizontal
        </p>
      ) : null}
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              type="number"
              dataKey="e"
              name="Easting"
              domain={domainE}
              ticks={niceTicks(domainE[0], domainE[1], 6)}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
              label={{ value: "Easting (m)", position: "insideBottom", offset: -12 }}
            />
            <YAxis
              type="number"
              dataKey="n"
              name="Northing"
              domain={domainN}
              ticks={niceTicks(domainN[0], domainN[1], 6)}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
              label={{ value: "Northing (m)", angle: -90, position: "insideLeft" }}
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
              line={{ strokeDasharray: "6 4", stroke: PLANNED_STROKE }}
              fill={PLANNED_STROKE}
              shape="circle"
            />
            <Scatter
              name="Actual (solid path)"
              data={actual}
              line={{ stroke: ACTUAL_STROKE }}
              fill={ACTUAL_STROKE}
              shape="circle"
            />
            {target.length > 0 ? (
              <Scatter
                name="Target"
                data={target}
                fill={TARGET_FILL}
                shape="diamond"
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export function TrajectoryVerticalSection({
  comparison,
  selectedPoint,
  crossSectionOffsetM,
}: {
  comparison: HoleTrajectoryComparison;
  selectedPoint?: TrajectoryTrackingPoint | null;
  crossSectionOffsetM?: number | null;
}) {
  const originE =
    comparison.planned?.collar.eastingM ??
    comparison.actual?.collar.eastingM ??
    0;
  const originN =
    comparison.planned?.collar.northingM ??
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
    bearingSource = "Collar-to-target projection";
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

  const sectionValues = [...planned, ...actual].map((p) => p.section);
  const rlValues = [...planned, ...actual].map((p) => p.rl);
  const sectionTicks = niceTicks(
    Math.min(...sectionValues),
    Math.max(...sectionValues),
    6,
  );
  const rlTicks = niceTicks(Math.min(...rlValues), Math.max(...rlValues), 6);
  const focus = selectedPoint ?? comparison.currentTrackingPoint;

  return (
    <div data-testid="trajectory-vertical-section">
      <p className="mb-1 text-sm font-semibold tabular-nums">
        SECTION BEARING {formatDegrees(bearing)} GRID
      </p>
      <p className="mb-2 text-sm text-[var(--tl-ink-muted)]">{bearingSource}</p>
      {crossSectionOffsetM !== undefined && crossSectionOffsetM !== null ? (
        <p className="mb-2 text-sm tabular-nums">
          Cross-section offset {formatMetresValue(Math.abs(crossSectionOffsetM))}
        </p>
      ) : null}
      {focus ? (
        <p className="mb-2 text-sm tabular-nums text-[var(--tl-ink-muted)]">
          Selected MD {formatMetresValue(focus.measuredDepthM)} · vertical{" "}
          {formatMetresValue(Math.abs(focus.verticalDeviationM))}{" "}
          {focus.verticalDeviationM >= 0 ? "above" : "below"} plan
        </p>
      ) : null}
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              type="number"
              dataKey="section"
              name="Section distance"
              ticks={sectionTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
            />
            <YAxis
              type="number"
              dataKey="rl"
              name="RL"
              ticks={rlTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
            />
            <Tooltip />
            <Legend />
            <Scatter
              name="Planned (dashed)"
              data={planned}
              line={{ strokeDasharray: "6 4", stroke: PLANNED_STROKE }}
              fill={PLANNED_STROKE}
            />
            <Scatter
              name="Actual (solid)"
              data={actual}
              line={{ stroke: ACTUAL_STROKE }}
              fill={ACTUAL_STROKE}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export function TrajectoryDeviationTrend({
  comparison,
  selectedPoint,
}: {
  comparison: HoleTrajectoryComparison;
  selectedPoint?: TrajectoryTrackingPoint | null;
}) {
  const data = comparison.trackingPoints.map((point) => ({
    md: point.measuredDepthM,
    horizontal: point.horizontalDeviationM,
    vertical: point.verticalDeviationM,
    spatial: point.spatialDeviationM,
  }));
  if (data.length === 0) {
    return <p className="text-sm">No tracking points for deviation trend.</p>;
  }
  const focus = selectedPoint ?? comparison.currentTrackingPoint;
  const domain = mdDomain(data.map((d) => d.md));
  const mdTicks = niceTicks(domain[0], domain[1], 6);
  const yValues = data.flatMap((d) => [d.horizontal, d.vertical, d.spatial]);
  const yTicks = niceTicks(Math.min(...yValues), Math.max(...yValues), 6);

  return (
    <div data-testid="trajectory-deviation-trend">
      {focus ? (
        <p className="mb-2 text-sm tabular-nums">
          At {formatMetresValue(focus.measuredDepthM)}: horizontal{" "}
          {formatMetresValue(focus.horizontalDeviationM)}, vertical{" "}
          {formatMetresValue(Math.abs(focus.verticalDeviationM))}{" "}
          {focus.verticalDeviationM >= 0 ? "above" : "below"}, spatial{" "}
          {formatMetresValue(focus.spatialDeviationM)}
        </p>
      ) : null}
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              dataKey="md"
              type="number"
              domain={domain}
              ticks={mdTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
              label={{ value: "MD (m)", position: "insideBottom", offset: -12 }}
            />
            <YAxis
              ticks={yTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
              label={{ value: "Deviation (m)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${Number(value).toFixed(1)} m`,
                name,
              ]}
              labelFormatter={(md) => `MD ${Number(md).toFixed(1)} m`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="horizontal"
              name="Horizontal"
              stroke={ACTUAL_STROKE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="vertical"
              name="Vertical"
              stroke={VERTICAL_STROKE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="spatial"
              name="Spatial 3D"
              stroke={SPATIAL_STROKE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            {focus ? (
              <ReferenceDot
                x={focus.measuredDepthM}
                y={focus.spatialDeviationM}
                r={6}
                fill="var(--tl-danger)"
                stroke="var(--tl-ink)"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export function TrajectoryDipTrend({
  comparison,
  selectedPoint,
}: {
  comparison: HoleTrajectoryComparison;
  selectedPoint?: TrajectoryTrackingPoint | null;
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
  const focus = selectedPoint ?? comparison.currentTrackingPoint;
  const domain = mdDomain(data.map((d) => d.md));
  const mdTicks = niceTicks(domain[0], domain[1], 6);
  const yValues = data.flatMap((d) => [d.planned, d.actual]).filter(
    (v): v is number => v !== undefined,
  );
  const yTicks =
    yValues.length > 0
      ? niceTicks(Math.min(...yValues), Math.max(...yValues), 6)
      : undefined;

  return (
    <div data-testid="trajectory-dip-trend">
      {focus ? (
        <div className="mb-2 space-y-0.5 text-sm tabular-nums">
          <p className="font-semibold">
            SELECTED MD {formatMetresValue(focus.measuredDepthM)}
          </p>
          <p>
            Planned {formatDegrees(focus.plannedDipDegrees)} · Actual{" "}
            {formatDegrees(focus.actualDipDegrees)} · Difference{" "}
            {formatDegrees(Math.abs(focus.dipDifferenceDegrees))}
          </p>
        </div>
      ) : null}
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              dataKey="md"
              type="number"
              domain={domain}
              ticks={mdTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
            />
            <YAxis
              ticks={yTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisDegrees}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${Number(value).toFixed(1)}°`,
                name,
              ]}
              labelFormatter={(md) => `MD ${Number(md).toFixed(1)} m`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planned dip"
              stroke={PLANNED_STROKE}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual dip"
              stroke={ACTUAL_STROKE}
              connectNulls
              dot={{ r: 3 }}
            />
            {focus ? (
              <ReferenceDot
                x={focus.measuredDepthM}
                y={focus.actualDipDegrees}
                r={6}
                fill="var(--tl-danger)"
                stroke="var(--tl-ink)"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export function TrajectoryAzimuthTrend({
  comparison,
  selectedPoint,
}: {
  comparison: HoleTrajectoryComparison;
  selectedPoint?: TrajectoryTrackingPoint | null;
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
  const raw = [...mdSet.values()].sort((a, b) => a.md - b.md);
  const data = unwrapAzimuthSeries(raw);
  const focus = selectedPoint ?? comparison.currentTrackingPoint;
  const domain = mdDomain(data.map((d) => d.md));
  const mdTicks = niceTicks(domain[0], domain[1], 6);
  const yValues = data.flatMap((d) => [d.planned, d.actual]).filter(
    (v): v is number => v !== undefined,
  );
  const yTicks =
    yValues.length > 0
      ? niceTicks(Math.min(...yValues), Math.max(...yValues), 6)
      : undefined;

  const selectedPlot = focus
    ? data.find((row) => Math.abs(row.md - focus.measuredDepthM) < 1e-6)
    : undefined;

  return (
    <div data-testid="trajectory-azimuth-trend">
      {focus ? (
        <div className="mb-2 space-y-0.5 text-sm tabular-nums">
          <p className="font-semibold">
            SELECTED MD {formatMetresValue(focus.measuredDepthM)}
          </p>
          <p>
            Planned {formatDegrees(focus.plannedAzimuthDegrees)} · Actual{" "}
            {formatDegrees(focus.actualAzimuthDegrees)} · Difference{" "}
            {formatDegrees(focus.circularAzimuthDifferenceDegrees)}
          </p>
          <p className="text-[var(--tl-ink-muted)]">
            Chart unwraps 0°/360° for continuity; values remain 0–360°.
          </p>
        </div>
      ) : null}
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              dataKey="md"
              type="number"
              domain={domain}
              ticks={mdTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisMetres}
            />
            <YAxis
              ticks={yTicks}
              tick={{ fill: CHART_TICK_FILL, fontSize: 11 }}
              tickFormatter={formatAxisDegrees}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const wrapped = ((Number(value) % 360) + 360) % 360;
                return [`${wrapped.toFixed(1)}°`, name];
              }}
              labelFormatter={(md) => `MD ${Number(md).toFixed(1)} m`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planned azimuth"
              stroke={PLANNED_STROKE}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual azimuth"
              stroke={ACTUAL_STROKE}
              connectNulls
              dot={{ r: 3 }}
            />
            {selectedPlot?.actual !== undefined ? (
              <ReferenceDot
                x={selectedPlot.md}
                y={selectedPlot.actual}
                r={6}
                fill="var(--tl-danger)"
                stroke="var(--tl-ink)"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
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
