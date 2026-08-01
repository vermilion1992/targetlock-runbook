"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  installCasing,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMetres,
  parseMetreInput,
  validateCasingRange,
  type Decimetres,
} from "@/domain";

import {
  CasingNotice,
  completedHoleDepth,
  createCasingId,
  defaultCasingActor,
} from "./casing-support";

function metreError(value: string, label: string): string | null {
  const parsed = parseMetreInput(value);
  if (parsed.ok) return null;
  if (parsed.reason === "empty") return `${label} is required.`;
  if (parsed.reason === "negative") return `${label} cannot be negative.`;
  if (parsed.reason === "precision")
    return `${label} must use 0.1 m precision.`;
  return `Enter a valid ${label.toLocaleLowerCase("en-AU")}.`;
}

export function CasingInstallForm({ holeId }: { holeId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [size, setSize] = useState("PQ");
  const [startDepth, setStartDepth] = useState("0.0");
  const [endDepth, setEndDepth] = useState("0.0");
  const [comment, setComment] = useState("");
  const [holeDepth, setHoleDepth] = useState<Decimetres | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationReason, setConfirmationReason] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.casing(holeId);
  const errorRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      const services = createBrowserRunbookServices();
      if (!active) return;
      if (services === null) {
        setMessage("Browser storage is unavailable. Casing cannot be added.");
        return;
      }
      try {
        setHoleDepth(completedHoleDepth(holeId, services));
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : "The current completed depth could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [holeId]);

  const parsedStart = parseMetreInput(startDepth);
  const parsedEnd = parseMetreInput(endDepth);
  const range =
    parsedStart.ok && parsedEnd.ok && holeDepth !== null
      ? validateCasingRange(parsedStart.value, parsedEnd.value, holeDepth)
      : null;
  const aboveDepth = range?.ok && range.requiresDepthConfirmation;

  useEffect(() => {
    if (message) errorRef.current?.focus();
  }, [message]);

  useEffect(() => {
    if (aboveDepth) warningRef.current?.focus();
  }, [aboveDepth]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const nextStartError = metreError(startDepth, "Start depth");
    const nextEndError = metreError(endDepth, "End depth");
    setStartError(nextStartError);
    setEndError(nextEndError);
    if (nextStartError || nextEndError) return;

    const start = parseMetreInput(startDepth);
    const end = parseMetreInput(endDepth);
    if (!start.ok || !end.ok) return;
    if (holeDepth === null) {
      setMessage("Current completed depth is unavailable. Casing was not saved.");
      return;
    }
    const validation = validateCasingRange(start.value, end.value, holeDepth);
    if (!validation.ok) {
      setEndError(validation.reason);
      return;
    }
    if (
      validation.requiresDepthConfirmation &&
      (!confirmed || confirmationReason.trim().length === 0)
    ) {
      setMessage(
        "Confirm the above-depth entry and provide a reason before saving.",
      );
      return;
    }
    if (size.trim().length === 0) {
      setMessage("Casing size is required.");
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable. Casing was not saved.");
      return;
    }

    setSaving(true);
    try {
      const actor = defaultCasingActor();
      const casingId = createCasingId(`casing-${holeId.toLocaleLowerCase("en-AU")}`);
      const now = new Date().toISOString();
      await installCasing(
        {
          operationId: createCasingId("install-casing"),
          casingStringId: casingId,
          holeId,
          label: label.trim() || undefined,
          casingSize: size.trim().toLocaleUpperCase("en-AU"),
          startDepthDm: start.value,
          endDepthDm: end.value,
          currentHoleDepthDm: holeDepth,
          aboveDepthConfirmed: validation.requiresDepthConfirmation
            ? confirmed
            : undefined,
          aboveDepthReason: validation.requiresDepthConfirmation
            ? confirmationReason.trim()
            : undefined,
          installedAt: now,
          recordedAt: now,
          recordedByUserId: actor.userId,
          recordedByNameSnapshot: actor.userName,
          comment: comment.trim() || undefined,
        },
        services,
      );
      setIsDirty(false);
      router.push(
        `${runbookRoutes.casingDetail(holeId, casingId)}?notice=installed`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Casing was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title="Add casing"
        description={`Record a new casing string for ${holeId}. The install becomes the first immutable event in its history.`}
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      {message ? (
        <div ref={errorRef} tabIndex={-1}>
          <CasingNotice tone="error">{message}</CasingNotice>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
        noValidate
      >
        <SectionPanel
          title="Casing string"
          description="All depths are recorded to 0.1 m precision."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[var(--tl-ink)]">
              Label
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="For example, outer PQ"
                className="mt-2 h-12 border-[var(--tl-border-strong)] text-base"
              />
            </label>
            <label className="block text-sm font-bold text-[var(--tl-ink)]">
              Casing size <span aria-hidden="true">*</span>
              <Input
                required
                value={size}
                onChange={(event) => setSize(event.target.value)}
                placeholder="PQ"
                className="mt-2 h-12 border-[var(--tl-border-strong)] text-base uppercase"
              />
            </label>
            <MetreInput
              label="Start depth"
              value={startDepth}
              onValueChange={(value) => {
                setStartDepth(value);
                setStartError(null);
              }}
              min={0}
              required
              error={startError ?? undefined}
              helpText="Defaults to the collar at 0.0 m."
            />
            <MetreInput
              label="End depth"
              value={endDepth}
              onValueChange={(value) => {
                setEndDepth(value);
                setEndError(null);
                setConfirmed(false);
              }}
              min={0}
              required
              error={endError ?? undefined}
              helpText={
                holeDepth === null
                  ? "Loading current completed depth…"
                  : `Current completed depth: ${formatMetres(holeDepth)}.`
              }
            />
          </div>
        </SectionPanel>

        {aboveDepth ? (
          <SectionPanel
            title="Above completed depth"
            description="This value is deeper than the deepest completed run."
            className="border-[var(--tl-warning)]"
          >
            <div className="space-y-4">
              <div ref={warningRef} tabIndex={-1}>
                <CasingNotice tone="warning">
                  {range.warning} Confirm this is intentional and record why.
                </CasingNotice>
              </div>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] p-3 font-semibold">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>I confirm the casing depth is intentionally above the completed hole depth.</span>
              </label>
              <label className="block text-sm font-bold text-[var(--tl-ink)]">
                Confirmation reason <span aria-hidden="true">*</span>
                <Textarea
                  required
                  value={confirmationReason}
                  onChange={(event) => setConfirmationReason(event.target.value)}
                  className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
                  placeholder="Explain the source of the depth and why it is correct"
                />
              </label>
            </div>
          </SectionPanel>
        ) : null}

        <SectionPanel title="Install note" description="Optional operational context.">
          <label className="block text-sm font-bold text-[var(--tl-ink)]">
            Comment
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-2 min-h-24 border-[var(--tl-border-strong)] text-base"
              placeholder="Installation method, ground conditions, or handover note"
            />
          </label>
        </SectionPanel>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <FieldActionButton
            type="submit"
            busy={saving}
            fieldSize="major"
            className="min-h-12"
          >
            <Save aria-hidden="true" className="size-5" />
            Save casing
          </FieldActionButton>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
