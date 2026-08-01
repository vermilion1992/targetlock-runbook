"use client";

import { Drill, History, PackagePlus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  completedDepthFromRuns,
  createBrowserRunbookServices,
  getActiveComponents,
  getCurrentHoleState,
  getHoleComponentStatistics,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  formatRecoveryPercentTenths,
  type Component,
  type ComponentAssignment,
  type ComponentType,
  type ComponentUsage,
} from "@/domain";

import {
  ComponentStatusPill,
  OperationNotice,
  formatComponentDate,
  formatComponentDepth,
  readCompletedUsageRuns,
  titleCase,
} from "./component-support";
import { BhaSetupCard } from "./bha-setup-card";

interface Statistic {
  readonly component: Component;
  readonly assignment: ComponentAssignment;
  readonly usage: ComponentUsage;
}

interface SummaryState {
  readonly statistics: readonly Statistic[];
  readonly bit: ComponentAssignment | null;
  readonly reamer: ComponentAssignment | null;
  readonly currentDepthDm: number;
  readonly shiftLabel: string | null;
}

function typeRoute(type: ComponentType): "bit" | "reamer" {
  return type === "BIT" ? "bit" : "reamer";
}

function recoverySummary(usage: ComponentUsage): string {
  if (usage.averageRecoveryPercentTenths === undefined) return "Unavailable";
  return `${formatRecoveryPercentTenths(usage.averageRecoveryPercentTenths)} · ${
    usage.recoveryEstimateStatus === "RUN_LEVEL_ESTIMATE"
      ? "run-level estimate"
      : "exact run set"
  }`;
}

function boundaryRunSummary(usage: ComponentUsage): string {
  if (usage.partiallyCoveredRuns === 0) return "No boundary runs";
  return `${usage.partiallyCoveredRuns} shared boundary run${
    usage.partiallyCoveredRuns === 1 ? "" : "s"
  }`;
}

function assignmentAction(
  holeId: string,
  type: ComponentType,
  active: ComponentAssignment | null,
) {
  const routeType = typeRoute(type);
  return active ? (
    <Link
      href={
        type === "BIT"
          ? runbookRoutes.changeBit(holeId)
          : runbookRoutes.changeReamer(holeId)
      }
      className="tl-action-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
    >
      <RefreshCw aria-hidden="true" className="size-5" />
      Change {titleCase(type)}
    </Link>
  ) : (
    <Link
      href={runbookRoutes.assignComponent(holeId, routeType)}
      className="tl-action-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
    >
      <PackagePlus aria-hidden="true" className="size-5" />
      Assign {titleCase(type)}
    </Link>
  );
}

