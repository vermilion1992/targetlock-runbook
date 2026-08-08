import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

import {
  decimetres,
  formatMetres,
  formatReportVersion,
  reportTypeLabel,
  type ReportSnapshot,
} from "@/domain";

import {
  PDF_THEME,
  drawRoundedCard,
  drawStatusPill,
  pdfSafeText,
  wrapPdfText,
} from "./pdf-design";

export interface ReportCoverKpi {
  readonly label: string;
  readonly value: string;
}

export interface ReportCoverModel {
  readonly eyebrow: string;
  readonly holeTitle: string;
  readonly holeSubtitle?: string;
  readonly status: string;
  readonly projectLine: string;
  readonly clientLine?: string;
  readonly siteLine?: string;
  readonly rigLine: string;
  readonly generatedByLine: string;
  readonly generatedAtLine: string;
  readonly versionLine: string;
  readonly coordinateSystemLabel: string;
  readonly coordinateLines: readonly string[];
  readonly directionLine?: string;
  readonly locationFallback: string;
  readonly plannedPath: readonly {
    readonly eastingM: number;
    readonly northingM: number;
  }[];
  readonly actualPath: readonly {
    readonly eastingM: number;
    readonly northingM: number;
  }[];
  readonly kpis: readonly ReportCoverKpi[];
}

function percent(tenths: number | undefined): string {
  return tenths === undefined ? "Not available" : `${(tenths / 10).toFixed(1)}%`;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
    return "In progress";
  }
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return remainingMinutes === 0
    ? `${hours} h`
    : `${hours} h ${remainingMinutes} min`;
}

export function buildReportCoverModel(
  snapshot: ReportSnapshot,
): ReportCoverModel {
  const data = snapshot.documentData;
  const analytics = data.holeAnalytics;
  const collar = data.collar;
  const generatedBy = data.generatedBy ?? {
    userId: snapshot.generatedByUserId,
    displayName: snapshot.generatedByNameSnapshot,
    role: snapshot.generatedByRoleSnapshot,
  };
  const roleLabel =
    generatedBy.role === "COMPANY_ADMIN"
      ? "Company admin"
      : generatedBy.role === "SUPERVISOR"
      ? "Supervisor"
      : generatedBy.role === "DRILLER"
        ? "Driller"
        : undefined;
  const coordinateLines: string[] = [];
  if (collar?.eastingM !== undefined) {
    coordinateLines.push(`E ${collar.eastingM.toFixed(2)} m`);
  }
  if (collar?.northingM !== undefined) {
    coordinateLines.push(`N ${collar.northingM.toFixed(2)} m`);
  }
  if (collar?.rlM !== undefined) {
    coordinateLines.push(`RL ${collar.rlM.toFixed(2)} m`);
  }
  const directionLine =
    collar?.dipDegrees === undefined && collar?.azimuthDegrees === undefined
      ? undefined
      : `Dip ${collar?.dipDegrees?.toFixed(1) ?? "-"} deg | Az ${collar?.azimuthDegrees?.toFixed(1) ?? "-"} deg${collar?.northReference ? ` ${collar.northReference}` : ""}`;
  const coordinateSystemLabel =
    data.coordinateSystemLabel ??
    collar?.coordinateSystemName ??
    collar?.epsgCode ??
    "Grid / CRS not recorded";
  const hasCoordinates = coordinateLines.length > 0;
  const trajectory = data.trajectorySummary;

  return {
    eyebrow: reportTypeLabel(snapshot.reportType).toUpperCase(),
    holeTitle: data.holeId,
    holeSubtitle:
      data.holeName === data.holeId ? undefined : data.holeName,
    status: data.holeStatus,
    projectLine: data.projectCode
      ? `${data.projectName} | ${data.projectCode}`
      : data.projectName,
    clientLine: data.clientName,
    siteLine: data.siteLocation,
    rigLine: data.rigName,
    generatedByLine: `${generatedBy.displayName}${roleLabel ? ` | ${roleLabel}` : ""}`,
    generatedAtLine: data.reportGeneratedAt ?? snapshot.generatedAt,
    versionLine: formatReportVersion(
      data.reportVersion ?? snapshot.version,
    ),
    coordinateSystemLabel,
    coordinateLines,
    directionLine,
    locationFallback: hasCoordinates
      ? "Recorded collar coordinates | no geographic conversion"
      : "Collar coordinates not recorded",
    plannedPath:
      trajectory?.plannedRenderPath?.map((point) => ({
        eastingM: point.eastingM,
        northingM: point.northingM,
      })) ?? [],
    actualPath:
      trajectory?.actualRenderPath?.map((point) => ({
        eastingM: point.eastingM,
        northingM: point.northingM,
      })) ?? [],
    kpis: [
      {
        label: "CURRENT / FINAL DEPTH",
        value: formatMetres(
          analytics?.currentOrFinalDepthDm ?? data.currentOrFinalDepthDm,
        ),
      },
      {
        label: "PLANNED DEPTH",
        value: formatMetres(analytics?.plannedDepthDm ?? data.plannedDepthDm),
      },
      {
        label: "DRILLED METRES",
        value: formatMetres(
          analytics?.totalDrilledDm ?? data.statistics.totalDrilledDm,
        ),
      },
      {
        label: "WEIGHTED RECOVERY",
        value: percent(
          analytics?.weightedRecoveryTenths ??
            data.statistics.weightedRecoveryPercentTenths,
        ),
      },
      {
        label: "RUNS",
        value: String(
          analytics?.totalCompletedRuns ?? data.statistics.totalRuns,
        ),
      },
      {
        label: "SHIFTS",
        value: String(analytics?.completedShifts ?? data.statistics.shiftCount),
      },
      {
        label: "SURVEYS / TRAYS",
        value: `${analytics?.surveyCount ?? data.statistics.surveyCount} / ${analytics?.trayCount ?? data.statistics.trayCount}`,
      },
      {
        label: "BITS / REAMERS",
        value: `${analytics?.bitsUsed ?? data.bits.length} / ${analytics?.reamersUsed ?? data.reamers.length}`,
      },
    ],
  };
}

