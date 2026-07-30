import type { PDFFont, PDFPage, RGB } from "pdf-lib";

import type { ReportDocumentData } from "@/domain";

import {
  PDF_THEME,
  drawRoundedCard,
  pdfSafeText,
} from "./pdf-design";

export interface ReportAnalyticsChartPoint {
  readonly label: string;
  readonly x: number;
  readonly value: number;
}

export interface ReportAnalyticsGraphicsModel {
  readonly depthProgression: {
    readonly title: "Depth progression";
    readonly unit: "m";
    readonly plannedDepthM?: number;
    readonly points: readonly ReportAnalyticsChartPoint[];
  };
  readonly recoveryByDepth: {
    readonly title: "Recovery by depth";
    readonly unit: "%";
    readonly points: readonly ReportAnalyticsChartPoint[];
  };
  readonly renderableChartCount: number;
}

function decimetresToMetres(value: number): number {
  return value / 10;
}

export function buildReportAnalyticsGraphicsModel(
  data: ReportDocumentData,
): ReportAnalyticsGraphicsModel {
  const analytics = data.holeAnalytics;
  const depthPoints =
    analytics?.shiftRows.map((row, index) => ({
      label: `${row.shiftType} ${row.shiftDate}`,
      x: index,
      value: decimetresToMetres(row.endingDepthDm),
    })) ?? [];
  const recoveryPoints =
    analytics?.runRows.map((row) => ({
      label: `Run ${row.runNumber}`,
      x: decimetresToMetres(row.depthDm),
      value: row.recoveryPercentTenths / 10,
    })) ?? [];

  return {
    depthProgression: {
      title: "Depth progression",
      unit: "m",
      plannedDepthM:
        analytics === undefined
          ? undefined
          : decimetresToMetres(analytics.plannedDepthDm),
      points: depthPoints,
    },
    recoveryByDepth: {
      title: "Recovery by depth",
      unit: "%",
      points: recoveryPoints,
    },
    renderableChartCount:
      Number(depthPoints.length > 0) + Number(recoveryPoints.length > 0),
  };
}

function samplePoints(
  points: readonly ReportAnalyticsChartPoint[],
  maximum: number,
): readonly ReportAnalyticsChartPoint[] {
  if (points.length <= maximum) return points;
  return Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (maximum - 1),
    );
    return points[sourceIndex]!;
  });
}

function valueExtent(points: readonly ReportAnalyticsChartPoint[]): {
  readonly minimum: number;
  readonly maximum: number;
} {
  if (points.length === 0) return { minimum: 0, maximum: 1 };
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) {
    return {
      minimum: Math.max(0, minimum - 1),
      maximum: maximum + 1,
    };
  }
  return { minimum, maximum };
}

function formatAxisValue(value: number, unit: string): string {
  return `${value.toFixed(unit === "%" ? 0 : 1)}${unit}`;
}

function drawChartFrame(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly title: string;
    readonly subtitle: string;
  },
): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  drawRoundedCard(page, {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    radius: 8,
    color: PDF_THEME.surface,
    borderColor: PDF_THEME.border,
  });
  page.drawText(pdfSafeText(input.title), {
    x: input.x + 12,
    y: input.y + input.height - 19,
    size: 10,
    font: bold,
    color: PDF_THEME.navy,
  });
  page.drawText(pdfSafeText(input.subtitle), {
    x: input.x + 12,
    y: input.y + input.height - 31,
    size: 7,
    font,
    color: PDF_THEME.inkMuted,
  });
  return {
    x: input.x + 33,
    y: input.y + 20,
    width: input.width - 47,
    height: input.height - 61,
  };
}

function drawEmptyChart(
  page: PDFPage,
  font: PDFFont,
  plot: { readonly x: number; readonly y: number; readonly width: number },
): void {
  page.drawLine({
    start: { x: plot.x, y: plot.y + 18 },
    end: { x: plot.x + plot.width, y: plot.y + 18 },
    thickness: 1,
    color: PDF_THEME.border,
  });
  page.drawText("No recorded data", {
    x: plot.x,
    y: plot.y + 27,
    size: 8,
    font,
    color: PDF_THEME.inkMuted,
  });
}

