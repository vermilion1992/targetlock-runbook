import type {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
} from "pdf-lib";

import {
  formatMetres,
  formatReportVersion,
  reportTypeLabel,
  type ReportSnapshot,
  type ReportTrayRow,
} from "@/domain";
import type { TrajectoryViewModel } from "@/domain/trajectory-view-model";

import {
  PDF_PAGE,
  PDF_THEME,
  drawBrandHeaderFooter,
  drawRoundedCard,
  drawStatusPill,
  pdfSafeText,
} from "./pdf-design";
import {
  buildCurrentShiftCoverModel,
  drawReportKpiGrid,
} from "./report-cover-pdf";
import {
  buildReportTrajectoryViewModel,
  drawShiftTrajectoryPair,
} from "./trajectory-pdf-graphics";

const MARGIN = PDF_PAGE.margin;
const CONTENT_TOP = PDF_PAGE.landscapeHeight - MARGIN - 16;
const CONTENT_BOTTOM = 42;
export const CURRENT_SHIFT_RUN_ROWS_PER_PAGE = 24;
export const CURRENT_SHIFT_SURVEY_ROWS_PER_PAGE = 22;
export const CURRENT_SHIFT_PHOTOS_PER_PAGE = 9;

export interface CurrentShiftTrayPhotoAsset {
  readonly trayId: string;
  readonly trayNumber: number;
  readonly bytes: Uint8Array;
  readonly mediaType: "image/png" | "image/jpeg";
}

function pageChunks<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function currentShiftReportPageCount(snapshot: ReportSnapshot): number {
  const data = snapshot.documentData;
  return (
    1 +
    Math.ceil(data.runsheet.length / CURRENT_SHIFT_RUN_ROWS_PER_PAGE) +
    Math.ceil(data.surveys.length / CURRENT_SHIFT_SURVEY_ROWS_PER_PAGE) +
    Math.ceil(data.trays.length / CURRENT_SHIFT_PHOTOS_PER_PAGE)
  );
}

function formatUtcDateTime(value: string | undefined): string {
  if (!value) return "In progress";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`;
}

function formatUtcTime(value: string | undefined): string {
  if (!value) return "In progress";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(11, 16)} UTC`;
}

function clipText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const safe = pdfSafeText(value);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let clipped = safe;
  while (
    clipped.length > 1 &&
    font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth
  ) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function drawPageTitle(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly eyebrow: string;
  readonly title: string;
  readonly detail?: string;
}): number {
  input.page.drawText(pdfSafeText(input.eyebrow.toUpperCase()), {
    x: MARGIN,
    y: CONTENT_TOP,
    size: 7,
    font: input.bold,
    color: PDF_THEME.blue,
  });
  input.page.drawText(pdfSafeText(input.title), {
    x: MARGIN,
    y: CONTENT_TOP - 29,
    size: 22,
    font: input.bold,
    color: PDF_THEME.navy,
  });
  if (input.detail) {
    const safe = pdfSafeText(input.detail);
    input.page.drawText(safe, {
      x:
        PDF_PAGE.landscapeWidth -
        MARGIN -
        input.font.widthOfTextAtSize(safe, 8),
      y: CONTENT_TOP - 25,
      size: 8,
      font: input.font,
      color: PDF_THEME.inkMuted,
    });
  }
  input.page.drawLine({
    start: { x: MARGIN, y: CONTENT_TOP - 43 },
    end: {
      x: PDF_PAGE.landscapeWidth - MARGIN,
      y: CONTENT_TOP - 43,
    },
    thickness: 1,
    color: PDF_THEME.border,
  });
  return CONTENT_TOP - 60;
}

