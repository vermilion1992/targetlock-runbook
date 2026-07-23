"use client";

import { formatMetres, type ShiftAnalytics } from "@/domain";

import { formatRecoveryTenths } from "./shift-analytics-format";

function BarChart({
  title,
  summary,
  bars,
}: {
  title: string;
  summary: string;
  bars: readonly { readonly label: string; readonly value: number; readonly display: string }[];
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <figure className="space-y-3">
      <figcaption className="font-bold">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      {bars.length === 0 ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">No completed Runs.</p>
      ) : (
        <ul className="space-y-2" aria-hidden="true">
          {bars.map((bar) => (
            <li key={bar.label} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 text-sm">
              <span className="tl-tabular font-semibold">{bar.label}</span>
              <div className="h-3 overflow-hidden rounded-sm bg-[var(--tl-border)]">
                <div
                  className="h-full bg-[var(--tl-primary)]"
                  style={{ width: `${Math.max(4, (bar.value / max) * 100)}%` }}
                />
              </div>
              <span className="tl-tabular text-right">{bar.display}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-[var(--tl-ink-muted)]" aria-live="polite">
        {summary}
      </p>
    </figure>
  );
}

export function ShiftRunCharts({ analytics }: { analytics: ShiftAnalytics }) {
  const metresBars = analytics.runLengthsByRunNumber.map((run) => ({
    label: String(run.runNumber),
    value: Number(run.drilledLengthDm),
    display: formatMetres(run.drilledLengthDm),
  }));
  const recoveryBars = analytics.runLengthsByRunNumber.map((run) => ({
    label: String(run.runNumber),
    value: run.recoveryPercentTenths,
    display: formatRecoveryTenths(run.recoveryPercentTenths),
  }));
  const metresSummary =
    metresBars.length === 0
      ? "No metres-by-Run chart data."
      : `Metres by Run: ${metresBars.map((bar) => `Run ${bar.label} ${bar.display}`).join("; ")}.`;
  const recoverySummary =
    recoveryBars.length === 0
      ? "No recovery-by-Run chart data."
      : `Recovery by Run: ${recoveryBars.map((bar) => `Run ${bar.label} ${bar.display}`).join("; ")}.`;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <BarChart title="Metres by Run" summary={metresSummary} bars={metresBars} />
      <BarChart
        title="Recovery by Run"
        summary={recoverySummary}
        bars={recoveryBars}
      />
    </div>
  );
}
