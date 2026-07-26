"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  formatMetres,
  formatTenths,
  type HoleAnalytics,
  type NorthReference,
} from "@/domain";

import {
  BitMetresChart,
  CumulativeDepthChart,
  RunMetresChart,
  ShiftMetresChart,
} from "./hole-analytics-charts";
import {
  formatOptionalMetres,
  formatRecoveryTenths,
  HOLE_METRIC_DEFINITIONS,
} from "./hole-analytics-format";

function MetricInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-md text-sm font-bold text-[var(--tl-ink-muted)] hover:bg-[var(--tl-border)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Metric definition"
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open ? (
        <span
          id={panelId}
          role="note"
          className="absolute left-0 top-11 z-10 w-64 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 text-left text-sm font-normal shadow-[var(--tl-shadow-sm)]"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function referenceLabel(reference: NorthReference): string {
  return reference === "NOT_SPECIFIED"
    ? "Not specified"
    : `${reference[0]}${reference.slice(1).toLocaleLowerCase("en-AU")}`;
}

export function HoleRunStatisticsPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const { production } = analytics;
  return (
    <SectionPanel
      title="Run statistics"
      description="Recorded metres, Run lengths and exceptions."
    >
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3"
        data-testid="hole-analytics-production"
      >
        <MetricDisplay
          label="Total drilled"
          value={formatMetres(production.totalDrilledDm)}
          emphasis="strong"
        />
        <MetricDisplay
          label="Completed Runs"
          value={production.totalCompletedRuns}
        />
        <MetricDisplay
          label="Average Run"
          value={formatOptionalMetres(production.averageRunLengthDm)}
        />
        <MetricDisplay
          label="Median Run"
          value={formatOptionalMetres(production.medianRunLengthDm)}
        />
        <MetricDisplay
          label="Longest Run"
          value={formatOptionalMetres(production.longestValidRunDm)}
        />
        <MetricDisplay
          label="Weighted core recovery"
          value={formatRecoveryTenths(production.weightedRecoveryTenths)}
          supportingText={
            <span className="inline-flex items-center gap-1">
              Hole-wide result
              <MetricInfo text={HOLE_METRIC_DEFINITIONS.weightedRecovery} />
            </span>
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill
          tone={production.totalCorrectedRuns > 0 ? "warning" : "neutral"}
        >
          {production.totalCorrectedRuns} corrected
        </StatusPill>
        <StatusPill
          tone={production.totalVoidedRuns > 0 ? "danger" : "neutral"}
        >
          {production.totalVoidedRuns} voided
        </StatusPill>
      </div>

      <div className="mt-5">
        <RunMetresChart analytics={analytics} />
      </div>
    </SectionPanel>
  );
}

export function HoleShiftStatisticsPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const { shifts } = analytics;
  return (
    <SectionPanel
      title="Shift statistics"
      description="Production output across completed Day and Night Shifts."
    >
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3"
        data-testid="hole-analytics-shifts"
      >
        <MetricDisplay label="Completed Shifts" value={shifts.completedShifts} />
        <MetricDisplay
          label="Average metres / Shift"
          value={formatOptionalMetres(shifts.averageMetresPerCompletedShiftDm)}
        />
        <MetricDisplay
          label="Median metres / Shift"
          value={formatOptionalMetres(shifts.medianMetresPerCompletedShiftDm)}
        />
        <MetricDisplay
          label="Highest Shift metres"
          value={formatOptionalMetres(shifts.highestShiftMetresDm)}
        />
        <MetricDisplay
          label="Average Day metres"
          value={formatOptionalMetres(shifts.averageDayShiftMetresDm)}
        />
        <MetricDisplay
          label="Average Night metres"
          value={formatOptionalMetres(shifts.averageNightShiftMetresDm)}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ShiftMetresChart analytics={analytics} />
        <CumulativeDepthChart analytics={analytics} />
      </div>
    </SectionPanel>
  );
}

export function HoleBitStatisticsPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const bits = analytics.components.assignments
    .filter((assignment) => assignment.componentType === "BIT")
    .sort(
      (left, right) =>
        Number(left.startDepthDm) - Number(right.startDepthDm),
    );
  const currentBit = [...bits]
    .reverse()
    .find((assignment) => assignment.finalStatus === "ACTIVE");
  const changeCount = Math.max(0, bits.length - 1);

  return (
    <SectionPanel
      title="Bit statistics"
      description="Bit utilisation, drilled intervals and change history."
      action={<StatusPill tone="info">{changeCount} changes</StatusPill>}
    >
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        data-testid="hole-analytics-components"
      >
        <MetricDisplay label="Bits used" value={analytics.components.bitsUsed} />
        <MetricDisplay
          label="Current Bit"
          value={currentBit?.serialNumber ?? "Not assigned"}
        />
        <MetricDisplay
          label="Average metres / Bit"
          value={formatOptionalMetres(
            analytics.components.averageRecordedMetresPerBitDm,
          )}
        />
        <MetricDisplay
          label="Longest Bit interval"
          value={formatOptionalMetres(
            analytics.components.longestBitIntervalDm,
          )}
        />
      </div>

      <div className="mt-5">
        <BitMetresChart analytics={analytics} />
      </div>

      {bits.length === 0 ? (
        <p className="mt-5 rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-5 text-center text-sm text-[var(--tl-ink-muted)]">
          No bit assignments recorded.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {bits.map((bit) => (
              <article
                key={bit.assignmentId}
                className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>{bit.serialNumber}</strong>
                  <StatusPill
                    tone={bit.finalStatus === "ACTIVE" ? "info" : "neutral"}
                  >
                    {bit.finalStatus}
                  </StatusPill>
                </div>
                <p className="mt-2 tl-tabular text-sm">
                  {formatMetres(bit.startDepthDm)}–{formatMetres(bit.endDepthDm)}
                </p>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  {formatMetres(bit.recordedMetresDm)} drilled
                  {bit.removalReason
                    ? ` · ${bit.removalReason.replaceAll("_", " ")}`
                    : ""}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-5 hidden overflow-x-auto rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[var(--tl-surface-raised)] text-xs uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                <tr>
                  {[
                    "Bit",
                    "Depth interval",
                    "Metres drilled",
                    "Removal reason",
                    "Status",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-bold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bits.map((bit) => (
                  <tr
                    key={bit.assignmentId}
                    className="border-t border-[var(--tl-border)]"
                  >
                    <td className="px-4 py-3 font-bold">{bit.serialNumber}</td>
                    <td className="px-4 py-3 tl-tabular">
                      {formatMetres(bit.startDepthDm)}–
                      {formatMetres(bit.endDepthDm)}
                    </td>
                    <td className="px-4 py-3 tl-tabular">
                      {formatMetres(bit.recordedMetresDm)}
                    </td>
                    <td className="px-4 py-3">
                      {bit.removalReason?.replaceAll("_", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        tone={
                          bit.finalStatus === "ACTIVE" ? "info" : "neutral"
                        }
                      >
                        {bit.finalStatus}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionPanel>
  );
}

export function HoleBarrelChangesPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const { barrels } = analytics;
  return (
    <SectionPanel
      title="Barrel changes"
      description="Recorded serial-number changes from the BHA setup history."
    >
      <div
        className="grid grid-cols-2 gap-3"
        data-testid="hole-analytics-barrels"
      >
        <MetricDisplay
          label="Current barrel"
          value={barrels.currentSerialNumber ?? "Not recorded"}
        />
        <MetricDisplay label="Recorded changes" value={barrels.changeCount} />
      </div>

      {barrels.changes.length === 0 ? (
        <p className="mt-5 rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-5 text-center text-sm text-[var(--tl-ink-muted)]">
          No barrel serial changes recorded.
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {barrels.changes.map((change) => (
            <li
              key={change.setupId}
              className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <strong className="tl-tabular">
                  {change.previousSerialNumber} → {change.serialNumber}
                </strong>
                <span className="text-sm text-[var(--tl-ink-muted)]">
                  {formatFieldDateTime(change.effectiveAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                BHA length{" "}
                <strong>{formatMetres(change.bottomHoleAssemblyLengthDm)}</strong>
                {" · "}
                {change.reason}
              </p>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Recorded by {change.recordedByName}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionPanel>
  );
}

export function HoleSurveyRegisterPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const records = analytics.surveys.records;
  return (
    <SectionPanel
      title="Survey register"
      description="Survey records ordered by measured depth."
      action={<StatusPill tone="info">{records.length} surveys</StatusPill>}
    >
      <div data-testid="hole-analytics-surveys">
        {records.length === 0 ? (
          <p className="rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-5 text-center text-sm text-[var(--tl-ink-muted)]">
            No Surveys recorded.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {records.map((survey) => (
                <Link
                  key={survey.surveyId}
                  href={runbookRoutes.surveyDetail(
                    analytics.holeId,
                    survey.surveyId,
                  )}
                  className="block rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4 no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="tl-tabular text-xl">
                      {formatMetres(survey.depthDm)}
                    </strong>
                    <span className="flex flex-wrap justify-end gap-1">
                      {survey.corrected ? (
                        <StatusPill tone="warning">Corrected</StatusPill>
                      ) : null}
                      {survey.hasPhotograph ? (
                        <StatusPill tone="info">Photo</StatusPill>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">
                    Dip {formatTenths(survey.dipTenths)}° · Azimuth{" "}
                    {formatTenths(survey.azimuthTenths)}°
                  </p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    {referenceLabel(survey.northReference)} ·{" "}
                    {survey.toolName ?? "Tool not specified"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
                    {formatFieldDateTime(survey.recordedAt)}
                  </p>
                </Link>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] md:block">
              <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                <thead className="bg-[var(--tl-surface-raised)] text-xs uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  <tr>
                    {[
                      "Depth",
                      "Dip",
                      "Azimuth",
                      "Reference",
                      "Tool",
                      "Recorded",
                      "Record",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-bold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((survey) => (
                    <tr
                      key={survey.surveyId}
                      className="border-t border-[var(--tl-border)]"
                    >
                      <td className="px-4 py-3 font-bold">
                        <Link
                          href={runbookRoutes.surveyDetail(
                            analytics.holeId,
                            survey.surveyId,
                          )}
                        >
                          {formatMetres(survey.depthDm)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tl-tabular">
                        {formatTenths(survey.dipTenths)}°
                      </td>
                      <td className="px-4 py-3 tl-tabular">
                        {formatTenths(survey.azimuthTenths)}°
                      </td>
                      <td className="px-4 py-3">
                        {referenceLabel(survey.northReference)}
                      </td>
                      <td className="px-4 py-3">
                        {survey.toolName ?? "Not specified"}
                        {survey.toolSerialNumber
                          ? ` · ${survey.toolSerialNumber}`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        {formatFieldDateTime(survey.recordedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1">
                          {survey.corrected ? (
                            <StatusPill tone="warning">Corrected</StatusPill>
                          ) : null}
                          {survey.hasPhotograph ? (
                            <StatusPill tone="info">Photo</StatusPill>
                          ) : null}
                          {!survey.corrected && !survey.hasPhotograph ? "—" : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionPanel>
  );
}
