"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  activatePlannedTrajectory,
  createBrowserRunbookServices,
  getTrajectorySetup,
  saveCoordinateConfiguration,
  saveHoleTarget,
  savePlannedTrajectoryDraft,
  saveStraightPlanDraft,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
  type PlannedTrajectoryStation,
} from "@/domain";

function parseSignedMetresToDm(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const negative = normalized.startsWith("-");
  const abs = parseMetreInput(normalized.replace(/^-/, ""));
  if (!abs.ok) return null;
  return negative ? -Number(abs.value) : Number(abs.value);
}

type PlanType = "STRAIGHT" | "CURVED";
type StationDraft = {
  id: string;
  md: string;
  dip: string;
  azimuth: string;
  stationType: PlannedTrajectoryStation["stationType"];
};

const NORTH_OPTIONS: NorthReference[] = [
  "GRID",
  "TRUE",
  "MAGNETIC",
  "NOT_SPECIFIED",
];

function newStation(partial?: Partial<StationDraft>): StationDraft {
  return {
    id: `station-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    md: "",
    dip: "",
    azimuth: "",
    stationType: "CONTROL",
    ...partial,
  };
}

export function TrajectoryPlanForm({ holeId }: { holeId: string }) {
  const [planType, setPlanType] = useState<PlanType>("CURVED");
  const [coordinateMode, setCoordinateMode] = useState<"RELATIVE" | "MINE_GRID">(
    "RELATIVE",
  );
  const [northReference, setNorthReference] = useState<NorthReference>("GRID");
  const [name, setName] = useState("Hole trajectory plan");
  const [straightDip, setStraightDip] = useState("-60.0");
  const [straightAzimuth, setStraightAzimuth] = useState("128.0");
  const [straightMd, setStraightMd] = useState("650.0");
  const [stations, setStations] = useState<StationDraft[]>([
    newStation({
      md: "0.0",
      dip: "-60.0",
      azimuth: "128.0",
      stationType: "COLLAR",
    }),
    newStation({
      md: "300.0",
      dip: "-66.0",
      azimuth: "134.0",
      stationType: "CONTROL",
    }),
    newStation({
      md: "650.0",
      dip: "-74.0",
      azimuth: "145.0",
      stationType: "PLANNED_ENDPOINT",
    }),
  ]);
  const [targetName, setTargetName] = useState("Primary Target");
  const [targetE, setTargetE] = useState("280.0");
  const [targetN, setTargetN] = useState("-220.0");
  const [targetRl, setTargetRl] = useState("-520.0");
  const [targetRadius, setTargetRadius] = useState("5.0");
  const [desiredDip, setDesiredDip] = useState("-74.0");
  const [desiredAzimuth, setDesiredAzimuth] = useState("145.0");
  const [message, setMessage] = useState<string | null>(null);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (!services) return;
    void getTrajectorySetup(holeId, services).then((setup) => {
      if (setup.coordinateConfiguration) {
        setCoordinateMode(setup.coordinateConfiguration.coordinateMode);
        setNorthReference(
          setup.coordinateConfiguration.calculationNorthReference,
        );
      }
      if (setup.activePlan) {
        setActivePlanName(setup.activePlan.name);
        setName(setup.activePlan.name);
        setNorthReference(setup.activePlan.northReference);
        setStations(
          setup.activePlan.stations.map((station) => ({
            id: station.id,
            md: (Number(station.measuredDepthDm) / 10).toFixed(1),
            dip: (station.dipTenths / 10).toFixed(1),
            azimuth: (station.azimuthTenths / 10).toFixed(1),
            stationType: station.stationType,
          })),
        );
      }
      if (setup.target) {
        setTargetName(setup.target.name);
        setTargetE((setup.target.eastingDm / 10).toFixed(1));
        setTargetN((setup.target.northingDm / 10).toFixed(1));
        setTargetRl((setup.target.rlDm / 10).toFixed(1));
        if (setup.target.radiusDm !== undefined) {
          setTargetRadius((setup.target.radiusDm / 10).toFixed(1));
        }
      }
    });
  }, [holeId]);

  async function persistCoordinate(
    services: NonNullable<ReturnType<typeof createBrowserRunbookServices>>,
  ) {
    await saveCoordinateConfiguration(
      {
        operationId: `coord-${holeId}-${Date.now()}`,
        holeId,
        coordinateMode,
        coordinateSystemName:
          coordinateMode === "MINE_GRID" ? "Local Mine Grid" : undefined,
        collarEastingDm: coordinateMode === "MINE_GRID" ? 0 : undefined,
        collarNorthingDm: coordinateMode === "MINE_GRID" ? 0 : undefined,
        collarRlDm: coordinateMode === "MINE_GRID" ? 0 : undefined,
        calculationNorthReference: northReference,
        createdByUserId: "user-local",
        createdByNameSnapshot: "Local operator",
        occurredAt: new Date().toISOString(),
      },
      services,
    );
  }

  async function handleSaveDraft(activate: boolean) {
    const services = createBrowserRunbookServices();
    if (!services) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await persistCoordinate(services);
      const occurredAt = new Date().toISOString();
      let plan;
      if (planType === "STRAIGHT") {
        const dip = parseDipInput(straightDip);
        const az = parseAzimuthInput(straightAzimuth);
        const md = parseMetreInput(straightMd);
        if (!dip.ok || !az.ok || !md.ok) {
          throw new Error("Straight plan inputs are invalid.");
        }
        plan = await saveStraightPlanDraft(
          {
            operationId: `plan-draft-${Date.now()}`,
            holeId,
            name: `${name} (straight)`,
            description: "Straight directional plan",
            northReference,
            collarDipTenths: dip.value,
            collarAzimuthTenths: az.value,
            endpointMeasuredDepthDm: Number(md.value),
            createdByUserId: "user-local",
            createdByNameSnapshot: "Local operator",
            occurredAt,
          },
          services,
        );
      } else {
        const parsedStations: PlannedTrajectoryStation[] = stations.map(
          (station, index) => {
            const md = parseMetreInput(station.md);
            const dip = parseDipInput(station.dip);
            const az = parseAzimuthInput(station.azimuth);
            if (!md.ok || !dip.ok || !az.ok) {
              throw new Error(`Station ${index + 1} has invalid values.`);
            }
            return {
              id: station.id,
              measuredDepthDm: md.value,
              dipTenths: dip.value,
              azimuthTenths: az.value,
              northReference,
              stationType:
                index === 0
                  ? "COLLAR"
                  : index === stations.length - 1
                    ? "PLANNED_ENDPOINT"
                    : station.stationType,
            };
          },
        );
        plan = await savePlannedTrajectoryDraft(
          {
            operationId: `plan-draft-${Date.now()}`,
            holeId,
            name,
            description: "Curved station plan",
            northReference,
            stations: parsedStations,
            createdByUserId: "user-local",
            createdByNameSnapshot: "Local operator",
            occurredAt,
          },
          services,
        );
      }

      const eastParsed = parseSignedMetresToDm(targetE);
      const northParsed = parseSignedMetresToDm(targetN);
      const rlParsed = parseSignedMetresToDm(targetRl);
      const radius = parseMetreInput(targetRadius);
      if (
        eastParsed !== null &&
        northParsed !== null &&
        rlParsed !== null &&
        radius.ok
      ) {
        const dip = parseDipInput(desiredDip);
        const az = parseAzimuthInput(desiredAzimuth);
        await saveHoleTarget(
          {
            operationId: `target-${Date.now()}`,
            holeId,
            name: targetName,
            coordinateMode,
            eastingDm: eastParsed,
            northingDm: northParsed,
            rlDm: rlParsed,
            radiusDm: Number(radius.value),
            targetMeasuredDepthDm: 6_500,
            attitudeMode:
              dip.ok || az.ok
                ? ("MATCH_ENTRY_DIRECTION" as const)
                : ("AUTO_SMOOTH" as const),
            desiredDipTenths: dip.ok ? dip.value : undefined,
            desiredAzimuthTenths: az.ok ? az.value : undefined,
            desiredNorthReference: northReference,
            occurredAt,
          },
          services,
        );
      }

      if (activate) {
        await activatePlannedTrajectory(
          {
            holeId,
            planId: plan.localId,
            operationId: `activate-${Date.now()}`,
            occurredAt: new Date().toISOString(),
          },
          services,
        );
        setActivePlanName(plan.name);
        setMessage(`Activated plan “${plan.name}”.`);
      } else {
        setMessage(`Saved draft plan “${plan.name}”.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="trajectory-plan-form">
      <StagePageHeader
        eyebrow="Trajectory"
        title="Hole trajectory plan"
        description="Define a straight or curved directional plan. Target coordinates are stored separately from planned stations."
        action={
          <Link
            href={runbookRoutes.trajectory(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          >
            View trajectory
          </Link>
        }
      />

      {activePlanName ? (
        <p className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 text-sm">
          Active plan: <strong>{activePlanName}</strong>
        </p>
      ) : null}

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Plan type</h2>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="planType"
            checked={planType === "STRAIGHT"}
            onChange={() => setPlanType("STRAIGHT")}
          />
          Straight directional plan
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="planType"
            checked={planType === "CURVED"}
            onChange={() => setPlanType("CURVED")}
          />
          Curved station plan
        </label>

        <h2 className="pt-2 text-lg font-semibold">Coordinate mode</h2>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="coordMode"
            checked={coordinateMode === "RELATIVE"}
            onChange={() => setCoordinateMode("RELATIVE")}
          />
          Relative
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="coordMode"
            checked={coordinateMode === "MINE_GRID"}
            onChange={() => setCoordinateMode("MINE_GRID")}
          />
          Mine grid
        </label>
        {coordinateMode === "RELATIVE" ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            RELATIVE COORDINATES — The collar is treated as E 0.0, N 0.0, RL 0.0.
            Planned and actual Hole shapes can be compared, but they are not
            positioned in the mine grid.
          </p>
        ) : (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            Mine-grid mode requires collar coordinates and Grid North conversion
            on the setup screen.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Plan name</span>
          <input
            className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">North reference</span>
          <select
            className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
            value={northReference}
            onChange={(event) =>
              setNorthReference(event.target.value as NorthReference)
            }
          >
            {NORTH_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      {planType === "STRAIGHT" ? (
        <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
          <h2 className="text-lg font-semibold">Straight directional plan</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Collar dip (°)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={straightDip}
                onChange={(event) => setStraightDip(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Collar azimuth (°)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={straightAzimuth}
                onChange={(event) => setStraightAzimuth(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Endpoint MD (m)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={straightMd}
                onChange={(event) => setStraightMd(event.target.value)}
              />
            </label>
          </div>
        </section>
      ) : (
        <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
          <h2 className="text-lg font-semibold">Planned stations</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">MD (m)</th>
                  <th className="p-2">Dip (°)</th>
                  <th className="p-2">Azimuth (°)</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station, index) => (
                  <tr key={station.id} className="border-t border-[var(--tl-border)]">
                    <td className="p-2">
                      <input
                        aria-label={`Station ${index + 1} MD`}
                        className="min-h-11 w-24 rounded border border-[var(--tl-border)] px-2"
                        value={station.md}
                        onChange={(event) =>
                          setStations((current) =>
                            current.map((row) =>
                              row.id === station.id
                                ? { ...row, md: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        aria-label={`Station ${index + 1} dip`}
                        className="min-h-11 w-24 rounded border border-[var(--tl-border)] px-2"
                        value={station.dip}
                        onChange={(event) =>
                          setStations((current) =>
                            current.map((row) =>
                              row.id === station.id
                                ? { ...row, dip: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        aria-label={`Station ${index + 1} azimuth`}
                        className="min-h-11 w-24 rounded border border-[var(--tl-border)] px-2"
                        value={station.azimuth}
                        onChange={(event) =>
                          setStations((current) =>
                            current.map((row) =>
                              row.id === station.id
                                ? { ...row, azimuth: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-2 text-[var(--tl-ink-muted)]">
                      {index === 0
                        ? "Collar"
                        : index === stations.length - 1
                          ? "Planned endpoint"
                          : "Control"}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="min-h-11 px-3"
                        disabled={stations.length <= 2 || index === 0}
                        onClick={() =>
                          setStations((current) =>
                            current.filter((row) => row.id !== station.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
            onClick={() =>
              setStations((current) => [
                ...current.slice(0, -1),
                newStation({ stationType: "CONTROL" }),
                current.at(-1) ?? newStation({ stationType: "PLANNED_ENDPOINT" }),
              ])
            }
          >
            Add planned station
          </button>
        </section>
      )}

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Target</h2>
        <p className="text-sm text-[var(--tl-ink-muted)]">
          Target position is separate from planned stations. Endpoint dip and
          azimuth alone do not prove the path reaches these coordinates.
          {coordinateMode === "RELATIVE"
            ? " Values below are relative offsets from collar."
            : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Target name</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={targetName}
              onChange={(event) => setTargetName(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Target radius (m)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={targetRadius}
              onChange={(event) => setTargetRadius(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Target Easting {coordinateMode === "RELATIVE" ? "offset" : ""} (m)
            </span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={targetE}
              onChange={(event) => setTargetE(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Target Northing {coordinateMode === "RELATIVE" ? "offset" : ""} (m)
            </span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={targetN}
              onChange={(event) => setTargetN(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Target RL {coordinateMode === "RELATIVE" ? "offset" : ""} (m)
            </span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={targetRl}
              onChange={(event) => setTargetRl(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Desired dip (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={desiredDip}
              onChange={(event) => setDesiredDip(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Desired azimuth (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={desiredAzimuth}
              onChange={(event) => setDesiredAzimuth(event.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          onClick={() => void handleSaveDraft(false)}
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-semibold text-white"
          onClick={() => void handleSaveDraft(true)}
        >
          Save and activate
        </button>
      </div>
      {message ? (
        <p role="status" className="text-sm" data-testid="trajectory-plan-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
