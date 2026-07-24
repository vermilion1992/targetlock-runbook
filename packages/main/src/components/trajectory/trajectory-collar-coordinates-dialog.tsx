"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  getTrajectorySetup,
  saveCoordinateConfiguration,
} from "@/application/runbook";
import { parseMetreInput } from "@/domain";

export function TrajectoryCollarCoordinatesDialog({
  holeId,
  open,
  onClose,
  onSaved,
}: {
  holeId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [easting, setEasting] = useState("");
  const [northing, setNorthing] = useState("");
  const [rl, setRl] = useState("");
  const [systemName, setSystemName] = useState("Local Mine Grid");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const services = createBrowserRunbookServices();
    if (!services) return;
    void getTrajectorySetup(holeId, services).then((setup) => {
      const coords = setup.coordinateConfiguration;
      if (!coords) return;
      setSystemName(coords.coordinateSystemName ?? "Local Mine Grid");
      if (coords.collarEastingDm !== undefined) {
        setEasting((coords.collarEastingDm / 10).toFixed(1));
      }
      if (coords.collarNorthingDm !== undefined) {
        setNorthing((coords.collarNorthingDm / 10).toFixed(1));
      }
      if (coords.collarRlDm !== undefined) {
        setRl((coords.collarRlDm / 10).toFixed(1));
      }
    });
  }, [holeId, open]);

  if (!open) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const services = createBrowserRunbookServices();
    if (!services) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    const e = parseMetreInput(easting);
    const n = parseMetreInput(northing);
    const rlAbs = parseMetreInput(rl.replace(/^-/, ""));
    if (!e.ok || !n.ok || !rlAbs.ok) {
      setMessage("Collar Easting, Northing and RL are required.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const setup = await getTrajectorySetup(holeId, services);
      const existing = setup.coordinateConfiguration;
      await saveCoordinateConfiguration(
        {
          operationId: `collar-coords-${holeId}-${Date.now()}`,
          holeId,
          expectedVersion: existing?.version,
          coordinateMode: "MINE_GRID",
          coordinateSystemName: systemName,
          collarEastingDm: Number(e.value),
          collarNorthingDm: Number(n.value),
          collarRlDm: rl.trim().startsWith("-")
            ? -Number(rlAbs.value)
            : Number(rlAbs.value),
          calculationNorthReference:
            existing?.calculationNorthReference ?? "GRID",
          referenceConfigurationId: existing?.referenceConfigurationId,
          createdByUserId: "user-local",
          createdByNameSnapshot: "Local operator",
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      onSaved();
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save collar coordinates.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collar-coords-title"
      data-testid="collar-coordinates-dialog"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg space-y-4 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-lg"
      >
        <div>
          <h2 id="collar-coords-title" className="text-lg font-semibold">
            Add collar coordinates
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Easting, Northing and RL are required to calculate the surveyed path
            and target tracking.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Easting (m)</span>
            <input
              value={easting}
              onChange={(event) => setEasting(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Northing (m)</span>
            <input
              value={northing}
              onChange={(event) => setNorthing(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">RL (m)</span>
            <input
              value={rl}
              onChange={(event) => setRl(event.target.value)}
              className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
              required
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Coordinate system</span>
          <input
            value={systemName}
            onChange={(event) => setSystemName(event.target.value)}
            className="w-full rounded-md border border-[var(--tl-border)] px-3 py-2"
          />
        </label>
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
            {busy ? "Saving…" : "Save coordinates"}
          </button>
        </div>
      </form>
    </div>
  );
}