export function HoleComponentSummary({
  holeId,
  notice,
}: {
  holeId: string;
  notice?: "bit-assigned" | "reamer-assigned" | "bit-changed" | "reamer-changed";
}) {
  const [state, setState] = useState<SummaryState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadTimer = window.setTimeout(() => {
      const load = async () => {
        const services = createBrowserRunbookServices();
        if (services === null) {
          throw new Error(
            "Browser storage is unavailable. Component assignments cannot be loaded.",
          );
        }
        const completedRuns = readCompletedUsageRuns(holeId, services);
        const [activeComponents, statistics, currentState] = await Promise.all([
          getActiveComponents(holeId, services),
          getHoleComponentStatistics(holeId, completedRuns, services),
          getCurrentHoleState(holeId, services.currentState),
        ]);
        if (!active) return;
        setState({
          statistics,
          bit: activeComponents.bit,
          reamer: activeComponents.reamer,
          currentDepthDm: completedDepthFromRuns(completedRuns),
          shiftLabel: currentState.activeShift
            ? `${currentState.activeShift.shiftType === "DAY" ? "Day" : "Night"} Shift · ${currentState.activeShift.primaryDrillerNameSnapshot}`
            : null,
        });
      };
      void load().catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Component assignments could not be loaded.",
          );
        }
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(loadTimer);
    };
  }, [holeId]);

  const noticeMessage =
    notice === "bit-assigned"
      ? "Initial bit assignment saved."
      : notice === "reamer-assigned"
        ? "Initial reamer assignment saved."
        : notice === "bit-changed"
          ? "Bit change saved at the recorded depth."
          : notice === "reamer-changed"
            ? "Reamer change saved at the recorded depth."
            : null;

  const activeStatistic = (assignment: ComponentAssignment | null) =>
    state?.statistics.find(
      (statistic) => statistic.assignment.localId === assignment?.localId,
    );

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Components"
        title={`${holeId} bottom hole assembly`}
        description="Active barrel setup (bit, front reamer, barrel, rear reamer), full BHA size, constant stick-up, and assignment history."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
      />

      {noticeMessage ? <OperationNotice tone="success">{noticeMessage}</OperationNotice> : null}
      {error ? <OperationNotice tone="error">{error}</OperationNotice> : null}

      <BhaSetupCard holeId={holeId} />

      <section aria-label="Component context" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricDisplay
          label="Completed depth"
          value={state ? formatComponentDepth(state.currentDepthDm) : "Loading…"}
          emphasis="strong"
          className="col-span-2"
        />
        <MetricDisplay label="Assignments" value={state?.statistics.length ?? "—"} />
        <MetricDisplay label="Active shift" value={state?.shiftLabel ?? "None"} />
      </section>

      <section aria-labelledby="active-components-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="active-components-heading" className="text-lg font-bold text-[var(--tl-ink)]">
            Assignment history tools
          </h2>
          <StatusPill tone={state?.shiftLabel ? "success" : "warning"}>
            {state?.shiftLabel ? "Shift ready" : "No active shift"}
          </StatusPill>
        </div>
        <p className="mb-3 text-sm text-[var(--tl-ink-muted)]">
          Depth-exact inventory bit and reamer changes remain available for usage
          tracking. The active barrel setup above is the operational source of truth.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(["BIT", "REAMER"] as const).map((type) => {
            const assignment = type === "BIT" ? state?.bit ?? null : state?.reamer ?? null;
            const statistic = activeStatistic(assignment);
            return (
              <article
                key={type}
                className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                      <Drill aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-primary)]">
                        Inventory {titleCase(type)}
                      </p>
                      <h3 className="mt-1 break-all text-lg font-bold text-[var(--tl-ink)]">
                        {statistic?.component.serialNumber ?? "Not assigned"}
                      </h3>
                    </div>
                  </div>
                  {statistic ? <ComponentStatusPill status={statistic.component.status} /> : null}
                </div>
                {statistic ? (
                  <>
                    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-[var(--tl-ink-muted)]">Started</dt><dd className="font-bold">{formatComponentDepth(statistic.assignment.startDepthDm)}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Drilled</dt><dd className="font-bold">{formatComponentDepth(statistic.usage.drilledMetresDm)}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Runs touched</dt><dd className="font-bold">{statistic.usage.runsTouched}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Average recovery</dt><dd className="font-bold">{recoverySummary(statistic.usage)}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Coverage</dt><dd className="font-bold">{boundaryRunSummary(statistic.usage)}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Installed by</dt><dd className="font-bold">{statistic.assignment.installedByNameSnapshot}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[var(--tl-ink-muted)]">
                    No active {type.toLocaleLowerCase("en-AU")} is assigned. Complete the initial assignment before recording it against new work.
                  </p>
                )}
                <div className="mt-4 border-t border-[var(--tl-border)] pt-4">
                  {assignmentAction(holeId, type, assignment)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <SectionPanel
        title="Assignment history"
        description="Closed and active intervals are listed with exact drilled length from completed-run overlap."
        action={<History aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />}
      >
        {state === null ? (
          <p role="status" className="text-sm text-[var(--tl-ink-muted)]">Loading assignment history…</p>
        ) : state.statistics.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">No component assignments are recorded for this hole.</p>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {[...state.statistics].reverse().map(({ component, assignment, usage }) => (
                <article key={assignment.localId} className="rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--tl-primary)]">{titleCase(assignment.componentType)}</p>
                      <h3 className="font-bold">{component.serialNumber}</h3>
                    </div>
                    <span className="text-xs font-bold">{assignment.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                    {formatComponentDepth(assignment.startDepthDm)} – {assignment.endDepthDm === undefined ? "active" : formatComponentDepth(assignment.endDepthDm)}
                  </p>
                  <p className="mt-1 text-sm">{formatComponentDepth(usage.drilledMetresDm)} · {usage.runsTouched} runs</p>
                  <p className="mt-1 text-sm">{recoverySummary(usage)}</p>
                  <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">{boundaryRunSummary(usage)}</p>
                  {assignment.removalReason ? <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">{titleCase(assignment.removalReason)}{assignment.removalComment ? ` · ${assignment.removalComment}` : ""}</p> : null}
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  <tr>
                    <th className="pb-3 font-bold">Component</th>
                    <th className="pb-3 font-bold">Depth interval</th>
                    <th className="pb-3 font-bold">Drilled / runs</th>
                    <th className="pb-3 font-bold">Recovery</th>
                    <th className="pb-3 font-bold">Installed</th>
                    <th className="pb-3 font-bold">Removal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tl-border)]">
                  {[...state.statistics].reverse().map(({ component, assignment, usage }) => (
                    <tr key={assignment.localId}>
                      <th scope="row" className="py-3 pr-4">
                        <span className="font-bold">{component.serialNumber}</span>
                        <span className="mt-0.5 block text-xs text-[var(--tl-ink-muted)]">{titleCase(component.type)} · {assignment.status}</span>
                      </th>
                      <td className="py-3 pr-4">{formatComponentDepth(assignment.startDepthDm)} – {assignment.endDepthDm === undefined ? "active" : formatComponentDepth(assignment.endDepthDm)}</td>
                      <td className="py-3 pr-4">{formatComponentDepth(usage.drilledMetresDm)} · {usage.runsTouched}</td>
                      <td className="py-3 pr-4">{recoverySummary(usage)}<span className="block text-xs text-[var(--tl-ink-muted)]">{boundaryRunSummary(usage)}</span></td>
                      <td className="py-3 pr-4">{formatComponentDate(assignment.installedAt)}<span className="block text-xs text-[var(--tl-ink-muted)]">{assignment.installedByNameSnapshot}</span></td>
                      <td className="py-3">{assignment.removalReason ? titleCase(assignment.removalReason) : "—"}{assignment.removalComment ? <span className="block max-w-52 text-xs text-[var(--tl-ink-muted)]">{assignment.removalComment}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionPanel>

    </div>
  );
}
