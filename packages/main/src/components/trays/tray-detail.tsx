"use client";

import { ChevronLeft, ChevronRight, Edit3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { LocalMediaImage } from "@/components/media/local-media-image";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  decimetres,
  findTrayRunOverlaps,
  formatMetres,
  type Photo,
  type RunbookShift,
  type Tray,
  type TrayOverlapRun,
} from "@/domain";
import { targetLockStage4Seed } from "@/infrastructure/seed";
import type { TrayCorrection } from "@/infrastructure/trays";

function range(tray: Tray): string {
  return tray.startDepthDm === undefined || tray.endDepthDm === undefined
    ? "Depth not recorded"
    : `${formatMetres(tray.startDepthDm)}–${formatMetres(tray.endDepthDm)}`;
}

export function TrayDetail({
  holeId,
  trayId,
}: {
  holeId: string;
  trayId: string;
}) {
  const [tray, setTray] = useState<Tray | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [shift, setShift] = useState<RunbookShift | null>(null);
  const [previous, setPrevious] = useState<Tray | null>(null);
  const [next, setNext] = useState<Tray | null>(null);
  const [overlaps, setOverlaps] = useState<readonly TrayOverlapRun[]>([]);
  const [corrections, setCorrections] = useState<readonly TrayCorrection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.trays.getById(trayId),
      services.trays.listByHole(holeId),
      services.trays.listCorrections(trayId),
      services.shifts.listByHole(holeId),
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
    ])
      .then(async ([record, trays, history, shifts, localRuns]) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Tray was not found.");
        }
        if (localRuns.status === "invalid") throw new Error(localRuns.reason);
        setTray(record);
        setCorrections(history);
        setPhoto(await services.photos.getById(record.primaryPhotoId));
        setShift(
          shifts.find(({ localId }) => localId === record.shiftId) ?? null,
        );
        const ordered = [...trays].sort(
          (left, right) => left.trayNumber - right.trayNumber,
        );
        const index = ordered.findIndex(({ localId }) => localId === trayId);
        setPrevious(ordered[index - 1] ?? null);
        setNext(ordered[index + 1] ?? null);
        const localNumbers = new Set(
          localRuns.snapshots.map(({ runNumber }) => runNumber),
        );
        const runs: TrayOverlapRun[] = [
          ...targetLockStage4Seed.runs
            .filter(
              (run) =>
                run.status !== "in_progress" &&
                !localNumbers.has(run.runNumber),
            )
            .map((run) => ({
              localId: run.localId,
              runNumber: run.runNumber,
              startDepthDm: run.startDepth,
              endDepthDm: run.holeDepth,
              status: run.status,
            })),
          ...localRuns.snapshots.map((run) => ({
            localId: run.localId,
            runNumber: run.runNumber,
            startDepthDm: decimetres(run.previousCompletedDepthDm),
            endDepthDm: decimetres(run.holeDepthDm),
            status: "completed" as const,
          })),
        ];
        setOverlaps(findTrayRunOverlaps(record, runs));
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Tray detail could not be loaded.",
        ),
      );
  }, [holeId, trayId]);

  if (error) return <p role="alert">{error}</p>;
  if (tray === null) return <p role="status">Loading tray…</p>;
  const runSummary =
    overlaps.length === 0
      ? "No completed run overlap"
      : overlaps.length === 1
        ? `Run ${overlaps[0]!.runNumber}`
        : `Runs ${overlaps[0]!.runNumber}–${overlaps.at(-1)!.runNumber}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 4 · tray detail"
        title={`Tray ${tray.trayNumber}`}
        description={`${holeId} · ${range(tray)}`}
        backTarget={namedBackTarget(runbookRoutes.trays(holeId), "Trays")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={runbookRoutes.correctTray(holeId, tray.localId)} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold no-underline">
              <Edit3 aria-hidden="true" className="size-4" />
              Edit details
            </Link>
            <Link href={runbookRoutes.replaceTrayPhoto(holeId, tray.localId)} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-primary)] px-3 font-bold text-[var(--tl-primary)] no-underline">
              <RefreshCw aria-hidden="true" className="size-4" />
              Replace photograph
            </Link>
          </div>
        }
      />
      <section className="grid gap-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)]">
          <LocalMediaImage photo={photo} alt={photo?.description ?? `Completed core tray ${tray.trayNumber}`} priority className="max-h-[75vh] w-full object-contain" />
        </div>
        <div className="space-y-3">
          <MetricDisplay label="Depth range" value={range(tray)} emphasis="strong" />
          <MetricDisplay label="Related runs" value={runSummary} />
          <MetricDisplay label="Photographed" value={formatFieldDateTime(tray.recordedAt)} />
          <MetricDisplay label="Recorded by" value={tray.recordedByNameSnapshot} />
          <MetricDisplay label="Final partial" value={tray.isFinalPartial ? "Yes" : "No"} />
          {shift ? (
            <MetricDisplay label="Shift" value={`${shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — ${shift.shiftDate}`} />
          ) : null}
          {tray.comment ? (
            <div className="rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
              <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Comment</p>
              <p className="mt-1">{tray.comment}</p>
            </div>
          ) : null}
        </div>
      </section>
      <SectionPanel
        title="Run overlap"
        description="Derived from completed depth intervals. No recovered metres are allocated between trays."
      >
        {overlaps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {overlaps.map((run) => (
              <Link key={run.localId} href={runbookRoutes.runDetail(holeId, run.localId)} className="inline-flex min-h-11 items-center rounded-full border border-[var(--tl-border-strong)] px-4 font-bold no-underline">
                Run {run.runNumber}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--tl-ink-muted)]">Enter both tray depths to derive run overlap.</p>
        )}
      </SectionPanel>
      {corrections.length > 0 ? (
        <SectionPanel title="Correction and replacement history">
          <ul className="space-y-2">
            {corrections.map((correction) => (
              <li key={correction.id} className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3 text-sm">
                <strong>{correction.fieldName}</strong>: {String(correction.previousValue)} → {String(correction.correctedValue)}
                <span className="block text-[var(--tl-ink-muted)]">{correction.reason} · {formatFieldDateTime(correction.correctedAt)}</span>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}
      <nav aria-label="Adjacent trays" className="grid grid-cols-2 gap-3">
        {previous ? (
          <Link href={runbookRoutes.trayDetail(holeId, previous.localId)} className="inline-flex min-h-12 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold no-underline">
            <ChevronLeft aria-hidden="true" className="size-5" />
            Tray {previous.trayNumber}
          </Link>
        ) : <span />}
        {next ? (
          <Link href={runbookRoutes.trayDetail(holeId, next.localId)} className="inline-flex min-h-12 items-center justify-end gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold no-underline">
            Tray {next.trayNumber}
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
