"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMetres, type HoleAnalytics } from "@/domain";

const DAY_FILL = "var(--tl-primary)";
const NIGHT_FILL = "var(--tl-ink-muted)";
const EXCEPTION_FILL = "var(--tl-danger, #b42318)";

function ChartFigure({
  title,
  summary,
  testId,
  height = 288,
  children,
}: {
  title: string;
  summary: string;
  testId: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <figure
      data-testid={testId}
      className="min-w-0 space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
    >
      <figcaption className="font-bold">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      <div className="w-full min-w-0" style={{ height }} aria-hidden="true">
        {children}
      </div>
      <p className="text-sm text-[var(--tl-ink-muted)]">{summary}</p>
    </figure>
  );
}

export function RunMetresChart({ analytics }: { analytics: HoleAnalytics }) {
  const data = analytics.charts.runLengthByDepth.points.map((point) => ({
    name: `Run ${point.runNumber}`,
    metres: point.drilledLengthDm / 10,
    highlight: point.highlight,
  }));
  const average =
    analytics.production.averageRunLengthDm === undefined
      ? undefined
      : Number(analytics.production.averageRunLengthDm) / 10;

  return (
    <ChartFigure
      title="Metres drilled per Run"
      summary={analytics.charts.runLengthByDepth.summary}
      testId="chart-run-metres"
    >
      {data.length === 0 ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">
          No completed Runs.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              angle={-25}
              textAnchor="end"
              height={52}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: "m", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number | string) => [
                `${Number(value).toFixed(1)} m`,
                "Drilled",
              ]}
            />
            {average !== undefined ? (
              <ReferenceLine
                y={average}
                stroke="var(--tl-ink)"
                strokeDasharray="5 4"
                label={{
                  value: "Average",
                  position: "insideTopRight",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Bar dataKey="metres" name="Metres drilled" radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.highlight === "short"
                      ? EXCEPTION_FILL
                      : entry.highlight === "long"
                        ? NIGHT_FILL
                        : DAY_FILL
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}

export function ShiftMetresChart({ analytics }: { analytics: HoleAnalytics }) {
  const points = analytics.charts.metresByShift.points;
  const data = points.map((point, index) => {
    const rollingWindow = points.slice(Math.max(0, index - 2), index + 1);
    const rollingMetres =
      rollingWindow.reduce((sum, item) => sum + item.metresDm, 0) /
      rollingWindow.length /
      10;
    return {
      name: point.label,
      metres: point.metresDm / 10,
      rollingMetres,
      amended: point.amended,
      fill: point.shiftType === "DAY" ? DAY_FILL : NIGHT_FILL,
    };
  });

  return (
    <ChartFigure
      title="Metres drilled by Shift"
      summary={analytics.charts.metresByShift.summary}
      testId="chart-shift-metres"
    >
      {data.length === 0 ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">
          No completed Shifts.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              angle={-25}
              textAnchor="end"
              height={52}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: "m", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                `${Number(value).toFixed(1)} m`,
                name === "rollingMetres"
                  ? "Rolling 3-Shift average"
                  : "Metres drilled",
              ]}
            />
            <Legend
              payload={[
                { value: "Day", type: "square", color: DAY_FILL },
                { value: "Night", type: "square", color: NIGHT_FILL },
                {
                  value: "Rolling 3-Shift average",
                  type: "line",
                  color: "var(--tl-ink)",
                },
              ]}
            />
            <Bar dataKey="metres" name="Metres drilled" radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  stroke={entry.amended ? "var(--tl-ink)" : undefined}
                  strokeWidth={entry.amended ? 2 : 0}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="rollingMetres"
              name="Rolling 3-Shift average"
              stroke="var(--tl-ink)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}

export function CumulativeDepthChart({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const data = analytics.charts.cumulativeDepthByShift.points.map((point) => ({
    name: point.label,
    depth: point.endingDepthDm / 10,
    completion: point.isCompletionPoint ? point.endingDepthDm / 10 : null,
  }));
  const plannedDepth = Number(analytics.production.plannedDepthDm) / 10;

  return (
    <ChartFigure
      title="Cumulative depth by Shift"
      summary={`${analytics.charts.cumulativeDepthByShift.summary} Planned depth ${formatMetres(
        analytics.production.plannedDepthDm,
      )}.`}
      testId="chart-cumulative-depth"
    >
      {data.length === 0 ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">
          No Shift depth series.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              angle={-25}
              textAnchor="end"
              height={52}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{
                value: "Depth m",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value: number | string) => [
                `${Number(value).toFixed(1)} m`,
                "Depth",
              ]}
            />
            <ReferenceLine
              y={plannedDepth}
              stroke="var(--tl-ink-muted)"
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
              label={{
                value: "Planned depth",
                position: "insideTopRight",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="depth"
              name="Completed depth"
              stroke={DAY_FILL}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="completion"
              name="Latest point"
              stroke="var(--tl-ink)"
              strokeWidth={0}
              dot={{ r: 6, strokeWidth: 2, fill: "var(--tl-surface)" }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}

export function BitMetresChart({ analytics }: { analytics: HoleAnalytics }) {
  const data = analytics.components.assignments
    .filter((assignment) => assignment.componentType === "BIT")
    .sort(
      (left, right) =>
        Number(left.startDepthDm) - Number(right.startDepthDm),
    )
    .map((assignment) => ({
      name: assignment.serialNumber,
      metres: Number(assignment.recordedMetresDm) / 10,
      active: assignment.finalStatus === "ACTIVE",
    }));
  const summary =
    data.length === 0
      ? "No bit assignments recorded."
      : `${data.length} bit assignment(s); ${formatMetres(
          analytics.components.longestBitIntervalDm!,
        )} longest recorded interval.`;

  return (
    <ChartFigure
      title="Metres drilled by Bit"
      summary={summary}
      testId="chart-bit-metres"
      height={Math.max(240, data.length * 44)}
    >
      {data.length === 0 ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">
          No bit assignments recorded.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" m" />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number | string) => [
                `${Number(value).toFixed(1)} m`,
                "Metres drilled",
              ]}
            />
            <Bar
              dataKey="metres"
              name="Metres drilled"
              radius={[0, 3, 3, 0]}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.active ? DAY_FILL : NIGHT_FILL}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}