function drawShiftHero(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly snapshot: ReportSnapshot;
  readonly x: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}): number {
  const model = buildCurrentShiftCoverModel(input.snapshot);
  const data = input.snapshot.documentData;
  const shift = data.currentShift;
  const bottom = input.top - input.height;
  drawRoundedCard(input.page, {
    x: input.x,
    y: bottom,
    width: input.width,
    height: input.height,
    radius: 11,
    color: PDF_THEME.navy,
  });

  const detailsWidth = input.width * 0.56;
  input.page.drawText("TARGETLOCK | SHIFT REPORT", {
    x: input.x + 18,
    y: input.top - 23,
    size: 7.5,
    font: input.bold,
    color: PDF_THEME.blueBright,
  });
  input.page.drawText(pdfSafeText(model.holeTitle), {
    x: input.x + 18,
    y: input.top - 61,
    size: 27,
    font: input.bold,
    color: PDF_THEME.white,
    maxWidth: detailsWidth,
  });
  drawStatusPill(input.page, input.bold, {
    x: input.x + 18,
    y: input.top - 90,
    label: model.status,
  });
  input.page.drawText(
    clipText(model.projectLine, input.font, 8.5, detailsWidth - 90),
    {
      x: input.x + 88,
      y: input.top - 83,
      size: 8.5,
      font: input.font,
      color: PDF_THEME.white,
    },
  );
  const operationalLine = [
    model.clientLine,
    model.rigLine,
    shift ? `Primary driller ${shift.primaryDrillerName}` : undefined,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" | ");
  input.page.drawText(
    clipText(operationalLine, input.font, 7.3, detailsWidth),
    {
      x: input.x + 18,
      y: bottom + 17,
      size: 7.3,
      font: input.font,
      color: PDF_THEME.border,
    },
  );

  const panelX = input.x + input.width * 0.59;
  const panelWidth = input.width * 0.39;
  drawRoundedCard(input.page, {
    x: panelX,
    y: bottom + 10,
    width: panelWidth,
    height: input.height - 20,
    radius: 8,
    color: PDF_THEME.navySoft,
  });
  input.page.drawText("COLLAR & SHIFT", {
    x: panelX + 12,
    y: input.top - 25,
    size: 7,
    font: input.bold,
    color: PDF_THEME.blueBright,
  });
  const coordinateSystemLabel = model.coordinateSystemLabel
    .toLocaleLowerCase("en-AU")
    .includes("not recorded")
    ? "CRS not recorded | relative coordinates"
    : model.coordinateSystemLabel;
  input.page.drawText(
    clipText(coordinateSystemLabel, input.font, 6.8, panelWidth - 24),
    {
      x: panelX + 12,
      y: input.top - 40,
      size: 6.8,
      font: input.font,
      color: PDF_THEME.border,
    },
  );
  const coordinates =
    model.coordinateLines.length > 0
      ? model.coordinateLines.join(" | ")
      : model.locationFallback;
  input.page.drawText(
    clipText(coordinates, input.bold, 7.3, panelWidth - 24),
    {
      x: panelX + 12,
      y: input.top - 59,
      size: 7.3,
      font: input.bold,
      color: PDF_THEME.white,
    },
  );
  input.page.drawText(
    clipText(
      model.directionLine ?? "Collar direction not recorded",
      input.font,
      6.8,
      panelWidth - 24,
    ),
    {
      x: panelX + 12,
      y: input.top - 75,
      size: 6.8,
      font: input.font,
      color: PDF_THEME.border,
    },
  );
  input.page.drawText(
    clipText(
      `${shift?.label ?? "Shift not recorded"} | ${formatUtcDateTime(shift?.startedAt)}`,
      input.font,
      6.8,
      panelWidth - 24,
    ),
    {
      x: panelX + 12,
      y: bottom + 17,
      size: 6.8,
      font: input.font,
      color: PDF_THEME.white,
    },
  );

  return bottom - 10;
}

function buildTrajectoryModel(snapshot: ReportSnapshot): TrajectoryViewModel {
  const trajectory = snapshot.documentData.trajectorySummary;
  return buildReportTrajectoryViewModel({
    holeId: snapshot.holeId,
    engineVersion: trajectory?.engineVersion ?? "Unavailable",
    activePlanName: trajectory?.activePlanName,
    plannedPath: trajectory?.plannedRenderPath ?? [],
    actualPath: trajectory?.actualRenderPath ?? [],
    plannedStations:
      trajectory?.plannedStations.map((station) => ({
        measuredDepthM: station.measuredDepthM,
        eastingM: station.eastingM,
        northingM: station.northingM,
        rlM: station.rlM,
      })) ?? [],
    actualStations:
      trajectory?.actualStations.map((station) => ({
        measuredDepthM: station.measuredDepthM,
        eastingM: station.eastingM,
        northingM: station.northingM,
        rlM: station.rlM,
      })) ?? [],
    target:
      trajectory?.targetEastingM !== undefined &&
      trajectory.targetNorthingM !== undefined &&
      trajectory.targetRlM !== undefined
        ? {
            eastingM: trajectory.targetEastingM,
            northingM: trajectory.targetNorthingM,
            rlM: trajectory.targetRlM,
            radiusM: trajectory.targetRadiusM,
          }
        : undefined,
    sectionBearingDegrees: trajectory?.sectionBearingDegrees,
  });
}

