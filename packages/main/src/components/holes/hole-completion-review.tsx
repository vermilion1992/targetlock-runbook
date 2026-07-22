"use client";

import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  acknowledgeCompletionWarning,
  beginHoleCompletionReview,
  completeHole,
  confirmFinalPartialTray,
  createBrowserRunbookServices,
  evaluateHoleCompletionApplication,
  markFinalCompletionSurveyUnavailable,
  recoverInterruptedCompletion,
  saveCompletionComponentOutcome,
  saveCompletionReasonAndDisposition,
  selectFinalCompletionSurvey,
  type HoleCompletionContext,
  type HoleFinalStatistics,
} from "@/application/runbook";
import type { HoleLifecycleState } from "@/infrastructure/completion";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  COMPONENT_OUTCOME_OPTIONS,
  completionReasonLabel,
  correctionHrefForCheck,
  createCompletionOperationId,
  defaultCompletionActor,
  holeStatusLabel,
} from "@/components/holes/completion-support";
import { HoleLockedPanel } from "@/components/holes/hole-locked-panel";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  HOLE_COMPLETION_REASONS,
  formatMetres,
  formatRecoveryPercentage,
  normalizeHoleStatus,
  type HoleCompletionCheck,
  type HoleCompletionComponentOutcome,
  type HoleCompletionComponentOutcomeCode,
  type HoleCompletionEvaluation,
  type HoleCompletionReason,
  type HoleCompletionReview,
} from "@/domain";

interface ReviewModel {
  readonly context: HoleCompletionContext;
  readonly review: HoleCompletionReview | null;
  readonly evaluation: HoleCompletionEvaluation;
  readonly statistics: HoleFinalStatistics;
  readonly lifecycle: HoleLifecycleState | null;
}

