"use client";

import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import type { HoleTrajectoryComparison } from "@/domain";

import { TrajectoryCockpit } from "./trajectory-cockpit";

export function TrajectoryDashboard({ holeId }: { holeId: string }) {
  const [comparison, setComparison] = useState<HoleTrajectoryComparison | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (active) {
          setMessage("Browser storage is unavailable.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
    void services.trajectoryComparison
      .getComparison(holeId)
      .then((next) => {
        if (!active) return;
        setComparison(next);
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load trajectory comparison.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [holeId]);

  function exportTrackingCsv() {
    if (!comparison) return;
    const headers = [
      "MD_m",
      "Planned_E",
      "Actual_E",
      "Delta_E",
      "Planned_N",
      "Actual_N",
      "Delta_N",
      "Planned_RL",
      "Actual_RL",
      "Delta_RL",
      "Horizontal_m",
      "Spatial_m",
      "Planned_dip",
      "Actual_dip",
      "Dip_diff",
      "Planned_az",
      "Actual_az",
      "Az_diff",
      "Status",
    ];
    const rows = comparison.trackingPoints.map((point) =>
      [
        point.measuredDepthM.toFixed(1),
        point.plannedPosition.eastingM.toFixed(1),
        point.actualPosition.eastingM.toFixed(1),
        point.deltaEastingM.toFixed(1),
        point.plannedPosition.northingM.toFixed(1),
        point.actualPosition.northingM.toFixed(1),
        point.deltaNorthingM.toFixed(1),
        point.plannedPosition.rlM.toFixed(1),
        point.actualPosition.rlM.toFixed(1),
        point.deltaRlM.toFixed(1),
        point.horizontalDeviationM.toFixed(1),
        point.spatialDeviationM.toFixed(1),
        point.plannedDipDegrees.toFixed(1),
        point.actualDipDegrees.toFixed(1),
        point.dipDifferenceDegrees.toFixed(1),
        point.plannedAzimuthDegrees.toFixed(1),
        point.actualAzimuthDegrees.toFixed(1),
        point.circularAzimuthDifferenceDegrees.toFixed(1),
        point.status,
      ].join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${holeId}-trajectory-tracking.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4" data-testid="trajectory-dashboard">
      {loading ? <p className="text-sm">Loading trajectory…</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-[var(--tl-danger, #b91c1c)]">
          {message}
        </p>
      ) : null}

      {comparison ? (
        <TrajectoryCockpit
          holeId={holeId}
          comparison={comparison}
          onExportCsv={exportTrackingCsv}
        />
      ) : null}
    </div>
  );
}
