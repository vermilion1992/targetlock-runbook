"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
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
  deriveDrillingReadiness,
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
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatOptionalMetres } from "@/components/holes/hole-analytics-format";
import { formatRecoveryTenths } from "@/components/shifts/shift-analytics-format";
import { BhaBarrelSetupDisplay } from "@/components/components/bha-barrel-setup-display";
import {
  cardActionOutline,
  cardActionPrimary,
  cardActionSecondary,
  cardActionWarning,
} from "@/components/field/card-action-styles";
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
  formatSignedMetres,
} from "@/components/trajectory/trajectory-format";

export function CurrentHoleDashboard({
  holeId,
  seed,
  notice,
}: {
  holeId: string;
  seed: TargetLockStage1Seed | null;
  notice?:
    | "shift-started"
    | "handover-accepted"
    | "final-shift-closed"
    | "survey-saved"
    | "tray-saved"
    | "hole-completed"
    | "hole-reopened"
    | "bha-updated";
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
  const [directoryContext, setDirectoryContext] = useState<{
    readonly projectCode: string;
    readonly projectName: string;
    readonly rigName: string;
  } | null>(null);
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
        if (nextLifecycle) {
          const [project, rig] = await Promise.all([
            services.projects.getProject(nextLifecycle.hole.projectId),
            services.projects.getRig(nextLifecycle.hole.rigId),
          ]);
          setDirectoryContext(
            project && rig
              ? {
                  projectCode: project.code,
                  projectName: project.name,
                  rigName: rig.name,
                }
              : null,
          );
        } else {
          setDirectoryContext(null);
        }
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

  const isSeedHole = seed !== null && holeId === seed.hole.localId;
  const holeStatus = lifecycle
    ? normalizeHoleStatus(lifecycle.status)
    : normalizeHoleStatus(isSeedHole && seed ? seed.hole.status : "DRAFT");
  const holeLocked =
    holeStatus === "COMPLETED" ||
    holeStatus === "ABANDONED" ||
    holeStatus === "ARCHIVED";
  const lifecycleBlocked =
    !holeLocked && holeStatus !== "DRAFT" && holeStatus !== "ACTIVE";
  const wasReopened = (lifecycle?.reopenHistory.length ?? 0) > 0 && !holeLocked;

  const activeShift = state?.activeShift ?? null;
  const pending = state?.pendingHandover ?? null;
  const loadingState = state === null && warning === null;
  const drillingReadiness =
    state === null
      ? null
      : deriveDrillingReadiness({
          holeStatus,
          bhaSetup: state.bhaSetup,
        });
  const setupRequired =
    !holeLocked &&
    !lifecycleBlocked &&
    drillingReadiness !== null &&
    !drillingReadiness.ready;
  const localRuns = state?.completedLocalRuns ?? [];
  const localRunIds = new Set(localRuns.map(({ localId }) => localId));
  const localRunNumbers = new Set(localRuns.map(({ runNumber }) => runNumber));
  const completedSeedRuns = (isSeedHole && seed ? seed.runs : []).filter(
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
  const recovery =
    totalDrilled > 0
      ? calculateRecoveryPercentage(totalDrilled, totalRecovered)
      : null;

  const activeCasingStrings = (state?.casingStrings ?? []).filter(
    ({ status }) => status === "ACTIVE",
  );
  const primaryCasing =
    [...activeCasingStrings].sort(
      (left, right) =>
        Number(right.currentEndDepthDm) - Number(left.currentEndDepthDm),
    )[0] ?? null;
  const secondaryCasingLine =
    activeCasingStrings.length > 1
      ? activeCasingStrings
          .filter(({ localId }) => localId !== primaryCasing?.localId)
          .map(
            (casing) =>
              `${casing.casingSize} to ${formatMetres(casing.currentEndDepthDm)}`,
          )
          .join(" · ")
      : null;
  const hasAnyCasing = (state?.casingStrings.length ?? 0) > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow={
          directoryContext
            ? `${directoryContext.projectCode} · ${directoryContext.rigName}`
            : isSeedHole && seed
              ? `${seed.project.code} · ${seed.rig.name}`
              : "Local operational hole"
        }
        title={`${holeId} overview`}
        description={
          lifecycle
            ? `${directoryContext?.projectName ?? "Project"} · ${lifecycle.hole.holeSize} · planned ${formatMetres(lifecycle.hole.plannedDepth)}${lifecycle.hole.planReference ? ` · Plan ${lifecycle.hole.planReference}${lifecycle.hole.planRevision ? ` (${lifecycle.hole.planRevision})` : ""}` : ""}`
            : isSeedHole && seed
              ? `${seed.project.name} · ${seed.hole.holeSize} · planned ${formatMetres(seed.hole.plannedDepth)}`
              : "Run, shift, survey, tray and trajectory state for this hole."
        }
        action={
          loadingState ? (
            <StatusPill tone="neutral">Checking shift</StatusPill>
          ) : holeLocked ? (
            <StatusPill tone={holeStatus === "ABANDONED" ? "danger" : "success"}>
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              {holeStatusLabel(holeStatus)}
            </StatusPill>
          ) : lifecycleBlocked ? (
            <StatusPill tone="warning">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              {holeStatusLabel(holeStatus)}
            </StatusPill>
          ) : setupRequired ? (
            <StatusPill tone="warning">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Setup required
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
                        : notice === "bha-updated"
                          ? "Bottom-hole assembly updated. Overview and rod-string base length use the new setup."
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

      {setupRequired ? (
        <section
          aria-labelledby="drilling-setup-required-heading"
          data-testid="drilling-setup-required"
          className="rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-[var(--tl-warning)]"
            />
            <div>
              <h2
                id="drilling-setup-required-heading"
                className="text-xl font-bold text-[var(--tl-ink)]"
              >
                Drilling setup required
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--tl-ink)]">
                Record the initial BHA measurements before starting the first
                shift or recording a run.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-[var(--tl-ink)]">
                {drillingReadiness.blockers.map((blocker) => (
                  <li key={blocker.code}>• {blocker.message}</li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            href={runbookRoutes.updateBha(holeId)}
            className={`${cardActionPrimary} mt-5 min-h-12 w-full sm:w-auto`}
          >
            Update BHA — next action
          </Link>
        </section>
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
            <div className="grid grid-cols-2 gap-3">
              {shiftAnalytics ? (
                <>
                  <MetricDisplay
                    label="Metres completed"
                    value={formatMetres(shiftAnalytics.metresCompletedDm)}
                  />
                  <MetricDisplay
                    label="Runs completed"
                    value={shiftAnalytics.completedRunCount}
                  />
                </>
              ) : null}
              <Link
                href={runbookRoutes.shiftDetail(holeId, activeShift.localId)}
                className={cardActionSecondary}
              >
                View shift
              </Link>
              <Link
                href={runbookRoutes.closeShift(holeId, activeShift.localId)}
                className={cardActionWarning}
              >
                Close shift
              </Link>
            </div>
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
        ) : lifecycleBlocked ? (
          <div>
            <h2 id="shift-heading" className="text-lg font-bold text-[var(--tl-ink)]">
              Shift start unavailable
            </h2>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Hole status {holeStatusLabel(holeStatus)} must be resolved before
              drilling work can continue.
            </p>
          </div>
        ) : setupRequired ? (
          <div>
            <div>
              <h2 id="shift-heading" className="text-lg font-bold text-[var(--tl-ink)]">
                Shift locked until setup is complete
              </h2>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Use the next action above to record BHA length and constant
                stick-up.
              </p>
            </div>
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
        <div className={holeLocked ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
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
          ) : lifecycleBlocked ? (
            <div
              aria-disabled="true"
              aria-describedby="run-disabled-reason"
              className="flex min-h-16 items-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-5 py-4 text-base font-bold text-[var(--tl-ink-muted)]"
            >
              <Drill aria-hidden="true" className="size-6" />
              RECORD NEXT RUN — HOLE NOT OPERATIONAL
            </div>
          ) : activeShift ? (
            <Link
              href={runbookRoutes.recordRun(holeId)}
              className="tl-action-primary flex min-h-16 items-center justify-between gap-3 rounded-[var(--tl-radius-md)] px-5 py-4 text-base font-bold text-white no-underline shadow-[var(--tl-shadow-sm)]"
            >
              <span className="flex items-center gap-3"><Drill aria-hidden="true" className="size-6" />RECORD NEXT RUN</span>
              <MoveRight aria-hidden="true" className="size-5" />
            </Link>
          ) : setupRequired ? (
            <div
              aria-disabled="true"
              aria-describedby="run-disabled-reason"
              className="flex min-h-16 items-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-5 py-4 text-base font-bold text-[var(--tl-ink-muted)]"
            >
              <Drill aria-hidden="true" className="size-6" />
              RECORD NEXT RUN — LOCKED
            </div>
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
          ) : null}
        </div>
        {!holeLocked && (!activeShift || lifecycleBlocked) ? (
          <p id="run-disabled-reason" className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            {lifecycleBlocked
              ? `Hole status ${holeStatusLabel(holeStatus)} does not allow drilling operations.`
              : setupRequired
              ? drillingReadiness.blockers.map(({ message }) => message).join(" ")
              : "Start or accept a shift before recording the next run."}
          </p>
        ) : null}
      </section>

      <section aria-label="Current working values">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay label="Current depth" value={state ? formatMetres(state.currentDepthDm) : "Loading…"} emphasis="strong" className="col-span-2 md:col-span-2" />
          <MetricDisplay label="Next run" value={state?.nextRunNumber ?? "—"} emphasis="strong" />
          <MetricDisplay label="Rod number" value={state?.currentRodNumber ?? "—"} emphasis="strong" />
          <MetricDisplay label="Current R/S" value={state ? formatMetres(state.currentRodStringDm) : "—"} />
          <MetricDisplay label="Measured stick-up" value={state?.measuredStickUpDm === undefined ? "Not entered" : formatMetres(state.measuredStickUpDm)} />
          <MetricDisplay
            label="Overall recovery"
            value={recovery === null ? "—" : formatRecoveryPercentage(recovery)}
          />
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
          <div className="mt-4">
            <Link href={runbookRoutes.addSurvey(holeId)} className={cardActionOutline}>
              <Compass aria-hidden="true" className="size-6" />
              Add survey
            </Link>
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
          <div className="mt-4">
            <Link href={runbookRoutes.addTray(holeId)} className={cardActionOutline}>
              <Camera aria-hidden="true" className="size-6" />
              Photograph tray
            </Link>
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
              value={formatSignedMetres(
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
            <Link href={runbookRoutes.trajectory(holeId)} className={cardActionOutline}>
              <Compass aria-hidden="true" className="size-6" />
              View trajectory
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-label="Casing and BHA" className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5">
          <div className="flex items-center gap-2">
            <Cylinder aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Casing
            </h2>
          </div>
          {primaryCasing ? (
            <div className="mt-3">
              <MetricDisplay
                label="Active casing"
                value={`${primaryCasing.casingSize} to ${formatMetres(primaryCasing.currentEndDepthDm)}`}
                emphasis="strong"
                supportingText={
                  secondaryCasingLine
                    ? `Also active: ${secondaryCasingLine}`
                    : undefined
                }
              />
            </div>
          ) : (
            <p className="mt-3 font-bold text-[var(--tl-ink)]">No casing recorded</p>
          )}
          <div className="mt-4">
            <Link
              href={
                hasAnyCasing
                  ? runbookRoutes.casing(holeId)
                  : runbookRoutes.addCasing(holeId)
              }
              className={cardActionOutline}
            >
              <Cylinder aria-hidden="true" className="size-6" />
              {hasAnyCasing ? "Update casing" : "Add casing"}
            </Link>
          </div>
        </article>

        <article
          className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5"
          data-testid="bha-overview-card"
        >
          <div className="flex items-center gap-2">
            <Drill aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Bottom hole assembly
            </h2>
          </div>
          <div className="mt-3">
            <BhaBarrelSetupDisplay setup={state?.bhaSetup ?? null} />
          </div>
          <div className="mt-4">
            <Link href={runbookRoutes.updateBha(holeId)} className={cardActionOutline}>
              <Drill aria-hidden="true" className="size-6" />
              Update BHA
            </Link>
          </div>
        </article>
      </section>

      <LocalPrototypeNotice />
    </div>
  );
}