export function HoleCompletionReview({
  holeId,
  notice,
}: {
  holeId: string;
  notice?: "hole-reopened";
}) {
  const router = useRouter();
  const noticeMessage =
    notice === "hole-reopened"
      ? "Hole reopened to Active. Review continuity before recording new work."
      : null;
  const [model, setModel] = useState<ReviewModel | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [reason, setReason] = useState<HoleCompletionReason | "">("");
  const [comment, setComment] = useState("");
  const [ackReasons, setAckReasons] = useState<Record<string, string>>({});
  const [surveyUnavailableReason, setSurveyUnavailableReason] = useState("");
  const [componentOutcomes, setComponentOutcomes] = useState<
    Record<string, HoleCompletionComponentOutcomeCode>
  >({});

  const reload = useCallback(async () => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    const recovered = await recoverInterruptedCompletion(holeId, services);
    if (recovered !== null) {
      setMessage(
        recovered.status === "recovered"
          ? "An interrupted completion was recovered and the hole is locked."
          : "This hole is already completed.",
      );
    }
    let lifecycle = await services.completion.getLifecycleState(holeId);
    let evaluated = await evaluateHoleCompletionApplication(holeId, services);
    const status = lifecycle
      ? normalizeHoleStatus(lifecycle.status)
      : normalizeHoleStatus(evaluated.context.hole.status);

    if (
      evaluated.review === null &&
      !["COMPLETED", "ABANDONED", "ARCHIVED"].includes(status)
    ) {
      await beginHoleCompletionReview(
        {
          operationId: createCompletionOperationId("begin-review"),
          reviewId: createCompletionOperationId("review"),
          holeId,
          expectedHoleVersion: evaluated.context.hole.version,
          startedAt: new Date().toISOString(),
          actor: defaultCompletionActor(),
        },
        services,
      );
      lifecycle = await services.completion.getLifecycleState(holeId);
      evaluated = await evaluateHoleCompletionApplication(holeId, services);
    }

    const review = evaluated.review;
    setReason(review?.reason ?? "");
    setComment(review?.comment ?? "");
    setComponentOutcomes(
      Object.fromEntries(
        (review?.componentOutcomes ?? []).map((outcome) => [
          outcome.assignmentId,
          outcome.outcome,
        ]),
      ),
    );
    setModel({
      context: evaluated.context,
      review,
      evaluation: evaluated.evaluation,
      statistics: evaluated.statistics,
      lifecycle,
    });
  }, [holeId]);

  useEffect(() => {
    void Promise.resolve()
      .then(() => reload())
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Completion review could not be loaded.",
        ),
      );
  }, [reload]);

  const saveBase = () => {
    if (model?.review === null || model?.review === undefined) {
      throw new Error("Completion review is not available.");
    }
    return {
      operationId: createCompletionOperationId("save-review"),
      reviewId: model.review.localId,
      holeId,
      expectedVersion: model.review.version,
      savedAt: new Date().toISOString(),
    };
  };

  const applyResult = async (
    action: () => Promise<{
      review: HoleCompletionReview;
      evaluation: HoleCompletionEvaluation;
    }>,
  ) => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      const lifecycle = await services.completion.getLifecycleState(holeId);
      const evaluated = await evaluateHoleCompletionApplication(
        holeId,
        services,
        result.review,
      );
      setModel({
        context: evaluated.context,
        review: result.review,
        evaluation: result.evaluation,
        statistics: evaluated.statistics,
        lifecycle,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The review could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (model === null) {
    return (
      <div
        role="status"
        className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-5"
      >
        {message ?? "Loading final hole review…"}
      </div>
    );
  }

  const status = normalizeHoleStatus(
    model.lifecycle?.status ?? model.context.hole.status,
  );
  if (
    status === "COMPLETED" ||
    status === "ABANDONED" ||
    status === "ARCHIVED"
  ) {
    const snapshot = model.lifecycle?.latestCompletion?.snapshot;
    return (
      <div className="space-y-5 sm:space-y-6">
        <StagePageHeader
          eyebrow="Hole completion"
          title={`${holeId} completion`}
          description={
            snapshot
              ? `${snapshot.projectNameSnapshot} · final ${formatMetres(snapshot.finalDepthDm)} · ${completionReasonLabel(snapshot.reason)}`
              : "This hole is locked."
          }
          action={
            <StatusPill tone={status === "ABANDONED" ? "danger" : "success"}>
              {holeStatusLabel(status)}
            </StatusPill>
          }
        />
        {message ? (
          <div
            role="status"
            className="rounded-[var(--tl-radius-md)] border border-[var(--tl-success)] bg-[var(--tl-success-soft)] p-4 font-semibold"
          >
            {message}
          </div>
        ) : null}
        <HoleLockedPanel holeId={holeId} status={status} />
        {snapshot ? (
          <SectionPanel title="Frozen final statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricDisplay
                label="Final depth"
                value={formatMetres(snapshot.finalDepthDm)}
                emphasis="strong"
              />
              <MetricDisplay label="Final run" value={snapshot.finalRunNumber} />
              <MetricDisplay label="Final rod" value={snapshot.finalRodNumber} />
              <MetricDisplay
                label="Overall recovery"
                value={formatRecoveryPercentage(
                  snapshot.overallRecoveryPercentTenths / 10,
                )}
              />
            </div>
          </SectionPanel>
        ) : null}
        <LocalPrototypeNotice />
      </div>
    );
  }

  const { evaluation, statistics, context, review } = model;
  const activeAssignments = context.componentAssignments.filter(
    ({ status: assignmentStatus, endDepthDm }) =>
      assignmentStatus === "ACTIVE" && endDepthDm === undefined,
  );
  const blockers = evaluation.blockers;
  const advisories = evaluation.unacknowledgedAdvisories;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Hole completion"
        title="Final hole review"
        description={`${context.projectName} · ${context.rigName} · reconcile before locking ${holeId}.`}
        action={
          <StatusPill tone={evaluation.canComplete ? "success" : "warning"}>
            {evaluation.canComplete ? "Ready to lock" : "Blocked"}
          </StatusPill>
        }
      />

      {noticeMessage ? (
        <div
          role="status"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-success)] bg-[var(--tl-success-soft)] p-4 font-semibold"
        >
          {noticeMessage}
        </div>
      ) : null}

      {message ? (
        <div
          role="alert"
          className="flex gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4"
        >
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <p className="font-semibold">{message}</p>
        </div>
      ) : null}

      <SectionPanel
        title="Authoritative hole state"
        description="Final depth comes from completed runs and the current rod projection. Values cannot be overwritten here."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay
            label="Final depth"
            value={
              evaluation.finalDepthDm === undefined
                ? "Unavailable"
                : formatMetres(evaluation.finalDepthDm)
            }
            emphasis="strong"
          />
          <MetricDisplay
            label="Planned depth"
            value={formatMetres(context.hole.plannedDepth)}
          />
          <MetricDisplay
            label="Final run"
            value={evaluation.finalRunNumber ?? "—"}
          />
          <MetricDisplay
            label="Rod number"
            value={context.rodProjection?.rodNumber ?? "—"}
          />
          <MetricDisplay
            label="Current R/S"
            value={
              context.rodProjection
                ? formatMetres(context.rodProjection.rodStringDm)
                : "—"
            }
          />
          <MetricDisplay
            label="Overall recovery"
            value={formatRecoveryPercentage(
              statistics.runs.overallRecoveryPercentTenths / 10,
            )}
          />
          <MetricDisplay label="Surveys" value={statistics.surveys.totalSurveys} />
          <MetricDisplay label="Trays" value={statistics.trays.totalTrays} />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Blocking checks"
        description="Resolve each blocker in its source workflow before the hole can be locked."
      >
        {blockers.length === 0 ? (
          <p className="flex items-center gap-2 font-semibold text-[var(--tl-success)]">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            No blocking checks remain.
          </p>
        ) : (
          <ul className="space-y-3">
            {blockers.map((check) => (
              <ChecklistRow key={check.code} holeId={holeId} check={check} />
            ))}
          </ul>
        )}
      </SectionPanel>

      {advisories.length > 0 ? (
        <SectionPanel
          title="Advisory acknowledgements"
          description="Acknowledge each advisory with a short reason before completion."
        >
          <ul className="space-y-4">
            {advisories.map((check) => (
              <li
                key={check.code}
                className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
              >
                <p className="font-bold">{check.label}</p>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  {check.message}
                </p>
                <label className="mt-3 block text-sm font-bold">
                  Acknowledgement reason
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3"
                    value={ackReasons[check.code] ?? ""}
                    onChange={(event) =>
                      setAckReasons((current) => ({
                        ...current,
                        [check.code]: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="mt-3">
                  <FieldActionButton
                    variant="secondary"
                    busy={busy}
                    onClick={() =>
                      void applyResult(() => {
                        const services = createBrowserRunbookServices()!;
                        return acknowledgeCompletionWarning(
                          {
                            ...saveBase(),
                            checkCode: check.code,
                            reason: ackReasons[check.code] ?? "",
                            actor: defaultCompletionActor(),
                          },
                          services,
                        );
                      })
                    }
                  >
                    Acknowledge {check.label}
                  </FieldActionButton>
                </div>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      <SectionPanel
        title="Active component outcomes"
        description="Resolve each still-active bit or reamer at the final depth. Carried-forward does not require a target hole."
      >
        {activeAssignments.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            No active component assignments require resolution.
          </p>
        ) : (
          <ul className="space-y-4">
            {activeAssignments.map((assignment) => {
              const component = context.components.find(
                ({ localId }) => localId === assignment.componentId,
              );
              return (
                <li
                  key={assignment.localId}
                  className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
                >
                  <p className="font-bold">
                    {assignment.componentType} ·{" "}
                    {component?.serialNumber ?? assignment.componentId}
                  </p>
                  <label className="mt-3 block text-sm font-bold">
                    Outcome
                    <select
                      className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
                      value={componentOutcomes[assignment.localId] ?? ""}
                      onChange={(event) =>
                        setComponentOutcomes((current) => ({
                          ...current,
                          [assignment.localId]: event.target
                            .value as HoleCompletionComponentOutcomeCode,
                        }))
                      }
                    >
                      <option value="">Select outcome</option>
                      {COMPONENT_OUTCOME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3">
                    <FieldActionButton
                      variant="secondary"
                      busy={busy}
                      disabled={!componentOutcomes[assignment.localId]}
                      onClick={() =>
                        void applyResult(() => {
                          const services = createBrowserRunbookServices()!;
                          const outcomeCode =
                            componentOutcomes[assignment.localId]!;
                          const outcome: HoleCompletionComponentOutcome =
                            outcomeCode === "CARRIED_FORWARD"
                              ? {
                                  assignmentId: assignment.localId,
                                  componentId: assignment.componentId,
                                  componentType: assignment.componentType,
                                  outcome: "CARRIED_FORWARD",
                                }
                              : {
                                  assignmentId: assignment.localId,
                                  componentId: assignment.componentId,
                                  componentType: assignment.componentType,
                                  outcome: outcomeCode,
                                };
                          return saveCompletionComponentOutcome(
                            { ...saveBase(), outcome },
                            services,
                          );
                        })
                      }
                    >
                      Save component outcome
                    </FieldActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionPanel>

      <SectionPanel
        title="Final survey"
        description="Select the final recorded survey or mark it unavailable with a reason."
      >
        <div className="space-y-3">
          <label className="block text-sm font-bold">
            Recorded survey
            <select
              className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
              value={
                review?.finalSurveyResolution?.status === "RECORDED"
                  ? review.finalSurveyResolution.surveyId
                  : ""
              }
              onChange={(event) => {
                const surveyId = event.target.value;
                if (!surveyId) return;
                void applyResult(() => {
                  const services = createBrowserRunbookServices()!;
                  return selectFinalCompletionSurvey(
                    { ...saveBase(), surveyId },
                    services,
                  );
                });
              }}
            >
              <option value="">Select survey</option>
              {[...context.surveys]
                .sort((left, right) => right.depthDm - left.depthDm)
                .map((survey) => (
                  <option key={survey.localId} value={survey.localId}>
                    {formatMetres(survey.depthDm)} ·{" "}
                    {(survey.dipTenths / 10).toFixed(1)}° /{" "}
                    {(survey.azimuthTenths / 10).toFixed(1)}°
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Unavailable reason
            <input
              className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
              value={surveyUnavailableReason}
              onChange={(event) => setSurveyUnavailableReason(event.target.value)}
            />
          </label>
          <FieldActionButton
            variant="secondary"
            busy={busy}
            disabled={!surveyUnavailableReason.trim()}
            onClick={() =>
              void applyResult(() => {
                const services = createBrowserRunbookServices()!;
                return markFinalCompletionSurveyUnavailable(
                  {
                    ...saveBase(),
                    reason: surveyUnavailableReason,
                  },
                  services,
                );
              })
            }
          >
            Mark final survey unavailable
          </FieldActionButton>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Final partial tray"
        description="Confirm the physical final tray position when the advisory appears."
      >
        <p className="text-sm text-[var(--tl-ink-muted)]">
          Latest tray:{" "}
          {statistics.finalTray
            ? `Tray ${statistics.finalTray.trayNumber}`
            : "None recorded"}
        </p>
        <div className="mt-3">
          <FieldActionButton
            variant="secondary"
            busy={busy}
            onClick={() =>
              void applyResult(() => {
                const services = createBrowserRunbookServices()!;
                return confirmFinalPartialTray(
                  {
                    ...saveBase(),
                    actor: defaultCompletionActor(),
                  },
                  services,
                );
              })
            }
          >
            Confirm final partial tray
          </FieldActionButton>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Completion reason"
        description="Selecting Hole abandoned sets the final disposition to Abandoned."
      >
        <label className="block text-sm font-bold">
          Reason
          <select
            className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as HoleCompletionReason | "")
            }
          >
            <option value="">Select reason</option>
            {HOLE_COMPLETION_REASONS.map((value) => (
              <option key={value} value={value}>
                {completionReasonLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-bold">
          Comment{reason === "OTHER" ? " (required)" : " (optional)"}
          <textarea
            className="mt-1 min-h-24 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <div className="mt-3">
          <FieldActionButton
            variant="secondary"
            busy={busy}
            disabled={!reason}
            onClick={() =>
              void applyResult(() => {
                const services = createBrowserRunbookServices()!;
                return saveCompletionReasonAndDisposition(
                  {
                    ...saveBase(),
                    reason: reason as HoleCompletionReason,
                    comment: comment.trim() || undefined,
                  },
                  services,
                );
              })
            }
          >
            Save reason
          </FieldActionButton>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Complete and lock"
        description="This writes an immutable snapshot, closes active components, and blocks further drilling mutations."
      >
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={confirmLock}
            onChange={(event) => setConfirmLock(event.target.checked)}
            className="size-5"
          />
          I confirm this hole should be completed and locked now.
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <FieldActionButton
            fieldSize="major"
            busy={busy}
            disabled={!confirmLock || !evaluation.canComplete || review === null}
            onClick={() => {
              void (async () => {
                if (review === null) return;
                const services = createBrowserRunbookServices();
                if (services === null) {
                  setMessage("Browser storage is unavailable.");
                  return;
                }
                setBusy(true);
                setMessage(null);
                try {
                  const result = await completeHole(
                    {
                      operationId: createCompletionOperationId("complete"),
                      holeId,
                      reviewId: review.localId,
                      expectedReviewVersion: review.version,
                      expectedHoleVersion: context.hole.version,
                      completedAt: new Date().toISOString(),
                      actor: defaultCompletionActor(),
                    },
                    services,
                  );
                  router.push(
                    `${runbookRoutes.currentHole(holeId)}?notice=hole-completed&status=${result.completion.finalStatus}`,
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "The hole could not be completed.",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Lock aria-hidden="true" className="size-5" />
            Complete and lock hole
          </FieldActionButton>
          <Link
            href={runbookRoutes.currentHole(holeId)}
            className="inline-flex min-h-12 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] px-5 font-bold no-underline"
          >
            Cancel
          </Link>
        </div>
      </SectionPanel>

      <LocalPrototypeNotice />
    </div>
  );
}

function ChecklistRow({
  holeId,
  check,
}: {
  holeId: string;
  check: HoleCompletionCheck;
}) {
  const href = correctionHrefForCheck(holeId, check.code);
  return (
    <li className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{check.label}</p>
          <p className="mt-1 text-sm">{check.message}</p>
        </div>
        <StatusPill tone="danger">Blocking</StatusPill>
      </div>
      {href ? (
        <Link
          href={href}
          className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
        >
          Open correction workflow
        </Link>
      ) : null}
    </li>
  );
}
