"use client";

import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  assessComponentChangeDepth,
  changeBit,
  changeReamer,
  completedDepthFromRuns,
  ComponentChangeValidationError,
  createBrowserRunbookServices,
  getCurrentHoleState,
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
  calculateComponentUsage,
  decimetres,
  decimetresToMetres,
  parseMetreInput,
  type Component,
  type ComponentAssignment,
  type ComponentRemovalReason,
  type ComponentType,
  type Decimetres,
  type UsageRun,
} from "@/domain";
import { ComponentRepositoryError } from "@/infrastructure/components";

import {
  OperationNotice,
  createComponentLocalId,
  formatComponentDepth,
  readCompletedUsageRuns,
  titleCase,
} from "./component-support";

const REMOVAL_REASONS: readonly ComponentRemovalReason[] = [
  "WORN",
  "POLISHED",
  "BURNT",
  "DAMAGED",
  "MATRIX_CHANGE",
  "LOST_DOWNHOLE",
  "INSPECTION",
  "HOLE_COMPLETED",
  "OTHER",
];

interface ChangeContext {
  readonly outgoingAssignment: ComponentAssignment | null;
  readonly outgoingComponent: Component | null;
  readonly incomingComponents: readonly Component[];
  readonly completedRuns: readonly UsageRun[];
  readonly currentCompletedDepthDm: Decimetres;
  readonly shiftId: string | null;
  readonly shiftLabel: string | null;
  readonly actorId: string | null;
  readonly actorName: string | null;
}

function metreInput(value: Decimetres): string {
  return decimetresToMetres(decimetres(value)).toFixed(1);
}

