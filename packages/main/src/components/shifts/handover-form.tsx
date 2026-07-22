"use client";

import { AlertTriangle, Check, FileClock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  acceptShiftHandover,
  createBrowserRunbookServices,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  formatMetres,
  shiftTypeLabel,
  type RunbookShift,
  type ShiftType,
} from "@/domain";

interface DrillerOption {
  readonly id: string;
  readonly name: string;
}

function id(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function localDateValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function HandoverForm({
  holeId,
  drillers,
}: {
  holeId: string;
  drillers: readonly DrillerOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<RunbookShift | null>(null);
  const [shiftType, setShiftType] = useState<ShiftType>("NIGHT");
  const [shiftDate, setShiftDate] = useState(localDateValue);
  const [drillerId, setDrillerId] = useState(drillers[0]?.id ?? "");
  const [operationId] = useState(() => id("handover"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => {
        setMessage("Browser storage is unavailable.");
        setLoading(false);
      });
      return;
    }
    void services.shifts
      .getPendingHandover(holeId)
      .then((shift) => {
        setPending(shift);
        if (shift !== null) {
          setShiftType(shift.shiftType === "DAY" ? "NIGHT" : "DAY");
          setShiftDate(shift.shiftDate);
        }
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "The handover could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [holeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending === null) return;
    const driller = drillers.find(({ id: value }) => value === drillerId);
    if (driller === undefined) {
      setMessage("Select the incoming driller.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await acceptShiftHandover(
        {
          operationId,
          holeId,
          outgoingShiftId: pending.localId,
          expectedVersion: pending.version,
          incomingShiftId: id(`shift-${holeId.toLowerCase()}-${shiftType.toLowerCase()}`),
          incomingShiftType: shiftType,
          incomingShiftDate: shiftDate,
          incomingDrillerId: driller.id,
          incomingDrillerNameSnapshot: driller.name,
          incomingCrewMembers: [
            { userId: driller.id, name: driller.name, role: "Primary driller" },
          ],
          acceptedAt: new Date().toISOString(),
        },
        services,
      );
      router.push(`${runbookRoutes.currentHole(holeId)}?notice=handover-accepted`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The handover was not accepted.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p role="status">Loading handover…</p>;
  }
  if (pending === null) {
    return (
      <div className="space-y-5">
        <StagePageHeader eyebrow="Stage 2 · handover" title="No pending handover" description={`There is no handover awaiting acceptance for ${holeId}.`} />
        {message ? <p role="alert">{message}</p> : null}
        <Link href={runbookRoutes.currentHole(holeId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">
          Return to Current Hole
        </Link>
      </div>
    );
  }

  const endingDepth = pending.endingDepthDm ?? pending.startingDepthDm;
  const endingRod = pending.endingRodNumber ?? pending.startingRodNumber;
  const endingRodString =
    pending.endingRodStringDm ?? pending.startingRodStringDm;

  return (
    <form onSubmit={submit} className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 2 · run continuity"
        title={`${shiftTypeLabel(pending.shiftType).toUpperCase()} HANDOVER`}
        description={`Outgoing driller: ${pending.primaryDrillerNameSnapshot}`}
        action={<StatusPill tone="warning">Acceptance required</StatusPill>}
      />

      {message ? (
        <div role="alert" aria-live="assertive" className="flex gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4">
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <p className="font-semibold">{message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-5">
          <SectionPanel title="Outgoing state" description="The incoming shift inherits this exact saved snapshot.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricDisplay label="Ending depth" value={formatMetres(endingDepth)} emphasis="strong" />
              <MetricDisplay label="Last completed run" value={pending.endingRunNumber ?? "—"} />
              <MetricDisplay label="Run in progress" value={pending.handoverRunNumber ?? "None"} />
              <MetricDisplay label="Rod number" value={endingRod} />
              <MetricDisplay label="Current R/S" value={formatMetres(endingRodString)} />
              <MetricDisplay label="Stick-up" value={pending.endingMeasuredStickUpDm === undefined ? "Not entered" : formatMetres(pending.endingMeasuredStickUpDm)} />
            </div>
          </SectionPanel>

          <SectionPanel title="Handover note" description="Recorded by the outgoing shift.">
            <p className="leading-6 text-[var(--tl-ink)]">{pending.handoverNote || "No handover note supplied."}</p>
            {pending.handoverRunNumber ? (
              <Link href={runbookRoutes.recordRun(holeId)} className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
                <FileClock aria-hidden="true" className="size-5" /> Review unfinished run {pending.handoverRunNumber}
              </Link>
            ) : null}
          </SectionPanel>
        </div>

        <SectionPanel title="Incoming shift" description="Acceptance closes the outgoing shift and creates this shift together.">
          <div className="space-y-5">
            <label className="block text-sm font-bold">
              Shift
              <select value={shiftType} onChange={(event) => setShiftType(event.target.value as ShiftType)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3">
                <option value="DAY">Day Shift</option>
                <option value="NIGHT">Night Shift</option>
              </select>
            </label>
            <label className="block text-sm font-bold">
              Shift date
              <input type="date" required value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
            </label>
            <label className="block text-sm font-bold">
              Incoming driller
              <select required value={drillerId} onChange={(event) => setDrillerId(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3">
                {drillers.map((driller) => <option key={driller.id} value={driller.id}>{driller.name}</option>)}
              </select>
            </label>
            <FieldActionButton type="submit" fieldSize="major" fullWidth busy={saving}>
              <Check aria-hidden="true" className="size-5" /> Accept handover
            </FieldActionButton>
            <p className="flex items-start gap-2 text-xs leading-5 text-[var(--tl-ink-muted)]">
              <RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Repeated acceptance with this operation ID is idempotent.
            </p>
          </div>
        </SectionPanel>
      </div>
    </form>
  );
}
