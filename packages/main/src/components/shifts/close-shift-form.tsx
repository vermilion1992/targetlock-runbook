"use client";

import { AlertTriangle, ArrowLeft, Flag, LogOut, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  closeFinalCompletionShift,
  closeRunbookShift,
  createBrowserRunbookServices,
  getShiftCloseReadiness,
  type ShiftCloseReadiness,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  createCompletionOperationId,
  defaultCompletionActor,
} from "@/components/holes/completion-support";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres, type RunbookShift } from "@/domain";

export function CloseShiftForm({
  holeId,
  shiftId,
}: {
  holeId: string;
  shiftId: string;
}) {
  const router = useRouter();
  const [readiness, setReadiness] = useState<ShiftCloseReadiness | null>(null);
  const [shift, setShift] = useState<RunbookShift | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      getShiftCloseReadiness(holeId, services),
      services.shifts.getById(shiftId, holeId),
    ])
      .then(([nextReadiness, nextShift]) => {
        setReadiness(nextReadiness);
        setShift(nextShift);
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Shift close state could not be loaded.",
        ),
      );
  }, [holeId, shiftId]);

  const submitHandover = async (event: FormEvent) => {
    event.preventDefault();
    if (shift === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await closeRunbookShift(
        {
          holeId,
          shiftId,
          expectedVersion: shift.version,
          closedAt: new Date().toISOString(),
          handoverNote: note,
          actor: {
            id: shift.primaryDrillerId,
            name: shift.primaryDrillerNameSnapshot,
          },
        },
        services,
      );
      router.push(`${runbookRoutes.handover(holeId)}?notice=handover-created`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The shift was not closed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitFinalClose = async () => {
    if (shift === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await closeFinalCompletionShift(
        {
          operationId: createCompletionOperationId("final-shift"),
          holeId,
          shiftId,
          expectedVersion: shift.version,
          closedAt: new Date().toISOString(),
          actor: defaultCompletionActor(),
        },
        services,
      );
      router.push(
        `${runbookRoutes.currentHole(holeId)}?notice=final-shift-closed`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The final shift could not be closed.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (shift === null || readiness === null) {
    return (
      <div
        role="status"
        className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-5"
      >
        {message ?? "Loading shift close summary…"}
      </div>
    );
  }

  const state = readiness.state;
  const canCloseFinally =
    readiness.mustResolve.length === 0 &&
    readiness.unfinishedRunNumber === undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Shift close"
        title={`Close ${shift.shiftType === "DAY" ? "Day" : "Night"} Shift`}
        description={`${shift.shiftDate} · ${shift.primaryDrillerNameSnapshot}`}
        action={<StatusPill tone="warning">Open</StatusPill>}
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

      <SectionPanel
        title="Ending hole state"
        description="Reconstructed from the latest valid local records."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay
            label="Starting depth"
            value={formatMetres(shift.startingDepthDm)}
          />
          <MetricDisplay
            label="Ending depth"
            value={formatMetres(state.currentDepthDm)}
            emphasis="strong"
          />
          <MetricDisplay label="Rod number" value={state.currentRodNumber} />
          <MetricDisplay
            label="Current R/S"
            value={formatMetres(state.currentRodStringDm)}
          />
          <MetricDisplay
            label="Stick-up"
            value={
              state.measuredStickUpDm === undefined
                ? "Not entered"
                : formatMetres(state.measuredStickUpDm)
            }
          />
          <MetricDisplay
            label="Last completed run"
            value={state.lastCompletedRunNumber}
          />
          <MetricDisplay
            label="Current tray"
            value={state.currentTrayNumber ?? "—"}
          />
          <MetricDisplay
            label="Latest survey"
            value={
              state.latestSurveyDepthDm === undefined
                ? "—"
                : formatMetres(state.latestSurveyDepthDm)
            }
          />
        </div>
      </SectionPanel>

      {readiness.mustResolve.length > 0 ? (
        <SectionPanel
          title="Must resolve"
          description="These conditions can corrupt runbook continuity."
        >
          <ul className="space-y-2" role="alert">
            {readiness.mustResolve.map((warning) => (
              <li
                key={warning.code}
                className="rounded-[var(--tl-radius-sm)] bg-[var(--tl-danger-soft)] p-3 font-semibold"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      {readiness.mayHandOver.length > 0 ? (
        <SectionPanel
          title="May hand over"
          description="These legitimate unfinished items will continue under the incoming shift."
        >
          <ul className="space-y-2" aria-live="polite">
            {readiness.mayHandOver.map((warning) => (
              <li
                key={warning.code}
                className="flex gap-3 rounded-[var(--tl-radius-sm)] bg-[var(--tl-warning-soft)] p-3"
              >
                <Share2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
          {readiness.unfinishedRunNumber ? (
            <Link
              href={runbookRoutes.recordRun(holeId)}
              className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
            >
              Return to run {readiness.unfinishedRunNumber}
            </Link>
          ) : null}
        </SectionPanel>
      ) : null}

      <form onSubmit={submitHandover} className="space-y-4">
        <SectionPanel
          title="Handover note"
          description="Optional operational context for the incoming shift."
        >
          <label htmlFor="handover-note" className="sr-only">
            Handover note
          </label>
          <textarea
            id="handover-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2_000}
            rows={5}
            placeholder="For example: core slightly broken near the end of the last run."
            className="w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3 text-base"
          />
        </SectionPanel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={runbookRoutes.currentHole(holeId)}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] font-bold no-underline"
          >
            <ArrowLeft aria-hidden="true" className="size-5" /> Return to hole
          </Link>
          <FieldActionButton
            type="submit"
            fieldSize="major"
            fullWidth
            busy={saving}
            disabled={readiness.mustResolve.length > 0}
          >
            <LogOut aria-hidden="true" className="size-5" /> Close and hand over
          </FieldActionButton>
        </div>
      </form>

      <SectionPanel
        title="Close as final shift"
        description="Use this when drilling is finished and no incoming shift will continue the hole. This closes the shift without handover so final hole review can proceed."
      >
        {!canCloseFinally ? (
          <p role="status" className="text-sm text-[var(--tl-ink-muted)]">
            Finish or hand over any unfinished run before closing as the final
            shift.
          </p>
        ) : null}
        <div className="mt-3">
          <FieldActionButton
            type="button"
            variant="secondary"
            fieldSize="major"
            busy={saving}
            disabled={!canCloseFinally}
            onClick={() => void submitFinalClose()}
          >
            <Flag aria-hidden="true" className="size-5" /> Close as final shift
          </FieldActionButton>
        </div>
      </SectionPanel>
    </div>
  );
}
