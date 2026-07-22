"use client";

import { AlertTriangle, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
  type CurrentHoleState,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { RecordRunForm } from "@/components/runs/record-run-form";
import {
  ddh041Stage2CurrentState,
  targetLockStage2Seed,
} from "@/infrastructure/seed";

export function RecordRunGate({
  holeId,
  initialRodLength,
}: {
  holeId: string;
  initialRodLength?: 3 | 6;
}) {
  const [state, setState] = useState<CurrentHoleState | null>(null);
  const [message, setMessage] = useState("Checking the active shift…");

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void getCurrentHoleState(holeId, services.currentState)
      .then((next) => {
        setState(next);
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Run context could not be loaded."),
      );
  }, [holeId]);

  if (state === null) return <p role="status">{message}</p>;
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
      currentState={ddh041Stage2CurrentState}
      initialRodLength={initialRodLength}
      conditionOptions={targetLockStage2Seed.runConditionTags.map((tag) => ({
        value: tag.localId,
        label: tag.label,
        description:
          tag.code === "COMP"
            ? "Stable, competent core"
            : tag.code === "BRKN"
              ? "Broken or fragmented interval"
              : "Recovery exceeds drilled length",
      }))}
    />
  );
}
