import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  formatMetres,
  formatReportVersion,
  reportTypeLabel,
  type ReportDocumentData,
  type ReportSnapshot,
  type ReportType,
} from "@/domain";
import {
  buildReportTrajectoryViewModel,
  drawTrajectoryGraphicsOnPdfPage,
} from "./trajectory-pdf-graphics";
import {
  PDF_PAGE,
  PDF_THEME,
  drawBrandHeaderFooter,
  drawSectionHeading,
  pdfSafeText,
  wrapPdfText,
} from "./pdf-design";
import {
  buildReportAnalyticsGraphicsModel,
  drawReportAnalyticsGraphicsOnPdfPage,
  type ReportAnalyticsGraphicsModel,
} from "./report-analytics-pdf-graphics";
import {
  buildReportCoverModel,
  drawReportCoverHero,
  drawReportKpiGrid,
  type ReportCoverModel,
} from "./report-cover-pdf";

const MARGIN = PDF_PAGE.margin;
const LINE = PDF_PAGE.lineHeight;

export interface PdfLayoutModel {
  readonly reportType: ReportType;
  readonly holeId: string;
  readonly version: number;
  readonly generatedAt: string;
  readonly landscapePages: number;
  readonly portraitPages: number;
  readonly shiftGroups: readonly {
    readonly label: string;
    readonly sharedRunCount: number;
    readonly runCount: number;
  }[];
  readonly hasCorrections: boolean;
  readonly sections: readonly string[];
  readonly oneDecimalSamples: readonly string[];
  readonly cover?: ReportCoverModel;
  readonly analyticsGraphics: ReportAnalyticsGraphicsModel;
}

export function buildPdfLayoutModel(snapshot: ReportSnapshot): PdfLayoutModel {
  const data = snapshot.documentData;
  const shiftGroups = data.shifts.map((shift) => ({
    label: shift.label,
    sharedRunCount: shift.sharedRunIds.length,
    runCount: shift.runIds.length,
  }));
  const runRows = data.runsheet.length;
  const landscapePages = Math.max(1, Math.ceil(runRows / 28) + (shiftGroups.length > 0 ? 1 : 0));
  const sections = sectionsFor(snapshot.reportType, data);
  const portraitPages = Math.max(1, Math.ceil(sections.length / 4));
  const hasCover =
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "HOLE_SUMMARY";
  return {
    reportType: snapshot.reportType,
    holeId: snapshot.holeId,
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    landscapePages,
    portraitPages,
    shiftGroups,
    hasCorrections: data.corrections.length > 0 || data.disclosures.length > 0,
    sections,
    oneDecimalSamples: data.runsheet.slice(0, 5).map((row) => formatMetres(row.holeDepthDm)),
    cover: hasCover ? buildReportCoverModel(snapshot) : undefined,
    analyticsGraphics: buildReportAnalyticsGraphicsModel(data),
  };
}

function sectionsFor(reportType: ReportType, data: ReportDocumentData): string[] {
  switch (reportType) {
    case "FULL_HOLE_RUNBOOK":
      return [
        "Hole and Project details",
        "Hole summary",
        "Analytical overview",
        "Completion details",
        "Shift sections",
        "Runsheet",
        "Rod history",
        "BHA and CSU changes",
        "Recovery summary",
        "Casing history",
        "Bit and reamer history",
        "Survey history",
        "Tray register",
        "Significant events",
        "Corrections",
        "Completion warnings",
      ].filter((section) => {
        if (section === "Completion details" || section === "Completion warnings") {
          return data.completion !== undefined;
        }
        if (section === "Analytical overview") {
          return data.holeAnalytics !== undefined;
        }
        return true;
      });
    case "CURRENT_SHIFT_RUNBOOK":
      return [
        "Hole",
        "Project",
        "Rig",
        "Shift",
        "Runs",
        "Rod state",
        "Components",
        "Casing",
        "Latest survey",
        "Current tray",
        "Handover",
      ];
    case "HOLE_SUMMARY":
      return [
        "Hole information",
        "Analytical overview",
        "Statistics",
        "Shifts",
        "Casing",
        "Components",
        "Surveys",
        "Trays",
        "Completion",
      ].filter((section) =>
        section === "Analytical overview" ? data.holeAnalytics !== undefined : true,
      );
    case "SURVEY_HISTORY":
      return ["Survey table", "Survey summary", "Corrections", "Duplicate depths"];
    case "TRAY_REGISTER":
      return ["Tray table"];
    case "COMPONENT_HISTORY":
      return ["Bits", "Reamers"];
    case "CASING_HISTORY":
      return ["Casing events"];
    default: {
      const _exhaustive: never = reportType;
      return [String(_exhaustive)];
    }
  }
}

