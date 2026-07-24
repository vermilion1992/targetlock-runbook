/**
 * Deterministic canvas drawing for trajectory graphics.
 * Uses verified view-model coordinates only — no desurvey recalculation.
 */

import {
  findTrackingPointForSurvey,
  projectPointToSection,
  toSceneCoordinates,
  type TrajectoryGraphicViewMode,
  type TrajectoryMarkerPoint,
  type TrajectoryPathPoint,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
  verticalScaleFactor,
  verticalScaleLabel,
} from "@/domain/trajectory-view-model";

import {
  mergeTrajectoryColors,
  TRAJECTORY_LIGHT_COLORS,
  type TrajectoryDrawColors,
} from "./trajectory-visual-theme";

type DrawColors = TrajectoryDrawColors;

export interface TrajectoryCameraState {
  /** Orbit yaw around vertical axis (radians). */
  readonly yaw: number;
  /** Orbit pitch from horizontal (radians). */
  readonly pitch: number;
  /** Distance from scene centre in metres. */
  readonly distance: number;
  /** Pan offset in scene units. */
  readonly panX: number;
  readonly panY: number;
}

export const DEFAULT_TRAJECTORY_CAMERA: TrajectoryCameraState = {
  yaw: Math.PI * 0.25,
  pitch: Math.PI * 0.28,
  distance: 1,
  panX: 0,
  panY: 0,
};

export function initialCameraForModel(
  model: TrajectoryViewModel,
  verticalMode: TrajectoryVerticalScaleMode,
): TrajectoryCameraState {
  const scale = verticalScaleFactor(verticalMode);
  const span = Math.max(
    model.bounds.spanM,
    (model.bounds.maxRlM - model.bounds.minRlM) * scale,
    1,
  );
  return {
    ...DEFAULT_TRAJECTORY_CAMERA,
    distance: span * 2.2,
  };
}

export interface DrawTrajectoryOptions {
  readonly model: TrajectoryViewModel;
  readonly viewMode: TrajectoryGraphicViewMode;
  readonly verticalScaleMode: TrajectoryVerticalScaleMode;
  readonly camera: TrajectoryCameraState;
  readonly selectedSurveyId?: string | null;
  readonly width: number;
  readonly height: number;
  readonly colors?: Partial<DrawColors>;
  readonly showLabels?: boolean;
}

function mergeColors(partial?: Partial<DrawColors>): DrawColors {
  return mergeTrajectoryColors(partial, TRAJECTORY_LIGHT_COLORS);
}

function drawDashedPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  color: string,
  lineWidth: number,
  dash: readonly number[],
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([...dash]);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSolidPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  color: string,
  lineWidth: number,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
}