function drawLineChart(
  page: PDFPage,
  font: PDFFont,
  input: {
    readonly plot: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly points: readonly ReportAnalyticsChartPoint[];
    readonly unit: string;
    readonly color: RGB;
    readonly plannedDepthM?: number;
  },
): void {
  if (input.points.length === 0) {
    drawEmptyChart(page, font, input.plot);
    return;
  }
  const points = samplePoints(input.points, 30);
  const extent = valueExtent([
    ...points,
    ...(input.plannedDepthM === undefined
      ? []
      : [{ label: "Planned", x: 0, value: input.plannedDepthM }]),
  ]);
  const range = extent.maximum - extent.minimum;
  const toY = (value: number) =>
    input.plot.y +
    ((value - extent.minimum) / range) * Math.max(1, input.plot.height);
  const toX = (index: number) =>
    input.plot.x +
    (points.length === 1
      ? input.plot.width / 2
      : (index / (points.length - 1)) * input.plot.width);

  page.drawLine({
    start: { x: input.plot.x, y: input.plot.y },
    end: { x: input.plot.x, y: input.plot.y + input.plot.height },
    thickness: 0.8,
    color: PDF_THEME.border,
  });
  page.drawLine({
    start: { x: input.plot.x, y: input.plot.y },
    end: { x: input.plot.x + input.plot.width, y: input.plot.y },
    thickness: 0.8,
    color: PDF_THEME.border,
  });
  if (input.plannedDepthM !== undefined) {
    const plannedY = toY(input.plannedDepthM);
    for (let x = input.plot.x; x < input.plot.x + input.plot.width; x += 8) {
      page.drawLine({
        start: { x, y: plannedY },
        end: { x: Math.min(x + 4, input.plot.x + input.plot.width), y: plannedY },
        thickness: 0.7,
        color: PDF_THEME.warning,
      });
    }
  }

  points.forEach((point, index) => {
    const x = toX(index);
    const y = toY(point.value);
    if (index > 0) {
      const previous = points[index - 1]!;
      page.drawLine({
        start: { x: toX(index - 1), y: toY(previous.value) },
        end: { x, y },
        thickness: 1.8,
        color: input.color,
      });
    }
    page.drawCircle({
      x,
      y,
      size: 2.4,
      color: PDF_THEME.surface,
      borderColor: input.color,
      borderWidth: 1.2,
    });
  });

  page.drawText(formatAxisValue(extent.maximum, input.unit), {
    x: input.plot.x - 29,
    y: input.plot.y + input.plot.height - 2,
    size: 6.5,
    font,
    color: PDF_THEME.inkMuted,
  });
  page.drawText(formatAxisValue(extent.minimum, input.unit), {
    x: input.plot.x - 29,
    y: input.plot.y - 2,
    size: 6.5,
    font,
    color: PDF_THEME.inkMuted,
  });
}

function drawRecoveryBars(
  page: PDFPage,
  font: PDFFont,
  input: {
    readonly plot: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly points: readonly ReportAnalyticsChartPoint[];
  },
): void {
  if (input.points.length === 0) {
    drawEmptyChart(page, font, input.plot);
    return;
  }
  const points = samplePoints(input.points, 24);
  const barGap = 2;
  const barWidth = Math.max(
    2,
    (input.plot.width - barGap * Math.max(0, points.length - 1)) /
      points.length,
  );
  page.drawLine({
    start: { x: input.plot.x, y: input.plot.y },
    end: { x: input.plot.x + input.plot.width, y: input.plot.y },
    thickness: 0.8,
    color: PDF_THEME.border,
  });
  for (const [index, point] of points.entries()) {
    const clamped = Math.max(0, Math.min(110, point.value));
    const height = (clamped / 110) * input.plot.height;
    page.drawRectangle({
      x: input.plot.x + index * (barWidth + barGap),
      y: input.plot.y,
      width: barWidth,
      height,
      color:
        point.value >= 90 ? PDF_THEME.success : PDF_THEME.warning,
    });
  }
  for (const marker of [0, 50, 100]) {
    const y = input.plot.y + (marker / 110) * input.plot.height;
    page.drawLine({
      start: { x: input.plot.x, y },
      end: { x: input.plot.x + input.plot.width, y },
      thickness: 0.35,
      color: PDF_THEME.border,
    });
    page.drawText(`${marker}%`, {
      x: input.plot.x - 25,
      y: y - 2,
      size: 6.5,
      font,
      color: PDF_THEME.inkMuted,
    });
  }
}

export function drawReportAnalyticsGraphicsOnPdfPage(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly model: ReportAnalyticsGraphicsModel;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): { readonly nextY: number; readonly drawnCharts: number } {
  const gap = 12;
  const chartWidth = (input.width - gap) / 2;
  const bottom = input.y - input.height;
  const depthPlot = drawChartFrame(input.page, input.font, input.bold, {
    x: input.x,
    y: bottom,
    width: chartWidth,
    height: input.height,
    title: input.model.depthProgression.title,
    subtitle: "Repository-backed ending depth by Shift",
  });
  drawLineChart(input.page, input.font, {
    plot: depthPlot,
    points: input.model.depthProgression.points,
    unit: input.model.depthProgression.unit,
    color: PDF_THEME.blue,
    plannedDepthM: input.model.depthProgression.plannedDepthM,
  });

  const recoveryPlot = drawChartFrame(input.page, input.font, input.bold, {
    x: input.x + chartWidth + gap,
    y: bottom,
    width: chartWidth,
    height: input.height,
    title: input.model.recoveryByDepth.title,
    subtitle: "Repository-backed weighted Run recovery by depth",
  });
  drawRecoveryBars(input.page, input.font, {
    plot: recoveryPlot,
    points: input.model.recoveryByDepth.points,
  });

  return {
    nextY: bottom - 12,
    drawnCharts: input.model.renderableChartCount,
  };
}
