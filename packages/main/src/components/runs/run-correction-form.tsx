"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  applyRunCorrection,
  createBrowserRunbookServices,
  previewRunCorrectionForHole,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  decimetres,
  formatMetres,
  parseMetreInput,
  type RunCorrectionImpact,
} from "@/domain";
import { targetLockStage5Seed } from "@/infrastructure/seed";
import { getBrowserRuntimeMode } from "@/infrastructure/sync";
import type { SavedRunSnapshot } from "@/infrastructure/drafts";

type CorrectionChoice =
  | "MEASURED_STICK_UP"
  | "RECOVERED_LENGTH"
  | "ROD_EVENT"
  | "COMMENT";

export function RunCorrectionForm({
  holeId,
  runId,
}: {
  holeId: string;
  runId: string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<SavedRunSnapshot | null>(null);
  const [choice, setChoice] = useState<CorrectionChoice | null>(null);
  const [stickUp, setStickUp] = useState("");
  const [recovered, setRecovered] = useState("");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [rodLength, setRodLength] = useState<"3.0" | "6.0">("3.0");
  const [rodAction, setRodAction] = useState<"add" | "remove">("add");
  const [impact, setImpact] = useState<RunCorrectionImpact | null>(null);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.runDetail(holeId, runId);
  const seedRuns = useMemo(
    () =>
      getBrowserRuntimeMode() === "demo"
        ? targetLockStage5Seed.runs.filter((item) => item.holeId === holeId)
        : [],
    [holeId],
  );

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
      services.completion.getLifecycleState(holeId),
    ])
      .then(async ([local, lifecycle]) => {
        if (local.status === "invalid") throw new Error(local.reason);
        let snapshot = local.snapshots.find((item) => item.localId === runId);
        if (snapshot === undefined) {
          const seed = seedRuns.find((item) => item.localId === runId);
          if (seed === undefined) throw new Error("The run was not found.");
          snapshot = await services.runCorrections.materializeSeedRun(holeId, {
            localId: seed.localId,
            startedAt: seed.startedAt,
            completedAt: seed.completedAt ?? seed.startedAt,
            startedShiftId: seed.startedShiftId,
            completedShiftId: seed.completedShiftId ?? seed.startedShiftId,
            startedByUserId: seed.startedByUserId,
            startedByNameSnapshot: seed.startedByNameSnapshot,
            completedByUserId: seed.completedByUserId ?? seed.startedByUserId,
            completedByNameSnapshot:
              seed.completedByNameSnapshot ?? seed.startedByNameSnapshot,
            holeId: seed.holeId,
            syncStatus: "local-only",
            runNumber: seed.runNumber,
            rodNumber: seed.rodNumber,
            rodStringDm: seed.rodStringLength,
            measuredStickUpDm: seed.measuredStickUp,
            previousCompletedDepthDm: seed.previousCompletedDepth,
            holeDepthDm: seed.holeDepth,
            drilledLengthDm: seed.drilledLength,
            recoveredLengthDm: seed.recoveredLength,
            recoveryPercentage: seed.recoveryPercentage,
            rodEvents: [],
            conditionTagIds: [...seed.conditionTagIds],
            comment: seed.comment ?? "",
            activeBitAssignmentId: seed.activeBitAssignmentId,
            activeReamerAssignmentId: seed.activeReamerAssignmentId,
            activeBitSerialNumberSnapshot: seed.activeBitSerialNumberSnapshot,
            activeReamerSerialNumberSnapshot:
              seed.activeReamerSerialNumberSnapshot,
            casingSummarySnapshot: seed.casingSummarySnapshot,
            version: seed.version,
            status:
              seed.status === "void"
                ? "void"
                : seed.status === "corrected"
                  ? "corrected"
                  : "completed",
            correctionIds: [...seed.correctionIds],
            originalSnapshot: null,
            voidReason: null,
            voidComment: null,
            voidedAt: null,
            voidedByUserId: null,
            voidedByNameSnapshot: null,
          });
        }
        setRun(snapshot);
        setStickUp((snapshot.measuredStickUpDm / 10).toFixed(1));
        setRecovered((snapshot.recoveredLengthDm / 10).toFixed(1));
        setComment(snapshot.comment);
        setLocked(
          lifecycle?.status === "COMPLETED" ||
            lifecycle?.status === "ABANDONED" ||
            lifecycle?.status === "ARCHIVED",
        );
        if (snapshot.rodEvents[0]) {
          setRodLength(snapshot.rodEvents[0].rodLengthDm === 60 ? "6.0" : "3.0");
          setRodAction(snapshot.rodEvents[0].action);
        }
      })
      .catch((caught: unknown) => {
        setRun(null);
        setError(
          caught instanceof Error ? caught.message : "Run could not be loaded.",
        );
      });
  }, [holeId, runId, seedRuns]);

  const previewInput = useMemo(() => {
    if (run === null || choice === null) return null;
    return { run, choice, stickUp, recovered, comment, reason, rodLength, rodAction };
  }, [run, choice, stickUp, recovered, comment, reason, rodLength, rodAction]);

  useEffect(() => {
    if (previewInput === null || !previewInput.reason.trim()) {
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) return;
    let cancelled = false;
    const stickUpResult = parseMetreInput(previewInput.stickUp);
    const recoveredResult = parseMetreInput(previewInput.recovered);
    void previewRunCorrectionForHole(
      {
        holeId,
        runId,
        correctionType: previewInput.choice,
        reason: previewInput.reason,
        comment:
          previewInput.choice === "COMMENT" ? previewInput.comment : undefined,
        measuredStickUpDm:
          previewInput.choice === "MEASURED_STICK_UP" && stickUpResult.ok
            ? Number(stickUpResult.value)
            : undefined,
        recoveredLengthDm:
          previewInput.choice === "RECOVERED_LENGTH" && recoveredResult.ok
            ? Number(recoveredResult.value)
            : undefined,
        rodEvent:
          previewInput.choice === "ROD_EVENT" &&
          previewInput.run.rodEvents[0] !== undefined
            ? {
                rodEventId: previewInput.run.rodEvents[0].localId,
                action: previewInput.rodAction,
                rodLengthDm: previewInput.rodLength === "6.0" ? 60 : 30,
                affectedRodNumber:
                  previewInput.run.rodEvents[0].affectedRodNumber,
              }
            : undefined,
        seedRuns,
        surveyDepthsDm: (getBrowserRuntimeMode() === "demo"
          ? targetLockStage5Seed.surveys
          : []
        )
          .filter((survey) => survey.holeId === holeId)
          .map((survey) => survey.depthDm),
      },
      services,
    )
      .then((next) => {
        if (!cancelled) setImpact(next);
      })
      .catch(() => {
        if (!cancelled) setImpact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [holeId, runId, previewInput, seedRuns]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (run === null || choice === null) return;
    if (!reason.trim()) {
      setError("Enter a reason for the correction.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    const activeShift = await services.shifts.getActiveShift(holeId);
    const actor = {
      id: activeShift?.primaryDrillerId ?? "local-operator",
      name: activeShift?.primaryDrillerNameSnapshot ?? "Local operator",
    };
    const stickUpResult = parseMetreInput(stickUp);
    const recoveredResult = parseMetreInput(recovered);
    if (choice === "MEASURED_STICK_UP" && !stickUpResult.ok) {
      setError("Enter a valid measured stick-up.");
      return;
    }
    if (choice === "RECOVERED_LENGTH" && !recoveredResult.ok) {
      setError("Enter a valid recovered length.");
      return;
    }
    setSaving(true);
    setError(null);
    const operationId = crypto.randomUUID();
    try {
      const reports = await services.reports.listReports(holeId);
      await applyRunCorrection(
        {
          operationId,
          correctionId: `correction-${operationId}`,
          holeId,
          runId,
          expectedVersion: run.version,
          correctionType: choice,
          reason: reason.trim(),
          comment: choice === "COMMENT" ? comment : undefined,
          measuredStickUpDm:
            choice === "MEASURED_STICK_UP" && stickUpResult.ok
              ? Number(stickUpResult.value)
              : undefined,
          recoveredLengthDm:
            choice === "RECOVERED_LENGTH" && recoveredResult.ok
              ? Number(recoveredResult.value)
              : undefined,
          rodEvent:
            choice === "ROD_EVENT" && run.rodEvents[0] !== undefined
              ? {
                  rodEventId: run.rodEvents[0].localId,
                  action: rodAction,
                  rodLengthDm: rodLength === "6.0" ? 60 : 30,
                  affectedRodNumber: run.rodEvents[0].affectedRodNumber,
                }
              : undefined,
          correctedAt: new Date().toISOString(),
          correctedByUserId: actor.id,
          correctedByNameSnapshot: actor.name,
          reportIds: reports.map((report) => report.localId),
          surveyDepthsDm: (getBrowserRuntimeMode() === "demo"
            ? targetLockStage5Seed.surveys
            : []
          )
            .filter((survey) => survey.holeId === holeId)
            .map((survey) => survey.depthDm),
          acknowledgeWarnings: acknowledgeWarnings || (impact?.warnings.length ?? 0) === 0,
          seedRuns,
        },
        services,
      );
      setSuccess(`Run ${run.runNumber} corrected.`);
      setIsDirty(false);
      router.push(parentHref);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Correction could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && run === null) {
    return <p role="alert">{error}</p>;
  }
  if (run === null) {
    return <p role="status">Loading run…</p>;
  }

  if (locked) {
    return (
      <div className="space-y-4">
        <StagePageHeader
          eyebrow="Runs"
          title={`Correct Run ${run.runNumber}`}
          description={`${holeId} is completed and locked.`}
          backTarget={cancelBackTarget(parentHref)}
        />
        <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4">
          Reopen the hole before correcting operational run data.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={runbookRoutes.completeHole(holeId)}
            className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
          >
            View completion
          </Link>
          <Link
            href={runbookRoutes.reopenHole(holeId)}
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white"
          >
            Reopen hole
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Runs"
        title={`Correct Run ${run.runNumber}`}
        description="Correct source values. Calculated R/S, depth, drilled and recovery stay derived."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4">
        <h2 className="font-bold">Current record</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-[var(--tl-ink-muted)]">Rod number</dt>
            <dd className="font-bold">{run.rodNumber}</dd>
          </div>
          <div>
            <dt className="text-[var(--tl-ink-muted)]">R/S</dt>
            <dd className="font-bold">{formatMetres(decimetres(run.rodStringDm))}</dd>
          </div>
          <div>
            <dt className="text-[var(--tl-ink-muted)]">Measured stick-up</dt>
            <dd className="font-bold">{formatMetres(decimetres(run.measuredStickUpDm))}</dd>
          </div>
          <div>
            <dt className="text-[var(--tl-ink-muted)]">Hole depth</dt>
            <dd className="font-bold">{formatMetres(decimetres(run.holeDepthDm))}</dd>
          </div>
          <div>
            <dt className="text-[var(--tl-ink-muted)]">Drilled</dt>
            <dd className="font-bold">{formatMetres(decimetres(run.drilledLengthDm))}</dd>
          </div>
          <div>
            <dt className="text-[var(--tl-ink-muted)]">Recovered</dt>
            <dd className="font-bold">{formatMetres(decimetres(run.recoveredLengthDm))}</dd>
          </div>
        </dl>
      </section>

      <form
        onSubmit={submit}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
      >
        <fieldset>
          <legend className="font-bold">What needs correcting?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["MEASURED_STICK_UP", "Measured stick-up"],
                ["RECOVERED_LENGTH", "Recovered length"],
                ["ROD_EVENT", "Rod event"],
                ["COMMENT", "Comment or note"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`min-h-11 rounded-[var(--tl-radius-md)] border px-4 text-left font-bold ${
                  choice === value
                    ? "border-[var(--tl-primary)] bg-[var(--tl-primary-soft)]"
                    : "border-[var(--tl-border)]"
                }`}
                onClick={() => {
                  setChoice(value);
                  setIsDirty(true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {choice === "MEASURED_STICK_UP" ? (
          <label className="block space-y-2">
            <span className="font-bold">Correct stick-up (m)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3"
              value={stickUp}
              onChange={(event) => setStickUp(event.target.value)}
              inputMode="decimal"
            />
          </label>
        ) : null}

        {choice === "RECOVERED_LENGTH" ? (
          <label className="block space-y-2">
            <span className="font-bold">Correct recovered length (m)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3"
              value={recovered}
              onChange={(event) => setRecovered(event.target.value)}
              inputMode="decimal"
            />
          </label>
        ) : null}

        {choice === "ROD_EVENT" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="font-bold">Action</span>
              <select
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3"
                value={rodAction}
                onChange={(event) =>
                  setRodAction(event.target.value as "add" | "remove")
                }
              >
                <option value="add">Added</option>
                <option value="remove">Removed</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="font-bold">Rod length</span>
              <select
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3"
                value={rodLength}
                onChange={(event) =>
                  setRodLength(event.target.value as "3.0" | "6.0")
                }
              >
                <option value="3.0">3.0 m</option>
                <option value="6.0">6.0 m</option>
              </select>
            </label>
          </div>
        ) : null}

        {choice === "COMMENT" ? (
          <label className="block space-y-2">
            <span className="font-bold">Corrected comment</span>
            <textarea
              className="min-h-24 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 py-2"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="font-bold">Reason</span>
          <input
            className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </label>

        {impact ? (
          <section
            aria-live="polite"
            className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
          >
            <h2 className="font-bold">Impact</h2>
            {impact.affectedRuns.length === 0 ? (
              <p className="text-sm text-[var(--tl-ink-muted)]">No calculated fields change.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {impact.affectedRuns.slice(0, 12).map((change) => (
                  <li key={`${change.runId}-${change.field}`}>
                    Run {change.runNumber} {change.field}:{" "}
                    <span className="font-bold">
                      {String(change.previousValue)} → {String(change.correctedValue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {impact.staleReportIds.length > 0 ? (
              <p className="text-sm">
                {impact.staleReportIds.length} historical report
                {impact.staleReportIds.length === 1 ? "" : "s"} will be marked out of date.
              </p>
            ) : null}
            {impact.blockers.length > 0 ? (
              <div role="alert" tabIndex={-1} className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-3">
                <p className="font-bold">Blocked</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {impact.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {impact.warnings.length > 0 ? (
              <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-3">
                <p className="font-bold">Warnings</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {impact.warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
                <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={acknowledgeWarnings}
                    onChange={(event) =>
                      setAcknowledgeWarnings(event.target.checked)
                    }
                  />
                  Continue despite warnings
                </label>
              </div>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-[var(--tl-danger)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="text-[var(--tl-success)]">
            {success}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={
              saving ||
              choice === null ||
              (impact?.blockers.length ?? 0) > 0
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-50"
          >
            <Save aria-hidden="true" className="size-4" />
            Save correction
          </button>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