export function ChangeComponentForm({
  holeId,
  componentType,
}: {
  holeId: string;
  componentType: ComponentType;
}) {
  const router = useRouter();
  const [context, setContext] = useState<ChangeContext | null>(null);
  const [incomingComponentId, setIncomingComponentId] = useState("");
  const [depth, setDepth] = useState("");
  const [reason, setReason] = useState<ComponentRemovalReason>("WORN");
  const [comment, setComment] = useState("");
  const [confirmWithinRun, setConfirmWithinRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.holeComponents(holeId);
  const errorRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const services = createBrowserRunbookServices();
      if (services === null) throw new Error("Browser storage is unavailable.");
      const completedRuns = readCompletedUsageRuns(holeId, services);
      const currentCompletedDepthDm = completedDepthFromRuns(completedRuns);
      const [outgoingAssignment, components, currentState] = await Promise.all([
        services.componentAssignments.getActive(holeId, componentType),
        services.components.list({ type: componentType }),
        getCurrentHoleState(holeId, services.currentState),
      ]);
      const outgoingComponent =
        outgoingAssignment === null
          ? null
          : await services.components.getById(outgoingAssignment.componentId);
      const incomingComponents = components.filter(
        (component) =>
          component.localId !== outgoingAssignment?.componentId &&
          (component.status === "AVAILABLE" ||
            component.status === "SERVICEABLE" ||
            component.status === "ACTIVE"),
      );
      if (active) {
        setContext({
          outgoingAssignment,
          outgoingComponent,
          incomingComponents,
          completedRuns,
          currentCompletedDepthDm,
          shiftId: currentState.activeShift?.localId ?? null,
          shiftLabel: currentState.activeShift
            ? `${currentState.activeShift.shiftType === "DAY" ? "Day" : "Night"} Shift`
            : null,
          actorId: currentState.activeShift?.primaryDrillerId ?? null,
          actorName:
            currentState.activeShift?.primaryDrillerNameSnapshot ?? null,
        });
        setIncomingComponentId(incomingComponents[0]?.localId ?? "");
        setDepth(metreInput(currentCompletedDepthDm));
      }
    };
    void load().catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Component change context could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [componentType, holeId]);

  const parsedDepth = parseMetreInput(depth);
  const assessment = useMemo(() => {
    if (
      context?.outgoingAssignment === null ||
      context?.outgoingAssignment === undefined ||
      !parsedDepth.ok
    ) {
      return null;
    }
    return assessComponentChangeDepth(
      parsedDepth.value,
      context.outgoingAssignment.startDepthDm,
      context.currentCompletedDepthDm,
      context.completedRuns,
    );
  }, [context, parsedDepth]);
  const boundaryRunId = assessment?.boundaryRun?.localId;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (boundaryRunId !== undefined) warningRef.current?.focus();
  }, [boundaryRunId]);

  const outgoingUsage =
    context?.outgoingAssignment === null ||
    context?.outgoingAssignment === undefined
      ? null
      : calculateComponentUsage(
          context.outgoingAssignment,
          context.completedRuns,
        );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || context === null || context.outgoingAssignment === null) return;
    setError(null);
    if (!parsedDepth.ok) {
      setError("Enter a valid change depth in 0.1 m increments.");
      return;
    }
    if (assessment === null || !assessment.valid) {
      setError(assessment?.reason ?? "The change depth is invalid.");
      return;
    }
    if (!incomingComponentId) {
      setError(`Select an incoming ${componentType.toLocaleLowerCase("en-AU")}.`);
      return;
    }
    if (context.shiftId === null || context.actorId === null || context.actorName === null) {
      setError("Start a shift before changing an operational component.");
      return;
    }
    if (reason === "OTHER" && !comment.trim()) {
      setError("A comment is required when Other is selected.");
      return;
    }
    if (assessment.boundaryRun !== undefined && !confirmWithinRun) {
      setError("Confirm the within-run change and add a comment before saving.");
      return;
    }
    if (assessment.boundaryRun !== undefined && !comment.trim()) {
      setError("A comment is required for a component change within a run.");
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    const input = {
      operationId: createComponentLocalId(
        `change-${componentType.toLocaleLowerCase("en-AU")}`,
      ),
      holeId,
      outgoingAssignmentId: context.outgoingAssignment.localId,
      incomingComponentId,
      changeDepthDm: parsedDepth.value,
      removalReason: reason,
      removalComment: comment.trim() || undefined,
      shiftId: context.shiftId,
      userId: context.actorId,
      userNameSnapshot: context.actorName,
      occurredAt: new Date().toISOString(),
      currentCompletedDepthDm: context.currentCompletedDepthDm,
      completedRuns: context.completedRuns,
      confirmWithinRun,
    };
    try {
      if (componentType === "BIT") {
        await changeBit(input, services);
      } else {
        await changeReamer(input, services);
      }
      setIsDirty(false);
      router.push(
        `${parentHref}?notice=${componentType === "BIT" ? "bit-changed" : "reamer-changed"}`,
      );
    } catch (cause) {
      setError(
        cause instanceof ComponentRepositoryError &&
          cause.code === "COMPONENT_ALREADY_ACTIVE"
          ? `Duplicate active component prevented: ${cause.message}`
          : cause instanceof ComponentChangeValidationError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : "The component change could not be saved.",
      );
      setSaving(false);
    }
  };

  const typeLabel = titleCase(componentType);
  const routeType = componentType === "BIT" ? "bit" : "reamer";
  const noActiveAssignment = context !== null && context.outgoingAssignment === null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Components"
        title={`Change ${typeLabel}`}
        description={`Close the outgoing ${typeLabel.toLocaleLowerCase("en-AU")} and activate its replacement at one exact depth. Completed runs and current depth are loaded from this browser.`}
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      {error ? (
        <div ref={errorRef} tabIndex={-1}>
          <OperationNotice tone="error">{error}</OperationNotice>
        </div>
      ) : null}

      {noActiveAssignment ? (
        <OperationNotice tone="error">
          No active {typeLabel.toLocaleLowerCase("en-AU")} is assigned.{" "}
          <Link
            href={`/holes/${encodeURIComponent(holeId)}/components/${routeType}/assign`}
            className="font-bold text-[var(--tl-primary)]"
          >
            Create the initial assignment
          </Link>
          .
        </OperationNotice>
      ) : null}

      {context !== null && context.shiftId === null ? (
        <OperationNotice tone="error">
          An active shift is required for a component change.{" "}
          <Link
            href={`/holes/${encodeURIComponent(holeId)}/shifts/start`}
            className="font-bold text-[var(--tl-primary)]"
          >
            Start shift
          </Link>
          .
        </OperationNotice>
      ) : null}

      <section aria-label="Change context" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricDisplay label="Hole" value={holeId} />
        <MetricDisplay label="Shift" value={context?.shiftLabel ?? "None"} />
        <MetricDisplay
          label="Completed depth"
          value={context ? formatComponentDepth(context.currentCompletedDepthDm) : "Loading…"}
          emphasis="strong"
          className="col-span-2"
        />
      </section>

      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <SectionPanel
            title={`Outgoing ${typeLabel}`}
            description="This active assignment will close at the entered depth."
          >
            {context?.outgoingAssignment && context.outgoingComponent ? (
              <>
                <h3 className="break-all text-xl font-bold text-[var(--tl-ink)]">
                  {context.outgoingComponent.serialNumber}
                </h3>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  {[context.outgoingComponent.manufacturer, context.outgoingComponent.model]
                    .filter(Boolean)
                    .join(" · ") || "Make and model not recorded"}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-[var(--tl-ink-muted)]">Started</dt><dd className="font-bold">{formatComponentDepth(context.outgoingAssignment.startDepthDm)}</dd></div>
                  <div><dt className="text-[var(--tl-ink-muted)]">Drilled</dt><dd className="font-bold">{outgoingUsage ? formatComponentDepth(outgoingUsage.drilledMetresDm) : "—"}</dd></div>
                  <div><dt className="text-[var(--tl-ink-muted)]">Runs touched</dt><dd className="font-bold">{outgoingUsage?.runsTouched ?? "—"}</dd></div>
                  <div><dt className="text-[var(--tl-ink-muted)]">Installed by</dt><dd className="font-bold">{context.outgoingAssignment.installedByNameSnapshot}</dd></div>
                </dl>
              </>
            ) : (
              <p role="status" className="text-sm text-[var(--tl-ink-muted)]">
                {context === null ? "Loading outgoing assignment…" : "No active assignment."}
              </p>
            )}
          </SectionPanel>

          <SectionPanel
            title={`Incoming ${typeLabel}`}
            description="Available and serviceable records can be assigned. Active records remain visible so duplicate-active protection is explicit."
          >
            <label htmlFor="incoming-component" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
              Incoming component <span className="text-[var(--tl-danger)]">*</span>
            </label>
            <select
              id="incoming-component"
              value={incomingComponentId}
              onChange={(event) => setIncomingComponentId(event.target.value)}
              required
              disabled={context === null || context.incomingComponents.length === 0}
              className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
            >
              {context?.incomingComponents.length === 0 ? (
                <option value="">No assignable components</option>
              ) : null}
              {context?.incomingComponents.map((component) => (
                <option key={component.localId} value={component.localId}>
                  {component.serialNumber} · {titleCase(component.status)}
                  {component.model ? ` · ${component.model}` : ""}
                </option>
              ))}
            </select>
            {context?.incomingComponents.length === 0 ? (
              <p role="status" className="mt-3 text-sm font-semibold text-[var(--tl-warning)]">
                Record an available {typeLabel.toLocaleLowerCase("en-AU")} serial before continuing.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={`/components/new?type=${componentType}&holeId=${encodeURIComponent(holeId)}&returnTo=${encodeURIComponent(parentHref)}`}
                target="_blank"
                className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
              >
                Add {typeLabel.toLocaleLowerCase("en-AU")} serial
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Refresh options
              </button>
            </div>
          </SectionPanel>
        </div>

        <SectionPanel
          title="Change depth and removal"
          description="Depth is stored to 0.1 m. It cannot precede the outgoing start or exceed the completed hole depth."
          action={<RefreshCw aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <MetreInput
              id="component-change-depth"
              label="Exact change depth"
              value={depth}
              onValueChange={(value) => {
                setDepth(value);
                setConfirmWithinRun(false);
              }}
              required
              min={
                context?.outgoingAssignment
                  ? decimetresToMetres(context.outgoingAssignment.startDepthDm)
                  : 0
              }
              max={
                context
                  ? decimetresToMetres(context.currentCompletedDepthDm)
                  : undefined
              }
              error={
                !depth
                  ? undefined
                  : !parsedDepth.ok
                    ? "Enter a value using 0.1 m increments."
                    : assessment !== null && !assessment.valid
                      ? assessment.reason
                      : undefined
              }
              helpText={
                context?.outgoingAssignment
                  ? `${formatComponentDepth(context.outgoingAssignment.startDepthDm)} to ${formatComponentDepth(context.currentCompletedDepthDm)}.`
                  : "Waiting for the active assignment."
              }
            />
            <div>
              <label htmlFor="removal-reason" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
                Removal reason <span className="text-[var(--tl-danger)]">*</span>
              </label>
              <select
                id="removal-reason"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as ComponentRemovalReason)
                }
                className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
              >
                {REMOVAL_REASONS.map((option) => (
                  <option key={option} value={option}>{titleCase(option)}</option>
                ))}
              </select>
            </div>
          </div>

          {assessment?.boundaryRun ? (
            <div
              ref={warningRef}
              tabIndex={-1}
              role="alert"
              className="mt-5 rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--tl-warning)]" />
                <div>
                  <p className="font-bold text-[var(--tl-ink)]">Change depth is inside a completed run</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
                    Run interval {formatComponentDepth(assessment.boundaryRun.startDepth)} – {formatComponentDepth(assessment.boundaryRun.holeDepth)}. Recovery for this assignment will be a run-level estimate.
                  </p>
                </div>
              </div>
              <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3">
                <input
                  type="checkbox"
                  checked={confirmWithinRun}
                  onChange={(event) => setConfirmWithinRun(event.target.checked)}
                  className="size-5 accent-[var(--tl-primary)]"
                />
                <span className="font-bold text-[var(--tl-ink)]">Confirm this change occurred within the run</span>
              </label>
            </div>
          ) : null}

          <div className="mt-5">
            <label htmlFor="removal-comment" className="mb-2 block text-sm font-bold text-[var(--tl-ink)]">
              Removal comment
              {reason === "OTHER" || assessment?.boundaryRun ? (
                <span className="ml-1 text-[var(--tl-danger)]">*</span>
              ) : null}
            </label>
            <Textarea
              id="removal-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required={reason === "OTHER" || assessment?.boundaryRun !== undefined}
              maxLength={1000}
              rows={4}
              placeholder={
                reason === "OTHER"
                  ? "Describe the removal reason."
                  : assessment?.boundaryRun
                    ? "Explain the exact within-run change."
                    : "Optional field note."
              }
              className="min-h-28 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
            />
          </div>
        </SectionPanel>

        <div className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 shadow-[var(--tl-shadow-md)]">
          <FieldActionButton
            type="submit"
            fieldSize="major"
            fullWidth
            busy={saving}
            disabled={
              context === null ||
              context.outgoingAssignment === null ||
              context.shiftId === null ||
              !incomingComponentId ||
              !parsedDepth.ok ||
              assessment?.valid !== true ||
              (assessment.boundaryRun !== undefined && !confirmWithinRun) ||
              ((reason === "OTHER" || assessment?.boundaryRun !== undefined) &&
                !comment.trim())
            }
            className="min-h-14"
          >
            <Save aria-hidden="true" className="size-5" />
            Save {typeLabel} change
          </FieldActionButton>
          <p className="mt-2 text-center text-xs text-[var(--tl-ink-muted)]">
            The outgoing assignment closes and incoming assignment opens atomically on this browser.
          </p>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
