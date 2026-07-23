"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  type SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { ConditionTagPicker } from "@/components/field/condition-tag-picker";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateCoreLossOrGain,
  calculateCurrentRodString,
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRecoveryPercentage,
  calculateRodNumber,
  decimetres,
  decimetresToMetres,
  formatMetres,
  formatRecoveryPercentage,
  parseMetreInput,
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
  type CoreRecoveryVariance,
  type Decimetres,
  type RodEventInput,
} from "@/domain";
import {
  completeRun,
  createBrowserRunbookServices,
  startRun,
} from "@/application/runbook";
import {
  createBrowserRunRepository,
  latestSavedRunSnapshot,
  nextRunContextFromSavedRuns,
  type PendingDraftRodEvent,
  type RunDraftContext,
  type RunDraftPayload,
} from "@/infrastructure/drafts";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

type Ddh041CurrentState =
  typeof import("@/infrastructure/seed").ddh041CurrentState;

interface RunConditionOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

interface RecordRunFormProps {
  holeId: string;
  runNumber: number;
  activeShiftId: string;
  shiftLabel: string;
  primaryDrillerId: string;
  primaryDriller: string;
  currentState: Ddh041CurrentState;
  conditionOptions: readonly RunConditionOption[];
  initialRodLength?: 3 | 6;
}

function metreFieldSchema(label: string) {
  return z.string().trim().superRefine((value, context) => {
    const parsed = parseMetreInput(value);
    if (parsed.ok) {
      return;
    }

    if (parsed.reason === "empty") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} is required.`,
      });
      return;
    }

    if (parsed.reason === "negative") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} cannot be negative.`,
      });
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        parsed.reason === "precision"
          ? "Use 0.1 m increments; extra decimal places must be zero."
          : "Enter a valid number, for example 2.8.",
    });
  });
}

const runFormSchema = z.object({
  stickUpMetres: metreFieldSchema("Measured stick-up"),
  recoveredMetres: metreFieldSchema("Core recovered"),
  conditionTagIds: z.array(z.string().min(1)),
  comment: z
    .string()
    .max(500, "Comment must be 500 characters or fewer."),
});

type RunFormValues = z.infer<typeof runFormSchema>;

interface DerivedRunValues {
  readonly rodNumber: number;
  readonly rodString: Decimetres;
  readonly stickUp: Decimetres;
  readonly holeDepth: Decimetres;
  readonly drilledLength: Decimetres;
  readonly recoveredLength: Decimetres;
  readonly recoveryPercentage: number;
  readonly variance: CoreRecoveryVariance;
}

type DerivedResult =
  | { readonly ok: true; readonly values: DerivedRunValues }
  | { readonly ok: false; readonly reason: string };

function parseMetreValue(value: string): Decimetres | null {
  const parsed = parseMetreInput(value);
  return parsed.ok ? parsed.value : null;
}

function domainRodEvents(
  pendingEvents: readonly PendingDraftRodEvent[],
): readonly RodEventInput[] {
  return pendingEvents.map((event) => ({
    action: event.action,
    rodLength:
      event.rodLengthDm === 30
        ? THREE_METRE_ROD_LENGTH
        : SIX_METRE_ROD_LENGTH,
  }));
}

