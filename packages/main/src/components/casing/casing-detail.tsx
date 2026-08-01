"use client";

import { MoveDown, PencilLine, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  removeCasing,
  updateCasingStatus,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Textarea } from "@/components/ui/textarea";
import type { CasingEvent, CasingStatus, CasingString } from "@/domain";

import {
  CasingEventHistory,
  CasingNotice,
  CasingStatusPill,
  createCasingId,
  defaultCasingActor,
  formatCasingDate,
  formatCasingDepth,
  formatCasingLength,
  titleCase,
} from "./casing-support";

function successNotice(notice?: string): string | null {
  if (notice === "installed") return "Casing was saved before this detail opened.";
  if (notice === "advanced") return "Casing advance was saved.";
  if (notice === "corrected")
    return "Correction was appended. Original events remain unchanged.";
  return null;
}

export function CasingDetail({
  holeId,
  casingId,
  notice,
}: {
  holeId: string;
  casingId: string;
  notice?: string;
}) {
  const [casing, setCasing] = useState<CasingString | null>(null);
  const [events, setEvents] = useState<readonly CasingEvent[]>([]);
  const [targetStatus, setTargetStatus] =
    useState<Exclude<CasingStatus, "ACTIVE">>("COMPLETED");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(
    successNotice(notice),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        const [record, history] = await Promise.all([
          services.casing.getById(casingId, holeId),
          services.casing.listEvents(holeId, casingId),
        ]);
        if (!active) return;
        setCasing(record);
        setEvents(history);
        if (!record) setMessage("This casing string could not be found.");
        if (record?.status === "COMPLETED") setTargetStatus("ABANDONED");
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

  const changeLifecycle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setConfirmation(null);
    if (!casing) return;
    if (reason.trim().length === 0) {
      setMessage("A lifecycle change reason is required.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable. The status was not changed.");
      return;
    }
    setSaving(true);
    try {
      const actor = defaultCasingActor();
      const common = {
        operationId: createCasingId("casing-status"),
        casingStringId: casing.localId,
        holeId,
        reason: reason.trim(),
        recordedByUserId: actor.userId,
        recordedByNameSnapshot: actor.userName,
        recordedAt: new Date().toISOString(),
        expectedVersion: casing.version,
      };
      const updated =
        targetStatus === "REMOVED"
          ? await removeCasing(common, services)
          : await updateCasingStatus(
              { ...common, newStatus: targetStatus },
              services,
            );
      const updatedEvents = await services.casing.listEvents(holeId, casingId);
      setCasing(updated);
      setEvents(updatedEvents);
      setReason("");
      if (updated.status === "COMPLETED") setTargetStatus("ABANDONED");
      setConfirmation(`Casing status changed to ${titleCase(updated.status)}.`);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "The status was not changed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const lifecycleMutable =
    casing?.status === "ACTIVE" || casing?.status === "COMPLETED";
  const statusOptions: readonly Exclude<CasingStatus, "ACTIVE">[] =
    casing?.status === "COMPLETED"
      ? ["ABANDONED", "REMOVED"]
      : ["COMPLETED", "ABANDONED", "REMOVED"];

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title={casing?.label || (casing ? `${casing.casingSize} casing` : "Casing detail")}
        description="Current projection, lifecycle actions, and permanent event history."
        backTarget={namedBackTarget(runbookRoutes.casing(holeId), "Casing")}
      />

      {confirmation ? (
        <CasingNotice tone="success">{confirmation}</CasingNotice>
      ) : null}
      {message ? <CasingNotice tone="error">{message}</CasingNotice> : null}
      <div role="status" aria-live="polite" className="sr-only">
        {loading ? "Loading casing detail." : "Casing detail loaded."}
      </div>

      {casing ? (
        <>
          <SectionPanel
            title="Current casing state"
            description={`${casing.casingSize} · version ${casing.version}`}
            action={<CasingStatusPill status={casing.status} />}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricDisplay
                label="Start depth"
                value={formatCasingDepth(casing.startDepthDm)}
              />
              <MetricDisplay
                label="Current end"
                value={formatCasingDepth(casing.currentEndDepthDm)}
                emphasis="strong"
              />
              <MetricDisplay
                label="Cased length"
                value={formatCasingLength(
                  casing.startDepthDm,
                  casing.currentEndDepthDm,
                )}
              />
              <MetricDisplay
                label="Events"
                value={events.length}
                supportingText="Append-only history"
              />
            </div>
            <dl className="mt-5 grid gap-4 rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-sunken)] p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-semibold text-[var(--tl-ink-muted)]">
                  Installed
                </dt>
                <dd className="mt-1 font-bold text-[var(--tl-ink)]">
                  {formatCasingDate(casing.installedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--tl-ink-muted)]">
                  Installed by
                </dt>
                <dd className="mt-1 font-bold text-[var(--tl-ink)]">
                  {casing.installedByNameSnapshot}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--tl-ink-muted)]">
                  Identifier
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-[var(--tl-ink)]">
                  {casing.localId}
                </dd>
              </div>
            </dl>
          </SectionPanel>

          <section
            aria-label="Casing actions"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Link
              href={runbookRoutes.advanceCasing(holeId, casing.localId)}
              aria-disabled={casing.status !== "ACTIVE"}
              tabIndex={casing.status === "ACTIVE" ? undefined : -1}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold no-underline ${
                casing.status === "ACTIVE"
                  ? "bg-[var(--tl-primary)] text-white"
                  : "pointer-events-none border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-[var(--tl-ink-muted)]"
              }`}
            >
              <MoveDown aria-hidden="true" className="size-5" />
              Advance casing
            </Link>
            <Link
              href={runbookRoutes.correctCasing(holeId, casing.localId)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-5 font-bold no-underline"
            >
              <PencilLine aria-hidden="true" className="size-5" />
              Correct casing
            </Link>
          </section>

          {lifecycleMutable ? (
            <form onSubmit={changeLifecycle}>
              <SectionPanel
                title="Lifecycle action"
                description="Complete, abandon, or remove this casing string. Reactivation requires a correction."
              >
                <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_auto] lg:items-end">
                  <label className="block text-sm font-bold text-[var(--tl-ink)]">
                    New status
                    <select
                      value={targetStatus}
                      onChange={(event) =>
                        setTargetStatus(
                          event.target.value as Exclude<CasingStatus, "ACTIVE">,
                        )
                      }
                      className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {titleCase(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-[var(--tl-ink)]">
                    Reason <span aria-hidden="true">*</span>
                    <Textarea
                      required
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-2 min-h-20 border-[var(--tl-border-strong)] text-base lg:min-h-12"
                      placeholder="Why is this lifecycle change required?"
                    />
                  </label>
                  <FieldActionButton
                    type="submit"
                    busy={saving}
                    className="min-h-12 w-full lg:w-auto"
                  >
                    <Save aria-hidden="true" className="size-5" />
                    Save status
                  </FieldActionButton>
                </div>
              </SectionPanel>
            </form>
          ) : null}

          <SectionPanel
            title="Casing events"
            description="Events are shown newest first. Corrections retain and reference prior values."
          >
            <CasingEventHistory events={events} headingLevel={3} />
          </SectionPanel>
        </>
      ) : null}
    </div>
  );
}