function markerStyle(
  kind: TrajectoryMarkerPoint["kind"],
  colors: DrawColors,
): { fill: string; radius: number; shape: "circle" | "diamond" | "square" } {
  switch (kind) {
    case "COLLAR":
      return { fill: colors.collar, radius: 5, shape: "square" };
    case "TARGET":
      return { fill: colors.target, radius: 6, shape: "diamond" };
    case "SELECTED_SURVEY":
      return { fill: colors.selected, radius: 7, shape: "circle" };
    case "SURVEY_STATION":
      return { fill: colors.actual, radius: 4, shape: "circle" };
    case "PLANNED_STATION":
      return { fill: colors.planned, radius: 3.5, shape: "circle" };
    case "ENDPOINT":
      return { fill: colors.ink, radius: 5, shape: "square" };
    default:
      return { fill: colors.muted, radius: 3, shape: "circle" };
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: TrajectoryMarkerPoint["kind"],
  colors: DrawColors,
): void {
  const style = markerStyle(kind, colors);
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  if (style.shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x, y - style.radius);
    ctx.lineTo(x + style.radius, y);
    ctx.lineTo(x, y + style.radius);
    ctx.lineTo(x - style.radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (style.shape === "square") {
    ctx.fillRect(
      x - style.radius,
      y - style.radius,
      style.radius * 2,
      style.radius * 2,
    );
    ctx.strokeRect(
      x - style.radius,
      y - style.radius,
      style.radius * 2,
      style.radius * 2,
    );
  } else {
    ctx.beginPath();
    ctx.arc(x, y, style.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function fitPlanMapper(
  model: TrajectoryViewModel,
  width: number,
  height: number,
  padding: number,
) {
  const { bounds } = model;
  const span = Math.max(
    bounds.maxEastingM - bounds.minEastingM,
    bounds.maxNorthingM - bounds.minNorthingM,
    1,
  );
  const usable = Math.min(width, height) - padding * 2;
  const scale = usable / (span * 1.15);
  const cx = width / 2;
  const cy = height / 2;
  return (point: TrajectoryPathPoint) => ({
    x: cx + (point.eastingM - bounds.centerEastingM) * scale,
    y: cy - (point.northingM - bounds.centerNorthingM) * scale,
  });
}

function fitSectionMapper(
  model: TrajectoryViewModel,
  width: number,
  height: number,
  padding: number,
  verticalScale: number,
) {
  const projected = [
    ...model.plannedPath,
    ...model.actualPath,
    ...model.markers,
  ]
    .map((point) => projectPointToSection(point, model))
    .filter((point): point is { sectionM: number; rlM: number } => point !== null);

  if (projected.length === 0) {
    return () => ({ x: width / 2, y: height / 2 });
  }

  let minS = projected[0]!.sectionM;
  let maxS = projected[0]!.sectionM;
  let minRl = projected[0]!.rlM;
  let maxRl = projected[0]!.rlM;
  for (const point of projected) {
    minS = Math.min(minS, point.sectionM);
    maxS = Math.max(maxS, point.sectionM);
    minRl = Math.min(minRl, point.rlM);
    maxRl = Math.max(maxRl, point.rlM);
  }
  const spanS = Math.max(maxS - minS, 1);
  const spanRl = Math.max((maxRl - minRl) * verticalScale, 1);
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const scale = Math.min(usableW / (spanS * 1.15), usableH / (spanRl * 1.15));
  const centerS = (minS + maxS) / 2;
  const centerRl = (minRl + maxRl) / 2;
  return (point: TrajectoryPathPoint) => {
    const section = projectPointToSection(point, model);
    if (!section) return { x: width / 2, y: height / 2 };
    return {
      x: width / 2 + (section.sectionM - centerS) * scale,
      y: height / 2 - (section.rlM - centerRl) * verticalScale * scale,
    };
  };
}

function project3d(
  point: TrajectoryPathPoint,
  model: TrajectoryViewModel,
  camera: TrajectoryCameraState,
  verticalScale: number,
  width: number,
  height: number,
): { x: number; y: number; depth: number } {
  const scene = toSceneCoordinates(point, model.bounds, verticalScale);
  const cosY = Math.cos(camera.yaw);
  const sinY = Math.sin(camera.yaw);
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);

  // Orbit camera looking at origin with pan in screen space after rotation.
  const x1 = scene.x * cosY + scene.z * sinY;
  const z1 = -scene.x * sinY + scene.z * cosY;
  const y1 = scene.y;

  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  const distance = Math.max(camera.distance, 1);
  const focal = Math.min(width, height) * 0.9;
  const depth = z2 + distance;
  const perspective = focal / Math.max(depth, 0.5);
  return {
    x: width / 2 + (x1 + camera.panX) * perspective,
    y: height / 2 - (y2 + camera.panY) * perspective,
    depth,
  };
}

function annotate(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colors: DrawColors,
): void {
  ctx.save();
  ctx.fillStyle = colors.muted;
  ctx.font = "11px sans-serif";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  colors: DrawColors,
  verticalMode: TrajectoryVerticalScaleMode,
  viewMode: TrajectoryGraphicViewMode,
  fieldMode?: boolean,
): void {
  const scaleLabel = verticalScaleLabel(verticalMode);
  const lines = [
    fieldMode
      ? "Collar · Actual = solid · Current direction / Recommended recovery = dashed · Target = diamond"
      : "Planned = dashed · Actual = solid · Target = diamond",
    viewMode === "VIEW_3D"
      ? `3D view · vertical scale ${scaleLabel === "1×" ? "equal" : scaleLabel}`
      : viewMode === "PLAN"
        ? "Plan view · Easting / Northing · North up"
        : "Vertical section · section distance / RL",
  ];
  if (verticalMode !== "EQUAL" && viewMode === "VIEW_3D") {
    lines.push(`VERTICAL SCALE ${scaleLabel} · Geometry visually exaggerated`);
  }
  lines.forEach((line, index) => {
    annotate(ctx, line, 12, 18 + index * 14, colors);
  });
}

function drawPlanDeviationVector(
  ctx: CanvasRenderingContext2D,
  model: TrajectoryViewModel,
  map: (point: TrajectoryPathPoint) => { x: number; y: number },
  colors: DrawColors,
  selectedSurveyId?: string | null,
): void {
  const point =
    (selectedSurveyId
      ? findTrackingPointForSurvey(model, selectedSurveyId)
      : undefined) ?? model.currentTrackingPoint;
  if (!point) return;
  const planned = map({
    eastingM: point.plannedPosition.eastingM,
    northingM: point.plannedPosition.northingM,
    rlM: point.plannedPosition.rlM,
    measuredDepthM: point.measuredDepthM,
  });
  const actual = map({
    eastingM: point.actualPosition.eastingM,
    northingM: point.actualPosition.northingM,
    rlM: point.actualPosition.rlM,
    measuredDepthM: point.measuredDepthM,
  });
  drawSolidPolyline(ctx, [planned, actual], colors.selected, 1.5);
  const midX = (planned.x + actual.x) / 2;
  const midY = (planned.y + actual.y) / 2;
  annotate(
    ctx,
    `${point.horizontalDeviationM.toFixed(1)} m horiz`,
    midX + 6,
    midY - 6,
    colors,
  );
}

function enrichedMarkers(
  model: TrajectoryViewModel,
  selectedSurveyId?: string | null,
): TrajectoryMarkerPoint[] {
  if (!selectedSurveyId) return [...model.markers];
  const tracking = model.trackingPoints.find(
    (point) => point.actualSurveyId === selectedSurveyId,
  );
  if (!tracking) return [...model.markers];
  return [
    ...model.markers,
    {
      eastingM: tracking.actualPosition.eastingM,
      northingM: tracking.actualPosition.northingM,
      rlM: tracking.actualPosition.rlM,
      measuredDepthM: tracking.measuredDepthM,
      kind: "SELECTED_SURVEY",
      label: `Selected ${tracking.measuredDepthM.toFixed(1)} m`,
      sourceId: selectedSurveyId,
    },
  ];
}

function drawTargetRadiusPlan(
  ctx: CanvasRenderingContext2D,
  model: TrajectoryViewModel,
  map: (point: TrajectoryPathPoint) => { x: number; y: number },
  colors: DrawColors,
): void {
  if (!model.target?.radiusM) return;
  const center = map({
    eastingM: model.target.eastingM,
    northingM: model.target.northingM,
    rlM: model.target.rlM,
    measuredDepthM: 0,
  });
  const edge = map({
    eastingM: model.target.eastingM + model.target.radiusM,
    northingM: model.target.northingM,
    rlM: model.target.rlM,
    measuredDepthM: 0,
  });
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
  ctx.save();
  ctx.strokeStyle = colors.target;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTargetRadius3d(
  ctx: CanvasRenderingContext2D,
  model: TrajectoryViewModel,
  camera: TrajectoryCameraState,
  verticalScale: number,
  width: number,
  height: number,
  colors: DrawColors,
): void {
  if (!model.target?.radiusM) return;
  const samples = 48;
  const ring: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    const point = project3d(
      {
        eastingM:
          model.target.eastingM + Math.cos(angle) * model.target.radiusM,
        northingM:
          model.target.northingM + Math.sin(angle) * model.target.radiusM,
        rlM: model.target.rlM,
        measuredDepthM: 0,
      },
      model,
      camera,
      verticalScale,
      width,
      height,
    );
    ring.push({ x: point.x, y: point.y });
  }
  drawDashedPolyline(ctx, ring, colors.target, 1.5, [4, 3]);
}

function drawFieldOverlays(
  ctx: CanvasRenderingContext2D,
  model: TrajectoryViewModel,
  map: (point: TrajectoryPathPoint) => { x: number; y: number },
  colors: DrawColors,
): void {
  if (model.projectedContinuationPath?.length) {
    drawDashedPolyline(
      ctx,
      model.projectedContinuationPath.map(map),
      colors.selected,
      2,
      [4, 4],
    );
  }
  if (model.curvedRecoveryPath?.length) {
    drawDashedPolyline(
      ctx,
      model.curvedRecoveryPath.map(map),
      colors.target,
      2.5,
      [8, 5],
    );
  }
  if (model.directToTargetLine) {
    drawSolidPolyline(
      ctx,
      [map(model.directToTargetLine.from), map(model.directToTargetLine.to)],
      colors.target,
      1.5,
    );
  }
  if (model.missVector) {
    drawDashedPolyline(
      ctx,
      [map(model.missVector.from), map(model.missVector.to)],
      colors.selected,
      1.5,
      [3, 3],
    );
  }
  if (model.closestApproachPoint) {
    const p = map(model.closestApproachPoint);
    ctx.save();
    ctx.fillStyle = colors.selected;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawTrajectoryGraphics(
  ctx: CanvasRenderingContext2D,
  options: DrawTrajectoryOptions,
): void {
  const colors = mergeColors(options.colors);
  const { model, width, height, viewMode, camera } = options;
  const verticalScale = verticalScaleFactor(options.verticalScaleMode);
  const padding = 36;

  ctx.save();
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  if (
    model.plannedPath.length === 0 &&
    model.actualPath.length === 0 &&
    model.markers.length === 0
  ) {
    annotate(ctx, "No trajectory path available.", 16, 32, colors);
    ctx.restore();
    return;
  }

  const markers = enrichedMarkers(model, options.selectedSurveyId);

  if (viewMode === "PLAN") {
    const map = fitPlanMapper(model, width, height, padding);
    // Grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i += 1) {
      const p1 = map({
        eastingM: model.bounds.centerEastingM + (i * model.bounds.spanM) / 4,
        northingM: model.bounds.minNorthingM - model.bounds.spanM * 0.1,
        rlM: model.bounds.centerRlM,
        measuredDepthM: 0,
      });
      const p2 = map({
        eastingM: model.bounds.centerEastingM + (i * model.bounds.spanM) / 4,
        northingM: model.bounds.maxNorthingM + model.bounds.spanM * 0.1,
        rlM: model.bounds.centerRlM,
        measuredDepthM: 0,
      });
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    drawTargetRadiusPlan(ctx, model, map, colors);
    if (!model.fieldMode) {
      drawDashedPolyline(
        ctx,
        model.plannedPath.map(map),
        colors.planned,
        2.5,
        [8, 5],
      );
    }
    drawSolidPolyline(ctx, model.actualPath.map(map), colors.actual, 2.5);
    drawFieldOverlays(ctx, model, map, colors);
    if (!model.fieldMode) {
      drawPlanDeviationVector(
        ctx,
        model,
        map,
        colors,
        options.selectedSurveyId,
      );
    }
    for (const marker of markers) {
      const p = map(marker);
      drawMarker(ctx, p.x, p.y, marker.kind, colors);
    }
    annotate(ctx, "E →", width - 40, height - 14, colors);
    annotate(ctx, "N ↑", 12, 40, colors);
  } else if (viewMode === "VERTICAL_SECTION") {
    if (model.sectionBearingDegrees === null) {
      annotate(ctx, "Vertical section bearing unavailable.", 16, 32, colors);
    } else {
      const map = fitSectionMapper(
        model,
        width,
        height,
        padding,
        verticalScale,
      );
      if (!model.fieldMode) {
        drawDashedPolyline(
          ctx,
          model.plannedPath.map(map),
          colors.planned,
          2.5,
          [8, 5],
        );
      }
      drawSolidPolyline(ctx, model.actualPath.map(map), colors.actual, 2.5);
      drawFieldOverlays(ctx, model, map, colors);
      for (const marker of markers) {
        const p = map(marker);
        drawMarker(ctx, p.x, p.y, marker.kind, colors);
      }
      annotate(
        ctx,
        `SECTION BEARING ${model.sectionBearingDegrees.toFixed(1)}° GRID`,
        12,
        height - 28,
        colors,
      );
      annotate(
        ctx,
        model.sectionBearingSource === "collar-to-target"
          ? "Collar-to-target projection"
          : model.sectionBearingSource,
        12,
        height - 14,
        colors,
      );
    }
  } else {
    // Axes
    const axisLen = model.bounds.spanM * 0.35;
    const origin = {
      eastingM: model.bounds.centerEastingM,
      northingM: model.bounds.centerNorthingM,
      rlM: model.bounds.centerRlM,
      measuredDepthM: 0,
    };
    const axisEnds = [
      {
        label: "E",
        point: {
          ...origin,
          eastingM: origin.eastingM + axisLen,
        },
      },
      {
        label: "N",
        point: {
          ...origin,
          northingM: origin.northingM + axisLen,
        },
      },
      {
        label: "RL",
        point: {
          ...origin,
          rlM: origin.rlM + axisLen / Math.max(verticalScale, 1),
        },
      },
    ];
    for (const axis of axisEnds) {
      const a = project3d(
        origin,
        model,
        camera,
        verticalScale,
        width,
        height,
      );
      const b = project3d(
        axis.point,
        model,
        camera,
        verticalScale,
        width,
        height,
      );
      drawSolidPolyline(ctx, [a, b], colors.grid, 1);
      annotate(ctx, axis.label, b.x + 4, b.y - 4, colors);
    }

    drawTargetRadius3d(
      ctx,
      model,
      camera,
      verticalScale,
      width,
      height,
      colors,
    );

    const planned = model.plannedPath.map((point) =>
      project3d(point, model, camera, verticalScale, width, height),
    );
    const actual = model.actualPath.map((point) =>
      project3d(point, model, camera, verticalScale, width, height),
    );
    if (!model.fieldMode) {
      drawDashedPolyline(ctx, planned, colors.planned, 2.5, [8, 5]);
    }
    drawSolidPolyline(ctx, actual, colors.actual, 2.5);
    drawFieldOverlays(
      ctx,
      model,
      (point) =>
        project3d(point, model, camera, verticalScale, width, height),
      colors,
    );

    const sortedMarkers = markers
      .map((marker) => ({
        marker,
        projected: project3d(
          marker,
          model,
          camera,
          verticalScale,
          width,
          height,
        ),
      }))
      .sort((a, b) => b.projected.depth - a.projected.depth);
    for (const item of sortedMarkers) {
      drawMarker(
        ctx,
        item.projected.x,
        item.projected.y,
        item.marker.kind,
        colors,
      );
      if (options.showLabels && item.marker.kind !== "PLANNED_STATION") {
        annotate(
          ctx,
          item.marker.label,
          item.projected.x + 8,
          item.projected.y - 8,
          colors,
        );
      }
    }
  }

  drawLegend(
    ctx,
    colors,
    options.verticalScaleMode,
    viewMode,
    model.fieldMode,
  );
  ctx.restore();
}

export function hitTestSurveyStation(
  model: TrajectoryViewModel,
  options: Omit<DrawTrajectoryOptions, "model"> & {
    readonly clientX: number;
    readonly clientY: number;
  },
): string | null {
  const verticalScale = verticalScaleFactor(options.verticalScaleMode);
  const padding = 36;
  let mapper: (point: TrajectoryPathPoint) => { x: number; y: number };

  if (options.viewMode === "PLAN") {
    mapper = fitPlanMapper(model, options.width, options.height, padding);
  } else if (options.viewMode === "VERTICAL_SECTION") {
    mapper = fitSectionMapper(
      model,
      options.width,
      options.height,
      padding,
      verticalScale,
    );
  } else {
    mapper = (point) =>
      project3d(
        point,
        model,
        options.camera,
        verticalScale,
        options.width,
        options.height,
      );
  }

  let bestId: string | null = null;
  let bestDistance = 16;
  for (const marker of model.markers) {
    if (marker.kind !== "SURVEY_STATION" || !marker.sourceId) continue;
    const p = mapper(marker);
    const distance = Math.hypot(p.x - options.clientX, p.y - options.clientY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = marker.sourceId;
    }
  }
  return bestId;
}
