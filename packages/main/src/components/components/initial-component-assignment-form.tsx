"use client";

import { PackagePlus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  assignInitialComponent,
  completedDepthFromRuns,
  createBrowserRunbookServices,
  getCurrentHoleState,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { Component, ComponentAssignment, ComponentType, Decimetres } from "@/domain";
import { ComponentRepositoryError } from "@/infrastructure/components";

import {
  OperationNotice,
  createComponentLocalId,
  defaultComponentActor,
  formatComponentDepth,
  readCompletedUsageRuns,
  titleCase,
} from "./component-support";

interface AssignmentContext {
  readonly components: readonly Component[];
  readonly currentDepthDm: Decimetres;
  readonly activeAssignment: ComponentAssignment | null;
  readonly shiftId?: string;
  readonly actorId: string;
  readonly actorName: string;
}

export function InitialComponentAssignmentForm({
  holeId,
  componentType,
}: {
  holeId: string;
  componentType: ComponentType;
}) {
  const router = useRouter();
  const [context, setContext] = useState<AssignmentContext | null>(null);
  const [componentId, setComponentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.holeComponents(holeId);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const services = createBrowserRunbookServices();
      if (services === null) throw new Error("Browser storage is unavailable.");
      const completedRuns = readCompletedUsageRuns(holeId, services);
      const [components, activeAssignment, currentState] = await Promise.all([
        services.components.list({ type: componentType }),
        services.componentAssignments.getActive(holeId, componentType),
        getCurrentHoleState(holeId, services.currentState),
      ]);
      const assignable = components.filter((component) =>
        component.status === "AVAILABLE" || component.status === "SERVICEABLE",
      );
      const fallback = defaultComponentActor();
      if (active) {
        setContext({
          components: assignable,
          currentDepthDm: completedDepthFromRuns(completedRuns),
          activeAssignment,
          shiftId: currentState.activeShift?.localId,
          actorId: currentState.activeShift?.primaryDrillerId ?? fallback.userId,
          actorName:
            currentState.activeShift?.primaryDrillerNameSnapshot ??
            fallback.userName,
        });
        setComponentId(assignable[0]?.localId ?? "");
      }
    };
    void load().catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Assignment context could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [componentType, holeId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || context === null || !componentId) return;
    if (context.activeAssignment !== null) {
      setError(
        `This hole already has an active ${componentType.toLocaleLowerCase("en-AU")}.`,
      );
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setError(null);
    const operationId = createComponentLocalId(
      `assign-${componentType.toLocaleLowerCase("en-AU")}`,
    );
    try {
      await assignInitialComponent(
        {
          operationId,
          assignmentId: `${operationId}-assignment`,
          componentId,
          holeId,
          componentType,
          startDepthDm: context.currentDepthDm,
          shiftId: context.shiftId,
          userId: context.actorId,
          userNameSnapshot: context.actorName,
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      setIsDirty(false);
      router.push(
        `${parentHref}?notice=${componentType === "BIT" ? "bit-assigned" : "reamer-assigned"}`,
      );
    } catch (cause) {
      setError(
        cause instanceof ComponentRepositoryError &&
          (cause.code === "ACTIVE_ASSIGNMENT_EXISTS" ||
            cause.code === "COMPONENT_ALREADY_ACTIVE")
          ? `Duplicate active assignment prevented: ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : "The assignment could not be saved.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Components"
        title={`Assign initial ${componentType.toLocaleLowerCase("en-AU")}`}
        description={`Select an available or serviceable ${componentType.toLocaleLowerCase("en-AU")}. Its assignment starts at the current completed depth.`}
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      {error ? <OperationNotice tone="error">{error}</OperationNotice> : null}

      {context?.activeAssignment ? (
        <OperationNotice tone="error">
          An active {componentType.toLocaleLowerCase("en-AU")} assignment already exists. Use Change {titleCase(componentType)} instead of creating a duplicate.
        </OperationNotice>
      ) : null}

      <section aria-label="Assignment context" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricDisplay label="Hole" value={holeId} />
        <MetricDisplay label="Type" value={titleCase(componentType)} />
        <MetricDisplay
          label="Start depth"
          value={context ? formatComponentDepth(context.currentDepthDm) : "Loading…"}
          emphasis="strong"
          className="col-span-2"
        />
      </section>

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)}>
        <SectionPanel
          title="Incoming component"
          description="Only serials currently available or serviceable for assignment are shown."
          action={<PackagePlus aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />}
        >
          <label htmlFor="initial-component" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
            Component <span className="text-[var(--tl-danger)]">*</span>
          </label>
          <select
            id="initial-component"
            value={componentId}
            onChange={(event) => {
              setComponentId(event.target.value);
              setIsDirty(true);
            }}
            required
            disabled={
              context === null ||
              context.activeAssignment !== null ||
              context.components.length === 0
            }
            className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
          >
            {context?.components.length === 0 ? (
              <option value="">No assignable components</option>
            ) : null}
            {context?.components.map((component) => (
              <option key={component.localId} value={component.localId}>
                {component.serialNumber} · {titleCase(component.status)}
                {component.model ? ` · ${component.model}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
            Operator: {context?.actorName ?? "Loading…"}
            {context?.shiftId ? " · active shift will be recorded" : " · no active shift reference"}
          </p>

          {context?.components.length === 0 ? (
            <p role="status" className="mt-4 rounded-[var(--tl-radius-sm)] bg-[var(--tl-warning-soft)] p-3 text-sm font-semibold">
              No available or serviceable {componentType.toLocaleLowerCase("en-AU")} serial is recorded.{" "}
              <Link
                href={`/components/new?type=${componentType}&holeId=${encodeURIComponent(holeId)}&returnTo=${encodeURIComponent(parentHref)}`}
                className="font-bold text-[var(--tl-primary)]"
              >
                Add a serial
              </Link>.
            </p>
          ) : null}

          <div className="mt-5">
            <FieldActionButton
              type="submit"
              busy={saving}
              disabled={
                context === null ||
                context.activeAssignment !== null ||
                !componentId
              }
              className="min-h-12 w-full md:w-auto"
            >
              <Save aria-hidden="true" className="size-5" />
              Save initial assignment
            </FieldActionButton>
          </div>
        </SectionPanel>
      </form>
      {discardDialog}
    </div>
  );
}
