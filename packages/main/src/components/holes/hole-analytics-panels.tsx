"use client";

import { useId, useState } from "react";

import { formatMetres, type HoleAnalytics } from "@/domain";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { CollapsibleFieldSection } from "@/components/shifts/collapsible-field-section";

import { HoleAnalyticsCharts } from "./hole-analytics-charts";
import {
  formatGrossMetresPerHour,
  formatOptionalMetres,
  formatRecoveryTenths,
  formatSignedMetres,
  HOLE_METRIC_DEFINITIONS,
} from "./hole-analytics-format";

function MetricInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="relative inline-flex">
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
        <p
          id={panelId}
          role="note"
          className="absolute left-0 top-11 z-10 w-64 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 text-sm shadow-[var(--tl-shadow-sm)]"
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

export function HoleOverviewPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { production, shifts, components, surveys, trays } = analytics;
  return (
    <SectionPanel
      title="OVERVIEW"
      description="Repository-backed Hole analytics from effective completed records."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-overview">
        <MetricDisplay
          label="Final / current depth"
          value={formatMetres(production.currentOrFinalDepthDm)}
          emphasis="strong"
        />
        <MetricDisplay
          label="Planned depth"
          value={formatMetres(production.plannedDepthDm)}
        />
        <MetricDisplay
          label="vs planned"
          value={formatSignedMetres(production.differenceFromPlannedDm)}
        />
        <MetricDisplay
          label="Total Runs"
          value={production.totalCompletedRuns}
        />
        <MetricDisplay label="Total Shifts" value={shifts.completedShifts} />
        <MetricDisplay
          label="Weighted recovery"
          value={formatRecoveryTenths(production.weightedRecoveryTenths)}
          supportingText={
            <span className="inline-flex items-center gap-1">
              Weighted, not average
              <MetricInfo text={HOLE_METRIC_DEFINITIONS.weightedRecovery} />
            </span>
          }
        />
        <MetricDisplay
          label="Avg metres / Shift"
          value={formatOptionalMetres(shifts.averageMetresPerCompletedShiftDm)}
          supportingText={
            <MetricInfo text={HOLE_METRIC_DEFINITIONS.averageMetresPerShift} />
          }
        />
        <MetricDisplay label="Bits used" value={components.bitsUsed} />
        <MetricDisplay label="Reamers used" value={components.reamersUsed} />
        <MetricDisplay label="Surveys" value={surveys.totalSurveys} />
        <MetricDisplay label="Trays" value={trays.totalTrays} />
      </div>
    </SectionPanel>
  );
}

export function HoleProductionPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const { production } = analytics;
  return (
    <CollapsibleFieldSection title="Production" defaultOpen>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-production">
        <MetricDisplay
          label="Starting depth"
          value={formatMetres(production.startingDepthDm)}
        />
        <MetricDisplay
          label="Total drilled"
          value={formatMetres(production.totalDrilledDm)}
        />
        <MetricDisplay
          label="Total recovered"
          value={formatMetres(production.totalRecoveredDm)}
        />
        <MetricDisplay
          label="Core loss"
          value={formatMetres(production.totalCoreLossDm)}
        />
        <MetricDisplay
          label="Core gain"
          value={formatMetres(production.totalCoreGainDm)}
        />
        <MetricDisplay
          label="Weighted recovery"
          value={formatRecoveryTenths(production.weightedRecoveryTenths)}
        />
        <MetricDisplay
          label="Completed Runs"
          value={production.totalCompletedRuns}
        />
        <MetricDisplay label="Voided Runs" value={production.totalVoidedRuns} />
        <MetricDisplay
          label="Corrected Runs"
          value={production.totalCorrectedRuns}
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
          label="Shortest valid Run"
          value={formatOptionalMetres(production.shortestValidRunDm)}
        />
        <MetricDisplay
          label="Longest valid Run"
          value={formatOptionalMetres(production.longestValidRunDm)}
        />
      </div>
    </CollapsibleFieldSection>
  );
}

