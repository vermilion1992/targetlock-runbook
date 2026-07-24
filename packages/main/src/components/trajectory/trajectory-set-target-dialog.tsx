"use client";

import { useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  saveHoleTarget,
} from "@/application/runbook";
import {
  DEFAULT_TARGET_DIAMETER_M,
  diameterMToRadiusDm,
  isAutoSmoothAttitudeMode,
  isMatchEntryAttitudeMode,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
  type TargetAttitudeMode,
  validateHoleTargetAttitude,
} from "@/domain";

const NORTH_OPTIONS: NorthReference[] = ["GRID", "TRUE", "MAGNETIC"];

function parseSignedMetresToDm(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const negative = normalized.startsWith("-");
  const absolute = negative ? normalized.slice(1) : normalized;
  const parsed = parseMetreInput(absolute);
  if (!parsed.ok) return null;
  return negative ? -Number(parsed.value) : Number(parsed.value);
}

function northShortLabel(ref: NorthReference): string {
  if (ref === "GRID") return "Grid";
  if (ref === "TRUE") return "True";
  if (ref === "MAGNETIC") return "Magnetic";
  return "Azimuth";
}

export function TrajectorySetTargetDialog({
  holeId,
  open,
  onClose,
  onSaved,
  initial,
  calculatedEntry,
}: {
  holeId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: {
    measuredDepthM?: number;
    eastingM?: number;
    northingM?: number;
    rlM?: number;
    diameterM?: number;
    attitudeMode?: TargetAttitudeMode;
    desiredDipDegrees?: number;
    desiredAzimuthDegrees?: number;
    desiredNorthReference?: NorthReference;
  };
  calculatedEntry?: {
    dipDegrees?: number;
    azimuthDegrees?: number;
    northReference?: NorthReference;
    residualDipDegrees?: number;
    residualAzimuthDegrees?: number;
  };
}) {
  const initialMatchEntry =
    isMatchEntryAttitudeMode(initial?.attitudeMode) &&
    initial?.attitudeMode !== "SAME_AS_COLLAR"
      ? true
      : Boolean(
          initial?.desiredDipDegrees !== undefined ||
            initial?.desiredAzimuthDegrees !== undefined,
        ) && !isAutoSmoothAttitudeMode(initial?.attitudeMode);

  const [measuredDepth, setMeasuredDepth] = useState(
    initial?.measuredDepthM?.toFixed(1) ?? "",
  );
  const [easting, setEasting] = useState(
    initial?.eastingM?.toFixed(1) ?? "",
  );
  const [northing, setNorthing] = useState(
    initial?.northingM?.toFixed(1) ?? "",
  );
  const [rl, setRl] = useState(initial?.rlM?.toFixed(1) ?? "");
  const [diameter, setDiameter] = useState(
    (initial?.diameterM ?? DEFAULT_TARGET_DIAMETER_M).toFixed(1),
  );
  const [specifyEntryDirection, setSpecifyEntryDirection] = useState(
    initialMatchEntry || initial?.attitudeMode === "SAME_AS_COLLAR"
      ? Boolean(
          initial?.desiredDipDegrees !== undefined ||
            initial?.attitudeMode === "SAME_AS_COLLAR",
        )
      : false,
  );
  const [desiredDip, setDesiredDip] = useState(
    initial?.desiredDipDegrees?.toFixed(1) ?? "",
  );
  const [desiredAzimuth, setDesiredAzimuth] = useState(
    initial?.desiredAzimuthDegrees?.toFixed(1) ?? "",
  );
  const [desiredRef, setDesiredRef] = useState<NorthReference>(
    initial?.desiredNorthReference ?? "GRID",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const services = createBrowserRunbookServices();
    if (!services) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    const md = parseMetreInput(measuredDepth);
    const eastingDm = parseSignedMetresToDm(easting);
    const northingDm = parseSignedMetresToDm(northing);
    const rlDm = parseSignedMetresToDm(rl);
    const diameterParsed = parseMetreInput(diameter);
    if (
      !md.ok ||
      eastingDm === null ||
      northingDm === null ||
      rlDm === null ||
      !diameterParsed.ok
    ) {
      setMessage(
        "Target MD, Easting, Northing, RL and diameter are all required.",
      );
      return;
    }
    if (Number(md.value) <= 0) {
      setMessage("Target measured depth must be positive.");
      return;
    }
    const diameterM = Number(diameterParsed.value) / 10;
    if (diameterM <= 0) {
      setMessage("Target diameter must be greater than zero.");
      return;
    }

    const attitudeMode: TargetAttitudeMode = specifyEntryDirection
      ? "MATCH_ENTRY_DIRECTION"
      : "AUTO_SMOOTH";

    let desiredDipTenths: number | undefined;
    let desiredAzimuthTenths: number | undefined;
    let desiredNorthReference: NorthReference | undefined;
    if (specifyEntryDirection) {
      const dip = parseDipInput(desiredDip);
      const az = parseAzimuthInput(desiredAzimuth);
      if (!dip.ok || !az.ok) {
        setMessage("Target entry dip and azimuth are required.");
        return;
      }
      desiredDipTenths = dip.value;
      desiredAzimuthTenths = az.value;
      desiredNorthReference = desiredRef;
      const attitudeError = validateHoleTargetAttitude({
        attitudeMode,
        desiredDipTenths,
        desiredAzimuthTenths,
        desiredNorthReference,
      });
      if (attitudeError) {
        setMessage(attitudeError);
        return;
      }
    }

    setBusy(true);
    setMessage(null);
    try {
      await saveHoleTarget(
        {
          operationId: `target-${holeId}-${Date.now()}`,
          holeId,
          name: "Target",
          coordinateMode: "RELATIVE",
          eastingDm,
          northingDm,
          rlDm,
          radiusDm: diameterMToRadiusDm(diameterM),
          targetMeasuredDepthDm: Number(md.value),
          attitudeMode,
          desiredDipTenths,
          desiredAzimuthTenths,
          desiredNorthReference,
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      onSaved();
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save target.",
      );
    } finally {
      setBusy(false);
    }
  }

  const calcRef = calculatedEntry?.northReference ?? "GRID";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-target-title"
      data-testid="set-target-dialog"
    >
      <form
        onSubmit={handleSave}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-lg"
      >
        <div>
          <h2 id="set-target-title" className="text-lg font-semibold">
            Edit Target
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Target MD is measured depth. Diameter defaults to 6.0 m (3.0 m
            radius).
          </p>
        </div>

        <div
          className="rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-sm"
          data-testid="target-summary"
        >
          <p className="font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
            Target
          </p>
          <p className="mt-1">MD {measuredDepth || "—"} m</p>
          <p>
            Position E {easting || "—"} · N {northing || "—"} · RL {rl || "—"}
          </p>
          <p>Diameter {diameter || "—"} m</p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Target measured depth (m)</span>
          <input
            value={measuredDepth}
            onChange={(event) => setMeasuredDepth(event.target.value)}
            className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
            required
            data-testid="target-md-input"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Target Easting (m)</span>
            <input
              value={easting}
              onChange={(event) => setEasting(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Target Northing (m)</span>
            <input
              value={northing}
              onChange={(event) => setNorthing(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Target RL (m)</span>
            <input
              value={rl}
              onChange={(event) => setRl(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Target diameter (m)</span>
          <input
            value={diameter}
            onChange={(event) => setDiameter(event.target.value)}
            className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
            required
          />
          <span className="text-xs text-[var(--tl-ink-muted)]">
            Radius used in miss calculations = diameter ÷ 2
          </span>
        </label>

        {!specifyEntryDirection &&
        calculatedEntry?.dipDegrees !== undefined &&
        calculatedEntry.azimuthDegrees !== undefined ? (
          <div
            className="rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-sm"
            data-testid="calculated-entry-direction"
          >
            <p className="font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
              Calculated entry direction
            </p>
            <p className="mt-1">
              Dip {calculatedEntry.dipDegrees.toFixed(1)}°
            </p>
            <p>
              Azimuth {calculatedEntry.azimuthDegrees.toFixed(1)}°{" "}
              {northShortLabel(calcRef)}
            </p>
          </div>
        ) : null}

        <fieldset
          className="space-y-2 text-sm"
          data-testid="advanced-target-options"
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
              data-testid="specify-entry-direction"
            />
            <span>Specify target entry direction</span>
          </label>
          {specifyEntryDirection ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">Target entry dip (°)</span>
                  <input
                    value={desiredDip}
                    onChange={(event) => setDesiredDip(event.target.value)}
                    className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
                    required
                    data-testid="entry-dip-input"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">Target entry azimuth (°)</span>
                  <input
                    value={desiredAzimuth}
                    onChange={(event) => setDesiredAzimuth(event.target.value)}
                    className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
                    required
                    data-testid="entry-azimuth-input"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">
                    Target entry north reference
                  </span>
                  <select
                    value={desiredRef}
                    onChange={(event) =>
                      setDesiredRef(event.target.value as NorthReference)
                    }
                    className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
                  >
                    {NORTH_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "GRID"
                          ? "Grid North"
                          : option === "TRUE"
                            ? "True North"
                            : "Magnetic North"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className="rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-sm"
                data-testid="requested-entry-direction"
              >
                <p className="font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
                  Requested entry direction
                </p>
                <p className="mt-1">Dip {desiredDip || "—"}°</p>
                <p>
                  Azimuth {desiredAzimuth || "—"}° {northShortLabel(desiredRef)}
                </p>
              </div>
              {calculatedEntry?.residualDipDegrees !== undefined &&
              calculatedEntry.residualAzimuthDegrees !== undefined ? (
                <div
                  className="rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-sm"
                  data-testid="calculated-entry-residual"
                >
                  <p className="font-semibold uppercase tracking-wide text-[var(--tl-ink-muted)]">
                    Calculated residual
                  </p>
                  <p className="mt-1">
                    Dip {calculatedEntry.residualDipDegrees.toFixed(1)}°
                  </p>
                  <p>
                    Azimuth {calculatedEntry.residualAzimuthDegrees.toFixed(1)}°
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </fieldset>

        {message ? (
          <p role="alert" className="text-sm text-[var(--tl-danger)]">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--tl-border)] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save target"}
          </button>
        </div>
      </form>
    </div>
  );
}
