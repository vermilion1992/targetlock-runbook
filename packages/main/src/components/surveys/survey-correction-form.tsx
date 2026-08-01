"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  correctSurvey,
  createBrowserRunbookServices,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { resolveOperationActor } from "@/components/session/operation-actor";
import { useOperatorSession } from "@/components/session";
import {
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
  type Survey,
} from "@/domain";

export function SurveyCorrectionForm({
  holeId,
  surveyId,
}: {
  holeId: string;
  surveyId: string;
}) {
  const router = useRouter();
  const { runtimeMode, session, pilot } = useOperatorSession();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [depth, setDepth] = useState("");
  const [dip, setDip] = useState("");
  const [azimuth, setAzimuth] = useState("");
  const [northReference, setNorthReference] =
    useState<NorthReference>("NOT_SPECIFIED");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.surveyDetail(holeId, surveyId);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void services.surveys
      .getById(surveyId, holeId)
      .then((record) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Survey was not found.");
        }
        setSurvey(record);
        setDepth((record.depthDm / 10).toFixed(1));
        setDip((record.dipTenths / 10).toFixed(1));
        setAzimuth((record.azimuthTenths / 10).toFixed(1));
        setNorthReference(record.northReference);
        setComment(record.comment ?? "");
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Survey could not be loaded."),
      );
  }, [holeId, surveyId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (survey === null) return;
    const depthResult = parseMetreInput(depth);
    const dipResult = parseDipInput(dip);
    const azimuthResult = parseAzimuthInput(azimuth);
    if (!depthResult.ok || !dipResult.ok || !azimuthResult.ok) {
      setError("Check the depth, dip and azimuth values.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason for the correction.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    const operationId = crypto.randomUUID();
    try {
      const actor = resolveOperationActor(runtimeMode, session, pilot, {
        id: "user-driller-hoffman",
        name: "M. Hoffman",
        organisationId: "organisation-briggs",
      });
      await correctSurvey(
        {
          operationId,
          correctionId: `correction-${operationId}`,
          surveyId,
          holeId,
          expectedVersion: survey.version,
          changes: {
            depthDm: depthResult.value,
            dipTenths: dipResult.value,
            azimuthTenths: azimuthResult.value,
            northReference,
            comment: comment.trim() || undefined,
          },
          reason: reason.trim(),
          correctedByUserId: actor.id,
          correctedByNameSnapshot: actor.name,
          correctedAt: new Date().toISOString(),
        },
        services,
      );
      setIsDirty(false);
      router.push(parentHref);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correction could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (survey === null && !error) return <p role="status">Loading survey…</p>;

  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Surveys"
        title="Correct survey"
        description="The original values remain available in correction and audit history."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />
      {error ? <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-bold">{error}</p> : null}
      {survey ? (
        <form
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          className="grid gap-4 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:grid-cols-2 sm:p-5"
        >
          <label>
            <span className="text-sm font-bold">Depth (m)</span>
            <input required value={depth} onChange={(event) => setDepth(event.target.value)} inputMode="decimal" className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <label>
            <span className="text-sm font-bold">Dip (°)</span>
            <input required value={dip} onChange={(event) => setDip(event.target.value)} inputMode="decimal" className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <label>
            <span className="text-sm font-bold">Azimuth (°)</span>
            <input required value={azimuth} onChange={(event) => setAzimuth(event.target.value)} inputMode="decimal" className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <label>
            <span className="text-sm font-bold">North reference</span>
            <select value={northReference} onChange={(event) => setNorthReference(event.target.value as NorthReference)} className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3">
              <option value="MAGNETIC">Magnetic North</option>
              <option value="TRUE">True North</option>
              <option value="GRID">Grid North</option>
              <option value="NOT_SPECIFIED">Not specified</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">Comment</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-2 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">Correction reason *</span>
            <input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: Typing mistake" className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" />
          </label>
          <button type="submit" disabled={saving} className="tl-action-primary flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white disabled:opacity-60 sm:col-span-2">
            <Save aria-hidden="true" className="size-5" />
            {saving ? "SAVING CORRECTION…" : "SAVE CORRECTION"}
          </button>
        </form>
      ) : null}
      {discardDialog}
    </div>
  );
}