export function buildCurrentShiftCoverModel(
  snapshot: ReportSnapshot,
): ReportCoverModel {
  const base = buildReportCoverModel(snapshot);
  const data = snapshot.documentData;
  const analytics = data.shiftAnalytics;
  const shift = data.currentShift;
  const elapsedMinutes =
    shift?.closedAt === undefined
      ? undefined
      : analytics?.elapsedMinutes ??
        (shift.startedAt
          ? Math.max(
              0,
              (Date.parse(shift.closedAt) - Date.parse(shift.startedAt)) /
                60_000,
            )
          : undefined);

  return {
    ...base,
    eyebrow: "SHIFT REPORT",
    rigLine: shift ? `${data.rigName} | ${shift.label}` : data.rigName,
    kpis: [
      {
        label: "METRES DRILLED",
        value: formatMetres(analytics?.metresCompletedDm ?? decimetres(0)),
      },
      {
        label: "STARTING DEPTH",
        value: formatMetres(
          analytics?.startingDepthDm ??
            shift?.startingDepthDm ??
            decimetres(0),
        ),
      },
      {
        label: "ENDING DEPTH",
        value: formatMetres(
          analytics?.endingDepthDm ??
            shift?.endingDepthDm ??
            data.currentOrFinalDepthDm,
        ),
      },
      {
        label: "RUNS COMPLETED",
        value: String(analytics?.completedRunCount ?? data.runsheet.length),
      },
      {
        label: "AVERAGE RUN",
        value:
          analytics?.averageRunLengthDm === undefined
            ? "Not available"
            : formatMetres(analytics.averageRunLengthDm),
      },
      {
        label: "SHIFT DURATION",
        value: formatDuration(elapsedMinutes),
      },
      {
        label: "SURVEYS RECORDED",
        value: String(data.surveys.length),
      },
      {
        label: "TRAYS PHOTOGRAPHED",
        value: String(data.trays.length),
      },
    ],
  };
}

