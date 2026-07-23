/**
 * Deterministic PDF trajectory graphics drawn with pdf-lib primitives.
 * Uses verified report path coordinates only — no desurvey recalculation.
 */

import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  EXAGGERATED_VERTICAL_SCALE,
  TRAJECTORY_GRAPHICS_DISCLAIMER,
  projectPointToSection,
  toSceneCoordinates,
  type TrajectoryPathPoint,
  type TrajectoryViewModel,
} from "@/domain/trajectory-view-model";

const PLANNED = rgb(0.35, 0.33, 0.31);
const ACTUAL = rgb(0.06, 0.46, 0.43);
const TARGET = rgb(0.71, 0.33, 0.04);
const GRID = rgb(0.78, 0.76, 0.73);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);

function drawPolyline(
  page: PDFPage,
  points: readonly { x: number; y: number }[],
  color: ReturnType<typeof rgb>,
  thickness: number,
  dashed: boolean,
): void {
  if (points.length < 2) return;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (dashed && i % 2 === 0) continue;
    page.drawLine({
      start: { x: from.x, y: from.y },
      end: { x: to.x, y: to.y },
      thickness,
      color,
    });
  }
}

function drawCircle(
  page: PDFPage,
  x: number,
  y: number,
  radius: number,
  color: ReturnType<typeof rgb>,
): void {
  page.drawCircle({
    x,
    y,
    size: radius,
    borderColor: color,
    borderWidth: 1,
    color: undefined,
  });
}

function fitPlan(
  model: TrajectoryViewModel,
  box: { x: number; y: number; width: number; height: number },
) {
  const span = Math.max(model.bounds.spanM, 1);
  const scale =
    Math.min(box.width, box.height) / (span * 1.2);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (point: TrajectoryPathPoint) => ({
    x: cx + (point.eastingM - model.bounds.centerEastingM) * scale,
    y: cy + (point.northingM - model.bounds.centerNorthingM) * scale,
  });
}

function fitSection(
  model: TrajectoryViewModel,
  box: { x: number; y: number; width: number; height: number },
) {
  const projected = [...model.plannedPath, ...model.actualPath, ...model.markers]
    .map((point) => projectPointToSection(point, model))
    .filter((point): point is { sectionM: number; rlM: number } => point !== null);
  if (projected.length === 0) {
    return () => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
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
  const spanRl = Math.max(maxRl - minRl, 1);
  const scale = Math.min(box.width / (spanS * 1.2), box.height / (spanRl * 1.2));
  const centerS = (minS + maxS) / 2;
  const centerRl = (minRl + maxRl) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (point: TrajectoryPathPoint) => {
    const section = projectPointToSection(point, model);
    if (!section) return { x: cx, y: cy };
    return {
      x: cx + (section.sectionM - centerS) * scale,
      y: cy + (section.rlM - centerRl) * scale,
    };
  };
}

function fitIsometric(
  model: TrajectoryViewModel,
  box: { x: number; y: number; width: number; height: number },
) {
  const yaw = Math.PI * 0.25;
  const pitch = Math.PI * 0.28;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const projected = [...model.plannedPath, ...model.actualPath, ...model.markers].map(
    (point) => {
      const scene = toSceneCoordinates(point, model.bounds, 1);
      const x1 = scene.x * cosY + scene.z * sinY;
      const z1 = -scene.x * sinY + scene.z * cosY;
      const y2 = scene.y * cosP - z1 * sinP;
      return { x: x1, y: y2 };
    },
  );
  if (projected.length === 0) {
    return () => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  let minX = projected[0]!.x;
  let maxX = projected[0]!.x;
  let minY = projected[0]!.y;
  let maxY = projected[0]!.y;
  for (const point of projected) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(box.width / (spanX * 1.2), box.height / (spanY * 1.2));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return (point: TrajectoryPathPoint) => {
    const scene = toSceneCoordinates(point, model.bounds, 1);
    const x1 = scene.x * cosY + scene.z * sinY;
    const z1 = -scene.x * sinY + scene.z * cosY;
    const y2 = scene.y * cosP - z1 * sinP;
    return {
      x: cx + (x1 - centerX) * scale,
      y: cy + (y2 - centerY) * scale,
    };
  };
}

function drawPanelFrame(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  title: string,
  font: PDFFont,
): void {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    borderColor: GRID,
    borderWidth: 1,
  });
  page.drawText(title, {
    x: box.x + 4,
    y: box.y + box.height - 12,
    size: 8,
    font,
    color: INK,
  });
}