export function HoleShiftPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { shifts } = analytics;
  return (
    <CollapsibleFieldSection title="Shifts" defaultOpen>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-shifts">
        <MetricDisplay label="Day Shifts" value={shifts.totalDayShifts} />
        <MetricDisplay label="Night Shifts" value={shifts.totalNightShifts} />
        <MetricDisplay label="Completed Shifts" value={shifts.completedShifts} />
        <MetricDisplay label="Handovers" value={shifts.handovers} />
        <MetricDisplay label="Shared Runs" value={shifts.sharedRuns} />
        <MetricDisplay
          label="Avg metres / Shift"
          value={formatOptionalMetres(shifts.averageMetresPerCompletedShiftDm)}
        />
        <MetricDisplay
          label="Median metres / Shift"
          value={formatOptionalMetres(shifts.medianMetresPerCompletedShiftDm)}
        />
        <MetricDisplay
          label="Avg Day metres"
          value={formatOptionalMetres(shifts.averageDayShiftMetresDm)}
        />
        <MetricDisplay
          label="Avg Night metres"
          value={formatOptionalMetres(shifts.averageNightShiftMetresDm)}
        />
        <MetricDisplay
          label="Highest Shift metres"
          value={formatOptionalMetres(shifts.highestShiftMetresDm)}
        />
        <MetricDisplay
          label="Lowest Shift metres"
          value={formatOptionalMetres(shifts.lowestShiftMetresDm)}
        />
        <MetricDisplay
          label="Day weighted recovery"
          value={formatRecoveryTenths(shifts.averageDayWeightedRecoveryTenths)}
        />
        <MetricDisplay
          label="Night weighted recovery"
          value={formatRecoveryTenths(shifts.averageNightWeightedRecoveryTenths)}
        />
        <MetricDisplay
          label="Gross m / elapsed Shift hour"
          value={formatGrossMetresPerHour(
            shifts.grossMetresPerElapsedShiftHourTenths,
          )}
          supportingText={
            <MetricInfo text={HOLE_METRIC_DEFINITIONS.grossMetresPerHour} />
          }
        />
      </div>
      {analytics.drillerOperational.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
            Operational record by driller
          </h3>
          <p className="text-sm text-[var(--tl-ink-muted)]">
            Neutral operational record — not a performance leaderboard.
          </p>
          <ul className="space-y-2">
            {analytics.drillerOperational.map((row) => (
              <li
                key={row.drillerId}
                className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3 text-sm"
              >
                <strong>{row.drillerName}</strong>
                <span className="block text-[var(--tl-ink-muted)]">
                  {row.shiftsWorked} Shift(s) · {row.runsCompleted} Run(s) ·{" "}
                  {formatMetres(row.metresAttributedDm)} · recovery{" "}
                  {formatRecoveryTenths(row.weightedRecoveryTenths)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CollapsibleFieldSection>
  );
}

export function HoleRodPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { rods } = analytics;
  return (
    <CollapsibleFieldSection title="Rods">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-rods">
        <MetricDisplay
          label="Rod number"
          value={`${rods.startingRodNumber} → ${rods.finalOrCurrentRodNumber}`}
        />
        <MetricDisplay
          label="R/S"
          value={`${formatMetres(rods.startingRodStringDm)} → ${formatMetres(rods.finalOrCurrentRodStringDm)}`}
        />
        <MetricDisplay label="3.0 m rods added" value={rods.rodsAdded3m} />
        <MetricDisplay label="6.0 m rods added" value={rods.rodsAdded6m} />
        <MetricDisplay label="Rods removed" value={rods.rodsRemoved} />
        <MetricDisplay
          label="Net physical rod change"
          value={rods.netPhysicalRodChange}
        />
        <MetricDisplay
          label="BHA configuration changes"
          value={rods.bhaConfigurationChanges}
        />
        <MetricDisplay
          label="Constant stick-up changes"
          value={rods.constantStickUpChanges}
        />
        <MetricDisplay
          label="Corrected rod events"
          value={rods.correctedRodEvents}
        />
        <MetricDisplay label="Voided rod events" value={rods.voidedRodEvents} />
      </div>
    </CollapsibleFieldSection>
  );
}

export function HoleComponentPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  const { components } = analytics;
  return (
    <CollapsibleFieldSection title="Components">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-components">
        <MetricDisplay label="Bits used" value={components.bitsUsed} />
        <MetricDisplay label="Reamers used" value={components.reamersUsed} />
        <MetricDisplay
          label="Avg metres / Bit"
          value={formatOptionalMetres(components.averageRecordedMetresPerBitDm)}
        />
        <MetricDisplay
          label="Avg metres / Reamer"
          value={formatOptionalMetres(
            components.averageRecordedMetresPerReamerDm,
          )}
        />
        <MetricDisplay
          label="Longest Bit interval"
          value={formatOptionalMetres(components.longestBitIntervalDm)}
        />
        <MetricDisplay
          label="Longest Reamer interval"
          value={formatOptionalMetres(components.longestReamerIntervalDm)}
        />
      </div>
      <ul className="mt-4 space-y-3">
        {components.assignments.map((assignment) => (
          <li
            key={assignment.assignmentId}
            className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3 text-sm"
          >
            <strong>
              {assignment.componentType} {assignment.serialNumber}
            </strong>
            <span className="block text-[var(--tl-ink-muted)]">
              {formatMetres(assignment.startDepthDm)}–
              {formatMetres(assignment.endDepthDm)} · recorded{" "}
              {formatMetres(assignment.recordedMetresDm)} ·{" "}
              {assignment.runsTouched} Run(s) touched
              {assignment.partialBoundaryRuns > 0
                ? ` · ${assignment.partialBoundaryRuns} partial boundary Run(s)`
                : ""}
            </span>
            <span className="mt-1 block">
              Observed recovery during assignment:{" "}
              {formatRecoveryTenths(assignment.observedRecoveryTenths)}
              {assignment.recoveryEstimateStatus === "RUN_LEVEL_ESTIMATE"
                ? " (run-level estimate — partial boundary)"
                : ""}
            </span>
            {assignment.removalReason ? (
              <span className="mt-1 block text-[var(--tl-ink-muted)]">
                Removal: {assignment.removalReason.replaceAll("_", " ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
        {HOLE_METRIC_DEFINITIONS.observedComponentRecovery}
      </p>
    </CollapsibleFieldSection>
  );
}

export function HoleCasingPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { casing } = analytics;
  return (
    <CollapsibleFieldSection title="Casing">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-casing">
        <MetricDisplay label="Strings" value={casing.stringCount} />
        <MetricDisplay label="Installs" value={casing.installCount} />
        <MetricDisplay label="Advancements" value={casing.advancementCount} />
        <MetricDisplay label="Corrections" value={casing.correctionCount} />
        <MetricDisplay
          label="Deepest casing"
          value={formatOptionalMetres(casing.deepestCasingDm)}
        />
        <MetricDisplay
          label="Sizes"
          value={casing.sizes.length === 0 ? "—" : casing.sizes.join(", ")}
        />
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {casing.timeline.map((item) => (
          <li key={item.casingId}>
            {item.size}: {formatMetres(item.startDepthDm)}–
            {formatMetres(item.endDepthDm)} · {item.status}
          </li>
        ))}
      </ul>
    </CollapsibleFieldSection>
  );
}

export function HoleSurveyPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { surveys } = analytics;
  return (
    <CollapsibleFieldSection title="Surveys">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-surveys">
        <MetricDisplay label="Total Surveys" value={surveys.totalSurveys} />
        <MetricDisplay
          label="First Survey depth"
          value={formatOptionalMetres(surveys.firstSurveyDepthDm)}
        />
        <MetricDisplay
          label="Latest Survey depth"
          value={formatOptionalMetres(surveys.latestSurveyDepthDm)}
        />
        <MetricDisplay
          label="Distance to latest"
          value={formatOptionalMetres(surveys.distanceFromFinalDepthToLatestDm)}
        />
        <MetricDisplay
          label="Average spacing"
          value={formatOptionalMetres(surveys.averageSurveySpacingDm)}
        />
        <MetricDisplay
          label="Median spacing"
          value={formatOptionalMetres(surveys.medianSurveySpacingDm)}
        />
        <MetricDisplay
          label="Largest gap"
          value={formatOptionalMetres(surveys.largestSurveyGapDm)}
        />
        <MetricDisplay
          label="Duplicate depths"
          value={surveys.duplicateDepthSurveyCount}
        />
        <MetricDisplay
          label="Corrected Surveys"
          value={surveys.correctedSurveyCount}
        />
        <MetricDisplay
          label="With photographs"
          value={surveys.surveysWithPhotographs}
        />
      </div>
      {surveys.mixedNorthReferenceWarning ? (
        <p
          role="status"
          className="mt-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3 text-sm"
        >
          {surveys.mixedNorthReferenceWarning}
        </p>
      ) : null}
    </CollapsibleFieldSection>
  );
}

export function HoleTrayPanel({ analytics }: { analytics: HoleAnalytics }) {
  const { trays } = analytics;
  return (
    <CollapsibleFieldSection title="Trays">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="hole-analytics-trays">
        <MetricDisplay label="Total Trays" value={trays.totalTrays} />
        <MetricDisplay
          label="First Tray"
          value={trays.firstTrayNumber ?? "—"}
        />
        <MetricDisplay
          label="Latest Tray"
          value={trays.latestTrayNumber ?? "—"}
        />
        <MetricDisplay
          label="With depth ranges"
          value={trays.traysWithDepthRanges}
        />
        <MetricDisplay
          label="Final partial"
          value={trays.finalPartialTrays}
        />
        <MetricDisplay
          label="Photo replacements"
          value={trays.photographReplacements}
        />
        <MetricDisplay
          label="Depth coverage"
          value={formatMetres(trays.depthCoverageDm)}
        />
        <MetricDisplay label="Coverage gaps" value={trays.coverageGaps} />
        <MetricDisplay label="Depth overlaps" value={trays.depthOverlaps} />
        <MetricDisplay
          label="Duplicate numbers"
          value={trays.duplicateNumberConflicts}
        />
        <MetricDisplay
          label="Uncovered to hole depth"
          value={formatOptionalMetres(trays.uncoveredIntervalToHoleDepthDm)}
        />
      </div>
    </CollapsibleFieldSection>
  );
}

export function HoleCompletenessPanel({
  analytics,
}: {
  analytics: HoleAnalytics;
}) {
  return (
    <CollapsibleFieldSection title="Record completeness" defaultOpen>
      <div data-testid="hole-analytics-completeness" className="space-y-3">
        <p className="text-sm text-[var(--tl-ink-muted)]">
          Transparent category checks — not a combined Hole score.
        </p>
        <ul className="space-y-2">
          {analytics.completeness.categories.map((category) => (
            <li
              key={category.category}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 py-2"
            >
              <span className="font-semibold">{category.category}</span>
              <span className="tl-tabular font-bold">{category.status}</span>
              {category.notes.length > 0 ? (
                <span className="basis-full text-sm text-[var(--tl-ink-muted)]">
                  {category.notes.join(" · ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </CollapsibleFieldSection>
  );
}

export function HoleChartsSection({ analytics }: { analytics: HoleAnalytics }) {
  return (
    <CollapsibleFieldSection title="Charts" defaultOpen>
      <p className="mb-3 text-sm text-[var(--tl-ink-muted)]">
        {HOLE_METRIC_DEFINITIONS.shortLongRuns}
      </p>
      <HoleAnalyticsCharts charts={analytics.charts} />
    </CollapsibleFieldSection>
  );
}