function drawProfessionalTable(input: {
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly x: number;
  readonly top: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly weights: readonly number[];
}): void {
  if (input.rows.length === 0) {
    drawRoundedCard(input.page, {
      x: input.x,
      y: input.top - 72,
      width: input.width,
      height: 72,
      color: PDF_THEME.surfaceMuted,
      borderColor: PDF_THEME.border,
    });
    input.page.drawText("No records captured during this shift.", {
      x: input.x + 18,
      y: input.top - 42,
      size: 10,
      font: input.font,
      color: PDF_THEME.inkMuted,
    });
    return;
  }

  const headerHeight = 26;
  const rowHeight = Math.min(
    31,
    Math.max(7, (input.maxHeight - headerHeight) / input.rows.length),
  );
  const fontSize = Math.min(8.5, Math.max(5.5, rowHeight * 0.42));
  const weightTotal = input.weights.reduce((sum, weight) => sum + weight, 0);
  const widths = input.weights.map(
    (weight) => (input.width * weight) / weightTotal,
  );
  const tableHeight = headerHeight + rowHeight * input.rows.length;
  drawRoundedCard(input.page, {
    x: input.x,
    y: input.top - tableHeight,
    width: input.width,
    height: tableHeight,
    radius: 8,
    color: PDF_THEME.surface,
    borderColor: PDF_THEME.border,
  });
  input.page.drawRectangle({
    x: input.x,
    y: input.top - headerHeight,
    width: input.width,
    height: headerHeight,
    color: PDF_THEME.navy,
  });

  let columnX = input.x;
  input.headers.forEach((header, index) => {
    const columnWidth = widths[index] ?? 0;
    input.page.drawText(
      clipText(header.toUpperCase(), input.bold, 6.5, columnWidth - 12),
      {
        x: columnX + 6,
        y: input.top - 17,
        size: 6.5,
        font: input.bold,
        color: PDF_THEME.white,
      },
    );
    columnX += columnWidth;
  });

  input.rows.forEach((row, rowIndex) => {
    const rowTop = input.top - headerHeight - rowIndex * rowHeight;
    if (rowIndex % 2 === 1) {
      input.page.drawRectangle({
        x: input.x + 1,
        y: rowTop - rowHeight,
        width: input.width - 2,
        height: rowHeight,
        color: PDF_THEME.surfaceMuted,
      });
    }
    input.page.drawLine({
      start: { x: input.x, y: rowTop - rowHeight },
      end: { x: input.x + input.width, y: rowTop - rowHeight },
      thickness: 0.35,
      color: PDF_THEME.border,
    });
    let cellX = input.x;
    row.forEach((cell, columnIndex) => {
      const columnWidth = widths[columnIndex] ?? 0;
      input.page.drawText(
        clipText(cell, input.font, fontSize, columnWidth - 12),
        {
          x: cellX + 6,
          y: rowTop - rowHeight + Math.max(2, (rowHeight - fontSize) / 2),
          size: fontSize,
          font: columnIndex === 0 ? input.bold : input.font,
          color:
            columnIndex === 0 ? PDF_THEME.navy : PDF_THEME.ink,
        },
      );
      cellX += columnWidth;
    });
  });
}

async function embedPhoto(
  doc: PDFDocument,
  asset: CurrentShiftTrayPhotoAsset | undefined,
): Promise<PDFImage | undefined> {
  if (!asset) return undefined;
  try {
    return asset.mediaType === "image/png"
      ? await doc.embedPng(asset.bytes)
      : await doc.embedJpg(asset.bytes);
  } catch {
    return undefined;
  }
}

