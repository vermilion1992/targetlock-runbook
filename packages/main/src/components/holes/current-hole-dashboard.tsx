"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  CircleDot,
  Compass,
  Cylinder,
  Drill,
  History,
  MoveRight,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
  getHoleAnalytics,
  loadShiftAnalytics,
  type CurrentHoleState,
} from "@/application/runbook";
import type { HoleLifecycleState } from "@/infrastructure/completion";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { holeStatusLabel } from "@/components/holes/completion-support";
import { HoleLockedPanel } from "@/components/holes/hole-locked-panel";
import { QuickActions } from "@/components/holes/quick-actions";
import { HoleRecordSearch } from "@/components/holes/hole-record-search";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatOptionalMetres } from "@/components/holes/hole-analytics-format";
import { formatRecoveryTenths } from "@/components/shifts/shift-analytics-format";
import {
  addDecimetres,
  calculateRecoveryPercentage,
  decimetres,
  formatMetres,
  formatRecoveryPercentage,
  normalizeHoleStatus,
  type HoleAnalytics,
  type HoleTrajectoryComparison,
  type ShiftAnalytics,
} from "@/domain";
import type { TargetLockStage1Seed } from "@/infrastructure/seed";
import {
  formatMetresValue,
  formatVerticalOfPlan,
} from "@/components/trajectory/trajectory-format";

