"use client";

import { History, Save, Wrench } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  correctComponent,
  createBrowserRunbookServices,
  getComponentHistory,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateComponentUsage,
  decimetresToMetres,
  formatRecoveryPercentTenths,
  parseMetreInput,
  summarizeComponentUsage,
  type Component,
  type ComponentAssignment,
  type ComponentStatus,
  type ComponentUsage,
} from "@/domain";
import {
  ComponentRepositoryError,
  type ComponentCorrection,
} from "@/infrastructure/components";
import { targetLockStage3Seed } from "@/infrastructure/seed";

import {
  COMPONENT_STATUSES,
  OperationNotice,
  createComponentLocalId,
  defaultComponentActor,
  formatComponentDate,
  formatComponentDepth,
  readCompletedUsageRuns,
  titleCase,
} from "./component-support";
import { AssignmentCorrectionForm } from "./assignment-correction-form";

interface DetailState {
  readonly component: Component;
  readonly assignments: readonly ComponentAssignment[];
  readonly usage: readonly ComponentUsage[];
  readonly corrections: readonly ComponentCorrection[];
  readonly assignmentCorrections: readonly ComponentCorrection[];
}

function formValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function CorrectionField({
  id,
  label,
  name,
  defaultValue,
  required = false,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
        {label}
        {required ? <span className="ml-1 text-[var(--tl-danger)]">*</span> : null}
      </label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={100}
        className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
      />
    </div>
  );
}

