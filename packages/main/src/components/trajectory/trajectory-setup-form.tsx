"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
  getTrajectorySetup,
  saveActualTrajectoryConfiguration,
  saveCoordinateConfiguration,
  saveReferenceConfiguration,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  parseAzimuthInput,
  parseDipInput,
  parseMetreInput,
  type NorthReference,
} from "@/domain";
import { useOperatorSession } from "@/components/session";

const NORTH_OPTIONS: NorthReference[] = [
  "GRID",
  "TRUE",
  "MAGNETIC",
  "NOT_SPECIFIED",
];

export function TrajectorySetupForm({ holeId }: { holeId: string }) {
  const { session } = useOperatorSession();
  const [collarDip, setCollarDip] = useState("-60.0");
  const [collarAzimuth, setCollarAzimuth] = useState("128.0");
  const [collarRef, setCollarRef] = useState<NorthReference>("GRID");
  const [coordinateMode, setCoordinateMode] = useState<"RELATIVE" | "MINE_GRID">(
    "RELATIVE",
  );
  const [systemName, setSystemName] = useState("Local Mine Grid");
  const [collarE, setCollarE] = useState("");
  const [collarN, setCollarN] = useState("");
  const [collarRl, setCollarRl] = useState("");
  const [calcRef, setCalcRef] = useState<NorthReference>("GRID");
  const [gridRotation, setGridRotation] = useState("0.0");
  const [declination, setDeclination] = useState("0.0");
  const [activePlan, setActivePlan] = useState<string>("None");
  const [targetStatus, setTargetStatus] = useState("No target");
  const [selectionCount, setSelectionCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (!services) return;
    void getTrajectorySetup(holeId, services).then((setup) => {
      if (setup.actualConfiguration) {
        setCollarDip((setup.actualConfiguration.collarDipTenths / 10).toFixed(1));
        setCollarAzimuth(
          (setup.actualConfiguration.collarAzimuthTenths / 10).toFixed(1),
        );
        setCollarRef(setup.actualConfiguration.collarNorthReference);
      }
      if (setup.coordinateConfiguration) {
        setCoordinateMode(setup.coordinateConfiguration.coordinateMode);
        setCalcRef(setup.coordinateConfiguration.calculationNorthReference);
        setSystemName(
          setup.coordinateConfiguration.coordinateSystemName ?? "Local Mine Grid",
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
      setActivePlan(setup.activePlan?.name ?? "None");
      setTargetStatus(setup.target ? setup.target.name : "No target");
      setSelectionCount(setup.selections.length);
    });
  }, [holeId]);

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
      const operationId = `hole-setup-${Date.now()}`;
      let collarEastingDm: number | undefined;
      let collarNorthingDm: number | undefined;
      let collarRlDm: number | undefined;
      if (coordinateMode === "MINE_GRID") {
        const e = parseMetreInput(collarE);
        const n = parseMetreInput(collarN);
        const rlAbs = parseMetreInput(collarRl.replace(/^-/, ""));
        if (!e.ok || !n.ok || !rlAbs.ok) {
          throw new Error("Mine-grid collar coordinates are required.");
        }
        collarEastingDm = Number(e.value);
        collarNorthingDm = Number(n.value);
        collarRlDm = collarRl.trim().startsWith("-")
          ? -Number(rlAbs.value)
          : Number(rlAbs.value);
      }
      await saveCoordinateConfiguration(
        {
          operationId: `${operationId}:coordinates`,
          holeId,
          coordinateMode,
          coordinateSystemName:
            coordinateMode === "MINE_GRID" ? systemName : undefined,
          collarEastingDm,
          collarNorthingDm,
          collarRlDm,
          calculationNorthReference: calcRef,
          createdByUserId: session?.operator.localId ?? "local-operator",
          createdByNameSnapshot:
            session?.operator.displayName ?? "Local operator",
          occurredAt,
        },
        services,
      );
      await saveReferenceConfiguration(
        {
          operationId: `${operationId}:reference`,
          holeId,
          gridRotationDeg: Number(gridRotation),
          magneticDeclinationDeg: Number(declination),
          createdByUserId: session?.operator.localId ?? "local-operator",
          createdByNameSnapshot:
            session?.operator.displayName ?? "Local operator",
          occurredAt,
        },
        services,
      );
      await saveActualTrajectoryConfiguration(
        {
          operationId: `${operationId}:actual`,
          holeId,
          collarDipTenths: dip.value,
          collarAzimuthTenths: az.value,
          collarNorthReference: collarRef,
          occurredAt,
        },
        services,
      );
      const state = await getCurrentHoleState(holeId, services.currentState);
      await services.audits.append({
        localId: `${operationId}:audit`,
        serverId: null,
        syncStatus: "local-only",
        createdAt: occurredAt,
        updatedAt: occurredAt,
        deviceId: "local-runbook-device",
        version: 1,
        holeId,
        entityType: "hole",
        entityId: holeId,
        action: "hole_setup_updated",
        userId: session?.operator.localId ?? "local-operator",
        userNameSnapshot:
          session?.operator.displayName ?? "Local operator",
        timestamp: occurredAt,
        depthDm: state.currentDepthDm,
        metadata: {
          collarDipTenths: dip.value,
          collarAzimuthTenths: az.value,
          collarNorthReference: collarRef,
          coordinateMode,
          collarCoordinatesRecorded: coordinateMode === "MINE_GRID",
        },
      });
      setMessage("Actual Survey trajectory setup saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save setup.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="trajectory-setup-form">
      <StagePageHeader
        eyebrow="Trajectory"
        title="Actual Survey trajectory setup"
        description="Configure collar direction, coordinate mode, and north-reference conversion for trajectory calculation."
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
        <h2 className="text-lg font-semibold">Actual collar direction</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Collar dip (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={collarDip}
              onChange={(event) => setCollarDip(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Collar azimuth (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={collarAzimuth}
              onChange={(event) => setCollarAzimuth(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Reference</span>
            <select
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={collarRef}
              onChange={(event) =>
                setCollarRef(event.target.value as NorthReference)
              }
            >
              {NORTH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">Coordinate configuration</h2>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            checked={coordinateMode === "RELATIVE"}
            onChange={() => setCoordinateMode("RELATIVE")}
          />
          Relative
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            checked={coordinateMode === "MINE_GRID"}
            onChange={() => setCoordinateMode("MINE_GRID")}
          />
          Mine grid
        </label>
        {coordinateMode === "MINE_GRID" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">Coordinate system name</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={systemName}
                onChange={(event) => setSystemName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Collar Easting (m)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={collarE}
                onChange={(event) => setCollarE(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Collar Northing (m)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={collarN}
                onChange={(event) => setCollarN(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Collar RL (m)</span>
              <input
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={collarRl}
                onChange={(event) => setCollarRl(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Calculation north reference</span>
              <select
                className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
                value={calcRef}
                onChange={(event) =>
                  setCalcRef(event.target.value as NorthReference)
                }
              >
                {NORTH_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
        <h2 className="text-lg font-semibold">North-reference conversion</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Grid rotation (°)</span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={gridRotation}
              onChange={(event) => setGridRotation(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Magnetic declination (° east +)
            </span>
            <input
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              value={declination}
              onChange={(event) => setDeclination(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-sm">
        <p>
          Active plan: <strong>{activePlan}</strong>
        </p>
        <p>
          Target status: <strong>{targetStatus}</strong>
        </p>
        <p>
          Persisted Survey selections: <strong>{selectionCount}</strong>
        </p>
        <Link
          href={runbookRoutes.trajectorySurveys(holeId)}
          className="inline-flex min-h-11 items-center font-semibold text-[var(--tl-primary)]"
        >
          Review duplicate Survey depths
        </Link>
      </section>

      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-semibold text-white"
        onClick={() => void handleSave()}
      >
        Save setup
      </button>
      {message ? (
        <p role="status" className="text-sm" data-testid="trajectory-setup-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