function drawMiniTrajectory(
  page: PDFPage,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly planned: ReportCoverModel["plannedPath"];
    readonly actual: ReportCoverModel["actualPath"];
  },
): boolean {
  const all = [...input.planned, ...input.actual];
  if (all.length < 2) return false;
  const eastings = all.map((point) => point.eastingM);
  const northings = all.map((point) => point.northingM);
  const minimumE = Math.min(...eastings);
  const maximumE = Math.max(...eastings);
  const minimumN = Math.min(...northings);
  const maximumN = Math.max(...northings);
  const rangeE = Math.max(1, maximumE - minimumE);
  const rangeN = Math.max(1, maximumN - minimumN);
  const project = (point: (typeof all)[number]) => ({
    x: input.x + ((point.eastingM - minimumE) / rangeE) * input.width,
    y: input.y + ((point.northingM - minimumN) / rangeN) * input.height,
  });
  const drawPath = (
    points: ReportCoverModel["plannedPath"],
    color: typeof PDF_THEME.blue,
    dashed: boolean,
  ) => {
    for (let index = 1; index < points.length; index += 1) {
      const start = project(points[index - 1]!);
      const end = project(points[index]!);
      if (dashed) {
        const segments = 8;
        for (let segment = 0; segment < segments; segment += 2) {
          const from = segment / segments;
          const to = Math.min(1, (segment + 1) / segments);
          page.drawLine({
            start: {
              x: start.x + (end.x - start.x) * from,
              y: start.y + (end.y - start.y) * from,
            },
            end: {
              x: start.x + (end.x - start.x) * to,
              y: start.y + (end.y - start.y) * to,
            },
            thickness: 1.1,
            color,
          });
        }
      } else {
        page.drawLine({ start, end, thickness: 2, color });
      }
    }
  };
  drawPath(input.planned, PDF_THEME.border, true);
  drawPath(input.actual, PDF_THEME.blueBright, false);
  const endpoint = input.actual.at(-1) ?? input.planned.at(-1);
  if (endpoint) {
    const point = project(endpoint);
    page.drawCircle({
      x: point.x,
      y: point.y,
      size: 3,
      color: PDF_THEME.white,
      borderColor: PDF_THEME.blueBright,
      borderWidth: 1.5,
    });
  }
  return true;
}

