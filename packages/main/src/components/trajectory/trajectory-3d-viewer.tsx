"use client";

import { useEffect, useRef, useState } from "react";

import {
  TRAJECTORY_GRAPHICS_DISCLAIMER,
  type TrajectoryGraphicViewMode,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
  findTrackingPointForSurvey,
} from "@/domain";
import {
  DEFAULT_TRAJECTORY_CAMERA,
  drawTrajectoryGraphics,
  hitTestSurveyStation,
  initialCameraForModel,
  type TrajectoryCameraState,
} from "@/infrastructure/trajectory/trajectory-canvas-draw";
import { exportTrajectoryPng } from "@/infrastructure/trajectory/trajectory-png-export";

import {
  formatCoordinate,
  formatDegrees,
  formatMetresValue,
  formatSignedMetres,
} from "./trajectory-format";

function detectMobileFallback(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768
  );
}

function defaultViewForDevice(): TrajectoryGraphicViewMode {
  return detectMobileFallback() ? "PLAN" : "VIEW_3D";
}

function cameraSeedFor(
  model: TrajectoryViewModel,
  verticalScaleMode: TrajectoryVerticalScaleMode,
): string {
  return [
    model.holeId,
    model.engineVersion,
    model.plannedPath.length,
    model.actualPath.length,
    model.bounds.spanM.toFixed(3),
    verticalScaleMode,
  ].join(":");
}

