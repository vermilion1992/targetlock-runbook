"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  createHoleWithTrajectoryDefaults,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  DEFAULT_TARGET_DIAMETER_M,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type HoleSize,
  type NorthReference,
  type TargetAttitudeMode,
} from "@/domain";
import { targetLockStage5Seed } from "@/infrastructure/seed";
import { createBrowserTrajectoryProjectDefaultsRepository } from "@/infrastructure/trajectory";
import { useOperatorSession } from "@/components/session";

const NORTH_OPTIONS: NorthReference[] = [
  "GRID",
  "TRUE",
  "MAGNETIC",
  "NOT_SPECIFIED",
];

interface NewHoleFormProps {
  projectId?: string;
}

function createOperationId(): string {
  const unique =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `create-hole-${unique}`;
}

export function NewHoleForm({
  projectId = targetLockStage5Seed.project.localId,
}: NewHoleFormProps) {
  const router = useRouter();
  const { session } = useOperatorSession();
  const identity = useRef({
    operationId: createOperationId(),
    occurredAt: new Date().toISOString(),
  });
  const [holeId, setHoleId] = useState("");
  const [projectName, setProjectName] = useState("Loading project…");
  const [rigs, setRigs] = useState<readonly { id: string; name: string }[]>([]);
  const [rigId, setRigId] = useState("");
  const [holeSize, setHoleSize] = useState<HoleSize>(
    targetLockStage5Seed.hole.holeSize,
  );
  const [plannedDepth, setPlannedDepth] = useState(
    (targetLockStage5Seed.hole.plannedDepth / 10).toFixed(1),
  );
  const [collarDip, setCollarDip] = useState("-60.0");
  const [collarAzimuth, setCollarAzimuth] = useState("128.0");
  const [collarRef, setCollarRef] = useState<NorthReference>("GRID");
  const [collarE, setCollarE] = useState("");
  const [collarN, setCollarN] = useState("");
  const [collarRl, setCollarRl] = useState("");
  const [targetMd, setTargetMd] = useState("");
  const [targetE, setTargetE] = useState("");
  const [targetN, setTargetN] = useState("");
  const [targetRl, setTargetRl] = useState("");
  const [targetDiameter, setTargetDiameter] = useState(
    DEFAULT_TARGET_DIAMETER_M.toFixed(1),
  );
  const [specifyEntryDirection, setSpecifyEntryDirection] = useState(false);
  const [targetDip, setTargetDip] = useState("");
  const [targetAzimuth, setTargetAzimuth] = useState("");
  const [targetRef, setTargetRef] = useState<NorthReference>("GRID");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = `/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    let cancelled = false;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (!cancelled) setMessage("Browser storage is unavailable.");
      });
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([
      services.projects.getProject(projectId),
      services.projects.listRigs(projectId),
    ]).then(([project, projectRigs]) => {
      if (cancelled) return;
      if (!project) {
        setProjectName("Unknown project");
        setMessage("This project is not available.");
        return;
      }
      setProjectName(project.name);
      const nextRigs = projectRigs.map((rig) => ({
        id: rig.localId,
        name: rig.name,
      }));
      setRigs(nextRigs);
      setRigId((current) => current || nextRigs[0]?.id || "");
    }).catch((caught: unknown) => {
      if (!cancelled) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : "The project setup could not load.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const services = createBrowserRunbookServices();
    if (!services) {
      setMessage("Browser storage is unavailable.");
      return;
    }

    const dip = parseDipInput(collarDip);
    const azimuth = parseAzimuthInput(collarAzimuth);
    if (!dip.ok || !azimuth.ok) {
      setMessage("Collar dip or azimuth is invalid.");
      return;
    }
    const plannedDepthParsed = parseMetreInput(plannedDepth);
    if (!plannedDepthParsed.ok || Number(plannedDepthParsed.value) <= 0) {
      setMessage("Planned depth must be greater than zero.");
      return;
    }
    if (!rigId) {
      setMessage("Select an operating rig before creating the hole.");
      return;
    }

    let collarEastingM: number | undefined;
    let collarNorthingM: number | undefined;
    let collarRlM: number | undefined;
    if (collarE.trim() || collarN.trim() || collarRl.trim()) {
      const e = parseMetreInput(collarE);
      const n = parseMetreInput(collarN);
      const rlAbs = parseMetreInput(collarRl.replace(/^-/, ""));
      if (!e.ok || !n.ok || !rlAbs.ok) {
        setMessage(
          "Enter Easting, Northing and RL together, or leave all three blank.",
        );
        return;
      }
      collarEastingM = Number(e.value) / 10;
      collarNorthingM = Number(n.value) / 10;
      collarRlM = collarRl.trim().startsWith("-")
        ? -Number(rlAbs.value) / 10
        : Number(rlAbs.value) / 10;
    }

    let target:
      | {
          targetMeasuredDepthM: number;
          eastingM: number;
          northingM: number;
          rlM: number;
          diameterM: number;
          attitudeMode: TargetAttitudeMode;
          desiredDipDegrees?: number;
          desiredAzimuthDegrees?: number;
          desiredNorthReference?: NorthReference;
        }
      | undefined;
    const attitudeMode: TargetAttitudeMode = specifyEntryDirection
      ? "MATCH_ENTRY_DIRECTION"
      : "AUTO_SMOOTH";
    const anyTargetField =
      targetMd.trim() ||
      targetE.trim() ||
      targetN.trim() ||
      targetRl.trim() ||
      specifyEntryDirection ||
      targetDip.trim() ||
      targetAzimuth.trim();
    if (anyTargetField) {
      const md = parseMetreInput(targetMd);
      const e = parseMetreInput(targetE);
      const n = parseMetreInput(targetN);
      const rlAbs = parseMetreInput(targetRl.replace(/^-/, ""));
      const diameterParsed = parseMetreInput(targetDiameter);
      if (!md.ok || !e.ok || !n.ok || !rlAbs.ok || !diameterParsed.ok) {
        setMessage(
          "A target requires measured depth plus Easting, Northing, RL and diameter together.",
        );
        return;
      }
      const diameterM = Number(diameterParsed.value) / 10;
      if (!(Number(md.value) > 0) || !(diameterM > 0)) {
        setMessage("Target MD and diameter must be positive.");
        return;
      }
      let desiredDipDegrees: number | undefined;
      let desiredAzimuthDegrees: number | undefined;
      if (specifyEntryDirection) {
        const tDip = parseDipInput(targetDip);
        const tAz = parseAzimuthInput(targetAzimuth);
        if (!tDip.ok || !tAz.ok) {
          setMessage("Target entry direction requires dip and azimuth.");
          return;
        }
        desiredDipDegrees = tDip.value / 10;
        desiredAzimuthDegrees = tAz.value / 10;
      }
      target = {
        targetMeasuredDepthM: Number(md.value) / 10,
        eastingM: Number(e.value) / 10,
        northingM: Number(n.value) / 10,
        rlM: targetRl.trim().startsWith("-")
          ? -Number(rlAbs.value) / 10
          : Number(rlAbs.value) / 10,
        diameterM,
        attitudeMode,
        desiredDipDegrees,
        desiredAzimuthDegrees,
        desiredNorthReference: specifyEntryDirection ? targetRef : undefined,
      };
    }

    setBusy(true);
    setMessage(null);
    try {
      const projectDefaults =
        createBrowserTrajectoryProjectDefaultsRepository()?.read(projectId) ??
        null;
      const result = await createHoleWithTrajectoryDefaults(
        {
          operationId: identity.current.operationId,
          holeId: holeId.trim(),
          projectId,
          rigId,
          holeSize,
          plannedDepthM: Number(plannedDepthParsed.value) / 10,
          collarDipTenths: dip.value,
          collarAzimuthTenths: azimuth.value,
          collarNorthReference: collarRef,
          collarEastingM,
          collarNorthingM,
          collarRlM,
          preferredSurveyIntervalM:
            projectDefaults === null
              ? 30
              : projectDefaults.preferredSurveyIntervalDm / 10,
          preferredSurveyNorthReference:
            projectDefaults?.surveyNorthReference ?? collarRef,
          calculationNorthReference:
            projectDefaults?.calculationNorthReference ?? "GRID",
          gridRotationDeg: projectDefaults?.gridRotationDeg ?? 0,
          magneticDeclinationDeg:
            projectDefaults?.magneticDeclinationDeg ?? 0,
          coordinateSystemName:
            projectDefaults?.coordinateSystemName ?? "Local Mine Grid",
          target,
          occurredAt: identity.current.occurredAt,
          createdByUserId: session?.operator.localId,
          createdByNameSnapshot: session?.operator.displayName,
        },
        {
          completion: services.completion,
          trajectory: services.trajectory,
          projects: services.projects,
          audits: services.audits,
        },
      );
      setIsDirty(false);
      router.replace(runbookRoutes.currentHole(result.hole.localId));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create hole.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="new-hole-form">
      <StagePageHeader
        eyebrow="Holes"
        title="New Hole"
        description="Create the hole identity and collar direction first. BHA and constant stick-up are the next required setup before drilling."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      <div
        role="status"
        className="rounded-[var(--tl-radius-md)] border border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] px-4 py-3"
      >
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-primary)]">
          Setup step 1 of 2
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--tl-ink)]">
          Save the hole, then enter BHA length and constant stick-up from its
          Overview.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-4 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[var(--tl-ink)]">
            Hole identity
          </legend>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-[var(--tl-ink)]">
              Hole ID
            </span>
            <input
              required
              maxLength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
              autoComplete="off"
              autoCapitalize="characters"
              aria-describedby="new-hole-id-help"
              value={holeId}
              onChange={(event) => setHoleId(event.target.value.toUpperCase())}
              placeholder="DDH050"
              className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              data-testid="new-hole-id"
            />
            <span
              id="new-hole-id-help"
              className="block text-xs text-[var(--tl-ink-muted)]"
            >
              Required · identifies every run, survey, tray and timeline event
              recorded for this hole.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-[var(--tl-ink)]">Project</span>
              <input
                readOnly
                value={projectName}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-3 py-2 text-[var(--tl-ink-muted)]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-[var(--tl-ink)]">Rig</span>
              <select
                required
                value={rigId}
                onChange={(event) => setRigId(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              >
                {rigs.length === 0 ? (
                  <option value="">No rigs available</option>
                ) : null}
                {rigs.map((rig) => (
                  <option key={rig.id} value={rig.id}>
                    {rig.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-[var(--tl-ink)]">
                Hole size
              </span>
              <select
                value={holeSize}
                onChange={(event) =>
                  setHoleSize(event.target.value as HoleSize)
                }
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              >
                {(["PQ", "HQ", "NQ", "BQ"] as const).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-[var(--tl-ink)]">
                Planned depth (m)
              </span>
              <input
                required
                inputMode="decimal"
                value={plannedDepth}
                onChange={(event) => setPlannedDepth(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[var(--tl-ink)]">
            Collar direction
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Collar dip (°)</span>
              <input
                required
                value={collarDip}
                onChange={(event) => setCollarDip(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Collar azimuth (°)</span>
              <input
                required
                value={collarAzimuth}
                onChange={(event) => setCollarAzimuth(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Collar azimuth reference</span>
              <select
                value={collarRef}
                onChange={(event) =>
                  setCollarRef(event.target.value as NorthReference)
                }
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              >
                {NORTH_OPTIONS.filter(
                  (option) => option !== "NOT_SPECIFIED",
                ).map((option) => (
                  <option key={option} value={option}>
                    {option === "GRID"
                      ? "Grid North"
                      : option === "TRUE"
                        ? "True North"
                        : option === "MAGNETIC"
                          ? "Magnetic North"
                          : "Not specified"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <details className="group rounded-md border border-dashed border-[var(--tl-border)] bg-[var(--tl-surface-raised)]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[var(--tl-ink)]">
            <span>
              Optional setup
              <span className="mt-0.5 block text-xs font-normal text-[var(--tl-ink-muted)]">
                Collar coordinates and target can also be added later.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-lg text-[var(--tl-primary)] group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="space-y-4 border-t border-[var(--tl-border)] p-3">
        <fieldset className="space-y-3 rounded-md border border-dashed border-[var(--tl-border)] p-3">
          <legend className="px-1 text-sm font-semibold text-[var(--tl-ink)]">
            Collar position
          </legend>
          <p className="text-xs text-[var(--tl-ink-muted)]">
            Enter Easting, Northing and RL together, or leave all three blank.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span>Easting (m)</span>
              <input
                value={collarE}
                onChange={(event) => setCollarE(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Northing (m)</span>
              <input
                value={collarN}
                onChange={(event) => setCollarN(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>RL (m)</span>
              <input
                value={collarRl}
                onChange={(event) => setCollarRl(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border border-dashed border-[var(--tl-border)] p-3">
          <legend className="px-1 text-sm font-semibold text-[var(--tl-ink)]">
            Target (optional)
          </legend>
          <p className="text-xs text-[var(--tl-ink-muted)]">
            Omit target details for now, or enter target MD and coordinates
            together. Default diameter is 6.0 m.
          </p>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Target measured depth (m)</span>
            <input
              value={targetMd}
              onChange={(event) => setTargetMd(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              data-testid="new-hole-target-md"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span>Target Easting (m)</span>
              <input
                value={targetE}
                onChange={(event) => setTargetE(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Target Northing (m)</span>
              <input
                value={targetN}
                onChange={(event) => setTargetN(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Target RL (m)</span>
              <input
                value={targetRl}
                onChange={(event) => setTargetRl(event.target.value)}
                className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Target diameter (m)</span>
            <input
              value={targetDiameter}
              onChange={(event) => setTargetDiameter(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
            />
          </label>
          <fieldset
            className="space-y-2 text-sm"
            data-testid="new-hole-advanced-target-options"
          >
            <legend className="font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
              Advanced target options
            </legend>
            <p className="text-xs text-[var(--tl-ink-muted)]">
              TargetLock normally calculates the smoothest entry direction
              automatically. Specify an entry direction only when the Hole must
              enter the target at a particular dip and azimuth.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={specifyEntryDirection}
                onChange={(event) =>
                  setSpecifyEntryDirection(event.target.checked)
                }
                data-testid="new-hole-specify-entry-direction"
              />
              <span>Specify target entry direction</span>
            </label>
            {specifyEntryDirection ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-sm">
                  <span>Target entry dip (°)</span>
                  <input
                    value={targetDip}
                    onChange={(event) => setTargetDip(event.target.value)}
                    className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
                    data-testid="new-hole-entry-dip"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Target entry azimuth (°)</span>
                  <input
                    value={targetAzimuth}
                    onChange={(event) => setTargetAzimuth(event.target.value)}
                    className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
                    data-testid="new-hole-entry-azimuth"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Target entry north reference</span>
                  <select
                    value={targetRef}
                    onChange={(event) =>
                      setTargetRef(event.target.value as NorthReference)
                    }
                    className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
                  >
                    {NORTH_OPTIONS.filter((o) => o !== "NOT_SPECIFIED").map(
                      (option) => (
                        <option key={option} value={option}>
                          {option === "GRID"
                            ? "Grid North"
                            : option === "TRUE"
                              ? "True North"
                              : "Magnetic North"}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            ) : null}
          </fieldset>
        </fieldset>
          </div>
        </details>

        {message ? (
          <p role="alert" className="text-sm text-[var(--tl-danger)]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          data-testid="new-hole-submit"
        >
          {busy ? "Creating…" : "Create hole and continue"}
        </button>
      </form>
      {discardDialog}
    </div>
  );
}
