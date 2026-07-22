"use client";

import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  createOperationalTray,
  getCurrentHoleState,
  TrayWarningConfirmationRequired,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { PhotoInput } from "@/components/media/photo-input";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  parseMetreInput,
  suggestTrayValues,
  type Decimetres,
  type Tray,
  type TrayValidationIssue,
} from "@/domain";

function optionalDepth(
  value: string,
): { readonly ok: true; readonly value?: Decimetres } | { readonly ok: false } {
  if (!value.trim()) return { ok: true };
  const result = parseMetreInput(value);
  return result.ok ? { ok: true, value: result.value } : { ok: false };
}

export function TrayForm({ holeId }: { holeId: string }) {
  const router = useRouter();
  const warningRef = useRef<HTMLDivElement>(null);
  const operationId = useRef<string | null>(null);
  const [trays, setTrays] = useState<readonly Tray[]>([]);
  const [currentDepth, setCurrentDepth] = useState<Decimetres | null>(null);
  const [trayNumber, setTrayNumber] = useState("");
  const [startDepth, setStartDepth] = useState("");
  const [endDepth, setEndDepth] = useState("");
  const [comment, setComment] = useState("");
  const [isFinalPartial, setIsFinalPartial] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [shiftId, setShiftId] = useState<string | undefined>();
  const [user, setUser] = useState({
    id: "user-driller-hoffman",
    name: "M. Hoffman",
  });
  const [warnings, setWarnings] = useState<readonly TrayValidationIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.trays.listByHole(holeId),
      getCurrentHoleState(holeId, services.currentState),
    ])
      .then(([records, state]) => {
        setTrays(records);
        setCurrentDepth(state.currentDepthDm);
        const suggestions = suggestTrayValues(records, state.currentDepthDm);
        setTrayNumber(String(suggestions.trayNumber));
        setStartDepth(
          suggestions.startDepthDm === undefined
            ? ""
            : (suggestions.startDepthDm / 10).toFixed(1),
        );
        setEndDepth((suggestions.endDepthDm / 10).toFixed(1));
        setShiftId(state.activeShift?.localId);
        if (state.activeShift) {
          setUser({
            id: state.activeShift.primaryDrillerId,
            name: state.activeShift.primaryDrillerNameSnapshot,
          });
        }
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Tray suggestions could not be loaded.",
        ),
      );
  }, [holeId]);

  async function save(confirmWarnings: boolean): Promise<void> {
    const number = Number(trayNumber);
    const start = optionalDepth(startDepth);
    const end = optionalDepth(endDepth);
    if (!Number.isInteger(number) || number <= 0) {
      setError("Tray number must be a positive whole number.");
      return;
    }
    if (!start.ok || !end.ok) {
      setError("Tray depths must use non-negative 0.1 m increments.");
      return;
    }
    if (photo === null) {
      setError("Choose a completed-tray photograph before saving.");
      return;
    }
    if (currentDepth === null) {
      setError("Current completed hole depth is unavailable.");
      return;
    }
    const duplicate = trays.find(({ trayNumber }) => trayNumber === number);
    if (duplicate !== undefined) {
      setWarnings([
        {
          code: "DUPLICATE_NUMBER",
          message: `Tray ${number} already exists. View it or replace its photograph.`,
        },
      ]);
      requestAnimationFrame(() => warningRef.current?.focus());
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Local tray services are unavailable.");
      return;
    }
    operationId.current ??= crypto.randomUUID();
    setSaving(true);
    setError(null);
    try {
      await createOperationalTray(
        {
          operationId: operationId.current,
          trayId: `tray-${operationId.current}`,
          photoId: `photo-tray-${operationId.current}`,
          holeId,
          shiftId,
          trayNumber: number,
          startDepthDm: start.value,
          endDepthDm: end.value,
          comment: comment.trim() || undefined,
          isFinalPartial,
          original: photo,
          originalFilename: photo.name,
          capturedAt: new Date().toISOString(),
          description: `Completed core tray ${number}`,
          userId: user.id,
          userNameSnapshot: user.name,
          currentCompletedDepthDm: currentDepth,
          warningsConfirmed: confirmWarnings,
        },
        services,
      );
      router.push(`${runbookRoutes.currentHole(holeId)}?notice=tray-saved`);
    } catch (caught) {
      if (caught instanceof TrayWarningConfirmationRequired) {
        setWarnings(caught.warnings);
        requestAnimationFrame(() => warningRef.current?.focus());
      } else {
        setError(
          caught instanceof Error ? caught.message : "Tray could not be saved.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  const duplicateTray = warnings.some(
    ({ code }) => code === "DUPLICATE_NUMBER",
  )
    ? trays.find(({ trayNumber: number }) => number === Number(trayNumber))
    : undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 4 · local media"
        title="Photograph completed tray"
        description={`Save a completed core tray for ${holeId}. Runs remain separate and overlap is derived from depth.`}
      />
      <Link href={runbookRoutes.trays(holeId)} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
        <ArrowLeft aria-hidden="true" className="size-5" />
        Tray library
      </Link>

      {warnings.length > 0 ? (
        <div
          ref={warningRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4 outline-none focus:ring-2 focus:ring-[var(--tl-focus)]"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <AlertTriangle aria-hidden="true" className="size-5" />
            Check tray details
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {duplicateTray ? (
              <>
                <Link
                  href={runbookRoutes.trayDetail(holeId, duplicateTray.localId)}
                  className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline"
                >
                  VIEW EXISTING
                </Link>
                <Link
                  href={runbookRoutes.replaceTrayPhoto(holeId, duplicateTray.localId)}
                  className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold no-underline"
                >
                  REPLACE PHOTOGRAPH
                </Link>
              </>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="min-h-11 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-60"
              >
                SAVE ANYWAY
              </button>
            )}
            <button type="button" onClick={() => setWarnings([])} className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold">
              CHECK ENTRY
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-bold">{error}</p> : null}

      <form onSubmit={submit} className="grid gap-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Hole</p>
          <p className="mt-1 text-xl font-bold">{holeId}</p>
        </div>
        <label>
          <span className="text-sm font-bold">Tray number *</span>
          <input required inputMode="numeric" value={trayNumber} onChange={(event) => setTrayNumber(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-lg" />
        </label>
        <div className="hidden md:block" />
        <label>
          <span className="text-sm font-bold">Start depth (m)</span>
          <input inputMode="decimal" value={startDepth} onChange={(event) => setStartDepth(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-lg" />
        </label>
        <label>
          <span className="text-sm font-bold">End depth (m)</span>
          <input inputMode="decimal" value={endDepth} onChange={(event) => setEndDepth(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-lg" />
          <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">Suggested from completed hole depth; correct it to the physical tray label.</span>
        </label>
        <div className="md:col-span-2">
          <PhotoInput id="tray-photo" label="Completed-tray photograph" file={photo} onFile={setPhoto} required />
        </div>
        <label className="md:col-span-2">
          <span className="text-sm font-bold">Comment (optional)</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-2 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3" />
        </label>
        <label className="flex min-h-12 items-center gap-3 md:col-span-2">
          <input type="checkbox" checked={isFinalPartial} onChange={(event) => setIsFinalPartial(event.target.checked)} className="size-5" />
          <span className="font-bold">Final partial tray</span>
        </label>
        <button type="submit" disabled={saving} className="tl-action-primary flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white disabled:opacity-60 md:col-span-2">
          <Save aria-hidden="true" className="size-5" />
          {saving ? "SAVING PHOTO AND TRAY…" : "SAVE TRAY"}
        </button>
        <p aria-live="polite" className="sr-only">
          {saving ? "Photograph save in progress. The tray is not complete until local media is verified." : ""}
        </p>
      </form>
    </div>
  );
}