function drawPaths(
  page: PDFPage,
  model: TrajectoryViewModel,
  map: (point: TrajectoryPathPoint) => { x: number; y: number },
): void {
  drawPolyline(page, model.plannedPath.map(map), PLANNED, 1.2, true);
  drawPolyline(page, model.actualPath.map(map), ACTUAL, 1.4, false);
  for (const marker of model.markers) {
    const p = map(marker);
    if (marker.kind === "TARGET") {
      page.drawRectangle({
        x: p.x - 3,
        y: p.y - 3,
        width: 6,
        height: 6,
        color: TARGET,
      });
      if (model.target?.radiusM) {
        const edge = map({
          eastingM: model.target.eastingM + model.target.radiusM,
          northingM: model.target.northingM,
          rlM: model.target.rlM,
          measuredDepthM: 0,
        });
        const radius = Math.hypot(edge.x - p.x, edge.y - p.y);
        drawCircle(page, p.x, p.y, Math.max(radius, 2), TARGET);
      }
    } else if (marker.kind === "COLLAR") {
      page.drawRectangle({
        x: p.x - 2.5,
        y: p.y - 2.5,
        width: 5,
        height: 5,
        borderColor: INK,
        borderWidth: 1,
      });
    } else if (marker.kind === "SURVEY_STATION") {
      drawCircle(page, p.x, p.y, 2, ACTUAL);
    } else if (marker.kind === "PLANNED_STATION") {
      drawCircle(page, p.x, p.y, 1.5, PLANNED);
    }
  }
}

export function drawTrajectoryGraphicsOnPdfPage(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly model: TrajectoryViewModel;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): number {
  const { page, font, bold, model } = input;
  let cursorY = input.y;

  page.drawText("Trajectory graphics", {
    x: input.x,
    y: cursorY,
    size: 11,
    font: bold,
    color: INK,
  });
  cursorY -= 14;

  page.drawText(
    `Engine ${model.engineVersion} · Planned dashed · Actual solid · equal vertical scale`,
    {
      x: input.x,
      y: cursorY,
      size: 8,
      font,
      color: MUTED,
    },
  );
  cursorY -= 10;

  page.drawText(TRAJECTORY_GRAPHICS_DISCLAIMER, {
    x: input.x,
    y: cursorY,
    size: 7,
    font,
    color: MUTED,
  });
  cursorY -= 16;

  const panelHeight = Math.min(150, (input.height - (input.y - cursorY) - 8) / 1);
  const gap = 8;
  const panelWidth = (input.width - gap * 2) / 3;

  const panels = [
    {
      title: "Plan view",
      box: {
        x: input.x,
        y: cursorY - panelHeight,
        width: panelWidth,
        height: panelHeight,
      },
      mapper: fitPlan,
    },
    {
      title: "Vertical section",
      box: {
        x: input.x + panelWidth + gap,
        y: cursorY - panelHeight,
        width: panelWidth,
        height: panelHeight,
      },
      mapper: fitSection,
    },
    {
      title: "3D view",
      box: {
        x: input.x + (panelWidth + gap) * 2,
        y: cursorY - panelHeight,
        width: panelWidth,
        height: panelHeight,
      },
      mapper: fitIsometric,
    },
  ] as const;

  for (const panel of panels) {
    drawPanelFrame(page, panel.box, panel.title, font);
    const inner = {
      x: panel.box.x + 6,
      y: panel.box.y + 6,
      width: panel.box.width - 12,
      height: panel.box.height - 22,
    };
    if (
      panel.title === "Vertical section" &&
      model.sectionBearingDegrees === null
    ) {
      page.drawText("Bearing unavailable", {
        x: inner.x + 4,
        y: inner.y + inner.height / 2,
        size: 7,
        font,
        color: MUTED,
      });
      continue;
    }
    const map = panel.mapper(model, inner);
    drawPaths(page, model, map);
  }

  cursorY -= panelHeight + 8;
  page.drawText(
    `Vertical exaggeration available in interactive UI (${EXAGGERATED_VERTICAL_SCALE}x). PDF panels use equal scale.`,
    {
      x: input.x,
      y: cursorY,
      size: 7,
      font,
      color: MUTED,
    },
  );
  return cursorY - 12;
}

