"use client";

import { History, Moon, Sun, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getShiftRunGroups,
  getShiftStatistics,
  loadAnalyticsForAllShifts,
  type ShiftRunGroup,
  type ShiftStatistics,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres, type ShiftAnalytics } from "@/domain";
import { targetLockStage2Seed } from "@/infrastructure/seed";
import { getBrowserRuntimeMode } from "@/infrastructure/sync";

import { formatRecoveryTenths } from "./shift-analytics-format";

const emptyStats: ShiftStatistics = {
  dayShiftRuns: 0,
  nightShiftRuns: 0,
  sharedRuns: 0,
  totalHandovers: 0,
  runsByPrimaryDriller: {},
};

export function ShiftHistory({ holeId }: { holeId: string }) {
  const [groups, setGroups] = useState<readonly ShiftRunGroup[]>([]);
  const [stats, setStats] = useState<ShiftStatistics>(emptyStats);
  const [analyticsByShift, setAnalyticsByShift] = useState<
    ReadonlyMap<string, ShiftAnalytics>
  >(new Map());
  const [message, setMessage] = useState("Loading shift history…");

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.shifts.listByHole(holeId),
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
      services.shiftAnalytics
        ? loadAnalyticsForAllShifts(holeId, services.shiftAnalytics)
        : Promise.resolve(new Map<string, ShiftAnalytics>()),
    ])
      .then(([shifts, runs, analyticsMap]) => {
        if (runs.status === "invalid") throw new Error(runs.reason);
        const nextGroups = getShiftRunGroups({
          holeId,
          shifts,
          seedRuns:
            getBrowserRuntimeMode() === "demo"
              ? targetLockStage2Seed.runs
              : [],
          localRuns: runs.snapshots,
        });
        setGroups(nextGroups);
        setStats(getShiftStatistics(nextGroups));
        setAnalyticsByShift(analyticsMap);
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Shift history could not be loaded."),
      );
  }, [holeId]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 2 · local history"
        title={`${holeId} shifts`}
        description="Day and Night Shift snapshots, handovers, shared runs, and runbook-focused statistics."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={<StatusPill tone="info"><History aria-hidden="true" className="size-4" />{groups.length} shifts</StatusPill>}
      />

      <section aria-label="Shift statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricDisplay label="Day Shift runs" value={stats.dayShiftRuns} />
        <MetricDisplay label="Night Shift runs" value={stats.nightShiftRuns} />
        <MetricDisplay label="Shared runs" value={stats.sharedRuns} emphasis="strong" />
        <MetricDisplay label="Total handovers" value={stats.totalHandovers} />
      </section>

      <SectionPanel title="Runs by primary driller" description="Run counts only; no hours, costs, delays, or payroll values.">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(stats.runsByPrimaryDriller).map(([name, count]) => (
            <div key={name} className="flex min-h-12 items-center justify-between rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] px-4">
              <span className="flex items-center gap-2 font-semibold"><UsersRound aria-hidden="true" className="size-5" />{name}</span>
              <strong>{count} runs</strong>
            </div>
          ))}
        </div>
      </SectionPanel>

      {message ? <p role="status" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4">{message}</p> : null}

      <section aria-labelledby="shift-list-heading">
        <h2 id="shift-list-heading" className="mb-3 text-lg font-bold">Shift history</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => {
            const shift = group.shift;
            const Icon = shift.shiftType === "DAY" ? Sun : Moon;
            const analytics = analyticsByShift.get(shift.localId);
            return (
              <article key={shift.localId} className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]" data-testid="shift-history-card">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="flex size-11 items-center justify-center rounded-full bg-[var(--tl-primary-soft)]"><Icon aria-hidden="true" className="size-5" /></span>
                    <div>
                      <h3 className="font-bold">{shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — {shift.shiftDate}</h3>
                      <p className="text-sm text-[var(--tl-ink-muted)]">{shift.primaryDrillerNameSnapshot}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill tone={shift.status === "OPEN" ? "success" : shift.status === "HANDOVER_PENDING" ? "warning" : "neutral"}>
                      {shift.status.replaceAll("_", " ")}
                    </StatusPill>
                    {analytics?.analyticsAmended ? (
                      <StatusPill tone="warning">Amended</StatusPill>
                    ) : null}
                  </div>
                </header>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-bold text-[var(--tl-ink-muted)]">Depth</dt>
                    <dd className="font-bold">
                      {formatMetres(analytics?.startingDepthDm ?? shift.startingDepthDm)}
                      {" → "}
                      {analytics
                        ? formatMetres(analytics.endingDepthDm)
                        : shift.endingDepthDm === undefined
                          ? "Open"
                          : formatMetres(shift.endingDepthDm)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-[var(--tl-ink-muted)]">Metres</dt>
                    <dd className="font-bold">
                      {analytics
                        ? formatMetres(analytics.metresCompletedDm)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-[var(--tl-ink-muted)]">Runs</dt>
                    <dd className="font-bold">
                      {analytics?.completedRunCount ??
                        (group.firstRunNumber === undefined
                          ? "None"
                          : `${group.firstRunNumber}–${group.lastRunNumber}`)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-[var(--tl-ink-muted)]">Recovery</dt>
                    <dd className="font-bold">
                      {formatRecoveryTenths(analytics?.weightedRecoveryTenths)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-[var(--tl-ink-muted)]">Shared</dt>
                    <dd className="font-bold">
                      {(analytics?.sharedRunCount ?? group.sharedRunCount) === 1
                        ? "1 shared Run"
                        : `${analytics?.sharedRunCount ?? group.sharedRunCount} shared Runs`}
                    </dd>
                  </div>
                </dl>
                {shift.handoverNote ? <p className="mt-4 border-t border-[var(--tl-border)] pt-3 text-sm text-[var(--tl-ink-muted)]">{shift.handoverNote}</p> : null}
                <Link href={runbookRoutes.shiftDetail(holeId, shift.localId)} className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">View shift detail</Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