class PdfWriter {
  private page!: PDFPage;
  private y = 0;
  private pageNumber = 0;
  private readonly pages: PDFPage[] = [];

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly landscape: boolean,
    private readonly meta: {
      readonly holeId: string;
      readonly version: number;
      readonly generatedAt: string;
      readonly reportLabel: string;
    },
  ) {
    this.newPage();
  }

  get width(): number {
    return this.landscape
      ? PDF_PAGE.landscapeWidth
      : PDF_PAGE.portraitWidth;
  }

  get height(): number {
    return this.landscape
      ? PDF_PAGE.landscapeHeight
      : PDF_PAGE.portraitHeight;
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  get cursorY(): number {
    return this.y;
  }

  setCursorY(value: number): void {
    this.y = value;
  }

  newPage(): void {
    this.page = this.doc.addPage([this.width, this.height]);
    this.pages.push(this.page);
    this.pageNumber += 1;
    this.y = this.height - MARGIN - 16;
  }

  ensureSpace(needed: number): void {
    if (this.y - needed < MARGIN + 28) {
      this.newPage();
    }
  }

  title(value: string): void {
    this.ensureSpace(LINE * 2);
    this.page.drawText(pdfSafeText(value), {
      x: MARGIN,
      y: this.y,
      size: 14,
      font: this.bold,
      color: PDF_THEME.navy,
    });
    this.y -= LINE * 2;
  }

  heading(value: string): void {
    this.ensureSpace(LINE * 2);
    drawSectionHeading(this.page, this.bold, {
      x: MARGIN,
      y: this.y,
      width: this.width - MARGIN * 2,
      label: value,
    });
    this.y -= LINE * 2;
  }

  line(value: string): void {
    const lines = wrapPdfText(
      value,
      this.font,
      9,
      this.width - MARGIN * 2,
    );
    for (const textLine of lines) {
      this.ensureSpace(LINE);
      this.page.drawText(textLine, {
        x: MARGIN,
        y: this.y,
        size: 9,
        font: this.font,
        color: PDF_THEME.ink,
      });
      this.y -= LINE;
    }
  }

  table(headers: readonly string[], rows: readonly (readonly string[])[]): void {
    const colWidth = (this.width - MARGIN * 2) / headers.length;
    let rowIndex = 0;
    const drawRow = (cells: readonly string[], header: boolean) => {
      this.ensureSpace(LINE + 2);
      if (header) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 2,
          width: this.width - MARGIN * 2,
          height: LINE + 2,
          color: PDF_THEME.navy,
        });
      } else if (rowIndex % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 2,
          width: this.width - MARGIN * 2,
          height: LINE + 2,
          color: PDF_THEME.surfaceMuted,
        });
      }
      cells.forEach((cell, index) => {
        const safe = pdfSafeText(cell);
        const maxCharacters = Math.max(6, Math.floor(colWidth / 4.3));
        const clipped =
          safe.length > maxCharacters
            ? `${safe.slice(0, maxCharacters - 3)}...`
            : safe;
        this.page.drawText(clipped, {
          x: MARGIN + index * colWidth + 2,
          y: this.y,
          size: 8,
          font: header ? this.bold : this.font,
          color: header ? PDF_THEME.white : PDF_THEME.ink,
        });
      });
      this.y -= LINE + 2;
      if (!header) rowIndex += 1;
    };

    drawRow(headers, true);
    for (const row of rows) {
      if (this.y < MARGIN + 40) {
        this.newPage();
        drawRow(headers, true);
      }
      drawRow(row, false);
    }
  }

  finalize(): void {
    const pageCount = this.pages.length;
    this.pages.forEach((page, index) => {
      drawBrandHeaderFooter(page, this.font, this.bold, {
        holeId: this.meta.holeId,
        reportLabel: this.meta.reportLabel,
        versionLabel: formatReportVersion(this.meta.version),
        generatedAt: this.meta.generatedAt,
        pageNumber: index + 1,
        pageCount,
        width: this.width,
        height: this.height,
      });
    });
  }
}