function drawLocationPanel(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  model: ReportCoverModel,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly mapImage?: PDFImage;
    readonly mapAttribution?: string;
  },
): void {
  drawRoundedCard(page, {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    radius: 9,
    color: PDF_THEME.navySoft,
  });
  page.drawText("LOCATION & TRAJECTORY", {
    x: input.x + 13,
    y: input.y + input.height - 21,
    size: 8,
    font: bold,
    color: PDF_THEME.blueBright,
  });
  page.drawText(pdfSafeText(model.coordinateSystemLabel), {
    x: input.x + 13,
    y: input.y + input.height - 36,
    size: 7,
    font,
    color: PDF_THEME.white,
    maxWidth: input.width - 26,
  });

  const visualY = input.y + 54;
  const visualHeight = Math.max(40, input.height - 105);
  if (input.mapImage) {
    const dimensions = input.mapImage.scaleToFit(
      input.width - 26,
      visualHeight,
    );
    page.drawImage(input.mapImage, {
      x: input.x + (input.width - dimensions.width) / 2,
      y: visualY + (visualHeight - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  } else {
    const drewTrajectory = drawMiniTrajectory(page, {
      x: input.x + 18,
      y: visualY + 4,
      width: input.width - 36,
      height: visualHeight - 8,
      planned: model.plannedPath,
      actual: model.actualPath,
    });
    if (!drewTrajectory) {
      page.drawLine({
        start: { x: input.x + 18, y: visualY + visualHeight / 2 },
        end: {
          x: input.x + input.width - 18,
          y: visualY + visualHeight / 2,
        },
        thickness: 1,
        color: PDF_THEME.border,
      });
    }
  }

  const coordinateText =
    model.coordinateLines.length > 0
      ? model.coordinateLines.join(" | ")
      : model.locationFallback;
  page.drawText(pdfSafeText(coordinateText), {
    x: input.x + 13,
    y: input.y + 35,
    size: 7.3,
    font: bold,
    color: PDF_THEME.white,
    maxWidth: input.width - 26,
  });
  page.drawText(
    pdfSafeText(
      model.directionLine ??
        input.mapAttribution ??
        "Offline vector panel | no satellite imagery",
    ),
    {
      x: input.x + 13,
      y: input.y + 19,
      size: 6.8,
      font,
      color: PDF_THEME.border,
      maxWidth: input.width - 26,
    },
  );
}

export function drawReportCoverHero(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly model: ReportCoverModel;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mapImage?: PDFImage;
  readonly mapAttribution?: string;
}): number {
  const panelWidth = Math.max(190, input.width * 0.39);
  const contentWidth = input.width - panelWidth - 30;
  const bottom = input.y - input.height;
  drawRoundedCard(input.page, {
    x: input.x,
    y: bottom,
    width: input.width,
    height: input.height,
    radius: 11,
    color: PDF_THEME.navy,
  });
  input.page.drawText(pdfSafeText(input.model.eyebrow), {
    x: input.x + 20,
    y: input.y - 29,
    size: 8.5,
    font: input.bold,
    color: PDF_THEME.blueBright,
  });
  input.page.drawText(pdfSafeText(input.model.holeTitle), {
    x: input.x + 20,
    y: input.y - 68,
    size: 29,
    font: input.bold,
    color: PDF_THEME.white,
    maxWidth: contentWidth,
  });
  let detailY = input.y - 87;
  if (input.model.holeSubtitle) {
    input.page.drawText(pdfSafeText(input.model.holeSubtitle), {
      x: input.x + 20,
      y: detailY,
      size: 10,
      font: input.font,
      color: PDF_THEME.border,
      maxWidth: contentWidth,
    });
    detailY -= 16;
  }
  drawStatusPill(input.page, input.bold, {
    x: input.x + 20,
    y: detailY - 9,
    label: input.model.status,
  });
  detailY -= 35;

  for (const line of [
    input.model.projectLine,
    input.model.clientLine,
    input.model.siteLine,
    input.model.rigLine,
  ].filter((line): line is string => Boolean(line))) {
    const wrapped = wrapPdfText(line, input.font, 8.5, contentWidth);
    for (const text of wrapped.slice(0, 2)) {
      input.page.drawText(text, {
        x: input.x + 20,
        y: detailY,
        size: 8.5,
        font: input.font,
        color: PDF_THEME.white,
      });
      detailY -= 12;
    }
  }

  input.page.drawText(
    pdfSafeText(
      `Generated by ${input.model.generatedByLine} | ${input.model.generatedAtLine} | ${input.model.versionLine}`,
    ),
    {
      x: input.x + 20,
      y: bottom + 18,
      size: 7,
      font: input.font,
      color: PDF_THEME.border,
      maxWidth: contentWidth,
    },
  );

  drawLocationPanel(input.page, input.font, input.bold, input.model, {
    x: input.x + input.width - panelWidth - 10,
    y: bottom + 10,
    width: panelWidth,
    height: input.height - 20,
    mapImage: input.mapImage,
    mapAttribution: input.mapAttribution,
  });
  return bottom - 12;
}

export function drawReportKpiGrid(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly kpis: readonly ReportCoverKpi[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
}): number {
  const columns = 4;
  const gap = 8;
  const cardWidth = (input.width - gap * (columns - 1)) / columns;
  const cardHeight = 49;
  input.kpis.forEach((kpi, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = input.x + column * (cardWidth + gap);
    const y = input.y - cardHeight - row * (cardHeight + gap);
    drawRoundedCard(input.page, {
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: 7,
      color: PDF_THEME.surfaceMuted,
      borderColor: PDF_THEME.border,
    });
    input.page.drawText(pdfSafeText(kpi.label), {
      x: x + 9,
      y: y + 31,
      size: 6.5,
      font: input.bold,
      color: PDF_THEME.inkMuted,
      maxWidth: cardWidth - 18,
    });
    input.page.drawText(pdfSafeText(kpi.value), {
      x: x + 9,
      y: y + 12,
      size: 12,
      font: input.bold,
      color: PDF_THEME.navy,
      maxWidth: cardWidth - 18,
    });
  });
  const rows = Math.ceil(input.kpis.length / columns);
  return input.y - rows * cardHeight - Math.max(0, rows - 1) * gap - 12;
}
