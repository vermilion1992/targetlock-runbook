"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterTrajectoryViewModelByInterval,
  TRAJECTORY_GRAPHICS_DISCLAIMER,
  verticalScaleLabel,
  type HoleTrajectoryComparison,
  type TrajectoryDepthIntervalMode,
  type TrajectoryGraphicViewMode,
  type TrajectoryTrackingPoint,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
} from "@/domain";
import {
  DEFAULT_TRAJECTORY_CAMERA,
  drawTrajectoryGraphics,
  exportTrajectoryPng,
  hitTestSurveyStation,
  initialCameraForModel,
  resolveTrajectoryCanvasColors,
  type TrajectoryCameraState,
} from "@/infrastructure/trajectory";

import {
  TrajectoryAzimuthTrend,
  TrajectoryDeviationTrend,
  TrajectoryDipTrend,
} from "./trajectory-charts";

export type TrajectoryWorkspaceTab =
  | "VIEW_3D"
  | "PLAN"
  | "VERTICAL_SECTION"
  | "DEVIATION"
  | "DIP"
  | "AZIMUTH";

function detectMobileFallback(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

function defaultTabForDevice(): TrajectoryWorkspaceTab {
  return detectMobileFallback() ? "PLAN" : "VIEW_3D";
}

function cameraSeedFor(
  model: TrajectoryViewModel,
  verticalScaleMode: TrajectoryVerticalScaleMode,
): string {
  return [
    model.holeId,
    model.bounds.spanM.toFixed(3),
    verticalScaleMode,
    model.plannedPath.length,
    model.actualPath.length,
  ].join(":");
}

const INTERVAL_OPTIONS: {
  id: TrajectoryDepthIntervalMode;
  label: string;
}[] = [
  { id: "FULL_HOLE", label: "Full Hole" },
  { id: "LATEST_100", label: "Latest 100 m" },
  { id: "LATEST_50", label: "Latest 50 m" },
  { id: "SELECTED_INTERVAL", label: "Selected interval" },
];

const SCALE_OPTIONS: {
  id: TrajectoryVerticalScaleMode;
  label: string;
}[] = [
  { id: "EQUAL", label: "Real scale" },
  { id: "X2", label: "2×" },
  { id: "EXAGGERATED", label: "3×" },
];

export function TrajectoryWorkspace({
  model,
  comparison,
  selectedSurveyId,
  selectedPoint,
  crossSectionOffsetM,
  onSelectSurveyId,
}: {
  model: TrajectoryViewModel;
  comparison: HoleTrajectoryComparison;
  selectedSurveyId: string | null;
  selectedPoint?: TrajectoryTrackingPoint | null;
  crossSectionOffsetM?: number | null;
  onSelectSurveyId: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMobileFallback] = useState(detectMobileFallback);
  const [tab, setTab] = useState<TrajectoryWorkspaceTab>(defaultTabForDevice);
  const [verticalScaleMode, setVerticalScaleMode] =
    useState<TrajectoryVerticalScaleMode>("EQUAL");
  const [depthInterval, setDepthInterval] =
    useState<TrajectoryDepthIntervalMode>("FULL_HOLE");
  const [camera, setCamera] = useState<TrajectoryCameraState>(() =>
    initialCameraForModel(model, "EQUAL"),
  );
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const cameraSeedRef = useRef(cameraSeedFor(model, "EQUAL"));
  const dragRef = useRef<{
    mode: "orbit" | "pan" | null;
    lastX: number;
    lastY: number;
  }>({ mode: null, lastX: 0, lastY: 0 });

  const filteredModel = useMemo(
    () =>
      filterTrajectoryViewModelByInterval(
        model,
        depthInterval,
        selectedPoint?.measuredDepthM,
      ),
    [model, depthInterval, selectedPoint?.measuredDepthM],
  );

  useEffect(() => {
    const nextSeed = cameraSeedFor(filteredModel, verticalScaleMode);
    if (nextSeed === cameraSeedRef.current) return;
    cameraSeedRef.current = nextSeed;
    setCamera(initialCameraForModel(filteredModel, verticalScaleMode));
  }, [filteredModel, verticalScaleMode]);

  const canvasMode: TrajectoryGraphicViewMode | null =
    tab === "VIEW_3D" || tab === "PLAN" || tab === "VERTICAL_SECTION"
      ? tab
      : null;

  useEffect(() => {
    if (!canvasMode) return;
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
      model: filteredModel,
      viewMode: canvasMode,
      verticalScaleMode,
      camera,
      selectedSurveyId,
      width,
      height,
      showLabels: true,
      colors: resolveTrajectoryCanvasColors(canvas),
    });
  }, [
    filteredModel,
    canvasMode,
    verticalScaleMode,
    camera,
    selectedSurveyId,
  ]);

  function resetCamera() {
    setCamera(initialCameraForModel(filteredModel, verticalScaleMode));
  }

  function fitCamera() {
    setCamera(initialCameraForModel(filteredModel, verticalScaleMode));
  }

  async function handleExport() {
    if (!canvasMode) {
      setExportMessage("Switch to 3D, Plan or Section to export PNG.");
      return;
    }
    try {
      const blob = await exportTrajectoryPng({
        model: filteredModel,
        viewMode: canvasMode,
        verticalScaleMode,
        camera: canvasMode === "VIEW_3D" ? camera : DEFAULT_TRAJECTORY_CAMERA,
        selectedSurveyId,
        colors: resolveTrajectoryCanvasColors(canvasRef.current),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${model.holeId}-trajectory-${canvasMode.toLowerCase()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportMessage(
        `Exported ${canvasMode.replaceAll("_", " ").toLowerCase()} PNG.`,
      );
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "PNG export failed.",
      );
    }
  }

  const tabs: { id: TrajectoryWorkspaceTab; label: string; testId: string }[] =
    [
      { id: "VIEW_3D", label: "3D", testId: "trajectory-view-view_3d" },
      { id: "PLAN", label: "Plan", testId: "trajectory-view-plan" },
      {
        id: "VERTICAL_SECTION",
        label: "Section",
        testId: "trajectory-view-vertical_section",
      },
      {
        id: "DEVIATION",
        label: "Deviation",
        testId: "trajectory-view-deviation",
      },
      { id: "DIP", label: "Dip", testId: "trajectory-view-dip" },
      { id: "AZIMUTH", label: "Azimuth", testId: "trajectory-view-azimuth" },
    ];

  return (
    <section
      className="flex min-h-0 flex-col rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]"
      data-testid="trajectory-graphics-viewer"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--tl-border)] px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] px-3 text-sm font-semibold ${
                tab === item.id
                  ? "bg-[var(--tl-primary)] text-white"
                  : "border border-[var(--tl-border)]"
              }`}
              aria-pressed={tab === item.id}
              data-testid={item.testId}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
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
          className="mx-3 mt-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] px-3 py-2 text-sm"
          data-testid="trajectory-mobile-fallback"
        >
          Phone / tablet: Plan view opens by default. 3D remains available.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 px-3 py-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 text-sm font-semibold"
          onClick={fitCamera}
        >
          Fit
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 text-sm font-semibold"
          data-testid="trajectory-camera-reset"
          onClick={resetCamera}
        >
          Reset
        </button>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <span className="text-[var(--tl-ink-muted)]">Interval</span>
          <select
            className="min-h-11 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-transparent px-2"
            value={depthInterval}
            onChange={(event) =>
              setDepthInterval(event.target.value as TrajectoryDepthIntervalMode)
            }
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <span className="text-[var(--tl-ink-muted)]">Scale</span>
          <select
            className="min-h-11 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-transparent px-2"
            value={verticalScaleMode}
            data-testid="trajectory-vertical-scale-toggle"
            onChange={(event) =>
              setVerticalScaleMode(
                event.target.value as TrajectoryVerticalScaleMode,
              )
            }
          >
            {SCALE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3 text-sm font-semibold"
          data-testid="trajectory-export-png"
          onClick={() => void handleExport()}
        >
          Export PNG
        </button>
      </div>

      {verticalScaleMode !== "EQUAL" && tab === "VIEW_3D" ? (
        <p className="mx-3 mb-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)]/40 bg-[var(--tl-warning-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--tl-warning)]">
          Vertical scale {verticalScaleLabel(verticalScaleMode)} · Geometry
          visually exaggerated
        </p>
      ) : null}

      {exportMessage ? (
        <p className="px-3 text-sm" data-testid="trajectory-export-message">
          {exportMessage}
        </p>
      ) : null}

      {canvasMode ? (
        <div
          className="relative mx-3 mb-3 h-[min(70vh,24rem)] w-auto overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] md:h-[min(70vh,28rem)]"
          data-testid={
            canvasMode === "PLAN"
              ? "trajectory-plan-view"
              : canvasMode === "VERTICAL_SECTION"
                ? "trajectory-vertical-section"
                : "trajectory-canvas-frame"
          }
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
              const hit = hitTestSurveyStation(filteredModel, {
                viewMode: canvasMode,
                verticalScaleMode,
                camera,
                width: rect.width,
                height: rect.height,
                clientX: event.clientX - rect.left,
                clientY: event.clientY - rect.top,
              });
              if (hit) onSelectSurveyId(hit);
            }}
            onPointerMove={(event) => {
              if (!dragRef.current.mode) return;
              const dx = event.clientX - dragRef.current.lastX;
              const dy = event.clientY - dragRef.current.lastY;
              dragRef.current.lastX = event.clientX;
              dragRef.current.lastY = event.clientY;
              if (canvasMode !== "VIEW_3D") {
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
                  filteredModel.bounds.spanM * 0.4,
                  Math.min(
                    filteredModel.bounds.spanM * 8,
                    current.distance * (event.deltaY > 0 ? 1.08 : 0.92),
                  ),
                ),
              }));
            }}
          />
          {canvasMode === "PLAN" ? (
            <p className="absolute bottom-2 left-2 max-w-[90%] rounded bg-[var(--tl-surface)]/90 px-2 py-1 text-xs text-[var(--tl-ink-muted)]">
              Plan view — equal-scale Easting / Northing. North up.
            </p>
          ) : null}
          {canvasMode === "VERTICAL_SECTION" &&
          crossSectionOffsetM !== undefined &&
          crossSectionOffsetM !== null ? (
            <p className="absolute bottom-2 left-2 rounded bg-[var(--tl-surface)]/90 px-2 py-1 text-xs tabular-nums">
              Cross-section offset{" "}
              {Math.abs(crossSectionOffsetM).toFixed(1)} m
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-3 pb-3">
          {tab === "DEVIATION" ? (
            <TrajectoryDeviationTrend
              comparison={comparison}
              selectedPoint={selectedPoint}
            />
          ) : null}
          {tab === "DIP" ? (
            <TrajectoryDipTrend
              comparison={comparison}
              selectedPoint={selectedPoint}
            />
          ) : null}
          {tab === "AZIMUTH" ? (
            <TrajectoryAzimuthTrend
              comparison={comparison}
              selectedPoint={selectedPoint}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
