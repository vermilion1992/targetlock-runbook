"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  reopenRunbookShift,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { useOperatorSession } from "@/components/session";
import { formatMetres, type RunbookShift } from "@/domain";

export function ReopenShiftForm({
  holeId,
  shiftId,
}: {
  holeId: string;
  shiftId: string;
}) {
  const router = useRouter();
  const { session } = useOperatorSession();
  const [shift, setShift] = useState<RunbookShift | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading shift…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void services.shifts
      .listByHole(holeId)
      .then((shifts) => {
        const selected = shifts.find((item) => item.localId === shiftId);
        if (selected === undefined) throw new Error("The shift was not found.");
        setShift(selected);
        if (selected.status === "OPEN") {
          setBlockedReason("This shift is already open.");
        } else if (
          selected.handoverAcceptedAt !== undefined ||
          shifts.some(
            (item) =>
              item.localId !== selected.localId &&
              item.startedAt > selected.startedAt,
          )
        ) {
          setBlockedReason(
            "A later shift has already started, so reopening this shift would create conflicting runbook ownership.",
          );
        } else if (
          shifts.some(
            (item) =>
              item.localId !== selected.localId &&
              (item.status === "OPEN" || item.status === "HANDOVER_PENDING"),
          )
        ) {
          setBlockedReason(
            "Another shift is active or awaiting handover. Resolve it before reopening this shift.",
          );
        } else {
          setBlockedReason(null);
        }
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "The shift could not be loaded.",
        ),
      );
  }, [holeId, shiftId]);

  async function submit() {
    if (shift === null || blockedReason !== null) return;
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await reopenRunbookShift(
        {
          operationId: `reopen-shift-${crypto.randomUUID()}`,
          holeId,
          shiftId,
          expectedVersion: shift.version,
          reopenedAt: new Date().toISOString(),
          actor: {
            id: session?.operator.localId ?? shift.primaryDrillerId,
            name:
              session?.operator.displayName ??
              shift.primaryDrillerNameSnapshot,
          },
        },
        services,
      );
      router.push(
        `${runbookRoutes.shiftDetail(holeId, shiftId)}?notice=shift-reopened`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The shift was not reopened.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (shift === null) {
    return (
      <p
        role={message === "Loading shift…" ? "status" : "alert"}
        className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-5"
      >
        {message}
      </p>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Shifts"
        title="Reopen shift"
        description={`${shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} · ${shift.shiftDate}`}
        backTarget={cancelBackTarget(
          runbookRoutes.shiftDetail(holeId, shiftId),
        )}
      />

      {message ? (
        <div
          role="alert"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-semibold"
        >
          {message}
        </div>
      ) : null}

      <SectionPanel
        title="Last recorded finish"
        description={
          shift.closedAt
            ? formatFieldDateTime(shift.closedAt)
            : "No finish time recorded"
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricDisplay
            label="Shift"
            value={shift.shiftType === "DAY" ? "Day" : "Night"}
          />
          <MetricDisplay
            label="Start"
            value={formatFieldDateTime(shift.startedAt)}
          />
          <MetricDisplay
            label="Finish"
            value={
              shift.closedAt ? formatFieldDateTime(shift.closedAt) : "Open"
            }
          />
          <MetricDisplay
            label="Ending depth"
            value={
              shift.endingDepthDm === undefined
                ? "Not recorded"
                : formatMetres(shift.endingDepthDm)
            }
          />
        </div>
      </SectionPanel>

      <div
        className={`flex gap-3 rounded-[var(--tl-radius-md)] border p-4 ${
          blockedReason
            ? "border-[var(--tl-danger)] bg-[var(--tl-danger-soft)]"
            : "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)]"
        }`}
      >
        <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
        <div>
          <h2 className="font-bold">
            {blockedReason ? "Shift cannot be reopened" : "Confirm reopening"}
          </h2>
          <p className="mt-1 text-sm">
            {blockedReason ??
              "The closing snapshot and handover state will be cleared. Existing runs, surveys, trays, and photos remain stored; close the shift again when work is complete."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || blockedReason !== null}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw aria-hidden="true" className="size-5" />
        {saving ? "Reopening…" : "Reopen shift"}
      </button>
    </div>
  );
}
