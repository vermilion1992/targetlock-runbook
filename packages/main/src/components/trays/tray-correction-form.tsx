"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  correctTrayDetails,
  createBrowserRunbookServices,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { parseMetreInput, type Decimetres, type Tray } from "@/domain";

function optionalDepth(value: string): Decimetres | undefined | null {
  if (!value.trim()) return undefined;
  const result = parseMetreInput(value);
  return result.ok ? result.value : null;
}

export function TrayCorrectionForm({
  holeId,
  trayId,
}: {
  holeId: string;
  trayId: string;
}) {
  const router = useRouter();
  const [tray, setTray] = useState<Tray | null>(null);
  const [trayNumber, setTrayNumber] = useState("");
  const [startDepth, setStartDepth] = useState("");
  const [endDepth, setEndDepth] = useState("");
  const [comment, setComment] = useState("");
  const [isFinalPartial, setIsFinalPartial] = useState(false);
  const [reason, setReason] = useState("");
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
    void services.trays
      .getById(trayId)
      .then((record) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Tray was not found.");
        }
        setTray(record);
        setTrayNumber(String(record.trayNumber));
        setStartDepth(
          record.startDepthDm === undefined
            ? ""
            : (record.startDepthDm / 10).toFixed(1),
        );
        setEndDepth(
          record.endDepthDm === undefined
            ? ""
            : (record.endDepthDm / 10).toFixed(1),
        );
        setComment(record.comment ?? "");
        setIsFinalPartial(record.isFinalPartial);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Tray could not be loaded."),
      );
  }, [holeId, trayId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tray === null) return;
    const number = Number(trayNumber);
    const start = optionalDepth(startDepth);
    const end = optionalDepth(endDepth);
    if (!Number.isInteger(number) || number <= 0 || start === null || end === null) {
      setError("Check the tray number and depth values.");
      return;
    }
    if (start !== undefined && end !== undefined && end < start) {
      setError("Tray end depth cannot be shallower than its start depth.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a correction reason.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    const operationId = crypto.randomUUID();
    setSaving(true);
    try {
      await correctTrayDetails(
        {
          operationId,
          correctionId: `correction-${operationId}`,
          trayId,
          holeId,
          expectedVersion: tray.version,
          trayNumber: number,
          startDepthDm: start,
          endDepthDm: end,
          comment,
          isFinalPartial,
          reason: reason.trim(),
          userId: "user-driller-hoffman",
          userNameSnapshot: "M. Hoffman",
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      router.push(runbookRoutes.trayDetail(holeId, trayId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correction could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (tray === null && !error) return <p role="status">Loading tray…</p>;
  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Stage 4 · audited correction"
        title="Edit tray details"
        description="Depth and number corrections retain their previous values and reason."
      />
      <Link href={runbookRoutes.trayDetail(holeId, trayId)} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
        <ArrowLeft aria-hidden="true" className="size-5" />
        Back to tray
      </Link>
      {error ? <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-bold">{error}</p> : null}
      {tray ? (
        <form onSubmit={submit} className="grid gap-4 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:grid-cols-2 sm:p-5">
          <label>
            <span className="text-sm font-bold">Tray number</span>
            <input required inputMode="numeric" value={trayNumber} onChange={(event) => setTrayNumber(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <span className="hidden sm:block" />
          <label>
            <span className="text-sm font-bold">Start depth (m)</span>
            <input inputMode="decimal" value={startDepth} onChange={(event) => setStartDepth(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <label>
            <span className="text-sm font-bold">End depth (m)</span>
            <input inputMode="decimal" value={endDepth} onChange={(event) => setEndDepth(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">Comment</span>
            <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3" />
          </label>
          <label className="flex min-h-12 items-center gap-3 sm:col-span-2">
            <input type="checkbox" checked={isFinalPartial} onChange={(event) => setIsFinalPartial(event.target.checked)} className="size-5" />
            <span className="font-bold">Final partial tray</span>
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">Correction reason *</span>
            <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <button type="submit" disabled={saving} className="tl-action-primary flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white disabled:opacity-60 sm:col-span-2">
            <Save aria-hidden="true" className="size-5" />
            {saving ? "SAVING CORRECTION…" : "SAVE CORRECTION"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
