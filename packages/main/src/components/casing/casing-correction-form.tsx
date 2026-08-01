"use client";

import { PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  correctCasing,
  createBrowserRunbookServices,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Textarea } from "@/components/ui/textarea";
import {
  decimetresToMetres,
  formatMetres,
  parseMetreInput,
  validateCasingRange,
  type CasingStatus,
  type CasingString,
  type Decimetres,
} from "@/domain";

import {
  CASING_STATUSES,
  CasingNotice,
  completedHoleDepth,
  createCasingId,
  defaultCasingActor,
  titleCase,
} from "./casing-support";

export function CasingCorrectionForm({
  holeId,
  casingId,
}: {
  holeId: string;
  casingId: string;
}) {
  const router = useRouter();
  const [casing, setCasing] = useState<CasingString | null>(null);
  const [holeDepth, setHoleDepth] = useState<Decimetres | null>(null);
  const [newDepth, setNewDepth] = useState("");
  const [newStatus, setNewStatus] = useState<CasingStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationReason, setConfirmationReason] = useState("");
  const [depthError, setDepthError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.casingDetail(holeId, casingId);
  const errorRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const services = createBrowserRunbookServices();
      if (services === null) {
        if (active) {
          setMessage(
            "Browser storage is unavailable. Casing cannot be loaded.",
          );
          setLoading(false);
        }
        return;
      }
      try {
        const depth = completedHoleDepth(holeId, services);
        const record = await services.casing.getById(casingId, holeId);
        if (!active) return;
        setHoleDepth(depth);
        setCasing(record);
        if (record) {
          setNewDepth(
            decimetresToMetres(record.currentEndDepthDm).toFixed(1),
          );
          setNewStatus(record.status);
        } else {
          setMessage("This casing string could not be found.");
        }
      } catch (cause) {
        if (active) {
          setMessage(
            cause instanceof Error ? cause.message : "Casing could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [casingId, holeId]);

  const parsedDepth = parseMetreInput(newDepth);
  const validation =
    casing && parsedDepth.ok && holeDepth !== null
      ? validateCasingRange(casing.startDepthDm, parsedDepth.value, holeDepth)
      : null;
  const aboveDepth =
    validation?.ok === true && validation.requiresDepthConfirmation;

  useEffect(() => {
    if (message) errorRef.current?.focus();
  }, [message]);

  useEffect(() => {
    if (aboveDepth) warningRef.current?.focus();
  }, [aboveDepth]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setDepthError(null);
    const parsed = parseMetreInput(newDepth);
    if (!parsed.ok) {
      setDepthError("Enter the corrected end depth to 0.1 m precision.");
      return;
    }
    if (!casing || holeDepth === null) {
      setMessage("Casing or completed depth is unavailable.");
      return;
    }
    if (reason.trim().length === 0) {
      setMessage("A correction reason is required.");
      return;
    }
    if (
      parsed.value === casing.currentEndDepthDm &&
      newStatus === casing.status
    ) {
      setMessage("Change the end depth or status before saving a correction.");
      return;
    }
    const range = validateCasingRange(
      casing.startDepthDm,
      parsed.value,
      holeDepth,
    );
    if (!range.ok) {
      setDepthError(range.reason);
      return;
    }
    if (
      range.requiresDepthConfirmation &&
      (!confirmed || confirmationReason.trim().length === 0)
    ) {
      setMessage(
        "Confirm the above-depth correction and provide a reason before saving.",
      );
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable. The correction was not saved.");
      return;
    }

    setSaving(true);
    try {
      const actor = defaultCasingActor();
      await correctCasing(
        {
          operationId: createCasingId("correct-casing"),
          casingStringId: casing.localId,
          holeId,
          newEndDepthDm:
            parsed.value === casing.currentEndDepthDm ? undefined : parsed.value,
          newStatus: newStatus === casing.status ? undefined : newStatus,
          currentHoleDepthDm: holeDepth,
          aboveDepthConfirmed: range.requiresDepthConfirmation
            ? confirmed
            : undefined,
          aboveDepthReason: range.requiresDepthConfirmation
            ? confirmationReason.trim()
            : undefined,
          reason: reason.trim(),
          comment: comment.trim() || undefined,
          recordedByUserId: actor.userId,
          recordedByNameSnapshot: actor.userName,
          recordedAt: new Date().toISOString(),
          expectedVersion: casing.version,
        },
        services,
      );
      setIsDirty(false);
      router.push(
        `${runbookRoutes.casingDetail(holeId, casing.localId)}?notice=corrected`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "The correction was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title="Correct casing"
        description="Append a correction while retaining every original casing event."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      <CasingNotice tone="warning">
        Corrections do not edit or delete history. A new event records the old
        and corrected values, the operator, time, and required reason.
      </CasingNotice>
      {message ? (
        <div ref={errorRef} tabIndex={-1}>
          <CasingNotice tone="error">{message}</CasingNotice>
        </div>
      ) : null}
      <div role="status" aria-live="polite" className="sr-only">
        {loading ? "Loading casing." : "Casing loaded."}
      </div>

      {casing ? (
        <form
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          className="space-y-5"
          noValidate
        >
          <SectionPanel
            title={casing.label || `${casing.casingSize} casing`}
            description="Original current values are shown beside the proposed correction."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricDisplay
                label="Current end depth"
                value={formatMetres(casing.currentEndDepthDm)}
              />
              <MetricDisplay
                label="Current status"
                value={titleCase(casing.status)}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            title="Corrected values"
            description="Change at least one value."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <MetreInput
                label="Corrected end depth"
                value={newDepth}
                onValueChange={(value) => {
                  setNewDepth(value);
                  setDepthError(null);
                  setConfirmed(false);
                }}
                min={0}
                required
                error={depthError ?? undefined}
                helpText={
                  holeDepth === null
                    ? "Loading current completed depth…"
                    : `Current completed depth: ${formatMetres(holeDepth)}.`
                }
              />
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Corrected status
                <select
                  value={newStatus}
                  onChange={(event) =>
                    setNewStatus(event.target.value as CasingStatus)
                  }
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                >
                  {CASING_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {titleCase(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </SectionPanel>

          {aboveDepth ? (
            <SectionPanel
              title="Above completed depth"
              description="Extra confirmation is required for this corrected value."
              className="border-[var(--tl-warning)]"
            >
              <div className="space-y-4">
                <div ref={warningRef} tabIndex={-1}>
                  <CasingNotice tone="warning">
                    Corrected casing end depth is deeper than the current completed
                    hole depth.
                  </CasingNotice>
                </div>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-1 size-5 shrink-0"
                  />
                  <span>I confirm this above-depth correction is intentional.</span>
                </label>
                <label className="block text-sm font-bold text-[var(--tl-ink)]">
                  Above-depth reason <span aria-hidden="true">*</span>
                  <Textarea
                    required
                    value={confirmationReason}
                    onChange={(event) =>
                      setConfirmationReason(event.target.value)
                    }
                    className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
                    placeholder="Explain why this depth is correct"
                  />
                </label>
              </div>
            </SectionPanel>
          ) : null}

          <SectionPanel
            title="Correction record"
            description="The reason is stored on the immutable correction event."
          >
            <div className="space-y-5">
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Correction reason <span aria-hidden="true">*</span>
                <Textarea
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
                  placeholder="Describe what was wrong and how the correct value was established"
                />
              </label>
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Additional comment
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="mt-2 min-h-20 border-[var(--tl-border-strong)] text-base"
                />
              </label>
            </div>
          </SectionPanel>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <FieldActionButton
              type="submit"
              busy={saving}
              fieldSize="major"
              className="min-h-12"
            >
              <PencilLine aria-hidden="true" className="size-5" />
              Save correction
            </FieldActionButton>
          </div>
        </form>
      ) : null}
      {discardDialog}
    </div>
  );
}
