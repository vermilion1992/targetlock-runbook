"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  replaceOperationalTrayPhoto,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { LocalMediaImage } from "@/components/media/local-media-image";
import { PhotoInput } from "@/components/media/photo-input";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { resolveOperationActor } from "@/components/session/operation-actor";
import { useOperatorSession } from "@/components/session";
import type { Photo, Tray } from "@/domain";

export function TrayPhotoReplacementForm({
  holeId,
  trayId,
}: {
  holeId: string;
  trayId: string;
}) {
  const router = useRouter();
  const { runtimeMode, session, pilot } = useOperatorSession();
  const [tray, setTray] = useState<Tray | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.trayDetail(holeId, trayId);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void services.trays
      .getById(trayId, holeId)
      .then(async (record) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Tray was not found.");
        }
        setTray(record);
        setCurrentPhoto(
          await services.photos.getById(record.primaryPhotoId, holeId),
        );
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Tray could not be loaded."),
      );
  }, [holeId, trayId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tray === null || replacement === null) {
      setError("Choose the replacement photograph.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason for replacing the photograph.");
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
      const actor = resolveOperationActor(runtimeMode, session, pilot, {
        id: "user-driller-hoffman",
        name: "M. Hoffman",
        organisationId: "organisation-briggs",
      });
      await replaceOperationalTrayPhoto(
        {
          operationId,
          photoId: `photo-tray-replacement-${operationId}`,
          trayId,
          holeId,
          expectedVersion: tray.version,
          reason: reason.trim(),
          original: replacement,
          originalFilename: replacement.name,
          capturedAt: new Date().toISOString(),
          description: `Replacement photograph for completed core tray ${tray.trayNumber}`,
          userId: actor.id,
          userNameSnapshot: actor.name,
        },
        services,
      );
      setIsDirty(false);
      router.push(parentHref);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photograph could not be replaced.");
    } finally {
      setSaving(false);
    }
  }

  if (tray === null && !error) return <p role="status">Loading tray…</p>;
  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Stage 4 · recoverable media operation"
        title={`Replace tray ${tray?.trayNumber ?? ""} photograph`}
        description="The current photograph remains active until the new original and preview are safely stored."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />
      {error ? <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-bold">{error}</p> : null}
      {tray ? (
        <form
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          className="grid gap-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:p-5 lg:grid-cols-2"
        >
          <section aria-labelledby="current-photo-heading">
            <h2 id="current-photo-heading" className="mb-2 font-bold">Current active photograph</h2>
            <div className="aspect-[4/3] overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)]">
              <LocalMediaImage photo={currentPhoto} alt={`Current photograph for completed core tray ${tray.trayNumber}`} />
            </div>
          </section>
          <div className="space-y-4">
            <PhotoInput
              id="replacement-photo"
              label="Replacement photograph"
              file={replacement}
              onFile={(file) => {
                setReplacement(file);
                setIsDirty(true);
              }}
              required
              mode="tray"
            />
            <label className="block">
              <span className="text-sm font-bold">Replacement reason *</span>
              <input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: First photograph was blurred" className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="tl-action-primary flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white disabled:opacity-60 lg:col-span-2">
            <RefreshCw aria-hidden="true" className="size-5" />
            {saving ? "STORING AND VERIFYING…" : "REPLACE PHOTOGRAPH"}
          </button>
          <p aria-live="polite" className="sr-only">
            {saving ? "Replacement photograph save in progress. The existing photograph remains active." : ""}
          </p>
        </form>
      ) : null}
      {discardDialog}
    </div>
  );
}