/**
 * Build a report-oriented view-model from stored trajectory summary path arrays.
 * Coordinates must already be Implementation 5 outputs.
 */
export function buildReportTrajectoryViewModel(input: {
  readonly holeId: string;
  readonly engineVersion: string;
  readonly activePlanName?: string;
  readonly plannedPath: readonly TrajectoryPathPoint[];
  readonly actualPath: readonly TrajectoryPathPoint[];
  readonly plannedStations: readonly TrajectoryPathPoint[];
  readonly actualStations: readonly TrajectoryPathPoint[];
  readonly target?: {
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly radiusM?: number;
  };
  readonly sectionBearingDegrees?: number | null;
}): TrajectoryViewModel {
  const collar = input.plannedPath[0] ?? input.actualPath[0];
  const markers = [
    ...(collar
      ? [
          {
            ...collar,
            kind: "COLLAR" as const,
            label: "Collar",
          },
        ]
      : []),
    ...input.plannedStations.slice(1).map((station) => ({
      ...station,
      kind: "PLANNED_STATION" as const,
      label: `Plan ${station.measuredDepthM.toFixed(1)} m`,
    })),
    ...input.actualStations
      .filter((station) => station.measuredDepthM > 0)
      .map((station) => ({
        ...station,
        kind: "SURVEY_STATION" as const,
        label: `Survey ${station.measuredDepthM.toFixed(1)} m`,
      })),
    ...(input.target
      ? [
          {
            eastingM: input.target.eastingM,
            northingM: input.target.northingM,
            rlM: input.target.rlM,
            measuredDepthM: 0,
            kind: "TARGET" as const,
            label: "Target",
          },
        ]
      : []),
  ];

  const all = [...input.plannedPath, ...input.actualPath, ...markers];
  let minE = 0;
  let maxE = 1;
  let minN = 0;
  let maxN = 1;
  let minRl = 0;
  let maxRl = 1;
  if (all.length > 0) {
    minE = Math.min(...all.map((p) => p.eastingM));
    maxE = Math.max(...all.map((p) => p.eastingM));
    minN = Math.min(...all.map((p) => p.northingM));
    maxN = Math.max(...all.map((p) => p.northingM));
    minRl = Math.min(...all.map((p) => p.rlM));
    maxRl = Math.max(...all.map((p) => p.rlM));
  }
  const span = Math.max(maxE - minE, maxN - minN, maxRl - minRl, 1);

  return {
    holeId: input.holeId,
    engineVersion: input.engineVersion,
    plannedPath: input.plannedPath,
    actualPath: input.actualPath,
    plannedStations: input.plannedStations,
    surveyStations: input.actualStations,
    markers,
    target: input.target,
    collar,
    bounds: {
      minEastingM: minE,
      maxEastingM: maxE,
      minNorthingM: minN,
      maxNorthingM: maxN,
      minRlM: minRl,
      maxRlM: maxRl,
      centerEastingM: (minE + maxE) / 2,
      centerNorthingM: (minN + maxN) / 2,
      centerRlM: (minRl + maxRl) / 2,
      spanM: span,
    },
    sectionBearingDegrees: input.sectionBearingDegrees ?? null,
    sectionBearingSource:
      input.sectionBearingDegrees === null ||
      input.sectionBearingDegrees === undefined
        ? "unavailable"
        : "report",
    trackingPoints: [],
    activePlanName: input.activePlanName,
  };
}
