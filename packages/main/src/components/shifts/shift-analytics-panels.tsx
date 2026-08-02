"use client";

import { formatMetres, type ShiftAnalytics } from "@/domain";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";

import { CollapsibleFieldSection } from "./collapsible-field-section";
import {
  formatGrossMetresPerHour,
  formatOptionalMetres,
  formatOptionalMinutes,
  formatRecoveryTenths,
  runRangeLabel,
} from "./shift-analytics-format";
import { ShiftRunCharts } from "./shift-run-charts";

export function ShiftBreakdownPanel({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  return (
    <SectionPanel
      title="Shift summary"
      description="From completed runs this shift."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricDisplay
          label="Starting depth"
          value={formatMetres(analytics.startingDepthDm)}
        />
        <MetricDisplay
          label="Ending depth"
          value={formatMetres(analytics.endingDepthDm)}
        />
        <MetricDisplay
          label="Metres completed"
          value={formatMetres(analytics.metresCompletedDm)}
          emphasis="strong"
        />
        <MetricDisplay
          label="Runs completed"
          value={analytics.completedRunCount}
        />
        <MetricDisplay
          label="Average Run"
          value={formatOptionalMetres(analytics.averageRunLengthDm)}
        />
        <MetricDisplay
          label="Median Run"
          value={formatOptionalMetres(analytics.medianRunLengthDm)}
        />
      </div>
    </SectionPanel>
  );
}

export function RodActivityPanel({ analytics }: { analytics: ShiftAnalytics }) {
  return (
    <SectionPanel title="ROD ACTIVITY">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricDisplay label="3.0 m rods added" value={analytics.rodsAdded3m} />
        <MetricDisplay label="6.0 m rods added" value={analytics.rodsAdded6m} />
        <MetricDisplay label="Rods removed" value={analytics.rodsRemoved} />
        <MetricDisplay
          label="Rod number"
          value={`${analytics.startingRodNumber} → ${analytics.endingRodNumber}`}
        />
        <MetricDisplay
          label="R/S"
          value={`${formatMetres(analytics.startingRodStringDm)} → ${formatMetres(analytics.endingRodStringDm)}`}
        />
        {analytics.bhaOrStickUpConfigChangeCount > 0 ? (
          <MetricDisplay
            label="BHA / stick-up changes"
            value={analytics.bhaOrStickUpConfigChangeCount}
          />
        ) : null}
      </div>
    </SectionPanel>
  );
}

export function ShiftRecordsPanel({ analytics }: { analytics: ShiftAnalytics }) {
  return (
    <SectionPanel title="SHIFT RECORDS">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricDisplay label="Surveys" value={analytics.surveyCount} />
        <MetricDisplay label="Trays" value={analytics.trayCount} />
        <MetricDisplay
          label="Casing updates"
          value={analytics.casingEventCount}
        />
        <MetricDisplay label="Bit changes" value={analytics.bitChangeCount} />
        <MetricDisplay
          label="Reamer changes"
          value={analytics.reamerChangeCount}
        />
        <MetricDisplay label="Shared Runs" value={analytics.sharedRunCount} />
        <MetricDisplay
          label="Corrections"
          value={analytics.runCorrectionCount}
        />
        <MetricDisplay label="Voided Runs" value={analytics.voidedRunCount} />
      </div>
    </SectionPanel>
  );
}

export function ShiftTimeMetricsPanel({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  return (
    <CollapsibleFieldSection
      title="Time metrics"
      description="Elapsed Shift time and recorded Run-cycle times"
    >
      <div className="grid grid-cols-2 gap-3">
        <MetricDisplay
          label="Elapsed Shift duration"
          value={formatOptionalMinutes(analytics.elapsedMinutes)}
        />
        <MetricDisplay
          label="Gross metres per elapsed Shift hour"
          value={formatGrossMetresPerHour(
            analytics.grossMetresPerElapsedHourTenths,
          )}
        />
        <MetricDisplay
          label="Recorded average Run-cycle time"
          value={formatOptionalMinutes(
            analytics.averageRecordedRunCycleMinutes,
          )}
        />
        <MetricDisplay
          label="Recorded median Run-cycle time"
          value={formatOptionalMinutes(analytics.medianRecordedRunCycleMinutes)}
        />
      </div>
      <details className="mt-4 text-sm text-[var(--tl-ink-muted)]">
        <summary className="min-h-11 cursor-pointer font-semibold text-[var(--tl-ink)]">
          About these time metrics
        </summary>
        <p className="mt-2">
          Gross metres/hour is based on elapsed Shift time and includes all
          recorded Shift activity.
        </p>
        <p className="mt-2">
          Run-cycle time is based on Runbook timestamps and may not equal
          machine drilling time.
        </p>
      </details>
    </CollapsibleFieldSection>
  );
}

export function ShiftAmendmentBanner({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  if (!analytics.analyticsAmended || analytics.amendmentSummary === undefined) {
    return null;
  }
  const summary = analytics.amendmentSummary;
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
    >
      <h2 className="font-bold">SHIFT ANALYTICS AMENDED</h2>
      <p className="mt-2 text-sm">
        A Run was corrected after Shift close. Original close snapshot is
        preserved; current values use corrected effective data.
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-[var(--tl-ink-muted)]">
            Original metres
          </dt>
          <dd>{formatMetres(summary.originalMetresCompletedDm)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--tl-ink-muted)]">
            Current calculated metres
          </dt>
          <dd>{formatMetres(summary.currentMetresCompletedDm)}</dd>
        </div>
        {summary.originalWeightedRecoveryTenths !== undefined ||
        summary.currentWeightedRecoveryTenths !== undefined ? (
          <>
            <div>
              <dt className="font-semibold text-[var(--tl-ink-muted)]">
                Original weighted recovery
              </dt>
              <dd>
                {formatRecoveryTenths(summary.originalWeightedRecoveryTenths)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--tl-ink-muted)]">
                Current weighted recovery
              </dt>
              <dd>
                {formatRecoveryTenths(summary.currentWeightedRecoveryTenths)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      {summary.responsibleCorrectionIds.length > 0 ? (
        <p className="mt-3 text-sm">
          Correction responsible:{" "}
          {summary.responsibleCorrectionIds.join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-sm">
          Correction responsible: see Run correction history for this Shift.
        </p>
      )}
      {analytics.closeSnapshot ? (
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold">
            View original close snapshot
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Ending depth {formatMetres(analytics.closeSnapshot.endingDepthDm)}
            </li>
            <li>
              Metres {formatMetres(analytics.closeSnapshot.metresCompletedDm)}
            </li>
            <li>
              Runs {analytics.closeSnapshot.completedRunCount}
            </li>
            <li>
              Recovery{" "}
              {formatRecoveryTenths(
                analytics.closeSnapshot.weightedRecoveryTenths,
              )}
            </li>
            <li>Captured {analytics.closeSnapshot.capturedAt}</li>
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function HandoverOutstandingPanel({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  if (analytics.unresolvedItems.length === 0) {
    return (
      <SectionPanel title="Outstanding items">
        <p className="text-sm text-[var(--tl-ink-muted)]">
          No unresolved handover items.
        </p>
      </SectionPanel>
    );
  }
  return (
    <SectionPanel title="Outstanding items">
      <ul className="space-y-2" aria-live="polite">
        {analytics.unresolvedItems.map((item) => (
          <li
            key={`${item.code}-${item.message}`}
            className="rounded-[var(--tl-radius-sm)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] px-3 py-2 text-sm font-semibold"
          >
            {item.message}
          </li>
        ))}
      </ul>
    </SectionPanel>
  );
}

export function HandoverCompletedWorkPanel({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  return (
    <SectionPanel title="Completed work">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricDisplay
          label="Metres completed"
          value={formatMetres(analytics.metresCompletedDm)}
        />
        <MetricDisplay label="Run range" value={runRangeLabel(analytics)} />
        <MetricDisplay
          label="Weighted recovery"
          value={formatRecoveryTenths(analytics.weightedRecoveryTenths)}
        />
        <MetricDisplay
          label="Rod number"
          value={`${analytics.startingRodNumber} → ${analytics.endingRodNumber}`}
        />
        <MetricDisplay
          label="R/S"
          value={`${formatMetres(analytics.startingRodStringDm)} → ${formatMetres(analytics.endingRodStringDm)}`}
        />
        <MetricDisplay
          label="Surveys / Trays"
          value={`${analytics.surveyCount} / ${analytics.trayCount}`}
        />
      </div>
    </SectionPanel>
  );
}

export function ShiftDetailAnalyticsSections({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  return (
    <div className="space-y-5">
      <ShiftAmendmentBanner analytics={analytics} />
      <SectionPanel title="1. Overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay
            label="Metres completed"
            value={formatMetres(analytics.metresCompletedDm)}
            emphasis="strong"
          />
          <MetricDisplay
            label="Runs completed"
            value={analytics.completedRunCount}
          />
          <MetricDisplay
            label="Weighted recovery"
            value={formatRecoveryTenths(analytics.weightedRecoveryTenths)}
          />
          <MetricDisplay
            label="Shared Runs"
            value={analytics.sharedRunCount}
          />
        </div>
      </SectionPanel>
      <SectionPanel title="2. Production">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricDisplay
            label="Starting depth"
            value={formatMetres(analytics.startingDepthDm)}
          />
          <MetricDisplay
            label="Ending depth"
            value={formatMetres(analytics.endingDepthDm)}
          />
          <MetricDisplay
            label="Average Run"
            value={formatOptionalMetres(analytics.averageRunLengthDm)}
          />
          <MetricDisplay
            label="Median Run"
            value={formatOptionalMetres(analytics.medianRunLengthDm)}
          />
          <MetricDisplay
            label="Shortest Run"
            value={formatOptionalMetres(analytics.shortestRunLengthDm)}
          />
          <MetricDisplay
            label="Longest Run"
            value={formatOptionalMetres(analytics.longestRunLengthDm)}
          />
        </div>
      </SectionPanel>
      <SectionPanel title="3. Recovery">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay
            label="Total recovered"
            value={formatMetres(analytics.totalRecoveredDm)}
          />
          <MetricDisplay
            label="Weighted recovery"
            value={formatRecoveryTenths(analytics.weightedRecoveryTenths)}
          />
          <MetricDisplay
            label="Core loss"
            value={formatMetres(analytics.totalCoreLossDm)}
          />
          <MetricDisplay
            label="Core gain"
            value={formatMetres(analytics.totalCoreGainDm)}
          />
        </div>
      </SectionPanel>
      <RodActivityPanel analytics={analytics} />
      <ShiftRecordsPanel analytics={analytics} />
      <HandoverOutstandingPanel analytics={analytics} />
      <SectionPanel title="7. Corrections and voids">
        <div className="grid grid-cols-2 gap-3">
          <MetricDisplay
            label="Run corrections"
            value={analytics.runCorrectionCount}
          />
          <MetricDisplay
            label="Voided Runs"
            value={analytics.voidedRunCount}
          />
          <MetricDisplay
            label="Corrected Run status"
            value={analytics.correctedRunCount}
          />
        </div>
      </SectionPanel>
      <SectionPanel title="8. Runs">
        <ShiftRunCharts analytics={analytics} />
      </SectionPanel>
      <ShiftTimeMetricsPanel analytics={analytics} />
    </div>
  );
}

export function CloseShiftAnalyticsPreview({
  analytics,
}: {
  analytics: ShiftAnalytics;
}) {
  return (
    <div data-testid="shift-close-analytics">
      <ShiftBreakdownPanel analytics={analytics} />
    </div>
  );
}