async function drawPhotoGallery(input: {
  readonly doc: PDFDocument;
  readonly page: PDFPage;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly trays: readonly ReportTrayRow[];
  readonly assets: readonly CurrentShiftTrayPhotoAsset[];
  readonly top: number;
}): Promise<void> {
  const trays = input.trays;
  if (trays.length === 0) {
    drawProfessionalTable({
      page: input.page,
      font: input.font,
      bold: input.bold,
      x: MARGIN,
      top: input.top,
      width: PDF_PAGE.landscapeWidth - MARGIN * 2,
      maxHeight: 100,
      headers: ["Tray"],
      rows: [],
      weights: [1],
    });
    return;
  }
  const assetByTray = new Map(input.assets.map((asset) => [asset.trayId, asset]));
  const columns =
    trays.length <= 4 ? 2 : trays.length <= 9 ? 3 : 4;
  const rows = Math.ceil(trays.length / columns);
  const gap = 10;
  const availableWidth = PDF_PAGE.landscapeWidth - MARGIN * 2;
  const availableHeight = input.top - CONTENT_BOTTOM;
  const cellWidth = (availableWidth - gap * (columns - 1)) / columns;
  const cellHeight = (availableHeight - gap * (rows - 1)) / rows;

  for (let index = 0; index < trays.length; index += 1) {
    const tray = trays[index]!;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (cellWidth + gap);
    const y = input.top - (row + 1) * cellHeight - row * gap;
    drawRoundedCard(input.page, {
      x,
      y,
      width: cellWidth,
      height: cellHeight,
      radius: 7,
      color: PDF_THEME.surface,
      borderColor: PDF_THEME.border,
    });
    const captionHeight = Math.min(23, Math.max(15, cellHeight * 0.12));
    input.page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: cellWidth - 2,
      height: captionHeight,
      color: PDF_THEME.navy,
    });
    const caption = `TRAY ${tray.trayNumber}`;
    input.page.drawText(caption, {
      x: x + 8,
      y: y + Math.max(5, (captionHeight - 7.5) / 2),
      size: Math.min(8, captionHeight * 0.38),
      font: input.bold,
      color: PDF_THEME.white,
    });

    const imageBox = {
      x: x + 8,
      y: y + captionHeight + 7,
      width: cellWidth - 16,
      height: cellHeight - captionHeight - 15,
    };
    input.page.drawRectangle({
      ...imageBox,
      color: PDF_THEME.surfaceMuted,
    });
    const image = await embedPhoto(input.doc, assetByTray.get(tray.trayId));
    if (image) {
      const dimensions = image.scaleToFit(imageBox.width, imageBox.height);
      input.page.drawImage(image, {
        x: imageBox.x + (imageBox.width - dimensions.width) / 2,
        y: imageBox.y + (imageBox.height - dimensions.height) / 2,
        width: dimensions.width,
        height: dimensions.height,
      });
    } else {
      const unavailable = "Photograph unavailable";
      input.page.drawText(unavailable, {
        x:
          imageBox.x +
          Math.max(
            6,
            (imageBox.width -
              input.font.widthOfTextAtSize(unavailable, 7.5)) /
              2,
          ),
        y: imageBox.y + imageBox.height / 2,
        size: 7.5,
        font: input.font,
        color: PDF_THEME.inkMuted,
      });
    }
  }
}

