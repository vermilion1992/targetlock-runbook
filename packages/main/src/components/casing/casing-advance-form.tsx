"use client";

import { MoveDown, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  advanceCasing,
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
  subtractDecimetres,
  validateCasingRange,
  type CasingString,
  type Decimetres,
} from "@/domain";

import {
  CasingNotice,
  completedHoleDepth,
  createCasingId,
  defaultCasingActor,
} from "./casing-support";

export function CasingAdvanceForm({
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
        if (record)
          setNewDepth(
            decimetresToMetres(record.currentEndDepthDm).toFixed(1),
          );
        if (!record) setMessage("This casing string could not be found.");
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
  const range =
    casing && parsedDepth.ok && holeDepth !== null
      ? validateCasingRange(casing.startDepthDm, parsedDepth.value, holeDepth)
      : null;
  const aboveDepth = range?.ok === true && range.requiresDepthConfirmation;
  const changeDm =
    casing &&
    parsedDepth.ok &&
    parsedDepth.value > casing.currentEndDepthDm
      ? subtractDecimetres(
          parsedDepth.value,
          casing.currentEndDepthDm,
          "Casing advance preview",
        )
      : null;

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
      setDepthError("Enter the new end depth to 0.1 m precision.");
      return;
    }
    if (!casing || holeDepth === null) {
      setMessage("Casing or completed depth is unavailable.");
      return;
    }
    if (casing.status !== "ACTIVE") {
      setMessage("Only active casing can be advanced.");
      return;
    }
    if (parsed.value <= casing.currentEndDepthDm) {
      setDepthError("New end depth must be deeper than the previous end depth.");
      return;
    }
    const validation = validateCasingRange(
      casing.startDepthDm,
      parsed.value,
      holeDepth,
    );
    if (!validation.ok) {
      setDepthError(validation.reason);
      return;
    }
    if (
      validation.requiresDepthConfirmation &&
      (!confirmed || confirmationReason.trim().length === 0)
    ) {
      setMessage(
        "Confirm the above-depth advance and provide a reason before saving.",
      );
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable. The advance was not saved.");
      return;
    }

    setSaving(true);
    try {
      const actor = defaultCasingActor();
      await advanceCasing(
        {
          operationId: createCasingId("advance-casing"),
          casingStringId: casing.localId,
          holeId,
          newEndDepthDm: parsed.value,
          currentHoleDepthDm: holeDepth,
          aboveDepthConfirmed: validation.requiresDepthConfirmation
            ? confirmed
            : undefined,
          aboveDepthReason: validation.requiresDepthConfirmation
            ? confirmationReason.trim()
            : undefined,
          reason: reason.trim() || undefined,
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
        `${runbookRoutes.casingDetail(holeId, casing.localId)}?notice=advanced`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "The advance was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title="Advance casing"
        description="Extend an active casing string and append a permanent advance event."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

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
            description={`${casing.casingSize} · ${casing.status.toLocaleLowerCase("en-AU")}`}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricDisplay
                label="Previous end"
                value={formatMetres(casing.currentEndDepthDm)}
              />
              <MetricDisplay
                label="New end"
                value={parsedDepth.ok ? formatMetres(parsedDepth.value) : "—"}
                emphasis="strong"
              />
              <MetricDisplay
                label="Change"
                value={
                  changeDm === null
                    ? "—"
                    : `+${formatMetres(changeDm)}`
                }
                supportingText="Must be greater than 0.0 m"
              />
            </div>
          </SectionPanel>

          <SectionPanel
            title="New casing depth"
            description="Use the controls or type a value at 0.1 m precision."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <MetreInput
                label="New end depth"
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
                Advance reason
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
                  placeholder="Optional reason for this advance"
                />
              </label>
            </div>
          </SectionPanel>

          {aboveDepth ? (
            <SectionPanel
              title="Above completed depth"
              description="Extra confirmation is required for this advance."
              className="border-[var(--tl-warning)]"
            >
              <div className="space-y-4">
                <div ref={warningRef} tabIndex={-1}>
                  <CasingNotice tone="warning">
                    Casing end depth is deeper than the current completed hole
                    depth.
                  </CasingNotice>
                </div>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-1 size-5 shrink-0"
                  />
                  <span>I confirm this above-depth advance is intentional.</span>
                </label>
                <label className="block text-sm font-bold text-[var(--tl-ink)]">
                  Confirmation reason <span aria-hidden="true">*</span>
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

          <SectionPanel title="Event note" description="Optional shift or handover context.">
            <label className="block text-sm font-bold text-[var(--tl-ink)]">
              Comment
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
              />
            </label>
          </SectionPanel>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <FieldActionButton
              type="submit"
              busy={saving}
              disabled={casing.status !== "ACTIVE"}
              fieldSize="major"
              className="min-h-12"
            >
              <MoveDown aria-hidden="true" className="size-5" />
              <Save aria-hidden="true" className="sr-only" />
              Save advance
            </FieldActionButton>
          </div>
        </form>
      ) : null}
      {discardDialog}
    </div>
  );
}