function deriveRunValues(
  context: RunDraftContext,
  pendingEvents: readonly PendingDraftRodEvent[],
  stickUpValue: string,
  recoveredValue: string,
): DerivedResult {
  const stickUp = parseMetreValue(stickUpValue);
  const recoveredLength = parseMetreValue(recoveredValue);

  if (stickUp === null || recoveredLength === null) {
    return {
      ok: false,
      reason: "Enter stick-up and recovery in valid 0.1 m increments.",
    };
  }

  try {
    const events = domainRodEvents(pendingEvents);
    const rodString = calculateCurrentRodString(
      decimetres(context.currentRodStringDm),
      events,
    );
    const rodNumber = calculateRodNumber(events, context.rodNumber);
    const holeDepth = calculateHoleDepth(rodString, stickUp);
    const drilledLength = calculateDrilledLength(
      holeDepth,
      decimetres(context.previousCompletedDepthDm),
    );

    if (drilledLength === 0) {
      return {
        ok: false,
        reason:
          "Drilled length is 0.0 m. Adjust stick-up or add a pending rod before saving.",
      };
    }

    return {
      ok: true,
      values: {
        rodNumber,
        rodString,
        stickUp,
        holeDepth,
        drilledLength,
        recoveredLength,
        recoveryPercentage: calculateRecoveryPercentage(
          drilledLength,
          recoveredLength,
        ),
        variance: calculateCoreLossOrGain(drilledLength, recoveredLength),
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "The run values could not be calculated.",
    };
  }
}

function metreNumber(value: Decimetres): string {
  return decimetresToMetres(value).toFixed(1);
}

function normalizeMetreInput(
  value: string,
  onChange: (value: string) => void,
): void {
  const parsed = parseMetreValue(value);
  if (parsed !== null) {
    onChange(metreNumber(parsed));
  }
}

function createLocalId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function RecordRunForm({
  holeId,
  runNumber,
  activeShiftId,
  shiftLabel,
  primaryDrillerId,
  primaryDriller,
  currentState,
  conditionOptions,
  initialRodLength,
}: RecordRunFormProps) {
  const router = useRouter();
  const initialContext = useMemo<RunDraftContext>(
    () => ({
      runNumber,
      rodNumber: currentState.rodNumber,
      currentRodStringDm: currentState.currentRodString,
      previousCompletedDepthDm: currentState.previousCompletedDepth,
    }),
    [currentState, runNumber],
  );
  const initialPendingEvents: readonly PendingDraftRodEvent[] =
    initialRodLength === undefined
      ? []
      : [
          {
            localId: `initial-rod-${initialRodLength}`,
            action: "add",
            rodLengthDm: initialRodLength === 3 ? 30 : 60,
          },
        ];
  const [context, setContext] = useState<RunDraftContext>(initialContext);
  const [pendingEvents, setPendingEvents] =
    useState<readonly PendingDraftRodEvent[]>(initialPendingEvents);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftIdentity, setDraftIdentity] = useState<{
    readonly localId: string;
    readonly startedAt: string;
    readonly startedShiftId: string;
    readonly startedByUserId: string;
    readonly startedByNameSnapshot: string;
    readonly activeBitAssignmentId: string | null;
    readonly activeReamerAssignmentId: string | null;
    readonly activeBitSerialNumberSnapshot: string | null;
    readonly activeReamerSerialNumberSnapshot: string | null;
    readonly casingSummarySnapshot: string | null;
  } | null>(null);
  const [draftStatus, setDraftStatus] = useState(
    "Checking this browser for a saved draft…",
  );
  const [saveStatus, setSaveStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    mode: "onChange",
    defaultValues: {
      stickUpMetres: metreNumber(currentState.measuredStickUp),
      recoveredMetres: metreNumber(currentState.recoveredLength),
      conditionTagIds: [],
      comment: "",
    },
  });

  const [stickUpMetres, recoveredMetres, conditionTagIds, comment] = useWatch({
    control,
    name: [
      "stickUpMetres",
      "recoveredMetres",
      "conditionTagIds",
      "comment",
    ],
  });
  const derived = useMemo(
    () =>
      deriveRunValues(
        context,
        pendingEvents,
        stickUpMetres,
        recoveredMetres,
      ),
    [context, pendingEvents, recoveredMetres, stickUpMetres],
  );

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const repository = createBrowserRunRepository();
      if (repository === null) {
        setDraftStatus(
          "Browser storage is unavailable; this form is not saved.",
        );
        setHydrated(true);
        void trigger();
        return;
      }

      const savedDraft = repository.readDraft(holeId);
      if (savedDraft.status === "valid") {
        setDraftIdentity({
          localId: savedDraft.envelope.payload.localId,
          startedAt: savedDraft.envelope.payload.startedAt,
          startedShiftId: savedDraft.envelope.payload.startedShiftId,
          startedByUserId: savedDraft.envelope.payload.startedByUserId,
          startedByNameSnapshot:
            savedDraft.envelope.payload.startedByNameSnapshot,
          activeBitAssignmentId:
            savedDraft.envelope.payload.activeBitAssignmentId,
          activeReamerAssignmentId:
            savedDraft.envelope.payload.activeReamerAssignmentId,
          activeBitSerialNumberSnapshot:
            savedDraft.envelope.payload.activeBitSerialNumberSnapshot,
          activeReamerSerialNumberSnapshot:
            savedDraft.envelope.payload.activeReamerSerialNumberSnapshot,
          casingSummarySnapshot:
            savedDraft.envelope.payload.casingSummarySnapshot,
        });
        setContext(savedDraft.envelope.payload.context);
        setPendingEvents(savedDraft.envelope.payload.pendingRodEvents);
        reset({
          stickUpMetres: savedDraft.envelope.payload.stickUpMetresInput,
          recoveredMetres: savedDraft.envelope.payload.recoveredMetresInput,
          conditionTagIds: savedDraft.envelope.payload.conditionTagIds,
          comment: savedDraft.envelope.payload.comment,
        });
        setDraftStatus(
          `Restored local draft saved ${new Date(savedDraft.envelope.savedAt).toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
          })}.`,
        );
      } else {
        const completedRuns = repository.readCompletedRuns(holeId);
        const latestCompleted =
          completedRuns.status === "valid"
            ? latestSavedRunSnapshot(completedRuns.snapshots)
            : undefined;

        const preparedContext =
          latestCompleted !== undefined
            ? nextRunContextFromSavedRuns(
                completedRuns.status === "valid"
                  ? completedRuns.snapshots
                  : [],
                initialContext,
              )
            : initialContext;
        if (latestCompleted !== undefined) {
          setContext(
            preparedContext,
          );
          reset({
            stickUpMetres: "",
            recoveredMetres: "",
            conditionTagIds: [],
            comment: "",
          });
          setDraftStatus(
            `Prepared run ${latestCompleted.runNumber + 1} from locally saved run ${latestCompleted.runNumber}. Current edits will auto-save.`,
          );
        } else if (savedDraft.status === "invalid") {
          setDraftStatus(
            `${savedDraft.reason} It was ignored and current edits will replace it.`,
          );
        } else if (completedRuns.status === "invalid") {
          setDraftStatus(
            `${completedRuns.reason} The seed context is shown without changing saved data.`,
          );
        } else {
          setDraftStatus("No earlier draft found. Current edits will auto-save.");
        }

        const startedAt = new Date().toISOString();
        const localId = createLocalId("local-run");
        setDraftIdentity({
          localId,
          startedAt,
          startedShiftId: activeShiftId,
          startedByUserId: primaryDrillerId,
          startedByNameSnapshot: primaryDriller,
          activeBitAssignmentId: null,
          activeReamerAssignmentId: null,
          activeBitSerialNumberSnapshot: null,
          activeReamerSerialNumberSnapshot: null,
          casingSummarySnapshot: null,
        });
        const services = createBrowserRunbookServices();
        if (services !== null) {
          void startRun(
            { holeId, localId, startedAt, context: preparedContext },
            services,
          )
            .then((payload) =>
              setDraftIdentity({
                localId: payload.localId,
                startedAt: payload.startedAt,
                startedShiftId: payload.startedShiftId,
                startedByUserId: payload.startedByUserId,
                startedByNameSnapshot: payload.startedByNameSnapshot,
                activeBitAssignmentId: payload.activeBitAssignmentId,
                activeReamerAssignmentId: payload.activeReamerAssignmentId,
                activeBitSerialNumberSnapshot:
                  payload.activeBitSerialNumberSnapshot,
                activeReamerSerialNumberSnapshot:
                  payload.activeReamerSerialNumberSnapshot,
                casingSummarySnapshot: payload.casingSummarySnapshot,
              }),
            )
            .catch((error: unknown) =>
              setDraftStatus(
                error instanceof Error
                  ? error.message
                  : "The run could not be started.",
              ),
            );
        }
      }

      setHydrated(true);
      void trigger();
    }, 0);

    return () => window.clearTimeout(hydrateTimer);
  }, [
    activeShiftId,
    holeId,
    initialContext,
    primaryDriller,
    primaryDrillerId,
    reset,
    trigger,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (draftIdentity === null) {
      return;
    }

    const repository = createBrowserRunRepository();
    if (repository === null) {
      const statusTimer = window.setTimeout(
        () =>
          setDraftStatus(
            "Browser storage is unavailable; this form is not saved.",
          ),
        0,
      );
      return () => window.clearTimeout(statusTimer);
    }

    const payload: RunDraftPayload = {
      localId: draftIdentity.localId,
      startedAt: draftIdentity.startedAt,
      startedShiftId: draftIdentity.startedShiftId,
      startedByUserId: draftIdentity.startedByUserId,
      startedByNameSnapshot: draftIdentity.startedByNameSnapshot,
      context,
      pendingRodEvents: [...pendingEvents],
      stickUpMetresInput: stickUpMetres,
      recoveredMetresInput: recoveredMetres,
      conditionTagIds: [...conditionTagIds],
      comment,
      activeBitAssignmentId: draftIdentity.activeBitAssignmentId,
      activeReamerAssignmentId: draftIdentity.activeReamerAssignmentId,
      activeBitSerialNumberSnapshot:
        draftIdentity.activeBitSerialNumberSnapshot,
      activeReamerSerialNumberSnapshot:
        draftIdentity.activeReamerSerialNumberSnapshot,
      casingSummarySnapshot: draftIdentity.casingSummarySnapshot,
    };
    const savedAt = new Date().toISOString();
    const result = repository.writeDraft(holeId, payload, savedAt);
    const statusTimer = window.setTimeout(() => {
      setDraftStatus(
        result.ok
          ? `Draft saved locally at ${new Date(savedAt).toLocaleTimeString("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
            })}. Not synced.`
          : result.reason,
      );
    }, 0);
    const persistBeforeUnload = () => {
      repository.writeDraft(holeId, payload);
    };

    window.addEventListener("beforeunload", persistBeforeUnload);
    return () => {
      window.clearTimeout(statusTimer);
      window.removeEventListener("beforeunload", persistBeforeUnload);
    };
  }, [
    comment,
    conditionTagIds,
    context,
    draftIdentity,
    holeId,
    hydrated,
    pendingEvents,
    recoveredMetres,
    stickUpMetres,
  ]);

  const addRod = (rodLengthDecimetres: 30 | 60) => {
    setSaveStatus(null);
    setPendingEvents((events) => [
      ...events,
      {
        localId: createLocalId("pending-rod"),
        action: "add",
        rodLengthDm: rodLengthDecimetres,
      },
    ]);
  };

  const removeLastPendingRod = () => {
    setSaveStatus(null);
    setPendingEvents((events) => events.slice(0, -1));
  };

  const onSubmit: SubmitHandler<RunFormValues> = async (values) => {
    if (saving || draftIdentity === null) {
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    const currentDerived = deriveRunValues(
      context,
      pendingEvents,
      values.stickUpMetres,
      values.recoveredMetres,
    );
    if (!currentDerived.ok) {
      setSaveStatus({ tone: "error", message: currentDerived.reason });
      setSaving(false);
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setSaveStatus({
        tone: "error",
        message:
          "Browser storage is unavailable. The run was not saved; your form remains open.",
      });
      setSaving(false);
      return;
    }

    const savedAt = new Date().toISOString();
    const calculated = currentDerived.values;
    let eventRodNumber = context.rodNumber;
    const snapshot = {
      localId: draftIdentity.localId,
      completedAt: savedAt,
      holeId,
      runNumber: context.runNumber,
      rodNumber: calculated.rodNumber,
      rodStringDm: calculated.rodString,
      measuredStickUpDm: calculated.stickUp,
      previousCompletedDepthDm: context.previousCompletedDepthDm,
      holeDepthDm: calculated.holeDepth,
      drilledLengthDm: calculated.drilledLength,
      recoveredLengthDm: calculated.recoveredLength,
      recoveryPercentage: calculated.recoveryPercentage,
      rodEvents: pendingEvents.map((event, index) => {
        const affectedRodNumber =
          event.action === "add" ? eventRodNumber + 1 : eventRodNumber;
        eventRodNumber += event.action === "add" ? 1 : -1;
        return {
          ...event,
          sequence: index + 1,
          affectedRodNumber,
          rodNumberAfterEvent: eventRodNumber,
          occurredAt: savedAt,
        };
      }),
      conditionTagIds: [...values.conditionTagIds],
      comment: values.comment.trim(),
    };
    let result;
    try {
      result = await completeRun(snapshot, services);
    } catch (error) {
      setSaveStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "The run could not be completed.",
      });
      setSaving(false);
      return;
    }

    if (!result.ok) {
      setSaveStatus({ tone: "error", message: result.reason });
      setSaving(false);
      return;
    }

    const savedRunNumber = context.runNumber;
    setSaveStatus({
      tone: "success",
      message: `Run ${savedRunNumber} ${result.status === "already-saved" ? "was already saved" : "saved"} on this browser only.`,
    });
    setSaving(false);
    router.push(runbookRoutes.runDetail(holeId, snapshot.localId));
  };

  const displayedValues = derived.ok ? derived.values : null;
  const recoveryWarning =
    displayedValues !== null && displayedValues.recoveryPercentage > 100;
  const varianceLabel =
    displayedValues === null
      ? "Enter valid measurements"
      : displayedValues.variance.kind === "exact"
        ? "Exact recovery"
        : `${displayedValues.variance.kind === "gain" ? "Core gain" : "Core loss"} ${formatMetres(displayedValues.variance.amount)}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 2 · shift-owned run capture"
        title={`Record run ${context.runNumber}`}
        description="Complete the field measurements below. Derived values come only from the shared TargetLock domain functions."
        action={
          <Link
            href={`/holes/${encodeURIComponent(holeId)}/current`}
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 text-sm font-bold text-[var(--tl-ink)] no-underline"
          >
            Back to current hole
          </Link>
        }
      />

      <aside
        aria-label="Local draft status"
        className="flex items-start gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-primary-soft)] p-4"
      >
        <HardDrive
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--tl-primary)]"
        />
        <div>
          <p className="font-bold text-[var(--tl-ink)]">
            Auto-saved draft · local-only
          </p>
          <p
            role="status"
            aria-live="polite"
            className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]"
          >
            {draftStatus}
          </p>
        </div>
      </aside>

      <section
        aria-labelledby="run-context-heading"
        className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
      >
        <h2 id="run-context-heading" className="sr-only">
          Run context
        </h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Hole", holeId],
            ["Run", String(context.runNumber)],
            ["Shift", shiftLabel],
            ["Primary driller", primaryDriller],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                {label}
              </dt>
              <dd className="mt-1 font-bold text-[var(--tl-ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <SectionPanel
          title="Rod string"
          description="Pending additions stay as individual events until this run is saved."
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricDisplay
              label="Rod number"
              value={displayedValues?.rodNumber ?? context.rodNumber}
              supportingText="Current + pending"
            />
            <MetricDisplay
              label="Current R/S"
              value={
                displayedValues
                  ? metreNumber(displayedValues.rodString)
                  : metreNumber(
                      decimetres(context.currentRodStringDm),
                    )
              }
              unit="m"
              supportingText="No CSU added"
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => addRod(30)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white"
            >
              <Plus aria-hidden="true" className="size-5" />
              Add 3.0 m
            </button>
            <button
              type="button"
              onClick={() => addRod(60)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white"
            >
              <Plus aria-hidden="true" className="size-5" />
              Add 6.0 m
            </button>
            <button
              type="button"
              disabled={pendingEvents.length === 0}
              onClick={removeLastPendingRod}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold text-[var(--tl-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              Undo last pending rod
            </button>
          </div>

          <div className="mt-4 rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
            <h3 className="text-sm font-bold text-[var(--tl-ink)]">
              Pending rod events ({pendingEvents.length})
            </h3>
            {pendingEvents.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                No pending additions. Saved rod history cannot be changed from
                this run form.
              </p>
            ) : (
              <ol className="mt-2 space-y-2">
                {pendingEvents.map((event, index) => (
                  <li
                    key={event.localId}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-3 py-2"
                  >
                    <span className="flex items-center gap-2 font-semibold text-[var(--tl-ink)]">
                      <Plus aria-hidden="true" className="size-4 text-[var(--tl-primary)]" />
                      Event {index + 1}: add{" "}
                      {formatMetres(decimetres(event.rodLengthDm))} rod
                    </span>
                    {index === pendingEvents.length - 1 ? (
                      <StatusPill tone="info">Undoable</StatusPill>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          title="Run measurements"
          description="Use the numeric keyboard. Measurements are stored at 0.1 m precision."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Controller
              name="stickUpMetres"
              control={control}
              render={({ field }) => (
                <MetreInput
                  label="Measured stick-up"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={() => {
                    normalizeMetreInput(field.value, field.onChange);
                    field.onBlur();
                  }}
                  min={0}
                  required
                  error={errors.stickUpMetres?.message}
                  helpText="Depth = current R/S minus this measured stick-up."
                  className="h-16 text-2xl"
                />
              )}
            />
            <Controller
              name="recoveredMetres"
              control={control}
              render={({ field }) => (
                <MetreInput
                  label="Core recovered"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={() => {
                    normalizeMetreInput(field.value, field.onChange);
                    field.onBlur();
                  }}
                  min={0}
                  required
                  error={errors.recoveredMetres?.message}
                  helpText="Values above drilled length are allowed as measured core gain."
                  className="h-16 text-2xl"
                />
              )}
            />
          </div>

          {!derived.ok ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-5 flex items-start gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] p-3 text-sm text-[var(--tl-ink)]"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--tl-warning)]"
              />
              {derived.reason}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricDisplay
              label="Depth"
              value={displayedValues ? metreNumber(displayedValues.holeDepth) : "—"}
              unit={displayedValues ? "m" : undefined}
              supportingText={`Previous ${formatMetres(decimetres(context.previousCompletedDepthDm))}`}
              emphasis="strong"
              className="col-span-2 lg:col-span-1"
            />
            <MetricDisplay
              label="Drilled"
              value={
                displayedValues ? metreNumber(displayedValues.drilledLength) : "—"
              }
              unit={displayedValues ? "m" : undefined}
            />
            <MetricDisplay
              label="Recovery"
              value={
                displayedValues
                  ? formatRecoveryPercentage(
                      displayedValues.recoveryPercentage,
                    )
                  : "—"
              }
            />
            <MetricDisplay
              label="Loss / gain"
              value={varianceLabel}
            />
          </div>

          {recoveryWarning ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-start gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-[var(--tl-warning)]"
              />
              <div>
                <p className="font-bold text-[var(--tl-ink)]">
                  Recovery is above 100%
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
                  This is allowed and will be saved as measured core gain.
                  Confirm tray reconciliation before continuing.
                </p>
              </div>
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Conditions and comment"
          description="Add field context that will remain with this local snapshot."
        >
          <Controller
            name="conditionTagIds"
            control={control}
            render={({ field }) => (
              <ConditionTagPicker
                label="Condition tags"
                options={conditionOptions}
                value={field.value}
                onValueChange={field.onChange}
                helpText="Choose every condition that applies."
              />
            )}
          />

          <div className="mt-6">
            <label
              htmlFor="run-comment"
              className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
            >
              Comment
            </label>
            <Controller
              name="comment"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="run-comment"
                  rows={4}
                  maxLength={500}
                  aria-invalid={Boolean(errors.comment)}
                  aria-describedby={
                    errors.comment ? "run-comment-error" : "run-comment-help"
                  }
                  placeholder="For example: competent core, minor natural breaks near run end."
                  className="min-h-28 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base text-[var(--tl-ink)]"
                />
              )}
            />
            {errors.comment ? (
              <p
                id="run-comment-error"
                className="mt-1 text-sm font-semibold text-[var(--tl-danger)]"
              >
                {errors.comment.message}
              </p>
            ) : (
              <p
                id="run-comment-help"
                className="mt-1 text-sm text-[var(--tl-ink-muted)]"
              >
                Optional · up to 500 characters.
              </p>
            )}
          </div>
        </SectionPanel>

        {saveStatus ? (
          <div
            role={saveStatus.tone === "error" ? "alert" : "status"}
            aria-live={saveStatus.tone === "error" ? "assertive" : "polite"}
            className={`flex items-start gap-3 rounded-[var(--tl-radius-md)] border p-4 ${
              saveStatus.tone === "error"
                ? "border-[var(--tl-danger)] bg-[var(--tl-danger-soft)]"
                : "border-[var(--tl-success)] bg-[var(--tl-success-soft)]"
            }`}
          >
            {saveStatus.tone === "error" ? (
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-[var(--tl-danger)]"
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-[var(--tl-success)]"
              />
            )}
            <p className="font-semibold leading-6 text-[var(--tl-ink)]">
              {saveStatus.message}
            </p>
          </div>
        ) : null}

        <div className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 shadow-[var(--tl-shadow-md)] md:p-4">
          <FieldActionButton
            type="submit"
            fieldSize="major"
            fullWidth
            busy={saving}
            disabled={!hydrated || !isValid || !derived.ok}
            className="min-h-14"
          >
            <Save aria-hidden="true" className="size-5" />
            Complete run
          </FieldActionButton>
          <p className="mt-2 text-center text-xs leading-4 text-[var(--tl-ink-muted)]">
            Save is blocked for invalid, negative, finer-than-0.1 m, or
            non-positive drilled values. No remote sync is configured.
          </p>
        </div>
      </form>
    </div>
  );
}
