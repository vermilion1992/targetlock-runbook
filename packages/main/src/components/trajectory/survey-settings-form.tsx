"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  getTrajectorySetup,
  saveActualTrajectoryConfiguration,
  saveCoordinateConfiguration,
  saveReferenceConfiguration,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  convertAzimuthDegrees,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
} from "@/domain";

const NORTH_OPTIONS: NorthReference[] = [
  "GRID",
  "TRUE",
  "MAGNETIC",
  "NOT_SPECIFIED",
];

function northLabel(ref: NorthReference): string {
  if (ref === "GRID") return "Grid North";
  if (ref === "TRUE") return "True North";
  if (ref === "MAGNETIC") return "Magnetic North";
  return "Not specified";
}

export function SurveySettingsForm({ holeId }: { holeId: string }) {
  const [surveyAzimuthRef, setSurveyAzimuthRef] =
    useState<NorthReference>("GRID");
  const [defaultIntervalM, setDefaultIntervalM] = useState("30.0");
  const [calcRef, setCalcRef] = useState<NorthReference>("GRID");
  const [gridRotation, setGridRotation] = useState("0.0");
  const [declination, setDeclination] = useState("0.0");
  const [conversionEnabled, setConversionEnabled] = useState(true);
  const [previewRecordedAz, setPreviewRecordedAz] = useState("129.8");
  const [collarDip, setCollarDip] = useState("-60.0");
  const [collarAzimuth, setCollarAzimuth] = useState("128.0");
  const [collarRef, setCollarRef] = useState<NorthReference>("GRID");
  const [collarE, setCollarE] = useState("");
  const [collarN, setCollarN] = useState("");
  const [collarRl, setCollarRl] = useState("");
  const [systemName, setSystemName] = useState("Local Mine Grid");
  const [collarOpen, setCollarOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (!services) return;
    void getTrajectorySetup(holeId, services).then((setup) => {
      if (setup.actualConfiguration) {
        setCollarDip(
          (setup.actualConfiguration.collarDipTenths / 10).toFixed(1),
        );
        setCollarAzimuth(
          (setup.actualConfiguration.collarAzimuthTenths / 10).toFixed(1),
        );
        setCollarRef(setup.actualConfiguration.collarNorthReference);
        setSurveyAzimuthRef(setup.actualConfiguration.collarNorthReference);
        if (setup.actualConfiguration.preferredSurveyIntervalDm !== undefined) {
          setDefaultIntervalM(
            (
              Number(setup.actualConfiguration.preferredSurveyIntervalDm) / 10
            ).toFixed(1),
          );
        } else {
          setDefaultIntervalM("");
        }
      }
      if (setup.coordinateConfiguration) {
        setCalcRef(setup.coordinateConfiguration.calculationNorthReference);
        setSystemName(
          setup.coordinateConfiguration.coordinateSystemName ??
            "Local Mine Grid",
        );
        if (setup.coordinateConfiguration.collarEastingDm !== undefined) {
          setCollarE(
            (setup.coordinateConfiguration.collarEastingDm / 10).toFixed(1),
          );
        }
        if (setup.coordinateConfiguration.collarNorthingDm !== undefined) {
          setCollarN(
            (setup.coordinateConfiguration.collarNorthingDm / 10).toFixed(1),
          );
        }
        if (setup.coordinateConfiguration.collarRlDm !== undefined) {
          setCollarRl(
            (setup.coordinateConfiguration.collarRlDm / 10).toFixed(1),
          );
        }
      }
      if (setup.referenceConfiguration) {
        setGridRotation(
          setup.referenceConfiguration.gridRotationDeg.toFixed(1),
        );
        setDeclination(
          setup.referenceConfiguration.magneticDeclinationDeg.toFixed(1),
        );
      }
      setSelectionCount(setup.selections.length);
    });
  }, [holeId]);

  const preview = useMemo(() => {
    const recorded = Number(previewRecordedAz);
    const decl = Number(declination);
    const grid = Number(gridRotation);
    if (!Number.isFinite(recorded)) {
      return null;
    }
    const calculation = convertAzimuthDegrees(
      recorded,
      surveyAzimuthRef,
      calcRef,
      {
        magneticDeclinationDeg: Number.isFinite(decl) ? decl : 0,
        gridRotationDeg: Number.isFinite(grid) ? grid : 0,
      },
    );
    return {
      recorded,
      calculation,
      declination: Number.isFinite(decl) ? decl : 0,
      grid: Number.isFinite(grid) ? grid : 0,
    };
  }, [previewRecordedAz, surveyAzimuthRef, calcRef, declination, gridRotation]);

  const validationOk =
    calcRef === "GRID" ||
    surveyAzimuthRef === "GRID" ||
    surveyAzimuthRef === calcRef ||
    (conversionEnabled && surveyAzimuthRef !== "NOT_SPECIFIED");

  async function handleSave() {
    const services = createBrowserRunbookServices();
    if (!services) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const dip = parseDipInput(collarDip);
      const az = parseAzimuthInput(collarAzimuth);
      if (!dip.ok || !az.ok) {
        throw new Error("Collar dip or azimuth is invalid.");
      }
      const occurredAt = new Date().toISOString();
      let collarEastingDm: number | undefined;
      let collarNorthingDm: number | undefined;
      let collarRlDm: number | undefined;
      if (collarE.trim() || collarN.trim() || collarRl.trim()) {
        const e = parseMetreInput(collarE);
        const n = parseMetreInput(collarN);
        const rlAbs = parseMetreInput(collarRl.replace(/^-/, ""));
        if (!e.ok || !n.ok || !rlAbs.ok) {
          throw new Error(
            "Collar Easting, Northing and RL must all be valid when provided.",
          );
        }
        collarEastingDm = Number(e.value);
        collarNorthingDm = Number(n.value);
        collarRlDm = collarRl.trim().startsWith("-")
          ? -Number(rlAbs.value)
          : Number(rlAbs.value);
      }

      const reference = await saveReferenceConfiguration(
        {
          operationId: `ref-settings-${Date.now()}`,
          holeId,
          gridRotationDeg: Number(gridRotation) || 0,
          magneticDeclinationDeg: Number(declination) || 0,
          createdByUserId: "user-local",
          createdByNameSnapshot: "Local operator",
          occurredAt,
        },
        services,
      );

      const hasCollarCoordinates =
        collarEastingDm !== undefined &&
        collarNorthingDm !== undefined &&
        collarRlDm !== undefined;
      await saveCoordinateConfiguration(
        {
          operationId: `coord-settings-${Date.now()}`,
          holeId,
          coordinateMode: hasCollarCoordinates ? "MINE_GRID" : "RELATIVE",
          coordinateSystemName: hasCollarCoordinates
            ? systemName
            : undefined,
          collarEastingDm,
          collarNorthingDm,
          collarRlDm,
          calculationNorthReference: calcRef,
          referenceConfigurationId: reference.localId,
          createdByUserId: "user-local",
          createdByNameSnapshot: "Local operator",
          occurredAt,
        },
        services,
      );

      let preferredSurveyIntervalDm: number | null = null;
      if (defaultIntervalM.trim()) {
        const interval = parseMetreInput(defaultIntervalM);
        if (!interval.ok || Number(interval.value) <= 0) {
          setMessage("Default Survey interval must be a positive distance.");
          setBusy(false);
          return;
        }
        preferredSurveyIntervalDm = Number(interval.value);
      }

      await saveActualTrajectoryConfiguration(
        {
          operationId: `actual-settings-${Date.now()}`,
          holeId,
          collarDipTenths: dip.value,
          collarAzimuthTenths: az.value,
          collarNorthReference: collarRef,
          preferredSurveyIntervalDm,
          occurredAt,
        },
        services,
      );

      setMessage(
        preferredSurveyIntervalDm !== undefined
          ? `Survey settings saved. Default Survey interval ${defaultIntervalM} m.`
          : "Survey settings saved. Survey interval cleared — next-Survey KPIs unavailable until set.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="survey-settings-form">
      <StagePageHeader
        eyebrow="Trajectory"
        title="Survey & Reference Settings"
        description="Survey azimuth reference, north conversion, and collar configuration for trajectory calculations."
        action={
          <Link
            href={runbookRoutes.trajectory(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          >
            View trajectory
          </Link>
        }
      />

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Survey input</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Survey azimuth reference</span>
            <select
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={surveyAzimuthRef}
              onChange={(event) => {
                const value = event.target.value as NorthReference;
                setSurveyAzimuthRef(value);
                setCollarRef(value);
              }}
            >
              {NORTH_OPTIONS.filter((option) => option !== "NOT_SPECIFIED").map(
                (option) => (
                  <option key={option} value={option}>
                    {northLabel(option)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Default Survey interval (m)</span>
            <input
              aria-label="Default Survey interval (m)"
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={defaultIntervalM}
              onChange={(event) => setDefaultIntervalM(event.target.value)}
              data-testid="survey-interval-input"
            />
          </label>
        </div>
        <p className="rounded-md bg-[var(--tl-surface-sunken)] px-3 py-2 text-sm text-[var(--tl-ink-muted)]">
          Dip convention: −90° down, 0° horizontal, +90° up (display only —
          not casually editable).
        </p>
      </section>

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Reference conversion</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Calculation reference</span>
            <select
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={calcRef}
              onChange={(event) =>
                setCalcRef(event.target.value as NorthReference)
              }
            >
              {NORTH_OPTIONS.filter((option) => option !== "NOT_SPECIFIED").map(
                (option) => (
                  <option key={option} value={option}>
                    {northLabel(option)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={conversionEnabled}
              onChange={(event) => setConversionEnabled(event.target.checked)}
            />
            Conversion enabled / apply to future Surveys
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Magnetic declination (° east +)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={declination}
              onChange={(event) => setDeclination(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Grid convergence / rotation (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={gridRotation}
              onChange={(event) => setGridRotation(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">Conversion preview</h2>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Sample recorded azimuth (°)</span>
            <input
              className="min-h-11 w-40 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={previewRecordedAz}
              onChange={(event) => setPreviewRecordedAz(event.target.value)}
            />
          </label>
        </div>
        {preview ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-[var(--tl-border)] px-3 py-2">
              <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                Recorded azimuth
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {preview.recorded.toFixed(1)}° {northLabel(surveyAzimuthRef)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--tl-border)] px-3 py-2">
              <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                Calculation azimuth
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {preview.calculation.toFixed(1)}° {northLabel(calcRef)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--tl-border)] px-3 py-2">
              <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                Magnetic declination
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {preview.declination >= 0 ? "+" : ""}
                {preview.declination.toFixed(1)}°
              </p>
            </div>
            <div className="rounded-md border border-[var(--tl-border)] px-3 py-2">
              <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                Grid conversion
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {preview.grid >= 0 ? "+" : ""}
                {preview.grid.toFixed(1)}°
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={`rounded-[var(--tl-radius-md)] border px-4 py-3 ${
          validationOk
            ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)]"
            : "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)]"
        }`}
        data-testid="reference-validation-card"
      >
        <p className="text-xs font-bold uppercase tracking-wide">
          Reference configuration
        </p>
        <p className="mt-1 font-semibold">
          {validationOk ? "Valid" : "Needs attention"}
        </p>
        <p className="mt-1 text-sm">
          {validationOk
            ? "All selected Surveys can be converted to the calculation north reference."
            : "Unspecified or incomplete conversion may block mine-grid trajectory."}
        </p>
      </section>

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-lg font-semibold"
          onClick={() => setCollarOpen((value) => !value)}
        >
          Collar
          <span className="text-sm text-[var(--tl-ink-muted)]">
            {collarOpen ? "Hide" : "Show"}
          </span>
        </button>
        {collarOpen ? (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Collar dip (°)</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarDip}
                  onChange={(event) => setCollarDip(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Collar azimuth (°)</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarAzimuth}
                  onChange={(event) => setCollarAzimuth(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Collar azimuth reference</span>
                <select
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarRef}
                  onChange={(event) =>
                    setCollarRef(event.target.value as NorthReference)
                  }
                >
                  {NORTH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {northLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1 text-sm lg:col-span-1">
                <span className="font-medium">Coordinate system</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={systemName}
                  onChange={(event) => setSystemName(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Easting (m)</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarE}
                  onChange={(event) => setCollarE(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Northing (m)</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarN}
                  onChange={(event) => setCollarN(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">RL (m)</span>
                <input
                  className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                  value={collarRl}
                  onChange={(event) => setCollarRl(event.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left font-semibold"
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          Advanced
          <span className="text-[var(--tl-ink-muted)]">
            {advancedOpen ? "Hide" : "Show"}
          </span>
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-2">
            <p>
              Persisted Survey selections: <strong>{selectionCount}</strong>
            </p>
            <Link
              href={runbookRoutes.trajectorySurveys(holeId)}
              className="inline-flex min-h-11 items-center font-semibold text-[var(--tl-primary)]"
            >
              Review duplicate Survey depths
            </Link>
            <Link
              href={runbookRoutes.surveyTools(holeId)}
              className="ml-4 inline-flex min-h-11 items-center font-semibold text-[var(--tl-primary)]"
            >
              Survey tool registry
            </Link>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-semibold text-white"
        onClick={() => void handleSave()}
      >
        Save settings
      </button>
      {message ? (
        <p role="status" className="text-sm" data-testid="survey-settings-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