export async function drawCurrentShiftReport(input: {
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly snapshot: ReportSnapshot;
  readonly trayPhotos?: readonly CurrentShiftTrayPhotoAsset[];
}): Promise<void> {
  const { doc, font, bold, snapshot } = input;
  const data = snapshot.documentData;
  const shift = data.currentShift;
  const pageSize: [number, number] = [
    PDF_PAGE.landscapeWidth,
    PDF_PAGE.landscapeHeight,
  ];

  const overview = doc.addPage(pageSize);
  const afterHero = drawShiftHero({
    page: overview,
    font,
    bold,
    snapshot,
    x: MARGIN,
    top: CONTENT_TOP,
    width: PDF_PAGE.landscapeWidth - MARGIN * 2,
    height: 118,
  });
  const cover = buildCurrentShiftCoverModel(snapshot);
  const afterKpis = drawReportKpiGrid({
    page: overview,
    font,
    bold,
    kpis: cover.kpis,
    x: MARGIN,
    y: afterHero,
    width: PDF_PAGE.landscapeWidth - MARGIN * 2,
  });
  drawShiftTrajectoryPair({
    page: overview,
    font,
    bold,
    model: buildTrajectoryModel(snapshot),
    x: MARGIN,
    y: afterKpis,
    width: PDF_PAGE.landscapeWidth - MARGIN * 2,
    height: Math.max(100, afterKpis - CONTENT_BOTTOM),
  });

  const shiftWindow = `${shift?.label ?? "Shift not recorded"} | ${formatUtcTime(shift?.startedAt)} - ${formatUtcTime(shift?.closedAt)}`;
  const runChunks = pageChunks(
    data.runsheet,
    CURRENT_SHIFT_RUN_ROWS_PER_PAGE,
  );
  runChunks.forEach((runRows, pageIndex) => {
    const runsheet = doc.addPage(pageSize);
    const runsTop = drawPageTitle({
      page: runsheet,
      font,
      bold,
      eyebrow: "Operational record",
      title: "Shift runbook",
      detail: `${shiftWindow}${runChunks.length > 1 ? ` | ${pageIndex + 1} of ${runChunks.length}` : ""}`,
    });
    drawProfessionalTable({
      page: runsheet,
      font,
      bold,
      x: MARGIN,
      top: runsTop,
      width: PDF_PAGE.landscapeWidth - MARGIN * 2,
      maxHeight: runsTop - CONTENT_BOTTOM,
      headers: [
        "Run",
        "Rod no.",
        "Rod added",
        "Rod string",
        "Stick-up",
        "Hole depth",
        "Drilled",
        "Recovered",
        "Recovery",
      ],
      rows: runRows.map((row) => [
        `${row.runNumber}${row.shared ? " S" : ""}`,
        String(row.rodNumber),
        formatMetres(row.rodAddedDm),
        formatMetres(row.rodStringDm),
        formatMetres(row.stickUpDm),
        formatMetres(row.holeDepthDm),
        formatMetres(row.drilledDm),
        formatMetres(row.recoveredDm),
        `${(row.recoveryPercentTenths / 10).toFixed(1)}%`,
      ]),
      weights: [0.65, 0.72, 0.92, 0.95, 0.82, 1, 0.82, 0.92, 0.85],
    });
  });

  const surveyChunks = pageChunks(
    data.surveys,
    CURRENT_SHIFT_SURVEY_ROWS_PER_PAGE,
  );
  surveyChunks.forEach((surveyRows, pageIndex) => {
    const surveys = doc.addPage(pageSize);
    const surveysTop = drawPageTitle({
      page: surveys,
      font,
      bold,
      eyebrow: "Directional control",
      title: "Surveys",
      detail: `${data.surveys.length} recorded during ${shift?.label ?? "this shift"}${surveyChunks.length > 1 ? ` | ${pageIndex + 1} of ${surveyChunks.length}` : ""}`,
    });
    drawProfessionalTable({
      page: surveys,
      font,
      bold,
      x: MARGIN,
      top: surveysTop,
      width: PDF_PAGE.landscapeWidth - MARGIN * 2,
      maxHeight: surveysTop - CONTENT_BOTTOM,
      headers: [
        "Depth",
        "Dip",
        "Azimuth",
        "North reference",
        "Survey tool",
        "Recorded time",
      ],
      rows: surveyRows.map((survey) => [
        formatMetres(survey.depthDm),
        `${(survey.dipTenths / 10).toFixed(1)} deg`,
        `${(survey.azimuthTenths / 10).toFixed(1)} deg`,
        survey.northReference,
        survey.toolName,
        formatUtcDateTime(survey.recordedAt),
      ]),
      weights: [0.8, 0.7, 0.78, 1.1, 1.2, 1.45],
    });
  });

  const photoChunks = pageChunks(data.trays, CURRENT_SHIFT_PHOTOS_PER_PAGE);
  for (let pageIndex = 0; pageIndex < photoChunks.length; pageIndex += 1) {
    const trayRows = photoChunks[pageIndex]!;
    const photos = doc.addPage(pageSize);
    const photosTop = drawPageTitle({
      page: photos,
      font,
      bold,
      eyebrow: "Core record",
      title: "Completed core trays",
      detail: `${data.trays.length} photographed during ${shift?.label ?? "this shift"}${photoChunks.length > 1 ? ` | ${pageIndex + 1} of ${photoChunks.length}` : ""}`,
    });
    await drawPhotoGallery({
      doc,
      page: photos,
      font,
      bold,
      trays: trayRows,
      assets: input.trayPhotos ?? [],
      top: photosTop,
    });
  }

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    drawBrandHeaderFooter(page, font, bold, {
      holeId: snapshot.holeId,
      reportLabel: reportTypeLabel(snapshot.reportType),
      versionLabel: formatReportVersion(snapshot.version),
      generatedAt: snapshot.generatedAt,
      pageNumber: index + 1,
      pageCount: pages.length,
      width: PDF_PAGE.landscapeWidth,
      height: PDF_PAGE.landscapeHeight,
    });
  });
}
