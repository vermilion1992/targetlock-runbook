"use client";

import { AlertTriangle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
  recordSurvey,
  SurveyWarningConfirmationRequired,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { PhotoInput } from "@/components/media/photo-input";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { resolveOperationActor } from "@/components/session/operation-actor";
import { useOperatorSession } from "@/components/session";
import {
  formatMetres,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type Decimetres,
  type NorthReference,
  type SurveyTool,
  type SurveyWarning,
} from "@/domain";

const referenceLabels: Readonly<Record<NorthReference, string>> = {
  MAGNETIC: "Magnetic North",
  TRUE: "True North",
  GRID: "Grid North",
  NOT_SPECIFIED: "Not specified",
};

export function SurveyForm({ holeId }: { holeId: string }) {
  const router = useRouter();
  const { runtimeMode, session, pilot } = useOperatorSession();
  const warningRef = useRef<HTMLDivElement>(null);
  const operationId = useRef<string | null>(null);
  const [depth, setDepth] = useState("");
  const [dip, setDip] = useState("");
  const [azimuth, setAzimuth] = useState("");
  const [northReference, setNorthReference] =
    useState<NorthReference>("NOT_SPECIFIED");
  const [toolId, setToolId] = useState("");
  const [tools, setTools] = useState<readonly SurveyTool[]>([]);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [currentDepth, setCurrentDepth] = useState<Decimetres | null>(null);
  const [shiftId, setShiftId] = useState<string | undefined>();
  const [user, setUser] = useState({
    id: "user-driller-hoffman",
    name: "M. Hoffman",
  });
  const [warnings, setWarnings] = useState<readonly SurveyWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [normalizedAzimuth, setNormalizedAzimuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.surveys(holeId);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => {
        setError("Browser storage is unavailable.");
        setReady(true);
      });
      return;
    }
    void Promise.all([
      getCurrentHoleState(holeId, services.currentState),
      services.surveyTools.listActive(),
      services.surveys.listByHole(holeId),
      services.trajectory.getActualConfiguration(holeId),
    ])
      .then(([state, activeTools, surveys, actualConfiguration]) => {
        setCurrentDepth(state.currentDepthDm);
        setDepth((current) =>
          current || (state.currentDepthDm / 10).toFixed(1),
        );
        setTools(activeTools);
        setShiftId(state.activeShift?.localId);
        if (runtimeMode === "demo" && state.activeShift) {
          setUser({
            id: state.activeShift.primaryDrillerId,
            name: state.activeShift.primaryDrillerNameSnapshot,
          });
        }
        const latest = surveys[0];
        const inheritedToolId =
          latest?.surveyToolId ?? activeTools[0]?.localId ?? "";
        setToolId(inheritedToolId);
        const inheritedTool = activeTools.find(
          ({ localId }) => localId === inheritedToolId,
        );
        setNorthReference(
          actualConfiguration?.preferredSurveyNorthReference ??
            latest?.northReference ??
            inheritedTool?.defaultNorthReference ??
            "NOT_SPECIFIED",
        );
        setReady(true);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Survey defaults could not be loaded.",
        );
        setReady(true);
      });
  }, [holeId, runtimeMode]);

  const selectedTool = tools.find(({ localId }) => localId === toolId);

  async function save(confirmWarnings: boolean): Promise<void> {
    const depthResult = parseMetreInput(depth);
    const dipResult = parseDipInput(dip);
    const azimuthResult = parseAzimuthInput(azimuth);
    if (!depthResult.ok) {
      setError("Enter a valid non-negative survey depth in 0.1 m increments.");
      return;
    }
    if (!dipResult.ok) {
      setError("Dip must be between -90.0° and +90.0°.");
      return;
    }
    if (!azimuthResult.ok) {
      setError("Azimuth must be between 0.0° and 359.9°.");
      return;
    }
    if (azimuthResult.normalized) {
      setAzimuth("0.0");
      setNormalizedAzimuth(true);
    }
    const services = createBrowserRunbookServices();
    if (services === null || currentDepth === null) {
      setError("Local survey services are unavailable.");
      return;
    }
    operationId.current ??= crypto.randomUUID();
    setSaving(true);
    setError(null);
    try {
      const actor = resolveOperationActor(runtimeMode, session, pilot, {
        ...user,
        organisationId: "organisation-briggs",
      });
      await recordSurvey(
        {
          operationId: operationId.current,
          surveyId: `survey-${operationId.current}`,
          photoId: photo ? `photo-survey-${operationId.current}` : undefined,
          holeId,
          shiftId,
          depthDm: depthResult.value,
          dipTenths: dipResult.value,
          azimuthTenths: azimuthResult.value,
          northReference,
          surveyToolId: toolId || undefined,
          comment: comment.trim() || undefined,
          currentCompletedDepthDm: currentDepth,
          warningsConfirmed: confirmWarnings,
          photo: photo ?? undefined,
          photoFilename: photo?.name,
          recordedByUserId: actor.id,
          recordedByNameSnapshot: actor.name,
          recordedAt: new Date().toISOString(),
        },
        services,
      );
      setIsDirty(false);
      router.push(`${runbookRoutes.currentHole(holeId)}?notice=survey-saved`);
    } catch (caught) {
      if (caught instanceof SurveyWarningConfirmationRequired) {
        setWarnings(caught.warnings);
        requestAnimationFrame(() => warningRef.current?.focus());
      } else {
        setError(
          caught instanceof Error ? caught.message : "Survey could not be saved.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 4 · survey record"
        title="Add survey"
        description={`Fast manual survey entry for ${holeId}. Values remain exactly as entered; no reference conversion or trajectory calculation is performed.`}
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      {warnings.length > 0 ? (
        <div
          ref={warningRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4 outline-none focus:ring-2 focus:ring-[var(--tl-focus)]"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
            <div>
              <h2 className="font-bold text-[var(--tl-ink)]">
                Check survey entry
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--tl-ink)]">
                {warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWarnings([])}
              className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold"
            >
              CHECK ENTRY
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="min-h-11 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-60"
            >
              SAVE ANYWAY
            </button>
            {warnings.some(({ code }) => code === "DUPLICATE_DEPTH") ? (
              <Link
                href={runbookRoutes.surveys(holeId)}
                className="inline-flex min-h-11 items-center px-3 font-bold text-[var(--tl-primary)]"
              >
                VIEW EXISTING
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-4 font-bold"
        >
          {error}
        </p>
      ) : null}
      {normalizedAzimuth ? (
        <p role="status" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] p-3">
          Azimuth 360.0° was normalised and will be saved as 0.0°.
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        onChange={() => setIsDirty(true)}
        className="grid gap-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:p-5 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
            Hole
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--tl-ink)]">{holeId}</p>
        </div>
        <label className="block">
          <span className="text-sm font-bold">Survey depth</span>
          <span className="relative mt-2 block">
            <input
              name="depth"
              disabled={!ready}
              inputMode="decimal"
              required
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
              className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 pr-10 text-lg"
            />
            <span className="pointer-events-none absolute right-3 top-3 text-[var(--tl-ink-muted)]">m</span>
          </span>
          {currentDepth !== null ? (
            <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
              Current completed depth {formatMetres(currentDepth)}
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="text-sm font-bold">Dip</span>
          <span className="relative mt-2 block">
            <input
              name="dip"
              disabled={!ready}
              inputMode="decimal"
              required
              value={dip}
              onChange={(event) => setDip(event.target.value)}
              aria-describedby="dip-help"
              className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 pr-9 text-lg"
            />
            <span className="pointer-events-none absolute right-3 top-3">°</span>
          </span>
          <span id="dip-help" className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
            Negative = down. Positive = up.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-bold">Azimuth</span>
          <span className="relative mt-2 block">
            <input
              name="azimuth"
              disabled={!ready}
              inputMode="decimal"
              required
              value={azimuth}
              onChange={(event) => setAzimuth(event.target.value)}
              className="min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 pr-9 text-lg"
            />
            <span className="pointer-events-none absolute right-3 top-3">°</span>
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-bold">North reference</span>
          <select
            value={northReference}
            onChange={(event) =>
              setNorthReference(event.target.value as NorthReference)
            }
            className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
          >
            {Object.entries(referenceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-bold">Survey tool</span>
          <select
            value={toolId}
            onChange={(event) => setToolId(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
          >
            <option value="">No tool specified</option>
            {tools.map((tool) => (
              <option key={tool.localId} value={tool.localId}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-sm font-bold">Tool serial</span>
          <p className="mt-2 flex min-h-12 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] px-3">
            {selectedTool?.serialNumber ?? "Not specified"}
          </p>
        </div>
        <label className="block md:col-span-2">
          <span className="text-sm font-bold">Comment (optional)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-3"
          />
        </label>
        <div className="md:col-span-2">
          <PhotoInput
            id="survey-photo"
            label="Result photograph (optional)"
            file={photo}
            onFile={setPhoto}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !ready}
          className="tl-action-primary flex min-h-14 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white disabled:opacity-60 md:col-span-2"
        >
          <Save aria-hidden="true" className="size-5" />
          {saving ? "SAVING SURVEY…" : "SAVE SURVEY"}
        </button>
        <p className="sr-only" aria-live="polite">
          {saving ? "Survey save in progress." : ""}
        </p>
      </form>
      {discardDialog}
    </div>
  );
}
