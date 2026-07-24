"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  createHoleWithTrajectoryDefaults,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import {
  DEFAULT_HOLE_ID,
  runbookRoutes,
} from "@/components/navigation/runbook-routes";
import {
  DEFAULT_TARGET_DIAMETER_M,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
  type TargetAttitudeMode,
} from "@/domain";

const NORTH_OPTIONS: NorthReference[] = [
  "GRID",
  "TRUE",
  "MAGNETIC",
  "NOT_SPECIFIED",
];

export function NewHoleForm() {
  const router = useRouter();
  const [holeId, setHoleId] = useState("");
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
  const parentHref = runbookRoutes.more(DEFAULT_HOLE_ID);

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
      const result = await createHoleWithTrajectoryDefaults(
        {
          operationId: `create-hole-${holeId.trim()}-${Date.now()}`,
          holeId: holeId.trim(),
          collarDipTenths: dip.value,
          collarAzimuthTenths: azimuth.value,
          collarNorthReference: collarRef,
          collarEastingM,
          collarNorthingM,
          collarRlM,
          preferredSurveyIntervalM: 30,
          target,
          occurredAt: new Date().toISOString(),
        },
        {
          completion: services.completion,
          trajectory: services.trajectory,
        },
      );
      setIsDirty(false);
      router.replace(runbookRoutes.trajectory(result.hole.localId));
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
        description="Create a hole with collar direction. Optional collar coordinates and target details can be entered now."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

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
              Hole ID/name
            </span>
            <input
              required
              value={holeId}
              onChange={(event) => setHoleId(event.target.value.toUpperCase())}
              placeholder="DDH050"
              className="w-full rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-2"
              data-testid="new-hole-id"
            />
          </label>
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
                {NORTH_OPTIONS.map((option) => (
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

        {message ? (
          <p role="alert" className="text-sm text-[var(--tl-danger)]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          data-testid="new-hole-submit"
        >
          {busy ? "Creating…" : "Create hole"}
        </button>
      </form>
      {discardDialog}
    </div>
  );
}
