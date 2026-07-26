"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  previewVoidRunForHole,
  voidRun,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { RunCorrectionImpact } from "@/domain";
import { targetLockStage5Seed } from "@/infrastructure/seed";
import type {
  RunVoidReason,
  SavedRunSnapshot,
} from "@/infrastructure/drafts";

const VOID_REASONS: readonly { value: RunVoidReason; label: string }[] = [
  { value: "ACCIDENTAL_DUPLICATE", label: "Accidental duplicate" },
  { value: "WRONG_HOLE", label: "Entered against wrong Hole" },
  { value: "TEST_ENTRY", label: "Test entry" },
  { value: "NEVER_OCCURRED", label: "Run never occurred" },
  { value: "OTHER", label: "Other" },
];

export function RunVoidForm({
  holeId,
  runId,
}: {
  holeId: string;
  runId: string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<SavedRunSnapshot | null>(null);
  const [reason, setReason] = useState<RunVoidReason>("ACCIDENTAL_DUPLICATE");
  const [comment, setComment] = useState("");
  const [rodResolution, setRodResolution] = useState<
    "VOID_WITH_RUN" | "REASSIGN" | "CANCEL"
  >("VOID_WITH_RUN");
  const [impact, setImpact] = useState<RunCorrectionImpact | null>(null);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.runDetail(holeId, runId);
  const seedRuns = useMemo(
    () => targetLockStage5Seed.runs.filter((item) => item.holeId === holeId),
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
        setLocked(
          lifecycle?.status === "COMPLETED" ||
            lifecycle?.status === "ABANDONED" ||
            lifecycle?.status === "ARCHIVED",
        );
      })
      .catch((caught: unknown) => {
        setRun(null);
        setError(
          caught instanceof Error ? caught.message : "Run could not be loaded.",
        );
      });
  }, [holeId, runId, seedRuns]);

  useEffect(() => {
    if (run === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    void previewVoidRunForHole(
      {
        holeId,
        runId,
        reason,
        comment,
        rodEventResolution: rodResolution,
        seedRuns,
        reportIds: [],
      },
      services,
    )
      .then(setImpact)
      .catch(() => setImpact(null));
  }, [holeId, runId, run, reason, comment, rodResolution, seedRuns]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (run === null) return;
    if (reason === "OTHER" && !comment.trim()) {
      setError("Enter a comment when choosing Other.");
      return;
    }
    if (rodResolution === "CANCEL") {
      setError("Cancel and correct the run instead of voiding.");
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
    setSaving(true);
    setError(null);
    const operationId = crypto.randomUUID();
    try {
      const reports = await services.reports.listReports(holeId);
      await voidRun(
        {
          operationId,
          correctionId: `void-${operationId}`,
          holeId,
          runId,
          expectedVersion: run.version,
          voidReason: reason,
          comment: comment.trim() || undefined,
          rodEventResolution: rodResolution,
          voidedAt: new Date().toISOString(),
          voidedByUserId: actor.id,
          voidedByNameSnapshot: actor.name,
          reportIds: reports.map((report) => report.localId),
          acknowledgeWarnings:
            acknowledgeWarnings || (impact?.warnings.length ?? 0) === 0,
          seedRuns,
        },
        services,
      );
      setIsDirty(false);
      router.push(parentHref);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Void could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && run === null) return <p role="alert">{error}</p>;
  if (run === null) return <p role="status">Loading run…</p>;

  if (locked) {
    return (
      <div className="space-y-4">
        <StagePageHeader
          eyebrow="Void run"
          title={`Void Run ${run.runNumber}`}
          description={`${holeId} is completed and locked.`}
          backTarget={cancelBackTarget(parentHref)}
        />
        <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4">
          Reopen the hole before voiding operational run data.
        </p>
        <Link
          href={runbookRoutes.reopenHole(holeId)}
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white"
        >
          Reopen hole
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Audited void"
        title={`Void Run ${run.runNumber}`}
        description="The run remains in audit history but is excluded from operational calculations."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      <form
        onSubmit={submit}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
      >
        <fieldset>
          <legend className="font-bold">Reason</legend>
          <div className="mt-3 space-y-2">
            {VOID_REASONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 items-center gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              >
                <input
                  type="radio"
                  name="void-reason"
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                <span className="font-bold">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="font-bold">
            Comment{reason === "OTHER" ? " (required)" : ""}
          </span>
          <textarea
            className="min-h-24 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 py-2"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
          />
        </label>

        {run.rodEvents.length > 0 ? (
          <fieldset>
            <legend className="font-bold">Associated rod event</legend>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["VOID_WITH_RUN", "Void the rod event with the Run"],
                  ["REASSIGN", "Keep the rod event and reassign it"],
                  ["CANCEL", "Cancel and correct the Run instead"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                >
                  <input
                    type="radio"
                    name="rod-resolution"
                    checked={rodResolution === value}
                    onChange={() => setRodResolution(value)}
                  />
                  <span className="font-bold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {impact ? (
          <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4">
            <h2 className="font-bold">Void Run {run.runNumber}?</h2>
            <p className="mt-2 text-sm">
              This Run will remain in audit history but will be excluded from
              operational calculations.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              <li>
                Rod events on this run: {run.rodEvents.length}
              </li>
              <li>
                Reports affected: {impact.staleReportIds.length}
              </li>
              <li>
                Affected later runs:{" "}
                {
                  new Set(
                    impact.affectedRuns
                      .filter((change) => change.runId !== runId)
                      .map((change) => change.runId),
                  ).size
                }
              </li>
            </ul>
            {impact.blockers.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm" role="alert">
                {impact.blockers.map((blocker) => (
                  <li key={blocker.code}>{blocker.message}</li>
                ))}
              </ul>
            ) : null}
            {impact.warnings.length > 0 ? (
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
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-[var(--tl-danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={
              saving ||
              rodResolution === "CANCEL" ||
              (impact?.blockers.length ?? 0) > 0
            }
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-danger)] px-4 font-bold text-white disabled:opacity-50"
            aria-label={`Void run ${run.runNumber}`}
          >
            Confirm void
          </button>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