export function ComponentDetail({
  componentId,
  notice,
}: {
  componentId: string;
  notice?: "component-created";
}) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    readonly tone: "error" | "success";
    readonly text: string;
  } | null>(
    notice === "component-created"
      ? { tone: "success", text: "Component saved to this browser." }
      : null,
  );

  const loadDetail = async () => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      throw new Error("Browser storage is unavailable.");
    }
    const completedRuns = readCompletedUsageRuns(
      targetLockStage3Seed.hole.name,
      services,
    );
    const [history, corrections] = await Promise.all([
      getComponentHistory(componentId, completedRuns, services),
      services.components.listCorrections(componentId),
    ]);
    if (history.component === null) throw new Error("Component not found.");
    const assignmentCorrections = (
      await Promise.all(
        history.assignments.map((assignment) =>
          services.componentAssignments.listCorrections(assignment.localId),
        ),
      )
    ).flat();
    setDetail({
      component: history.component,
      assignments: history.assignments,
      usage: history.assignments.map((assignment, index) =>
        assignment.holeId === targetLockStage3Seed.hole.name
          ? history.usage[index]!
          : calculateComponentUsage(assignment, []),
      ),
      corrections,
      assignmentCorrections,
    });
  };

  useEffect(() => {
    let active = true;
    const loadTimer = window.setTimeout(() => {
      void loadDetail()
        .catch((cause: unknown) => {
          if (active) {
            setMessage({
              tone: "error",
              text:
                cause instanceof Error
                  ? cause.message
                  : "Component details could not be loaded.",
            });
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(loadTimer);
    };
    // The local repository is reloaded explicitly after a correction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  const totals = useMemo(() => {
    const summary = summarizeComponentUsage(detail?.usage ?? []);
    return {
      drilledDm: summary.drilledMetresDm,
      runs: summary.runsTouched,
      holes: new Set(detail?.assignments.map(({ holeId }) => holeId) ?? []).size,
    };
  }, [detail]);

  const handleCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || detail === null) return;
    setSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const reason = formValue(form, "reason");
    const crown = formValue(form, "startingCrownHeight");
    const parsedCrown = crown ? parseMetreInput(crown) : null;
    if (!reason) {
      setMessage({ tone: "error", text: "A correction reason is required." });
      setSaving(false);
      return;
    }
    if (parsedCrown !== null && !parsedCrown.ok) {
      setMessage({
        tone: "error",
        text: "Starting crown height must use non-negative 0.1 m increments.",
      });
      setSaving(false);
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage({ tone: "error", text: "Browser storage is unavailable." });
      setSaving(false);
      return;
    }
    const actor = defaultComponentActor();
    try {
      await correctComponent(
        {
          operationId: createComponentLocalId("correct-component"),
          componentId,
          expectedVersion: detail.component.version,
          serialNumber: formValue(form, "serialNumber"),
          manufacturer: formValue(form, "manufacturer"),
          model: formValue(form, "model"),
          matrix: formValue(form, "matrix"),
          size: formValue(form, "size"),
          supplier: formValue(form, "supplier"),
          startingCrownHeightDm:
            parsedCrown?.ok === true ? parsedCrown.value : undefined,
          status: formValue(form, "status") as ComponentStatus,
          notes: formValue(form, "notes"),
          reason,
          auditHoleId: targetLockStage3Seed.hole.name,
          userId: actor.userId,
          userNameSnapshot: actor.userName,
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      await loadDetail();
      setMessage({
        tone: "success",
        text: "Registry correction saved with an audit entry.",
      });
    } catch (cause) {
      setMessage({
        tone: "error",
        text:
          cause instanceof ComponentRepositoryError &&
          cause.code === "STALE_VERSION"
            ? `${cause.message} Reload this page and review the latest values.`
            : cause instanceof Error
              ? cause.message
              : "The correction could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && detail === null) {
    return (
      <p role="status" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        Loading component history…
      </p>
    );
  }

  if (detail === null) {
    return (
      <div className="space-y-4">
        <StagePageHeader
          title="Component"
          backTarget={namedBackTarget(
            runbookRoutes.componentRegistry(),
            "Component Registry",
          )}
        />
        {message ? <OperationNotice tone={message.tone}>{message.text}</OperationNotice> : null}
      </div>
    );
  }

  const component = detail.component;
  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow={`Stage 3 · ${titleCase(component.type)}`}
        title={component.serialNumber}
        description={`${component.manufacturer ?? "Manufacturer not recorded"}${component.model ? ` · ${component.model}` : ""} · ${component.size}`}
        backTarget={namedBackTarget(
          runbookRoutes.componentRegistry(),
          "Component Registry",
        )}
      />

      {message ? <OperationNotice tone={message.tone}>{message.text}</OperationNotice> : null}

      <section aria-label="Component statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricDisplay label="Status" value={titleCase(component.status)} emphasis="strong" />
        <MetricDisplay label="Drilled" value={formatComponentDepth(totals.drilledDm)} />
        <MetricDisplay label="Runs touched" value={totals.runs} />
        <MetricDisplay label="Holes" value={totals.holes} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionPanel title="Registry record" description="Current local values. Corrections are append-only audited events.">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
            {[
              ["Type", titleCase(component.type)],
              ["Serial number", component.serialNumber],
              ["Manufacturer", component.manufacturer ?? "—"],
              ["Model", component.model ?? "—"],
              ["Size", component.size],
              ["Matrix", component.matrix ?? "—"],
              ["Supplier", component.supplier ?? "—"],
              [
                "Starting crown",
                component.startingCrownHeightDm === undefined
                  ? "—"
                  : formatComponentDepth(component.startingCrownHeightDm),
              ],
              ["Created by", component.createdByNameSnapshot],
              ["Updated", formatComponentDate(component.updatedAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-[var(--tl-ink-muted)]">{label}</dt>
                <dd className="mt-1 break-words font-bold text-[var(--tl-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
          {component.notes ? (
            <div className="mt-5 border-t border-[var(--tl-border)] pt-4">
              <p className="text-sm font-semibold text-[var(--tl-ink-muted)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--tl-ink)]">{component.notes}</p>
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Audit summary"
          description="Each changed field records its previous value, corrected value, reason, operator, and time."
          action={<span className="text-sm font-bold text-[var(--tl-primary)]">{detail.corrections.length} changes</span>}
        >
          {detail.corrections.length === 0 ? (
            <p className="text-sm text-[var(--tl-ink-muted)]">No registry corrections have been recorded.</p>
          ) : (
            <ol className="space-y-3">
              {[...detail.corrections].reverse().map((correction) => (
                <li key={correction.id} className="rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[var(--tl-ink)]">{titleCase(correction.fieldName)}</p>
                    <time className="text-xs text-[var(--tl-ink-muted)]">{formatComponentDate(correction.correctedAt)}</time>
                  </div>
                  <p className="mt-1 break-words text-sm text-[var(--tl-ink)]">
                    {String(correction.previousValue ?? "—")} → {String(correction.correctedValue ?? "—")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    {correction.reason} · {correction.correctedByNameSnapshot}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionPanel>
      </div>

      <SectionPanel
        title="Assignment history and usage"
        description="Drilled metres use exact overlap with completed run intervals. Recovery is marked as estimated when a boundary falls inside a run."
        action={<History aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />}
      >
        {detail.assignments.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">This component has not been assigned to a hole.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {detail.assignments.map((assignment, index) => {
              const usage = detail.usage[index];
              const assignmentCorrections =
                detail.assignmentCorrections.filter(
                  ({ entityId }) => entityId === assignment.localId,
                );
              return (
                <article key={assignment.localId} className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--tl-ink)]">{assignment.holeId}</h3>
                      <p className="text-sm text-[var(--tl-ink-muted)]">
                        {formatComponentDepth(assignment.startDepthDm)} –{" "}
                        {assignment.endDepthDm === undefined
                          ? "active"
                          : formatComponentDepth(assignment.endDepthDm)}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-primary)]">
                      {assignment.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-[var(--tl-ink-muted)]">Drilled</dt><dd className="font-bold">{usage ? formatComponentDepth(usage.drilledMetresDm) : "—"}</dd></div>
                    <div><dt className="text-[var(--tl-ink-muted)]">Runs touched</dt><dd className="font-bold">{usage?.runsTouched ?? "—"}</dd></div>
                    <div><dt className="text-[var(--tl-ink-muted)]">Recovery</dt><dd className="font-bold">{usage?.averageRecoveryPercentTenths === undefined ? "—" : formatRecoveryPercentTenths(usage.averageRecoveryPercentTenths)}</dd></div>
                    <div><dt className="text-[var(--tl-ink-muted)]">Estimate</dt><dd className="font-bold">{usage ? titleCase(usage.recoveryEstimateStatus) : "—"}</dd></div>
                  </dl>
                  {assignment.removalReason ? (
                    <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">
                      Removed: {titleCase(assignment.removalReason)}
                      {assignment.removalComment ? ` · ${assignment.removalComment}` : ""}
                    </p>
                  ) : null}
                  <AssignmentCorrectionForm
                    assignment={assignment}
                    onSaved={loadDetail}
                  />
                  {assignmentCorrections.length > 0 ? (
                    <ol className="mt-3 space-y-2" aria-label="Assignment corrections">
                      {assignmentCorrections.map((correction) => (
                        <li
                          key={correction.id}
                          className="rounded-[var(--tl-radius-sm)] bg-[var(--tl-warning-soft)] p-3 text-sm"
                        >
                          <strong>{titleCase(correction.fieldName)}</strong>:{" "}
                          {String(correction.previousValue ?? "—")} →{" "}
                          {String(correction.correctedValue ?? "—")}
                          <span className="mt-1 block text-[var(--tl-ink-muted)]">
                            {correction.reason} ·{" "}
                            {correction.correctedByNameSnapshot}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>

      <form onSubmit={handleCorrection}>
        <SectionPanel
          title="Correct registry record"
          description="Use this only to correct recorded values or status. The reason and every changed field are audited."
          action={<Wrench aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />}
          footer={
            <p className="text-xs text-[var(--tl-ink-muted)]">
              Active status is controlled by assignment workflows. An active component cannot be given a non-active status until its assignment is closed.
            </p>
          }
        >
          <div key={component.version} className="grid gap-5 md:grid-cols-2">
            <CorrectionField id="correct-serial" label="Serial number" name="serialNumber" defaultValue={component.serialNumber} required />
            <CorrectionField id="correct-manufacturer" label="Manufacturer" name="manufacturer" defaultValue={component.manufacturer} />
            <CorrectionField id="correct-model" label="Model" name="model" defaultValue={component.model} />
            <CorrectionField id="correct-matrix" label="Matrix" name="matrix" defaultValue={component.matrix} />
            <CorrectionField id="correct-size" label="Size" name="size" defaultValue={component.size} required />
            <CorrectionField id="correct-supplier" label="Supplier" name="supplier" defaultValue={component.supplier} />
            <CorrectionField
              id="correct-crown"
              label="Starting crown height (m)"
              name="startingCrownHeight"
              defaultValue={
                component.startingCrownHeightDm === undefined
                  ? ""
                  : decimetresToMetres(component.startingCrownHeightDm).toFixed(1)
              }
            />
            <div>
              <label htmlFor="correct-status" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">Status</label>
              <select
                id="correct-status"
                name="status"
                defaultValue={component.status}
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
              >
                {COMPONENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{titleCase(status)}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="correct-notes" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">Notes</label>
              <Textarea id="correct-notes" name="notes" defaultValue={component.notes} rows={3} maxLength={1000} className="border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="correction-reason" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
                Correction reason <span className="text-[var(--tl-danger)]">*</span>
              </label>
              <Textarea id="correction-reason" name="reason" required rows={3} maxLength={500} placeholder="Explain why the registry value or status is being corrected." className="border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div className="md:col-span-2">
              <FieldActionButton type="submit" busy={saving} className="min-h-11 w-full md:w-auto">
                <Save aria-hidden="true" className="size-5" />
                Save audited correction
              </FieldActionButton>
            </div>
          </div>
        </SectionPanel>
      </form>
    </div>
  );
}