export function TrajectoryGraphicsViewer({
  model,
}: {
  model: TrajectoryViewModel;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMobileFallback] = useState(detectMobileFallback);
  const [viewMode, setViewMode] = useState<TrajectoryGraphicViewMode>(
    defaultViewForDevice,
  );
  const [verticalScaleMode, setVerticalScaleMode] =
    useState<TrajectoryVerticalScaleMode>("EQUAL");
  const [cameraSeed, setCameraSeed] = useState(() =>
    cameraSeedFor(model, "EQUAL"),
  );
  const [camera, setCamera] = useState<TrajectoryCameraState>(() =>
    initialCameraForModel(model, "EQUAL"),
  );
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(
    model.currentTrackingPoint?.actualSurveyId ?? null,
  );
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const dragRef = useRef<{
    mode: "orbit" | "pan" | null;
    lastX: number;
    lastY: number;
  }>({ mode: null, lastX: 0, lastY: 0 });

  const nextCameraSeed = cameraSeedFor(model, verticalScaleMode);
  if (nextCameraSeed !== cameraSeed) {
    setCameraSeed(nextCameraSeed);
    setCamera(initialCameraForModel(model, verticalScaleMode));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    drawTrajectoryGraphics(ctx, {
      model,
      viewMode,
      verticalScaleMode,
      camera,
      selectedSurveyId,
      width,
      height,
      showLabels: true,
    });
  }, [model, viewMode, verticalScaleMode, camera, selectedSurveyId]);

  function resetCamera() {
    setCamera(initialCameraForModel(model, verticalScaleMode));
  }

  async function handleExport(mode: TrajectoryGraphicViewMode) {
    try {
      const blob = await exportTrajectoryPng({
        model,
        viewMode: mode,
        verticalScaleMode,
        camera: mode === "VIEW_3D" ? camera : DEFAULT_TRAJECTORY_CAMERA,
        selectedSurveyId,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${model.holeId}-trajectory-${mode.toLowerCase()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportMessage(`Exported ${mode.replaceAll("_", " ").toLowerCase()} PNG.`);
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "PNG export failed.",
      );
    }
  }

  const selectedTracking = selectedSurveyId
    ? findTrackingPointForSurvey(model, selectedSurveyId)
    : model.currentTrackingPoint;

  return (
    <section
      className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
      data-testid="trajectory-graphics-viewer"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Interactive trajectory graphics</h2>
          <p className="text-sm text-[var(--tl-ink-muted)]">
            Plan, vertical section and 3D views share the same verified
            coordinates from engine {model.engineVersion}.
          </p>
        </div>
        <p
          className="max-w-md text-xs text-[var(--tl-ink-muted)]"
          data-testid="trajectory-graphics-disclaimer"
        >
          {TRAJECTORY_GRAPHICS_DISCLAIMER}
        </p>
      </div>

      {isMobileFallback ? (
        <p
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-bg)] px-3 py-2 text-sm"
          data-testid="trajectory-mobile-fallback"
        >
          Phone / tablet fallback: plan and vertical-section views open by
          default. 3D remains available with touch rotate, pan and pinch-zoom.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["VIEW_3D", "3D"],
            ["PLAN", "Plan"],
            ["VERTICAL_SECTION", "Section"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border px-4 font-semibold ${
              viewMode === mode
                ? "border-[var(--tl-primary)] bg-[var(--tl-primary)] text-white"
                : "border-[var(--tl-border)]"
            }`}
            aria-pressed={viewMode === mode}
            data-testid={`trajectory-view-${mode.toLowerCase()}`}
            onClick={() => setViewMode(mode)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          data-testid="trajectory-vertical-scale-toggle"
          onClick={() =>
            setVerticalScaleMode((current) =>
              current === "EQUAL" ? "EXAGGERATED" : "EQUAL",
            )
          }
        >
          Vertical: {verticalScaleMode === "EQUAL" ? "Equal" : "Exaggerated 3×"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          data-testid="trajectory-camera-reset"
          onClick={resetCamera}
        >
          Reset view
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          data-testid="trajectory-export-png"
          onClick={() => void handleExport(viewMode)}
        >
          Export PNG
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          onClick={() => void handleExport("PLAN")}
        >
          Export plan PNG
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          onClick={() => void handleExport("VERTICAL_SECTION")}
        >
          Export section PNG
        </button>
      </div>
      {exportMessage ? (
        <p className="text-sm" data-testid="trajectory-export-message">
          {exportMessage}
        </p>
      ) : null}

      <p className="text-sm text-[var(--tl-ink-muted)]">
        Controls: drag to rotate (3D), Shift-drag to pan, wheel to zoom. Tap a
        Survey marker to inspect same-depth deviation.
      </p>

      <div
        className="relative h-[min(70vh,28rem)] w-full overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)]"
        data-testid="trajectory-canvas-frame"
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          data-testid="trajectory-canvas"
          onPointerDown={(event) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.setPointerCapture(event.pointerId);
            dragRef.current = {
              mode: event.shiftKey || event.button === 1 ? "pan" : "orbit",
              lastX: event.clientX,
              lastY: event.clientY,
            };
            const rect = canvas.getBoundingClientRect();
            const hit = hitTestSurveyStation(model, {
              viewMode,
              verticalScaleMode,
              camera,
              width: rect.width,
              height: rect.height,
              clientX: event.clientX - rect.left,
              clientY: event.clientY - rect.top,
            });
            if (hit) setSelectedSurveyId(hit);
          }}
          onPointerMove={(event) => {
            if (!dragRef.current.mode) return;
            const dx = event.clientX - dragRef.current.lastX;
            const dy = event.clientY - dragRef.current.lastY;
            dragRef.current.lastX = event.clientX;
            dragRef.current.lastY = event.clientY;
            if (viewMode !== "VIEW_3D") {
              if (dragRef.current.mode === "pan") {
                setCamera((current) => ({
                  ...current,
                  panX: current.panX + dx * 0.2,
                  panY: current.panY - dy * 0.2,
                }));
              }
              return;
            }
            if (dragRef.current.mode === "pan") {
              setCamera((current) => ({
                ...current,
                panX: current.panX + dx * (current.distance / 400),
                panY: current.panY - dy * (current.distance / 400),
              }));
              return;
            }
            setCamera((current) => ({
              ...current,
              yaw: current.yaw + dx * 0.01,
              pitch: Math.max(
                0.05,
                Math.min(Math.PI / 2 - 0.05, current.pitch + dy * 0.01),
              ),
            }));
          }}
          onPointerUp={(event) => {
            dragRef.current.mode = null;
            canvasRef.current?.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            event.preventDefault();
            setCamera((current) => ({
              ...current,
              distance: Math.max(
                model.bounds.spanM * 0.4,
                Math.min(
                  model.bounds.spanM * 8,
                  current.distance * (event.deltaY > 0 ? 1.08 : 0.92),
                ),
              ),
            }));
          }}
        />
      </div>

      <div
        className="space-y-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-bg)] p-3"
        data-testid="trajectory-inspection-callout"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold" htmlFor="survey-inspect">
            Inspect Survey
          </label>
          <select
            id="survey-inspect"
            className="min-h-11 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-transparent px-3"
            value={selectedSurveyId ?? ""}
            onChange={(event) =>
              setSelectedSurveyId(event.target.value || null)
            }
          >
            <option value="">Current tracking</option>
            {model.trackingPoints.map((point) => (
              <option key={point.actualSurveyId} value={point.actualSurveyId}>
                {point.measuredDepthM.toFixed(1)} m · {point.status}
              </option>
            ))}
          </select>
        </div>
        {selectedTracking ? (
          <div className="space-y-1 text-sm">
            <p>
              Selected MD {formatMetresValue(selectedTracking.measuredDepthM)} ·{" "}
              {selectedTracking.status}
            </p>
            <p>
              Planned E {formatCoordinate(selectedTracking.plannedPosition.eastingM)},
              N {formatCoordinate(selectedTracking.plannedPosition.northingM)},
              RL {formatCoordinate(selectedTracking.plannedPosition.rlM)}
            </p>
            <p>
              Actual E {formatCoordinate(selectedTracking.actualPosition.eastingM)},
              N {formatCoordinate(selectedTracking.actualPosition.northingM)},
              RL {formatCoordinate(selectedTracking.actualPosition.rlM)}
            </p>
            <p>
              Same-depth deviation — ΔE{" "}
              {formatSignedMetres(selectedTracking.deltaEastingM)}, ΔN{" "}
              {formatSignedMetres(selectedTracking.deltaNorthingM)}, ΔRL{" "}
              {formatSignedMetres(selectedTracking.deltaRlM)}, 3D{" "}
              {formatMetresValue(selectedTracking.spatialDeviationM)}
            </p>
            <p>
              Dip {formatDegrees(selectedTracking.actualDipDegrees)} (plan{" "}
              {formatDegrees(selectedTracking.plannedDipDegrees)}); Azimuth{" "}
              {formatDegrees(selectedTracking.actualAzimuthDegrees)} (plan{" "}
              {formatDegrees(selectedTracking.plannedAzimuthDegrees)})
            </p>
          </div>
        ) : (
          <p className="text-sm">No Survey tracking point available.</p>
        )}
        {model.currentTrackingPoint ? (
          <p
            className="text-sm font-medium"
            data-testid="trajectory-current-tracking-callout"
          >
            Current tracking at{" "}
            {formatMetresValue(model.currentTrackingPoint.measuredDepthM)}: 3D
            deviation{" "}
            {formatMetresValue(model.currentTrackingPoint.spatialDeviationM)} (
            {model.currentTrackingPoint.status})
          </p>
        ) : null}
      </div>
    </section>
  );
}
