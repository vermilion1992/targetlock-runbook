"use client";

import { AlertTriangle, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  deriveDrillingReadiness,
  getCurrentHoleState,
  type CurrentHoleState,
  type DrillingReadiness,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { RecordRunForm } from "@/components/runs/record-run-form";

export function RecordRunGate({
  holeId,
  initialRodLength,
}: {
  holeId: string;
  initialRodLength?: 3 | 6;
}) {
  const [state, setState] = useState<CurrentHoleState | null>(null);
  const [readiness, setReadiness] = useState<DrillingReadiness | null>(null);
  const [message, setMessage] = useState("Checking the active shift…");

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      getCurrentHoleState(holeId, services.currentState),
      services.completion.getStatus(holeId),
    ])
      .then(([next, holeStatus]) => {
        setState(next);
        setReadiness(
          deriveDrillingReadiness({
            holeStatus,
            bhaSetup: next.bhaSetup,
          }),
        );
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Run context could not be loaded."),
      );
  }, [holeId]);

  if (state === null || readiness === null) return <p role="status">{message}</p>;
  if (!readiness.ready) {
    return (
      <div className="space-y-5">
        <StagePageHeader
          eyebrow="Drilling readiness"
          title="BHA setup required"
          description="This hole cannot record a run until its initial drilling measurements are valid."
        />
        <div
          role="alert"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
        >
          <div className="flex gap-3">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            <div>
              <p className="font-bold">Complete drilling setup first.</p>
              <ul className="mt-2 space-y-1 text-sm font-semibold">
                {readiness.blockers.map((blocker) => (
                  <li key={blocker.code}>• {blocker.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <Link
          href={runbookRoutes.updateBha(holeId)}
          className="inline-flex min-h-14 items-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
        >
          Update BHA
        </Link>
      </div>
    );
  }
  if (state.activeShift === null) {
    const pending = state.pendingHandover;
    return (
      <div className="space-y-5">
        <StagePageHeader
          eyebrow="Stage 2 · run ownership"
          title="Active shift required"
          description="Runs cannot be created anonymously or without a shift owner."
        />
        <div role="alert" className="flex gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4">
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <p className="font-semibold">
            {pending
              ? "Accept the pending handover before continuing the unfinished run."
              : "Start a Day Shift or Night Shift before recording runs."}
          </p>
        </div>
        <Link
          href={pending ? runbookRoutes.handover(holeId) : runbookRoutes.startShift(holeId)}
          className="inline-flex min-h-14 items-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
        >
          <Play aria-hidden="true" className="size-5" />
          {pending ? "Review handover" : "Start shift"}
        </Link>
      </div>
    );
  }

  const active = state.activeShift;
  return (
    <RecordRunForm
      holeId={holeId}
      runNumber={state.nextRunNumber}
      activeShiftId={active.localId}
      shiftLabel={active.shiftType === "DAY" ? "Day Shift" : "Night Shift"}
      primaryDrillerId={active.primaryDrillerId}
      primaryDriller={active.primaryDrillerNameSnapshot}
      currentState={{
        rodNumber: state.currentRodNumber,
        currentRodString: state.currentRodStringDm,
        previousCompletedDepth: state.previousCompletedDepthDm,
        measuredStickUp: state.measuredStickUpDm,
      }}
      initialRodLength={initialRodLength}
    />
  );
}
