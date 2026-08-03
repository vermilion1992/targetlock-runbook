"use client";

import { ChevronLeft, ChevronRight, Edit3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { SectionPanel } from "@/components/field/section-panel";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { LocalMediaImage } from "@/components/media/local-media-image";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { Photo, RunbookShift, Tray } from "@/domain";
import type { TrayCorrection } from "@/infrastructure/trays";

const trayActionClassName =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-center text-sm font-bold text-[var(--tl-ink)] no-underline";

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
      services.trays.getById(trayId, holeId),
      services.trays.listByHole(holeId),
      services.trays.listCorrections(trayId, holeId),
      services.shifts.listByHole(holeId),
    ])
      .then(async ([record, trays, history, shifts]) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Tray was not found.");
        }
        setTray(record);
        setCorrections(history);
        setPhoto(await services.photos.getById(record.primaryPhotoId, holeId));
        setShift(
          shifts.find(({ localId }) => localId === record.shiftId) ?? null,
        );
        const ordered = [...trays].sort(
          (left, right) => left.trayNumber - right.trayNumber,
        );
        const index = ordered.findIndex(({ localId }) => localId === trayId);
        setPrevious(ordered[index - 1] ?? null);
        setNext(ordered[index + 1] ?? null);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Tray detail could not be loaded.",
        ),
      );
  }, [holeId, trayId]);

  if (error) return <p role="alert">{error}</p>;
  if (tray === null) return <p role="status">Loading tray…</p>;

  const shiftLabel = shift
    ? `${shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — ${shift.shiftDate}`
    : "Shift not recorded";

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Trays"
        title={`Tray ${tray.trayNumber}`}
        description={holeId}
        backTarget={namedBackTarget(runbookRoutes.trays(holeId), "Trays")}
      />

      <section className="space-y-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5">
        <div className="overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)]">
          <LocalMediaImage
            photo={photo}
            alt={
              photo?.description ?? `Completed core tray ${tray.trayNumber}`
            }
            preferOriginal
            priority
            className="max-h-[75vh] w-full object-contain"
          />
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Recorded by
            </dt>
            <dd className="mt-1.5 text-lg font-bold tracking-[-0.02em] text-[var(--tl-ink)]">
              {tray.recordedByNameSnapshot}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Shift
            </dt>
            <dd className="mt-1.5 text-lg font-bold tracking-[-0.02em] text-[var(--tl-ink)]">
              {shiftLabel}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Date / time
            </dt>
            <dd className="mt-1.5 text-lg font-bold tracking-[-0.02em] text-[var(--tl-ink)]">
              {formatFieldDateTime(tray.recordedAt)}
            </dd>
          </div>
        </dl>

        {tray.comment ? (
          <div className="rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
              Comment
            </p>
            <p className="mt-1">{tray.comment}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={runbookRoutes.correctTray(holeId, tray.localId)}
            className={trayActionClassName}
          >
            <Edit3 aria-hidden="true" className="size-4 shrink-0" />
            Edit details
          </Link>
          <Link
            href={runbookRoutes.replaceTrayPhoto(holeId, tray.localId)}
            className={trayActionClassName}
          >
            <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
            Replace photograph
          </Link>
        </div>
      </section>

      {corrections.length > 0 ? (
        <SectionPanel title="Correction and replacement history">
          <ul className="space-y-2">
            {corrections.map((correction) => (
              <li
                key={correction.id}
                className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-3 text-sm"
              >
                <strong>{correction.fieldName}</strong>:{" "}
                {String(correction.previousValue)} →{" "}
                {String(correction.correctedValue)}
                <span className="block text-[var(--tl-ink-muted)]">
                  {correction.reason} ·{" "}
                  {formatFieldDateTime(correction.correctedAt)}
                </span>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      <nav aria-label="Adjacent trays" className="grid grid-cols-2 gap-3">
        {previous ? (
          <Link
            href={runbookRoutes.trayDetail(holeId, previous.localId)}
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold no-underline"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            Tray {previous.trayNumber}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={runbookRoutes.trayDetail(holeId, next.localId)}
            className="inline-flex min-h-12 items-center justify-end gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold no-underline"
          >
            Tray {next.trayNumber}
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
