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
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { resolveSafeReturnPath } from "@/components/navigation/resolve-safe-return-path";
import {
  convertAzimuthDegrees,
  DEFAULT_GUIDANCE_DEADBAND_DEG,
  DEFAULT_STEERING_LIMITS,
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
} from "@/domain";
import { createBrowserTrajectoryProjectDefaultsRepository } from "@/infrastructure/trajectory";

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

export function SurveySettingsForm({
  holeId,
  returnTo,
}: {
  holeId: string;
  returnTo?: string;
}) {
  const [surveyAzimuthRef, setSurveyAzimuthRef] =
    useState<NorthReference>("GRID");
  const [defaultIntervalM, setDefaultIntervalM] = useState("30.0");
  const [maximumDogleg, setMaximumDogleg] = useState(
    DEFAULT_STEERING_LIMITS.maximumDoglegPer30mDegrees.toFixed(1),
  );
  const [maximumLift, setMaximumLift] = useState(
    DEFAULT_STEERING_LIMITS.maximumLiftPer30mDegrees.toFixed(1),
  );
  const [maximumDrop, setMaximumDrop] = useState(
    DEFAULT_STEERING_LIMITS.maximumDropPer30mDegrees.toFixed(1),
  );
  const [maximumTurn, setMaximumTurn] = useState(
    DEFAULT_STEERING_LIMITS.maximumTurnPer30mDegrees.toFixed(1),
  );
  const [guidanceDeadband, setGuidanceDeadband] = useState(
    DEFAULT_GUIDANCE_DEADBAND_DEG.toFixed(1),
  );
  const [calcRef, setCalcRef] = useState<NorthReference>("GRID");
  const [gridRotation, setGridRotation] = useState("0.0");
  const [declination, setDeclination] = useState("0.0");
  const [previewRecordedAz, setPreviewRecordedAz] = useState("129.8");
  const [collarDip, setCollarDip] = useState("-60.0");
  const [collarAzimuth, setCollarAzimuth] = useState("128.0");
  const [collarRef, setCollarRef] = useState<NorthReference>("GRID");
  const [collarE, setCollarE] = useState("");
  const [collarN, setCollarN] = useState("");
  const [collarRl, setCollarRl] = useState("");
  const [systemName, setSystemName] = useState("Local Mine Grid");
  const [selectionCount, setSelectionCount] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);
  const [duplicateDepthCount, setDuplicateDepthCount] = useState(0);
  const [activeToolCount, setActiveToolCount] = useState(0);
  const [saveAsProjectDefault, setSaveAsProjectDefault] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);

  const parent = resolveSafeReturnPath({
    requestedReturnTo: returnTo,
    canonicalFallback: runbookRoutes.more(holeId),
    currentHoleId: holeId,
  });

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (!services) return;
    void Promise.all([
      getTrajectorySetup(holeId, services),
      services.surveys.listByHole(holeId),
      services.surveyTools.listActive(),
    ])
      .then(([setup, surveys, activeTools]) => {
        if (setup.actualConfiguration) {
          setCollarDip(
            (setup.actualConfiguration.collarDipTenths / 10).toFixed(1),
          );
          setCollarAzimuth(
            (setup.actualConfiguration.collarAzimuthTenths / 10).toFixed(1),
          );
          setCollarRef(setup.actualConfiguration.collarNorthReference);
          setSurveyAzimuthRef(
            setup.actualConfiguration.preferredSurveyNorthReference ??
              setup.actualConfiguration.collarNorthReference,
          );
          if (
            setup.actualConfiguration.preferredSurveyIntervalDm !== undefined
          ) {
            setDefaultIntervalM(
              (
                Number(setup.actualConfiguration.preferredSurveyIntervalDm) /
                10
              ).toFixed(1),
            );
          } else {
            setDefaultIntervalM("");
          }
          setMaximumDogleg(
            (
              (setup.actualConfiguration.maximumDoglegPer30mTenths ??
                DEFAULT_STEERING_LIMITS.maximumDoglegPer30mDegrees * 10) / 10
            ).toFixed(1),
          );
          setMaximumLift(
            (
              (setup.actualConfiguration.maximumLiftPer30mTenths ??
                DEFAULT_STEERING_LIMITS.maximumLiftPer30mDegrees * 10) / 10
            ).toFixed(1),
          );
          setMaximumDrop(
            (
              (setup.actualConfiguration.maximumDropPer30mTenths ??
                DEFAULT_STEERING_LIMITS.maximumDropPer30mDegrees * 10) / 10
            ).toFixed(1),
          );
          setMaximumTurn(
            (
              (setup.actualConfiguration.maximumTurnPer30mTenths ??
                DEFAULT_STEERING_LIMITS.maximumTurnPer30mDegrees * 10) / 10
            ).toFixed(1),
          );
          setGuidanceDeadband(
            (
              (setup.actualConfiguration.guidanceDeadbandTenths ??
                DEFAULT_GUIDANCE_DEADBAND_DEG * 10) / 10
            ).toFixed(1),
          );
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
        setSurveyCount(surveys.length);
        const depthCounts = new Map<number, number>();
        for (const survey of surveys) {
          depthCounts.set(
            Number(survey.depthDm),
            (depthCounts.get(Number(survey.depthDm)) ?? 0) + 1,
          );
        }
        setDuplicateDepthCount(
          [...depthCounts.values()].filter((count) => count > 1).length,
        );
        setActiveToolCount(activeTools.length);
        setReady(true);
      })
      .catch(() => {
        setMessage("Saved settings could not be loaded.");
        setReady(true);
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
    surveyAzimuthRef !== "NOT_SPECIFIED";

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

      const envelopeValues = [
        ["Maximum dogleg", maximumDogleg],
        ["Maximum lift", maximumLift],
        ["Maximum drop", maximumDrop],
        ["Maximum turn", maximumTurn],
      ] as const;
      const parsedEnvelope = envelopeValues.map(([label, raw]) => ({
        label,
        value: Number(raw),
      }));
      const invalidEnvelope = parsedEnvelope.find(
        ({ value }) => !Number.isFinite(value) || value <= 0 || value > 90,
      );
      const parsedDeadband = Number(guidanceDeadband);
      if (invalidEnvelope) {
        setMessage(
          `${invalidEnvelope.label} must be greater than 0° and no more than 90° per 30 m.`,
        );
        setBusy(false);
        return;
      }
      if (
        !Number.isFinite(parsedDeadband) ||
        parsedDeadband < 0 ||
        parsedDeadband > 5
      ) {
        setMessage("Guidance deadband must be between 0.0° and 5.0°.");
        setBusy(false);
        return;
      }

      await saveActualTrajectoryConfiguration(
        {
          operationId: `actual-settings-${Date.now()}`,
          holeId,
          collarDipTenths: dip.value,
          collarAzimuthTenths: az.value,
          collarNorthReference: collarRef,
          preferredSurveyNorthReference: surveyAzimuthRef,
          preferredSurveyIntervalDm,
          maximumDoglegPer30mTenths: Math.round(
            Number(maximumDogleg) * 10,
          ),
          maximumLiftPer30mTenths: Math.round(Number(maximumLift) * 10),
          maximumDropPer30mTenths: Math.round(Number(maximumDrop) * 10),
          maximumTurnPer30mTenths: Math.round(Number(maximumTurn) * 10),
          guidanceDeadbandTenths: Math.round(parsedDeadband * 10),
          occurredAt,
        },
        services,
      );

      if (saveAsProjectDefault && preferredSurveyIntervalDm !== null) {
        const hole = await services.completion.getHole(holeId);
        if (hole === null) {
          throw new Error("The hole project could not be resolved.");
        }
        const defaults =
          createBrowserTrajectoryProjectDefaultsRepository();
        await defaults?.save(hole.projectId, {
          surveyNorthReference:
            surveyAzimuthRef === "NOT_SPECIFIED"
              ? "GRID"
              : surveyAzimuthRef,
          preferredSurveyIntervalDm,
          calculationNorthReference:
            calcRef === "NOT_SPECIFIED" ? "GRID" : calcRef,
          gridRotationDeg: Number(gridRotation) || 0,
          magneticDeclinationDeg: Number(declination) || 0,
          coordinateSystemName: systemName.trim() || "Local Mine Grid",
          updatedAt: occurredAt,
        });
      }

      setIsDirty(false);
      setMessage(
        preferredSurveyIntervalDm !== null
          ? `Survey settings saved for ${holeId}.${saveAsProjectDefault ? " New holes will use these survey and reference defaults." : ""}`
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
    <div
      className="space-y-4"
      data-testid="survey-settings-form"
      data-ready={ready}
      onChange={() => setIsDirty(true)}
    >
      <StagePageHeader
        eyebrow="Trajectory"
        title="Survey & Reference Settings"
        description="Survey azimuth reference, north conversion, and collar configuration for trajectory calculations."
        backTarget={namedBackTarget(parent.href, parent.label, {
          onNavigate: requestLeave,
        })}
        action={
          <Link
            href={runbookRoutes.trajectory(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          >
            View trajectory
          </Link>
        }
      />
      {discardDialog}

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Survey input</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Survey azimuth reference</span>
            <select
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={surveyAzimuthRef}
              onChange={(event) =>
                setSurveyAzimuthRef(event.target.value as NorthReference)
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

      <section
        className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
        data-testid="steering-envelope-settings"
      >
        <div>
          <h2 className="text-lg font-semibold">Steering guidance envelope</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--tl-ink-muted)]">
            Guidance is withheld when the recovery path exceeds any limit.
            Confirm these values for the active BHA, ground conditions and
            operating procedure.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Maximum dogleg (°/30 m)", maximumDogleg, setMaximumDogleg],
            ["Maximum lift (°/30 m)", maximumLift, setMaximumLift],
            ["Maximum drop (°/30 m)", maximumDrop, setMaximumDrop],
            ["Maximum turn (°/30 m)", maximumTurn, setMaximumTurn],
            ["Hold deadband (°)", guidanceDeadband, setGuidanceDeadband],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="block space-y-1 text-sm">
              <span className="font-medium">{label as string}</span>
              <input
                inputMode="decimal"
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 tabular-nums"
                value={value as string}
                onChange={(event) =>
                  (setter as (next: string) => void)(event.target.value)
                }
              />
            </label>
          ))}
        </div>
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
          <p className="rounded-md bg-[var(--tl-surface-sunken)] px-3 py-2 text-sm text-[var(--tl-ink-muted)]">
            Conversion is applied to every selected Survey in this hole. Raw
            recorded azimuths and their original references remain unchanged.
          </p>
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

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <div>
          <h2 className="text-lg font-semibold">Collar</h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Hole-specific origin and starting direction. Changing these values
            recalculates this hole&apos;s trajectory.
          </p>
        </div>
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
          <label className="block space-y-1 text-sm">
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
      </section>

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-sm">
        <div>
          <h2 className="text-lg font-semibold">Advanced</h2>
          <p className="mt-1 text-[var(--tl-ink-muted)]">
            Calculation and Survey details currently active for {holeId}.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Coordinate mode", collarE && collarN && collarRl ? "Mine grid" : "Relative"],
            ["EPSG", "Not configured"],
            ["Desurvey method", "Minimum curvature"],
            ["Calculation reference", northLabel(calcRef)],
            ["Survey records", String(surveyCount)],
            ["Selected duplicate readings", String(selectionCount)],
            ["Duplicate Survey depths", String(duplicateDepthCount)],
            ["Active Survey tools", String(activeToolCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md bg-[var(--tl-surface-sunken)] px-3 py-2"
            >
              <dt className="text-xs font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
                {label}
              </dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[var(--tl-ink-muted)]">
          Reference changes recalculate the displayed trajectory from stored
          raw Survey readings; they do not rewrite those readings.
        </p>
      </section>

      <section className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-primary-soft)] p-4">
        <h2 className="font-semibold">Settings scope</h2>
        <p className="text-sm text-[var(--tl-ink-muted)]">
          Saving always updates this hole only. Existing holes are never
          changed automatically.
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={saveAsProjectDefault}
            onChange={(event) => setSaveAsProjectDefault(event.target.checked)}
          />
          Also use these Survey and reference values for new holes
        </label>
        <p className="text-xs text-[var(--tl-ink-muted)]">
          Collar coordinates and direction remain hole-specific and are not
          copied.
        </p>
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
