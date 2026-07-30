"use client";

import { AlertTriangle, CalendarDays, Play, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  deriveDrillingReadiness,
  getCurrentHoleState,
  startRunbookShift,
  type CurrentHoleState,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  decimetres,
  formatMetres,
  type HoleStatus,
  type ShiftType,
} from "@/domain";
import { useOperatorSession } from "@/components/session";

interface DrillerOption {
  readonly id: string;
  readonly name: string;
}

function localDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function StartShiftForm({
  holeId,
  drillers,
}: {
  holeId: string;
  drillers: readonly DrillerOption[];
}) {
  const router = useRouter();
  const { runtimeMode, session } = useOperatorSession();
  const availableDrillers =
    runtimeMode === "pilot" && session
      ? [
          {
            id: session.operator.localId,
            name: session.operator.displayName,
          },
        ]
      : session?.operator.role === "DRILLER" &&
    !drillers.some(({ id }) => id === session.operator.localId)
      ? [
          {
            id: session.operator.localId,
            name: session.operator.displayName,
          },
          ...drillers,
        ]
      : drillers;
  const errorId = useId();
  const [shiftType, setShiftType] = useState<ShiftType>("DAY");
  const [shiftDate, setShiftDate] = useState(localDateValue);
  const [drillerId, setDrillerId] = useState(
    availableDrillers[0]?.id ?? "",
  );
  const selectedDrillerId =
    runtimeMode === "pilot" && session
      ? session.operator.localId
      : drillerId;
  const [crew, setCrew] = useState("");
  const [rigId, setRigId] = useState("");
  const [state, setState] = useState<CurrentHoleState | null>(null);
  const [holeStatus, setHoleStatus] = useState<HoleStatus | null>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.currentHole(holeId);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => {
        setMessage("Browser storage is unavailable. A shift cannot be started.");
        setLoading(false);
      });
      return;
    }
    void Promise.all([
      getCurrentHoleState(holeId, services.currentState),
      services.completion.getStatus(holeId),
      services.completion.getHole(holeId),
    ])
      .then(([nextState, nextStatus, hole]) => {
        if (hole === null) {
          throw new Error(`Hole ${holeId} was not found.`);
        }
        setState(nextState);
        setHoleStatus(nextStatus);
        setRigId(hole.rigId);
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error ? error.message : "Hole state could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [holeId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const selected = availableDrillers.find(
      ({ id }) => id === selectedDrillerId,
    );
    if (selected === undefined) {
      setMessage("Select a primary driller.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable. The shift was not started.");
      return;
    }
    setSaving(true);
    try {
      const crewMembers = [
        { userId: selected.id, name: selected.name, role: "Primary driller" },
        ...crew
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, role: "Crew" })),
      ];
      await startRunbookShift(
        {
          id: localId(`shift-${holeId.toLowerCase()}-${shiftType.toLowerCase()}`),
          holeId,
          rigId,
          shiftType,
          shiftDate,
          primaryDrillerId: selected.id,
          primaryDrillerNameSnapshot: selected.name,
          crewMembers,
          startedAt: new Date().toISOString(),
        },
        services,
      );
      setMessage(`${shiftType === "DAY" ? "Day" : "Night"} Shift started.`);
      setIsDirty(false);
      router.push(`${parentHref}?notice=shift-started`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The shift was not started.");
      requestAnimationFrame(() => document.getElementById(errorId)?.focus());
    } finally {
      setSaving(false);
    }
  };

  const blockedShift = state?.activeShift ?? state?.pendingHandover ?? null;
  const readiness =
    state === null || holeStatus === undefined
      ? null
      : deriveDrillingReadiness({
          holeStatus,
          bhaSetup: state.bhaSetup,
        });
  const lifecycleBlocked =
    readiness?.blockers.some(
      ({ code }) => code === "HOLE_STATUS_NOT_OPERATIONAL",
    ) ?? false;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 2 · shift continuity"
        title="Start runbook shift"
        description={`Assign the shift that will own new runs for ${holeId}.`}
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
        action={<StatusPill tone="info">Local-only</StatusPill>}
      />

      {message ? (
        <div
          id={errorId}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="font-semibold text-[var(--tl-ink)]">{message}</p>
        </div>
      ) : null}

      {blockedShift ? (
        <SectionPanel
          title={`A runbook shift is already active for ${holeId}`}
          description="The active shift must be closed and its handover accepted before another shift can start."
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Shift</dt>
              <dd className="mt-1 font-bold text-[var(--tl-ink)]">
                {blockedShift.shiftType === "DAY" ? "Day Shift" : "Night Shift"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Driller</dt>
              <dd className="mt-1 font-bold text-[var(--tl-ink)]">
                {blockedShift.primaryDrillerNameSnapshot}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Status</dt>
              <dd className="mt-1"><StatusPill tone="warning">{blockedShift.status.replaceAll("_", " ")}</StatusPill></dd>
            </div>
          </dl>
          <Link
            href={
              blockedShift.status === "HANDOVER_PENDING"
                ? runbookRoutes.handover(holeId)
                : runbookRoutes.shiftDetail(holeId, blockedShift.localId)
            }
            className="mt-5 inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline"
          >
            Open active shift
          </Link>
        </SectionPanel>
      ) : lifecycleBlocked && readiness ? (
        <SectionPanel
          title="Hole is not available for shift start"
          description="Return to the overview and resolve the hole lifecycle before starting operational work."
        >
          <p className="text-sm font-semibold text-[var(--tl-ink)]">
            {readiness.blockers[0]?.message}
          </p>
          <Link
            href={parentHref}
            className="mt-5 inline-flex min-h-12 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
          >
            Return to overview
          </Link>
        </SectionPanel>
      ) : readiness && !readiness.ready ? (
        <SectionPanel
          title="BHA setup required before the first shift"
          description="Record the initial full BHA length and constant stick-up before drilling begins."
        >
          <ul className="space-y-2 text-sm font-semibold text-[var(--tl-ink)]">
            {readiness.blockers.map((blocker) => (
              <li key={blocker.code}>• {blocker.message}</li>
            ))}
          </ul>
          <Link
            href={runbookRoutes.updateBha(holeId)}
            className="mt-5 inline-flex min-h-12 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
          >
            Update BHA
          </Link>
        </SectionPanel>
      ) : (
        <form
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          className="space-y-5"
        >
          <SectionPanel
            title="Shift assignment"
            description="The operational date remains the date on which this shift begins."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Shift
                <select
                  value={shiftType}
                  onChange={(event) => setShiftType(event.target.value as ShiftType)}
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                >
                  <option value="DAY">Day Shift</option>
                  <option value="NIGHT">Night Shift</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Shift date
                <span className="relative mt-2 block">
                  <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-5 text-[var(--tl-ink-muted)]" />
                  <input
                    type="date"
                    required
                    value={shiftDate}
                    onChange={(event) => setShiftDate(event.target.value)}
                    className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 pr-3 text-base"
                  />
                </span>
              </label>
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Primary driller
                <select
                  required
                  value={selectedDrillerId}
                  onChange={(event) => setDrillerId(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                >
                  {availableDrillers.map((driller) => (
                    <option key={driller.id} value={driller.id}>{driller.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Additional crew
                <span className="relative mt-2 block">
                  <UsersRound aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-5 text-[var(--tl-ink-muted)]" />
                  <input
                    value={crew}
                    onChange={(event) => setCrew(event.target.value)}
                    placeholder="Optional, comma separated"
                    className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 pr-3 text-base"
                  />
                </span>
              </label>
            </div>
          </SectionPanel>

          <SectionPanel title="Current hole state" description="Captured when the shift starts.">
            {loading || state === null ? (
              <p role="status" className="text-sm text-[var(--tl-ink-muted)]">Loading current state…</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricDisplay label="Starting depth" value={formatMetres(state.currentDepthDm)} emphasis="strong" />
                <MetricDisplay label="Rod number" value={state.currentRodNumber} />
                <MetricDisplay label="Current R/S" value={formatMetres(state.currentRodStringDm)} />
                <MetricDisplay label="Stick-up" value={state.measuredStickUpDm === undefined ? "Not entered" : formatMetres(state.measuredStickUpDm)} />
                <MetricDisplay label="Next run" value={state.nextRunNumber} />
                <MetricDisplay label="Current tray" value={state.currentTrayNumber ?? "—"} />
                <MetricDisplay
                  label="Bit serial"
                  value={
                    state.bhaSetup?.bitSerialNumber ??
                    state.activeBitSerialNumber ??
                    "—"
                  }
                />
                <MetricDisplay
                  label="Front reamer"
                  value={
                    state.bhaSetup?.frontReamerSerialNumber ??
                    state.activeReamerSerialNumber ??
                    "—"
                  }
                />
                <MetricDisplay
                  label="Rear reamer"
                  value={state.bhaSetup?.rearReamerSerialNumber ?? "—"}
                />
                <MetricDisplay label="Latest survey" value={state.latestSurveyDepthDm === undefined ? "—" : formatMetres(decimetres(state.latestSurveyDepthDm))} />
              </div>
            )}
          </SectionPanel>

          <FieldActionButton
            type="submit"
            fieldSize="major"
            fullWidth
            busy={saving}
            disabled={loading || state === null || !rigId}
          >
            <Play aria-hidden="true" className="size-5" />
            Start shift
          </FieldActionButton>
        </form>
      )}
      {discardDialog}
    </div>
  );
}
