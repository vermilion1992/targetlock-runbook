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
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { decimetres, formatMetres, type HoleChartDatasets } from "@/domain";

function ChartFigure({
  title,
  summary,
  testId,
  children,
}: {
  title: string;
  summary: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      data-testid={testId}
      className="min-w-0 space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
    >
      <figcaption className="font-bold">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      <div className="h-64 w-full min-w-0" aria-hidden="true">
        {children}
      </div>
      <p className="text-sm text-[var(--tl-ink-muted)]">{summary}</p>
    </figure>
  );
}

const DAY_FILL = "var(--tl-primary)";
const NIGHT_FILL = "var(--tl-ink-muted)";
const LOSS_FILL = "var(--tl-danger, #b42318)";
const GAIN_FILL = "var(--tl-primary)";

export function HoleAnalyticsCharts({
  charts,
}: {
  charts: HoleChartDatasets;
}) {
  const metresData = charts.metresByShift.points.map((point) => ({
    name: point.label,
    metres: point.metresDm / 10,
    amended: point.amended ? "Amended" : "",
    fill: point.shiftType === "DAY" ? DAY_FILL : NIGHT_FILL,
    pattern: point.shiftType === "NIGHT" ? "night" : "day",
  }));

  const cumulativeData = charts.cumulativeDepthByShift.points.map((point) => ({
    name: point.label,
    depth: point.endingDepthDm / 10,
    completion: point.isCompletionPoint ? point.endingDepthDm / 10 : null,
  }));

  const recoveryData = charts.recoveryByDepth.points.map((point) => ({
    depth: point.depthDm / 10,
    recovery: point.recoveryPercentTenths / 10,
    run: point.runNumber,
  }));

  const runLengthData = charts.runLengthByDepth.points.map((point) => ({
    depth: point.depthDm / 10,
    length: point.drilledLengthDm / 10,
    highlight: point.highlight,
    run: point.runNumber,
  }));

  const lossGainData = charts.coreLossGainByDepth.points.map((point) => ({
    depth: point.depthDm / 10,
    loss: -(point.lossDm / 10),
    gain: point.gainDm / 10,
    run: point.runNumber,
  }));

  const bitIntervals = charts.componentIntervals.points.filter(
    (point) => point.componentType === "BIT",
  );
  const reamerIntervals = charts.componentIntervals.points.filter(
    (point) => point.componentType === "REAMER",
  );
  const intervalRows = [
    ...bitIntervals.map((point, index) => ({
      row: `Bit ${index + 1}`,
      serial: point.serialNumber,
      start: point.startDepthDm / 10,
      span: Math.max(0.1, (point.endDepthDm - point.startDepthDm) / 10),
      partial: point.partialBoundaryRuns > 0,
    })),
    ...reamerIntervals.map((point, index) => ({
      row: `Reamer ${index + 1}`,
      serial: point.serialNumber,
      start: point.startDepthDm / 10,
      span: Math.max(0.1, (point.endDepthDm - point.startDepthDm) / 10),
      partial: point.partialBoundaryRuns > 0,
    })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="hole-analytics-charts">
      <ChartFigure
        title="Metres completed by Shift"
        summary={charts.metresByShift.summary}
        testId="chart-metres-by-shift"
      >
        {metresData.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No completed Shifts.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metresData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{ value: "m", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: number | string) => [
                  `${Number(value).toFixed(1)} m`,
                  "Metres",
                ]}
              />
              <Legend
                payload={[
                  { value: "Day", type: "square", color: DAY_FILL },
                  { value: "Night", type: "square", color: NIGHT_FILL },
                ]}
              />
              <Bar dataKey="metres" name="Metres">
                {metresData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                    stroke={entry.amended ? "var(--tl-ink)" : undefined}
                    strokeWidth={entry.amended ? 2 : 0}
                    strokeDasharray={entry.pattern === "night" ? "4 2" : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartFigure>

      <ChartFigure
        title="Cumulative depth by Shift"
        summary={charts.cumulativeDepthByShift.summary}
        testId="chart-cumulative-depth"
      >
        {cumulativeData.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No Shift depth series.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: "Depth m", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(value: number | string) => [`${Number(value).toFixed(1)} m`, "Depth"]} />
              <Legend />
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
                name="Completion point"
                stroke="var(--tl-ink)"
                strokeWidth={0}
                dot={{ r: 6, strokeWidth: 2, fill: "var(--tl-surface)" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartFigure>

      <ChartFigure
        title="Recovery by depth"
        summary={charts.recoveryByDepth.summary}
        testId="chart-recovery-by-depth"
      >
        {recoveryData.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No completed Runs.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
              <XAxis
                type="number"
                dataKey="depth"
                name="Depth"
                unit=" m"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="recovery"
                name="Recovery"
                unit="%"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number | string, name: string) => [
                  name === "recovery" ? `${Number(value).toFixed(1)}%` : `${Number(value).toFixed(1)} m`,
                  name === "recovery" ? "Recovery" : "Depth",
                ]}
              />
              <Scatter name="Run recovery" data={recoveryData} fill={DAY_FILL} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </ChartFigure>

      <ChartFigure
        title="Run length by depth"
        summary={charts.runLengthByDepth.summary}
        testId="chart-run-length"
      >
        {runLengthData.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No completed Runs.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
              <XAxis type="number" dataKey="depth" name="Depth" unit=" m" tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="length" name="Length" unit=" m" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number | string, name: string) => [
                  `${Number(value).toFixed(1)} m`,
                  name === "length" ? "Drilled" : "Depth",
                ]}
              />
              <Legend
                payload={[
                  { value: "Normal", type: "circle", color: DAY_FILL },
                  { value: "Short (<1.5 m)", type: "circle", color: LOSS_FILL },
                  { value: "Long (>6.0 m)", type: "circle", color: NIGHT_FILL },
                ]}
              />
              <Scatter name="Run length" data={runLengthData}>
                {runLengthData.map((entry) => (
                  <Cell
                    key={`run-${entry.run}`}
                    fill={
                      entry.highlight === "short"
                        ? LOSS_FILL
                        : entry.highlight === "long"
                          ? NIGHT_FILL
                          : DAY_FILL
                    }
                    stroke={entry.highlight === "normal" ? undefined : "var(--tl-ink)"}
                    strokeWidth={entry.highlight === "normal" ? 0 : 1}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </ChartFigure>

      <ChartFigure
        title="Core loss / gain by depth"
        summary={charts.coreLossGainByDepth.summary}
        testId="chart-loss-gain"
      >
        {lossGainData.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No completed Runs.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={lossGainData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tl-border)" />
              <XAxis dataKey="depth" tick={{ fontSize: 11 }} unit=" m" />
              <YAxis tick={{ fontSize: 11 }} unit=" m" />
              <Tooltip
                formatter={(value: number | string, name: string) => [
                  `${Math.abs(Number(value)).toFixed(1)} m`,
                  name === "loss" ? "Loss" : "Gain",
                ]}
              />
              <Legend />
              <Bar dataKey="loss" name="Loss" fill={LOSS_FILL} />
              <Bar dataKey="gain" name="Gain" fill={GAIN_FILL} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartFigure>

      <ChartFigure
        title="Component intervals"
        summary={charts.componentIntervals.summary}
        testId="chart-component-intervals"
      >
        {intervalRows.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No component assignments.</p>
        ) : (
          <ul className="space-y-3">
            {intervalRows.map((row) => {
              const maxDepth = Math.max(
                ...intervalRows.map((item) => item.start + item.span),
                1,
              );
              const left = (row.start / maxDepth) * 100;
              const width = (row.span / maxDepth) * 100;
              return (
                <li key={`${row.row}-${row.serial}`} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2 font-semibold">
                    <span>
                      {row.row}: {row.serial}
                      {row.partial ? " · partial boundary Runs" : ""}
                    </span>
                    <span className="tl-tabular text-[var(--tl-ink-muted)]">
                      {formatMetres(decimetres(Math.round(row.start * 10)))}–
                      {formatMetres(
                        decimetres(Math.round((row.start + row.span) * 10)),
                      )}
                    </span>
                  </div>
                  <div className="relative h-4 overflow-hidden rounded-sm bg-[var(--tl-border)]">
                    <div
                      className={`absolute inset-y-0 ${row.partial ? "bg-[var(--tl-ink-muted)]" : "bg-[var(--tl-primary)]"}`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      title={`${row.serial} interval`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartFigure>
    </div>
  );
}
