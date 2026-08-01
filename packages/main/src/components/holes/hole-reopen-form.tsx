"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  getCompletedHoleState,
  reopenHole,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  completionReasonLabel,
  createCompletionOperationId,
  defaultCompletionActor,
  holeStatusLabel,
} from "@/components/holes/completion-support";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres, normalizeHoleStatus } from "@/domain";

export function HoleReopenForm({ holeId }: { holeId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [holeVersion, setHoleVersion] = useState<number | null>(null);
  const [completionId, setCompletionId] = useState<string | undefined>();
  const [finalDepth, setFinalDepth] = useState<string>("—");
  const [completionReason, setCompletionReason] = useState<string>("—");
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.more(holeId);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void getCompletedHoleState(holeId, services)
      .then((lifecycle) => {
        if (lifecycle === null) {
          setMessage("Hole was not found.");
          return;
        }
        const normalized = normalizeHoleStatus(lifecycle.status);
        setStatus(normalized);
        setHoleVersion(lifecycle.hole.version);
        setCompletionId(lifecycle.latestCompletion?.localId);
        if (lifecycle.latestCompletion) {
          setFinalDepth(
            formatMetres(lifecycle.latestCompletion.snapshot.finalDepthDm),
          );
          setCompletionReason(
            completionReasonLabel(lifecycle.latestCompletion.snapshot.reason),
          );
        }
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Completion state could not be loaded.",
        ),
      );
  }, [holeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (holeVersion === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await reopenHole(
        {
          operationId: createCompletionOperationId("reopen"),
          holeId,
          completionRecordId: completionId,
          expectedHoleVersion: holeVersion,
          reason,
          comment: comment.trim() || undefined,
          reopenedAt: new Date().toISOString(),
          actor: defaultCompletionActor(),
        },
        services,
      );
      setIsDirty(false);
      router.push(`${runbookRoutes.currentHole(holeId)}?notice=hole-reopened`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The hole could not be reopened.",
      );
    } finally {
      setBusy(false);
    }
  };

  const locked =
    status === "COMPLETED" || status === "ABANDONED" || status === "ARCHIVED";

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Holes"
        title={`Reopen ${holeId}`}
        description="Restores the hole to Active without opening a shift or assigning components."
        backTarget={cancelBackTarget(parentHref, {
          onNavigate: locked ? requestLeave : undefined,
        })}
        action={
          status ? (
            <StatusPill
              tone={
                status === "ABANDONED"
                  ? "danger"
                  : status === "COMPLETED"
                    ? "success"
                    : "neutral"
              }
            >
              {holeStatusLabel(
                status as "COMPLETED" | "ABANDONED" | "ARCHIVED" | "ACTIVE",
              )}
            </StatusPill>
          ) : undefined
        }
      />

      {message ? (
        <div
          role="alert"
          className="flex gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4"
        >
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <p className="font-semibold">{message}</p>
        </div>
      ) : null}

      <SectionPanel title="Prior completion">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricDisplay label="Final depth" value={finalDepth} emphasis="strong" />
          <MetricDisplay label="Reason" value={completionReason} />
          <MetricDisplay label="Status" value={status ?? "Loading…"} />
        </div>
      </SectionPanel>

      {locked ? (
        <form
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          className="space-y-5"
        >
          <SectionPanel
            title="Reopen reason"
            description="Depth, casing, surveys, and trays are retained. A continuity-review banner will appear on the dashboard."
          >
            <label className="block text-sm font-bold">
              Reason
              <textarea
                required
                className="mt-1 min-h-24 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Comment (optional)
              <textarea
                className="mt-1 min-h-20 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
          </SectionPanel>
          <div className="flex flex-wrap gap-3">
            <FieldActionButton
              type="submit"
              fieldSize="major"
              busy={busy}
              disabled={!reason.trim()}
            >
              Reopen hole
            </FieldActionButton>
          </div>
        </form>
      ) : status === null ? (
        <p role="status">Loading reopen state…</p>
      ) : (
        <SectionPanel title="Hole is already mutable">
          <p className="text-sm text-[var(--tl-ink-muted)]">
            Only completed or abandoned holes can be reopened.
          </p>
        </SectionPanel>
      )}

      <LocalPrototypeNotice />
      {discardDialog}
    </div>
  );
}