export function CurrentHoleDashboard({
  holeId,
  seed,
  notice,
}: {
  holeId: string;
  seed: TargetLockStage1Seed;
  notice?:
    | "shift-started"
    | "handover-accepted"
    | "final-shift-closed"
    | "survey-saved"
    | "tray-saved"
    | "hole-completed"
    | "hole-reopened";
}) {
  const [state, setState] = useState<CurrentHoleState | null>(null);
  const [lifecycle, setLifecycle] = useState<HoleLifecycleState | null>(null);
  const [shiftAnalytics, setShiftAnalytics] = useState<ShiftAnalytics | null>(
    null,
  );
  const [holeAnalytics, setHoleAnalytics] = useState<HoleAnalytics | null>(
    null,
  );
  const [trajectory, setTrajectory] = useState<HoleTrajectoryComparison | null>(
    null,
  );
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setWarning(
          "Browser storage is unavailable. Runbook continuity cannot be loaded.",
        ),
      );
      return;
    }
    void Promise.all([
      getCurrentHoleState(holeId, services.currentState),
      services.completion.getLifecycleState(holeId),
    ])
      .then(async ([nextState, nextLifecycle]) => {
        setState(nextState);
        setLifecycle(nextLifecycle);
        const active = nextState.activeShift;
        if (active && services.shiftAnalytics) {
          const analytics = await loadShiftAnalytics(
            holeId,
            active.localId,
            services.shiftAnalytics,
          );
          setShiftAnalytics(analytics);
        } else {
          setShiftAnalytics(null);
        }
        const locked =
          nextLifecycle?.status === "COMPLETED" ||
          nextLifecycle?.status === "ABANDONED";
        if (locked && services.holeAnalytics) {
          const completionId = nextLifecycle?.latestCompletion?.localId;
          const analytics = await getHoleAnalytics(
            holeId,
            services.holeAnalytics,
            completionId === undefined ? {} : { completionId },
          );
          setHoleAnalytics(analytics);
        } else {
          setHoleAnalytics(null);
        }
        if (services.trajectoryComparison) {
          try {
            setTrajectory(
              await services.trajectoryComparison.getComparison(holeId),
            );
          } catch {
            setTrajectory(null);
          }
        } else {
          setTrajectory(null);
        }
      })
      .catch((error: unknown) =>
        setWarning(error instanceof Error ? error.message : "Hole state could not be loaded."),
      );
  }, [holeId]);

  const isSeedHole = holeId === seed.hole.name;
  const holeStatus = lifecycle
    ? normalizeHoleStatus(lifecycle.status)
    : normalizeHoleStatus(isSeedHole ? seed.hole.status : "ACTIVE");
  const holeLocked =
    holeStatus === "COMPLETED" ||
    holeStatus === "ABANDONED" ||
    holeStatus === "ARCHIVED";
  const wasReopened = (lifecycle?.reopenHistory.length ?? 0) > 0 && !holeLocked;

  const activeShift = state?.activeShift ?? null;
  const pending = state?.pendingHandover ?? null;
  const loadingState = state === null && warning === null;
  const localRuns = state?.completedLocalRuns ?? [];
  const localRunIds = new Set(localRuns.map(({ localId }) => localId));
  const localRunNumbers = new Set(localRuns.map(({ runNumber }) => runNumber));
  const completedSeedRuns = (isSeedHole ? seed.runs : []).filter(
    (run) =>
      run.status !== "in_progress" &&
      !localRunIds.has(run.localId) &&
      !localRunNumbers.has(run.runNumber),
  );
  const totalDrilled = addDecimetres(
    ...completedSeedRuns.map(({ drilledLength }) => drilledLength),
    ...localRuns.map(({ drilledLengthDm }) => decimetres(drilledLengthDm)),
  );
  const totalRecovered = addDecimetres(
    ...completedSeedRuns.map(({ recoveredLength }) => recoveredLength),
    ...localRuns.map(({ recoveredLengthDm }) =>
      decimetres(recoveredLengthDm),
    ),
  );
  const recovery = calculateRecoveryPercentage(totalDrilled, totalRecovered);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow={
          isSeedHole
            ? `${seed.project.code} · ${seed.rig.name}`
            : "Local operational hole"
        }
        title={`${holeId} current hole`}
        description={
          isSeedHole
            ? `${seed.project.name} · ${seed.hole.holeSize} · planned ${formatMetres(seed.hole.plannedDepth)}`
            : "Run, shift, Survey, tray, and trajectory state stored independently for this hole."
        }
        action={
          loadingState ? (
            <StatusPill tone="neutral">Checking shift</StatusPill>
          ) : holeLocked ? (
            <StatusPill tone={holeStatus === "ABANDONED" ? "danger" : "success"}>
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              {holeStatusLabel(holeStatus)}
            </StatusPill>
          ) : activeShift ? (
            <StatusPill tone="success">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Active {activeShift.shiftType === "DAY" ? "Day" : "Night"} Shift
            </StatusPill>
          ) : pending ? (
            <StatusPill tone="warning">
              <Clock3 aria-hidden="true" className="size-3.5" />
              Handover pending
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">No active shift</StatusPill>
          )
        }
      />

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-success)] bg-[var(--tl-success-soft)] p-4"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="font-semibold text-[var(--tl-ink)]">
            {notice === "shift-started"
              ? "Runbook shift started successfully."
              : notice === "handover-accepted"
                ? "Handover accepted. The incoming shift now owns new work."
                : notice === "final-shift-closed"
                  ? "Final shift closed. Continue with final hole review when ready."
                  : notice === "survey-saved"
                    ? "Survey saved locally. Dashboard, history and timeline are updated."
                    : notice === "hole-completed"
                      ? "Hole completed and locked. Drilling mutations are blocked."
                      : notice === "hole-reopened"
                        ? "Hole reopened to Active. Review continuity before recording new work."
                        : "Tray photograph verified and saved locally."}
          </p>
        </div>
      ) : null}

      {wasReopened ? (
        <aside
          role="status"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4 font-semibold"
        >
          This hole was reopened. Review continuity of depth, casing, components,
          surveys, and trays before recording the next run.
        </aside>
      ) : null}

      {holeLocked ? (
        <HoleLockedPanel
          holeId={holeId}
          status={holeStatus}
          description={
            lifecycle?.latestCompletion
              ? `Final depth ${formatMetres(lifecycle.latestCompletion.snapshot.finalDepthDm)} · locked after completion review.`
              : undefined
          }
        />
      ) : null}

      {holeLocked && holeAnalytics ? (
        <SectionPanel title="HOLE PERFORMANCE">
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
            data-testid="hole-performance-teaser"
          >
            <MetricDisplay
              label="Final depth"
              value={formatMetres(
                holeAnalytics.production.currentOrFinalDepthDm,
              )}
              emphasis="strong"
            />
            <MetricDisplay
              label="Total Runs"
              value={holeAnalytics.production.totalCompletedRuns}
            />
            <MetricDisplay
              label="Overall recovery"
              value={formatRecoveryTenths(
                holeAnalytics.production.weightedRecoveryTenths,
              )}
            />
            <MetricDisplay
              label="Average metres per Shift"
              value={formatOptionalMetres(
                holeAnalytics.shifts.averageMetresPerCompletedShiftDm,
              )}
            />
            <MetricDisplay
              label="Bits used"
              value={holeAnalytics.components.bitsUsed}
            />
            <MetricDisplay
              label="Surveys"
              value={holeAnalytics.surveys.totalSurveys}
            />
            <MetricDisplay
              label="Trays"
              value={holeAnalytics.trays.totalTrays}
            />
          </div>
          <div className="mt-4">
            <Link
              href={runbookRoutes.statistics(holeId)}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline"
            >
              VIEW FULL ANALYTICS
            </Link>
          </div>
        </SectionPanel>
      ) : null}

      {warning ? (
        <aside
          role="alert"
          className="flex items-start gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="font-semibold text-[var(--tl-ink)]">{warning}</p>
        </aside>
      ) : null}

      <section
        aria-labelledby="shift-heading"
        className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5"
      >
        {loadingState ? (
          <div>
            <h2 id="shift-heading" className="text-lg font-bold text-[var(--tl-ink)]">
              Loading shift state…
            </h2>
            <p role="status" className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Checking this browser for the active shift and pending handover.
            </p>
          </div>
        ) : activeShift ? (
          <div className="space-y-4" data-testid="current-shift-summary">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-[var(--tl-success-soft)] text-[var(--tl-success)]">
                  <UserRound aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 id="shift-heading" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
                    CURRENT SHIFT
                  </h2>
                  <p className="text-lg font-bold text-[var(--tl-ink)]">
                    {activeShift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — {activeShift.shiftDate}
                  </p>
                  <p className="text-sm text-[var(--tl-ink-muted)]">
                    Driller: {activeShift.primaryDrillerNameSnapshot}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={runbookRoutes.shiftDetail(holeId, activeShift.localId)} className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold no-underline">
                  VIEW SHIFT
                </Link>
                <Link href={runbookRoutes.closeShift(holeId, activeShift.localId)} className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-warning)] px-4 font-bold text-[var(--tl-ink)] no-underline">
                  Close shift
                </Link>
              </div>
            </div>
            {shiftAnalytics ? (
              <div className="grid grid-cols-3 gap-3">
                <MetricDisplay
                  label="Metres completed"
                  value={formatMetres(shiftAnalytics.metresCompletedDm)}
                />
                <MetricDisplay
                  label="Runs completed"
                  value={shiftAnalytics.completedRunCount}
                />
                <MetricDisplay
                  label="Weighted recovery"
                  value={formatRecoveryTenths(
                    shiftAnalytics.weightedRecoveryTenths,
                  )}
                />
              </div>
            ) : null}
          </div>
        ) : pending ? (
          <div>
            <h2 id="shift-heading" className="text-lg font-bold text-[var(--tl-ink)]">Handover awaiting acceptance</h2>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              {pending.shiftType === "DAY" ? "Day Shift" : "Night Shift"} · {pending.primaryDrillerNameSnapshot}
            </p>
            <Link href={runbookRoutes.handover(holeId)} className="mt-4 inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline">
              Review handover
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="shift-heading" className="text-lg font-bold text-[var(--tl-ink)]">No active shift</h2>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Start a Day Shift or Night Shift before recording runs.
              </p>
            </div>
            <Link href={runbookRoutes.startShift(holeId)} className="inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline">
              Start shift
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="primary-actions-heading">
        <h2 id="primary-actions-heading" className="sr-only">Primary actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {loadingState ? (
            <div
              aria-disabled="true"
              className="flex min-h-16 items-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-5 py-4 text-base font-bold text-[var(--tl-ink-muted)]"
            >
              <Drill aria-hidden="true" className="size-6" />
              CHECKING ACTIVE SHIFT…
            </div>
          ) : holeLocked ? (
            <Link
              href={runbookRoutes.completeHole(holeId)}
              className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-5 py-4 text-base font-bold text-[var(--tl-ink)] no-underline"
            >
              <span className="flex items-center gap-3">
                <CheckCircle2 aria-hidden="true" className="size-6" />
                VIEW COMPLETION SNAPSHOT
              </span>
              <MoveRight aria-hidden="true" className="size-5" />
            </Link>
          ) : activeShift ? (
            <Link
              href={runbookRoutes.recordRun(holeId)}
              className="tl-action-primary flex min-h-16 items-center justify-between gap-3 rounded-[var(--tl-radius-md)] px-5 py-4 text-base font-bold text-white no-underline shadow-[var(--tl-shadow-sm)]"
            >
              <span className="flex items-center gap-3"><Drill aria-hidden="true" className="size-6" />RECORD NEXT RUN</span>
              <MoveRight aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <Link
              href={pending ? runbookRoutes.handover(holeId) : runbookRoutes.startShift(holeId)}
              aria-describedby="run-disabled-reason"
              className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-5 py-4 text-base font-bold text-[var(--tl-ink-muted)] no-underline"
            >
              <span className="flex items-center gap-3"><Drill aria-hidden="true" className="size-6" />RECORD NEXT RUN</span>
              <MoveRight aria-hidden="true" className="size-5" />
            </Link>
          )}
          {holeLocked ? (
            <Link
              href={runbookRoutes.completedHoles()}
              className="flex min-h-16 items-center justify-between rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-primary)] px-5 py-4 font-bold text-[var(--tl-primary)] no-underline"
            >
              <span className="flex items-center gap-3">
                <History aria-hidden="true" className="size-6" />
                COMPLETED HOLES LIST
              </span>
            </Link>
          ) : (
            <Link href={runbookRoutes.addTray(holeId)} className="flex min-h-16 items-center justify-between rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-primary)] px-5 py-4 font-bold text-[var(--tl-primary)] no-underline">
              <span className="flex items-center gap-3"><Camera aria-hidden="true" className="size-6" />PHOTOGRAPH COMPLETED TRAY</span>
            </Link>
          )}
        </div>
        {!holeLocked && !activeShift ? (
          <p id="run-disabled-reason" className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            Run entry redirects to the required shift workflow.
          </p>
        ) : null}
        {!holeLocked ? (
          <div className="mt-3">
            <Link
              href={runbookRoutes.completeHole(holeId)}
              className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              Open final hole review
            </Link>
          </div>
        ) : null}
      </section>

      <section aria-label="Current working values">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay label="Current depth" value={state ? formatMetres(state.currentDepthDm) : "Loading…"} emphasis="strong" className="col-span-2 md:col-span-2" />
          <MetricDisplay label="Next run" value={state?.nextRunNumber ?? "—"} emphasis="strong" />
          <MetricDisplay label="Rod number" value={state?.currentRodNumber ?? "—"} emphasis="strong" />
          <MetricDisplay label="Current R/S" value={state ? formatMetres(state.currentRodStringDm) : "—"} />
          <MetricDisplay label="Measured stick-up" value={state?.measuredStickUpDm === undefined ? "Not entered" : formatMetres(state.measuredStickUpDm)} />
          <MetricDisplay label="Overall recovery" value={formatRecoveryPercentage(recovery)} />
          <MetricDisplay label="Current tray" value={state?.currentTrayNumber ?? "—"} />
        </div>
      </section>

      <section aria-label="Latest survey and tray" className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5">
          <div className="flex items-center gap-2">
            <Compass aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">Latest survey</h2>
          </div>
          {state?.latestSurvey ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricDisplay label="Depth" value={formatMetres(state.latestSurvey.depthDm)} emphasis="strong" />
              <MetricDisplay label="Distance since" value={state.distanceSinceLatestSurveyDm === undefined ? "—" : formatMetres(state.distanceSinceLatestSurveyDm)} />
              <MetricDisplay label="Dip" value={`${(state.latestSurvey.dipTenths / 10).toFixed(1)}°`} />
              <MetricDisplay label="Azimuth" value={`${(state.latestSurvey.azimuthTenths / 10).toFixed(1)}° ${state.latestSurvey.northReference === "NOT_SPECIFIED" ? "" : state.latestSurvey.northReference}`} />
            </div>
          ) : (
            <p className="mt-3 text-[var(--tl-ink-muted)]">No survey recorded.</p>
          )}
          {state?.surveyIntervalReminder ? (
            <p className="mt-3 rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] p-3 text-sm font-bold">
              {state.surveyIntervalReminder.status === "DUE_IN"
                ? `Next survey due in approximately ${formatMetres(state.surveyIntervalReminder.distanceDm)}`
                : state.surveyIntervalReminder.status === "EXCEEDED"
                  ? `Survey interval exceeded by ${formatMetres(state.surveyIntervalReminder.distanceDm)}`
                  : "Survey is due now"}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={runbookRoutes.addSurvey(holeId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">Add survey</Link>
            <Link href={runbookRoutes.surveys(holeId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">View history</Link>
          </div>
        </article>
        <article className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5">
          <div className="flex items-center gap-2">
            <Camera aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">Current tray</h2>
          </div>
          {state?.lastCompletedTray ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricDisplay label="Last completed tray" value={state.lastCompletedTray.trayNumber} emphasis="strong" />
              <MetricDisplay
                label="Depth range"
                value={
                  state.lastCompletedTray.startDepthDm === undefined ||
                  state.lastCompletedTray.endDepthDm === undefined
                    ? "Not recorded"
                    : `${formatMetres(state.lastCompletedTray.startDepthDm)}–${formatMetres(state.lastCompletedTray.endDepthDm)}`
                }
              />
            </div>
          ) : (
            <p className="mt-3 text-[var(--tl-ink-muted)]">No completed tray recorded.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={runbookRoutes.addTray(holeId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">Photograph next tray</Link>
            <Link href={runbookRoutes.trays(holeId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">View library</Link>
          </div>
        </article>
      </section>

      {trajectory &&
      !trajectory.blocked &&
      trajectory.currentTrackingPoint ? (
        <section
          aria-label="Trajectory tracking"
          className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5"
          data-testid="trajectory-tracking-card"
        >
          <div className="flex items-center gap-2">
            <Compass aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Trajectory tracking
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetricDisplay
              label="Latest Survey"
              value={formatMetresValue(
                trajectory.currentTrackingPoint.measuredDepthM,
              )}
              emphasis="strong"
            />
            <MetricDisplay
              label="Horizontal deviation from plan"
              value={formatMetresValue(
                trajectory.currentTrackingPoint.horizontalDeviationM,
              )}
            />
            <MetricDisplay
              label="Vertical deviation from plan"
              value={formatVerticalOfPlan(
                trajectory.currentTrackingPoint.deltaRlM,
              )}
            />
            <MetricDisplay
              label="Distance to target"
              value={
                trajectory.targetTracking
                  ? formatMetresValue(
                      trajectory.targetTracking.actualEndpointDistanceM,
                    )
                  : "Not configured"
              }
            />
          </div>
          <div className="mt-4">
            <Link
              href={runbookRoutes.trajectory(holeId)}
              className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              View trajectory
            </Link>
          </div>
        </section>
      ) : null}

      <HoleRecordSearch holeId={holeId} />

      <QuickActions holeId={holeId} />

      <SectionPanel
        title="Casing and active components"
        description="Repository-backed permanent hole records. Changes are saved locally before this view updates."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4">
            <div className="flex items-center gap-2">
              <CircleDot aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
                Active bit
              </h3>
            </div>
            <p className="mt-2 break-all text-lg font-bold text-[var(--tl-ink)]">
              {state?.activeBitSerialNumber ?? "Not assigned"}
            </p>
            {state?.activeBitAssignment ? (
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Active from {formatMetres(state.activeBitAssignment.startDepthDm)}
                {" · "}
                {formatMetres(
                  state.activeBitUsage?.drilledMetresDm ?? decimetres(0),
                )}{" "}
                recorded
              </p>
            ) : null}
            <Link
              href={
                state?.activeBitAssignment
                  ? runbookRoutes.changeBit(holeId)
                  : runbookRoutes.assignComponent(holeId, "bit")
              }
              className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              {state?.activeBitAssignment ? "Change bit" : "Assign bit"}
            </Link>
          </article>
          <article className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4">
            <div className="flex items-center gap-2">
              <CircleDot aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
                Active reamer
              </h3>
            </div>
            <p className="mt-2 break-all text-lg font-bold text-[var(--tl-ink)]">
              {state?.activeReamerSerialNumber ?? "Not assigned"}
            </p>
            {state?.activeReamerAssignment ? (
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Active from{" "}
                {formatMetres(state.activeReamerAssignment.startDepthDm)}
                {" · "}
                {formatMetres(
                  state.activeReamerUsage?.drilledMetresDm ?? decimetres(0),
                )}{" "}
                recorded
              </p>
            ) : null}
            <Link
              href={
                state?.activeReamerAssignment
                  ? runbookRoutes.changeReamer(holeId)
                  : runbookRoutes.assignComponent(holeId, "reamer")
              }
              className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              {state?.activeReamerAssignment ? "Change reamer" : "Assign reamer"}
            </Link>
          </article>
          <article className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4">
            <div className="flex items-center gap-2">
              <Cylinder aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
                Casing
              </h3>
            </div>
            {state?.casingStrings.length ? (
              <ul className="mt-2 space-y-1">
                {state.casingStrings
                  .filter(({ status }) => status === "ACTIVE")
                  .map((casing) => (
                    <li key={casing.localId} className="font-bold text-[var(--tl-ink)]">
                      {casing.casingSize} to{" "}
                      {formatMetres(casing.currentEndDepthDm)}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 font-bold text-[var(--tl-ink)]">No casing recorded</p>
            )}
            <Link
              href={
                state?.casingStrings.length
                  ? runbookRoutes.casing(holeId)
                  : runbookRoutes.addCasing(holeId)
              }
              className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              {state?.casingStrings.length ? "Update casing" : "Add casing"}
            </Link>
          </article>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href={runbookRoutes.holeComponents(holeId)} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
            <History aria-hidden="true" className="size-5" /> Component history
          </Link>
          <Link href={runbookRoutes.casing(holeId)} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
            <History aria-hidden="true" className="size-5" /> Casing history
          </Link>
        </div>
      </SectionPanel>

      <LocalPrototypeNotice />
    </div>
  );
}