function percent(tenths: number): string {
  return `${(tenths / 10).toFixed(1)}%`;
}

export interface ReportPdfAssets {
  readonly locationMap?: {
    readonly bytes: Uint8Array;
    readonly mediaType: "image/png" | "image/jpeg";
    readonly attribution: string;
  };
}

export async function generateReportPdf(
  snapshot: ReportSnapshot,
  assets?: ReportPdfAssets,
): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const data = snapshot.documentData;
  const layout = buildPdfLayoutModel(snapshot);
  const generatedDate = new Date(snapshot.generatedAt);
  if (Number.isFinite(generatedDate.getTime())) {
    doc.setCreationDate(generatedDate);
    doc.setModificationDate(generatedDate);
  }
  doc.setProducer("TargetLock offline report generator");
  doc.setCreator("TargetLock");
  doc.setTitle(
    `${snapshot.holeId} ${reportTypeLabel(snapshot.reportType)} ${formatReportVersion(snapshot.version)}`,
  );
  doc.setSubject("Deterministic offline drilling report snapshot");
  doc.setKeywords([
    "TargetLock",
    snapshot.holeId,
    reportTypeLabel(snapshot.reportType),
  ]);
  const locationMap =
    assets?.locationMap === undefined
      ? undefined
      : assets.locationMap.mediaType === "image/png"
        ? await doc.embedPng(assets.locationMap.bytes)
        : await doc.embedJpg(assets.locationMap.bytes);
  const landscape =
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK";
  const writer = new PdfWriter(doc, font, bold, landscape, {
    holeId: snapshot.holeId,
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    reportLabel: reportTypeLabel(snapshot.reportType),
  });

  if (layout.cover) {
    const afterHero = drawReportCoverHero({
      page: writer.currentPage,
      font,
      bold,
      model: layout.cover,
      x: MARGIN,
      y: writer.cursorY,
      width: writer.width - MARGIN * 2,
      height: landscape ? 185 : 225,
      mapImage: locationMap,
      mapAttribution: assets?.locationMap?.attribution,
    });
    writer.setCursorY(
      drawReportKpiGrid({
        page: writer.currentPage,
        font,
        bold,
        kpis: layout.cover.kpis,
        x: MARGIN,
        y: afterHero,
        width: writer.width - MARGIN * 2,
      }),
    );
    const chartHeight = landscape ? 124 : 155;
    writer.ensureSpace(chartHeight + 6);
    const graphics = drawReportAnalyticsGraphicsOnPdfPage({
      page: writer.currentPage,
      font,
      bold,
      model: layout.analyticsGraphics,
      x: MARGIN,
      y: writer.cursorY,
      width: writer.width - MARGIN * 2,
      height: chartHeight,
    });
    writer.setCursorY(graphics.nextY);
    writer.newPage();
  } else {
    writer.title(`TargetLock Runbook — ${reportTypeLabel(snapshot.reportType)}`);
    writer.line(`Hole ID ${data.holeId} · ${data.holeName}`);
    writer.line(`Project ${data.projectName} · Rig ${data.rigName}`);
    writer.line(
      `Status ${data.holeStatus} · Current/final depth ${formatMetres(data.currentOrFinalDepthDm)} · Planned ${formatMetres(data.plannedDepthDm)}`,
    );
    writer.line(
      `Generated ${snapshot.generatedAt} · Report ${formatReportVersion(snapshot.version)} · By ${snapshot.generatedByNameSnapshot}`,
    );
  }

  if (snapshot.reportType === "HOLE_SUMMARY") {
    writer.heading("Hole Summary");
    writer.line(`Total Runs ${data.statistics.totalRuns}`);
    writer.line(`Total drilled ${formatMetres(data.statistics.totalDrilledDm)}`);
    writer.line(
      `Total recovered ${formatMetres(data.statistics.totalRecoveredDm)}`,
    );
    writer.line(
      `Weighted recovery ${percent(data.statistics.weightedRecoveryPercentTenths)}`,
    );
  }

  if (
    data.holeAnalytics &&
    (snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
      snapshot.reportType === "HOLE_SUMMARY")
  ) {
    const analytics = data.holeAnalytics;
    writer.heading("Analytical overview");
    writer.line(
      `Executive summary · Status ${data.holeStatus} · Final/current ${formatMetres(analytics.currentOrFinalDepthDm)} · Planned ${formatMetres(analytics.plannedDepthDm)}`,
    );
    if (data.completion) {
      writer.line(`Completion reason ${data.completion.reason}`);
    }
    writer.line(
      `Runs ${analytics.totalCompletedRuns} · Shifts ${analytics.completedShifts} · Weighted recovery ${analytics.weightedRecoveryTenths === undefined ? "Not available" : percent(analytics.weightedRecoveryTenths)}`,
    );
    writer.line(
      `Average metres per Shift ${analytics.averageMetresPerCompletedShiftDm === undefined ? "Not available" : formatMetres(analytics.averageMetresPerCompletedShiftDm)} · Surveys ${analytics.surveyCount} · Trays ${analytics.trayCount} · Bits ${analytics.bitsUsed} · Reamers ${analytics.reamersUsed}`,
    );
    writer.line(
      `Total drilled ${formatMetres(analytics.totalDrilledDm)} · Recovered ${formatMetres(analytics.totalRecoveredDm)} · Loss ${formatMetres(analytics.totalCoreLossDm)} · Gain ${formatMetres(analytics.totalCoreGainDm)}`,
    );
    writer.line(
      `Day Shifts ${analytics.dayShifts} · Night Shifts ${analytics.nightShifts} · Shared Runs ${analytics.sharedRuns}`,
    );
    writer.line(
      `Rods +3.0 m ${analytics.rodsAdded3m} · +6.0 m ${analytics.rodsAdded6m} · removed ${analytics.rodsRemoved}`,
    );
    writer.heading("Analytical notes");
    writer.line(
      "Cover-page vector charts and the following searchable notes use the same repository-backed analytics snapshot.",
    );
    for (const chart of analytics.chartSummaries) {
      writer.line(`${chart.chart}: ${chart.summary}`);
    }
    writer.heading("Record completeness");
    for (const category of analytics.completeness) {
      writer.line(
        `${category.category}: ${category.status}${category.notes.length > 0 ? ` · ${category.notes.join("; ")}` : ""}`,
      );
    }
    if (analytics.mixedNorthReferenceWarning) {
      writer.line(analytics.mixedNorthReferenceWarning);
    }
  }

  if (
    data.trajectorySummary &&
    (snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
      snapshot.reportType === "HOLE_SUMMARY" ||
      snapshot.reportType === "CURRENT_SHIFT_RUNBOOK")
  ) {
    const trajectory = data.trajectorySummary;
    writer.heading("Trajectory tracking summary");
    writer.line(`Active plan ${trajectory.activePlanName ?? "None"}`);
    writer.line(
      `Coordinate system ${trajectory.coordinateSystemName ?? trajectory.coordinateMode ?? "Relative"}`,
    );
    writer.line(`Desurvey method ${trajectory.desurveyMethod}`);
    writer.line(`Engine ${trajectory.engineVersion}`);
    if (trajectory.latestSurveyDepthM !== undefined) {
      writer.line(
        `Latest Survey depth ${trajectory.latestSurveyDepthM.toFixed(1)} m`,
      );
    }
    if (
      trajectory.plannedEastingM !== undefined &&
      trajectory.plannedNorthingM !== undefined &&
      trajectory.plannedRlM !== undefined
    ) {
      writer.line(
        `Current planned position E ${trajectory.plannedEastingM.toFixed(1)} N ${trajectory.plannedNorthingM.toFixed(1)} RL ${trajectory.plannedRlM.toFixed(1)}`,
      );
    }
    if (
      trajectory.actualEastingM !== undefined &&
      trajectory.actualNorthingM !== undefined &&
      trajectory.actualRlM !== undefined
    ) {
      writer.line(
        `Current actual position E ${trajectory.actualEastingM.toFixed(1)} N ${trajectory.actualNorthingM.toFixed(1)} RL ${trajectory.actualRlM.toFixed(1)}`,
      );
    }
    if (trajectory.horizontalDeviationM !== undefined) {
      writer.line(
        `Horizontal deviation from plan ${trajectory.horizontalDeviationM.toFixed(1)} m`,
      );
    }
    if (trajectory.verticalDeviationM !== undefined) {
      writer.line(
        `Vertical deviation from plan ${trajectory.verticalDeviationM.toFixed(1)} m`,
      );
    }
    if (trajectory.spatialDeviationM !== undefined) {
      writer.line(
        `3D deviation from plan ${trajectory.spatialDeviationM.toFixed(1)} m`,
      );
    }
    if (trajectory.targetMeasuredDepthM !== undefined) {
      writer.line(
        `Target MD ${trajectory.targetMeasuredDepthM.toFixed(1)} m`,
      );
    }
    if (
      trajectory.targetEastingM !== undefined &&
      trajectory.targetNorthingM !== undefined &&
      trajectory.targetRlM !== undefined
    ) {
      writer.line(
        `Target position E ${trajectory.targetEastingM.toFixed(1)} N ${trajectory.targetNorthingM.toFixed(1)} RL ${trajectory.targetRlM.toFixed(1)}`,
      );
    }
    if (trajectory.targetDiameterM !== undefined) {
      writer.line(
        `Target diameter ${trajectory.targetDiameterM.toFixed(1)} m`,
      );
    }
    if (trajectory.targetAttitudeMode) {
      writer.line(`Target entry direction ${trajectory.targetAttitudeMode}`);
    }
    if (
      trajectory.nextSurveyDipDegrees !== undefined &&
      trajectory.nextSurveyAzimuthDegrees !== undefined &&
      trajectory.nextSurveyMeasuredDepthM !== undefined
    ) {
      writer.line(
        `Next-Survey target at ${trajectory.nextSurveyMeasuredDepthM.toFixed(1)} m: dip ${trajectory.nextSurveyDipDegrees.toFixed(1)}° azimuth ${trajectory.nextSurveyAzimuthDegrees.toFixed(1)}°`,
      );
    }
    if (trajectory.projectedMissOutsideTargetM !== undefined) {
      writer.line(
        `Projected miss outside target ${trajectory.projectedMissOutsideTargetM.toFixed(1)} m`,
      );
    }
    if (trajectory.distanceToTargetM !== undefined) {
      writer.line(
        `Distance from surveyed endpoint to target ${trajectory.distanceToTargetM.toFixed(1)} m`,
      );
    }
    if (trajectory.plannedEndpointDistanceToTargetM !== undefined) {
      writer.line(
        `Planned endpoint distance to target ${trajectory.plannedEndpointDistanceToTargetM.toFixed(1)} m`,
      );
    }
    if (trajectory.geometricGuidanceDisclaimer) {
      writer.line(trajectory.geometricGuidanceDisclaimer);
    }
    writer.line(`Trajectory warnings ${trajectory.warningCount}`);

    const plannedRenderPath = trajectory.plannedRenderPath ?? [];
    const actualRenderPath = trajectory.actualRenderPath ?? [];
    if (plannedRenderPath.length > 0 || actualRenderPath.length > 0) {
      writer.ensureSpace(220);
      const viewModel = buildReportTrajectoryViewModel({
        holeId: snapshot.holeId,
        engineVersion: trajectory.engineVersion,
        activePlanName: trajectory.activePlanName,
        plannedPath: plannedRenderPath,
        actualPath: actualRenderPath,
        plannedStations: trajectory.plannedStations.map((station) => ({
          measuredDepthM: station.measuredDepthM,
          eastingM: station.eastingM,
          northingM: station.northingM,
          rlM: station.rlM,
        })),
        actualStations: trajectory.actualStations.map((station) => ({
          measuredDepthM: station.measuredDepthM,
          eastingM: station.eastingM,
          northingM: station.northingM,
          rlM: station.rlM,
        })),
        target:
          trajectory.targetEastingM !== undefined &&
          trajectory.targetNorthingM !== undefined &&
          trajectory.targetRlM !== undefined
            ? {
                eastingM: trajectory.targetEastingM,
                northingM: trajectory.targetNorthingM,
                rlM: trajectory.targetRlM,
                radiusM: trajectory.targetRadiusM,
              }
            : undefined,
        sectionBearingDegrees: trajectory.sectionBearingDegrees,
      });
      const nextY = drawTrajectoryGraphicsOnPdfPage({
        page: writer.currentPage,
        font,
        bold,
        model: viewModel,
        x: MARGIN,
        y: writer.cursorY,
        width: writer.width - MARGIN * 2,
        height: 200,
      });
      writer.setCursorY(nextY);
    }
  }

  if (data.completion) {
    writer.heading("Completion");
    writer.line(
      `${data.completion.finalStatus} · ${data.completion.reason} · ${data.completion.completedByName} · ${data.completion.completedAt}`,
    );
    if (data.completion.comment) writer.line(data.completion.comment);
    for (const warning of data.completion.warningAcknowledgements) {
      writer.line(`Acknowledged warning: ${warning}`);
    }
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK" ||
    snapshot.reportType === "HOLE_SUMMARY"
  ) {
    writer.heading("Shift sections");
    for (const shift of data.shifts) {
      writer.line(
        `${shift.label} · ${shift.primaryDrillerName} · ${formatMetres(shift.startingDepthDm)} -> ${formatMetres(shift.endingDepthDm)} · shared runs ${shift.sharedRunIds.length}`,
      );
      if (shift.handoverNote) writer.line(`Handover: ${shift.handoverNote}`);
    }

    if (
      snapshot.reportType === "CURRENT_SHIFT_RUNBOOK" &&
      data.shiftAnalytics
    ) {
      const analytics = data.shiftAnalytics;
      writer.heading("Shift analytics");
      writer.line(
        `Starting depth ${formatMetres(analytics.startingDepthDm)} · Ending depth ${formatMetres(analytics.endingDepthDm)} · Metres completed ${formatMetres(analytics.metresCompletedDm)}`,
      );
      writer.line(
        `Runs completed ${analytics.completedRunCount} · Shared ${analytics.sharedRunCount} · Voided ${analytics.voidedRunCount} · Corrections ${analytics.runCorrectionCount}`,
      );
      writer.line(
        `Average Run ${analytics.averageRunLengthDm === undefined ? "Not available" : formatMetres(analytics.averageRunLengthDm)} · Median Run ${analytics.medianRunLengthDm === undefined ? "Not available" : formatMetres(analytics.medianRunLengthDm)}`,
      );
      writer.line(
        `Recovered ${formatMetres(analytics.totalRecoveredDm)} · Weighted recovery ${analytics.weightedRecoveryTenths === undefined ? "Not available" : percent(analytics.weightedRecoveryTenths)} · Core loss ${formatMetres(analytics.totalCoreLossDm)} · Core gain ${formatMetres(analytics.totalCoreGainDm)}`,
      );
      writer.line(
        `Rods +3.0 m ${analytics.rodsAdded3m} · +6.0 m ${analytics.rodsAdded6m} · removed ${analytics.rodsRemoved} · Rod ${analytics.startingRodNumber} → ${analytics.endingRodNumber}`,
      );
      writer.line(
        `R/S ${formatMetres(analytics.startingRodStringDm)} → ${formatMetres(analytics.endingRodStringDm)}`,
      );
      writer.line(
        `Surveys ${analytics.surveyCount} · Trays ${analytics.trayCount} · Casing ${analytics.casingEventCount} · Bit changes ${analytics.bitChangeCount} · Reamer changes ${analytics.reamerChangeCount}`,
      );
      if (analytics.grossMetresPerElapsedHourTenths !== undefined) {
        writer.line(
          `Gross metres per elapsed Shift hour ${(analytics.grossMetresPerElapsedHourTenths / 10).toFixed(1)} m/h (elapsed Shift time includes all recorded activity)`,
        );
      }
      if (analytics.unresolvedItems.length > 0) {
        writer.line("Unresolved handover items:");
        for (const item of analytics.unresolvedItems) {
          writer.line(`- ${item}`);
        }
      }
    }

    writer.heading("Runsheet");
    writer.table(
      [
        "Run",
        "Rod No.",
        "Rod added",
        "R/S",
        "Stick-up",
        "Hole depth",
        "Drilled",
        "Recovered",
        "Recovery",
      ],
      data.runsheet.map((row) => [
        `${row.runNumber}${row.shared ? " S" : ""}`,
        String(row.rodNumber),
        formatMetres(row.rodAddedDm).replace(" m", ""),
        formatMetres(row.rodStringDm).replace(" m", ""),
        formatMetres(row.stickUpDm).replace(" m", ""),
        formatMetres(row.holeDepthDm).replace(" m", ""),
        formatMetres(row.drilledDm).replace(" m", ""),
        formatMetres(row.recoveredDm).replace(" m", ""),
        percent(row.recoveryPercentTenths),
      ]),
    );
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK"
  ) {
    writer.heading("Rod history");
    writer.line(data.rodConfigurationSummary);
    writer.line(data.currentRodState);
    for (const event of data.rodEvents.slice(0, 40)) {
      writer.line(
        `${event.action} ${formatMetres(event.rodLengthDm)} · ${event.userName} · ${event.recordedAt}`,
      );
    }
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "HOLE_SUMMARY" ||
    snapshot.reportType === "CASING_HISTORY" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK"
  ) {
    writer.heading("Casing history");
    writer.line(data.casingSummary);
    writer.table(
      ["Size", "Event", "Start", "End", "Status", "User", "When"],
      data.casingEvents.map((event) => [
        event.casingSize,
        event.eventType,
        event.startDepthDm === undefined
          ? ""
          : formatMetres(event.startDepthDm).replace(" m", ""),
        event.endDepthDm === undefined
          ? ""
          : formatMetres(event.endDepthDm).replace(" m", ""),
        event.status,
        event.userName,
        event.recordedAt.slice(0, 16),
      ]),
    );
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "COMPONENT_HISTORY" ||
    snapshot.reportType === "HOLE_SUMMARY" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK"
  ) {
    writer.heading("Bit history");
    writer.table(
      ["Serial", "Status", "Start", "End", "Metres", "Runs", "Recovery"],
      data.bits.map((row) => [
        row.serialNumber,
        row.status,
        formatMetres(row.startDepthDm).replace(" m", ""),
        row.endDepthDm === undefined
          ? ""
          : formatMetres(row.endDepthDm).replace(" m", ""),
        formatMetres(row.recordedMetresDm).replace(" m", ""),
        String(row.runsTouched),
        row.recoveryOrEstimateLabel,
      ]),
    );
    writer.heading("Reamer history");
    writer.table(
      ["Serial", "Status", "Start", "End", "Metres", "Runs", "Recovery"],
      data.reamers.map((row) => [
        row.serialNumber,
        row.status,
        formatMetres(row.startDepthDm).replace(" m", ""),
        row.endDepthDm === undefined
          ? ""
          : formatMetres(row.endDepthDm).replace(" m", ""),
        formatMetres(row.recordedMetresDm).replace(" m", ""),
        String(row.runsTouched),
        row.recoveryOrEstimateLabel,
      ]),
    );
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "SURVEY_HISTORY" ||
    snapshot.reportType === "HOLE_SUMMARY" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK"
  ) {
    writer.heading("Survey history");
    writer.line(
      `Total ${data.surveySummary.total} · Duplicate depths ${data.surveySummary.duplicateDepthCount} · Corrections ${data.surveySummary.correctionCount}`,
    );
    if (data.surveySummary.averageSpacingDm !== undefined) {
      writer.line(
        `Average spacing ${formatMetres(data.surveySummary.averageSpacingDm)} · Largest gap ${formatMetres(data.surveySummary.largestGapDm ?? data.surveySummary.averageSpacingDm)}`,
      );
    }
    writer.table(
      ["Depth", "Dip", "Azimuth", "Reference", "Tool", "Serial", "Recorded"],
      data.surveys.map((survey) => [
        formatMetres(survey.depthDm).replace(" m", ""),
        (survey.dipTenths / 10).toFixed(1),
        (survey.azimuthTenths / 10).toFixed(1),
        survey.northReference,
        survey.toolName,
        survey.toolSerial,
        survey.recordedAt.slice(0, 16),
      ]),
    );
  }

  if (
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "TRAY_REGISTER" ||
    snapshot.reportType === "HOLE_SUMMARY" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK"
  ) {
    writer.heading("Tray register");
    writer.table(
      ["Tray", "Start", "End", "Related Runs", "Photo date", "Final partial"],
      data.trays.map((tray) => [
        String(tray.trayNumber),
        formatMetres(tray.startDepthDm).replace(" m", ""),
        formatMetres(tray.endDepthDm).replace(" m", ""),
        tray.relatedRunNumbers.join(","),
        tray.photoDate?.slice(0, 10) ?? "",
        tray.finalPartial ? "yes" : "no",
      ]),
    );
  }

  if (snapshot.reportType === "FULL_HOLE_RUNBOOK" || snapshot.reportType === "HOLE_SUMMARY") {
    writer.heading("Recovery summary");
    writer.line(
      `Drilled ${formatMetres(data.statistics.totalDrilledDm)} · Recovered ${formatMetres(data.statistics.totalRecoveredDm)} · Weighted recovery ${percent(data.statistics.weightedRecoveryPercentTenths)}`,
    );
    writer.line(
      `Loss ${formatMetres(data.statistics.totalLossDm)} · Gain ${formatMetres(data.statistics.totalGainDm)}`,
    );
  }

  if (data.significantEvents.length > 0) {
    writer.heading("Significant events");
    for (const event of data.significantEvents) writer.line(event);
  }

  if (data.corrections.length > 0 || data.disclosures.length > 0) {
    writer.heading("Corrections and disclosures");
    for (const disclosure of data.disclosures) writer.line(disclosure);
    for (const correction of data.corrections) {
      writer.line(
        `${correction.entityType}/${correction.fieldName}: ${correction.previousValue} -> ${correction.correctedValue} (${correction.reason})`,
      );
    }
  }

  writer.finalize();
  const bytes = await doc.save();
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
