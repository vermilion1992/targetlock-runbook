import {
  PDFDocument,
  StandardFonts,
  rgb,
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

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const PORTRAIT_WIDTH = 595.28;
const PORTRAIT_HEIGHT = 841.89;
const MARGIN = 36;
const LINE = 12;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.25, 0.25, 0.25);

interface PdfLayoutModel {
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
  };
}

function sectionsFor(reportType: ReportType, data: ReportDocumentData): string[] {
  switch (reportType) {
    case "FULL_HOLE_RUNBOOK":
      return [
        "Hole and Project details",
        "Hole summary",
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
      return ["Hole information", "Statistics", "Shifts", "Casing", "Components", "Surveys", "Trays", "Completion"];
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

function drawHeaderFooter(
  page: PDFPage,
  font: PDFFont,
  input: {
    readonly holeId: string;
    readonly version: number;
    readonly generatedAt: string;
    readonly pageNumber: number;
    readonly pageCount: number;
    readonly width: number;
    readonly height: number;
  },
): void {
  const header = `TargetLock Runbook — ${input.holeId} — ${formatReportVersion(input.version)}`;
  page.drawText(header, {
    x: MARGIN,
    y: input.height - 24,
    size: 9,
    font,
    color: BLACK,
  });
  page.drawText(`Generated ${input.generatedAt}`, {
    x: MARGIN,
    y: 18,
    size: 8,
    font,
    color: GRAY,
  });
  const pageLabel = `Page ${input.pageNumber} of ${input.pageCount}`;
  const width = font.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, {
    x: input.width - MARGIN - width,
    y: 18,
    size: 8,
    font,
    color: GRAY,
  });
}

function pdfSafeText(value: string): string {
  return value
    .replace(/→/g, "->")
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n\r\t]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current.length > 0) lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length === 0 ? [""] : lines;
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
    },
  ) {
    this.newPage();
  }

  get width(): number {
    return this.landscape ? PAGE_WIDTH : PORTRAIT_WIDTH;
  }

  get height(): number {
    return this.landscape ? PAGE_HEIGHT : PORTRAIT_HEIGHT;
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
      color: BLACK,
    });
    this.y -= LINE * 2;
  }

  heading(value: string): void {
    this.ensureSpace(LINE * 1.5);
    this.page.drawText(pdfSafeText(value), {
      x: MARGIN,
      y: this.y,
      size: 11,
      font: this.bold,
      color: BLACK,
    });
    this.y -= LINE * 1.5;
  }

  line(value: string): void {
    const lines = wrapText(value, this.font, 9, this.width - MARGIN * 2);
    for (const textLine of lines) {
      this.ensureSpace(LINE);
      this.page.drawText(textLine, {
        x: MARGIN,
        y: this.y,
        size: 9,
        font: this.font,
        color: BLACK,
      });
      this.y -= LINE;
    }
  }

  table(headers: readonly string[], rows: readonly (readonly string[])[]): void {
    const colWidth = (this.width - MARGIN * 2) / headers.length;
    const drawRow = (cells: readonly string[], header: boolean) => {
      this.ensureSpace(LINE + 2);
      if (header) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 2,
          width: this.width - MARGIN * 2,
          height: LINE + 2,
          color: rgb(0.92, 0.92, 0.92),
        });
      }
      cells.forEach((cell, index) => {
        const safe = pdfSafeText(cell);
        const clipped = safe.length > 18 ? `${safe.slice(0, 17)}...` : safe;
        this.page.drawText(clipped, {
          x: MARGIN + index * colWidth + 2,
          y: this.y,
          size: 8,
          font: header ? this.bold : this.font,
          color: BLACK,
        });
      });
      this.y -= LINE + 2;
    };

    drawRow(headers, true);
    let rowIndex = 0;
    for (const row of rows) {
      if (this.y < MARGIN + 40) {
        this.newPage();
        drawRow(headers, true);
      }
      drawRow(row, false);
      rowIndex += 1;
      void rowIndex;
    }
  }

  finalize(): void {
    const pageCount = this.pages.length;
    this.pages.forEach((page, index) => {
      drawHeaderFooter(page, this.font, {
        holeId: this.meta.holeId,
        version: this.meta.version,
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

export async function generateReportPdf(snapshot: ReportSnapshot): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const data = snapshot.documentData;
  const landscape =
    snapshot.reportType === "FULL_HOLE_RUNBOOK" ||
    snapshot.reportType === "CURRENT_SHIFT_RUNBOOK";
  const writer = new PdfWriter(doc, font, bold, landscape, {
    holeId: snapshot.holeId,
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
  });

  writer.title(`TargetLock Runbook — ${reportTypeLabel(snapshot.reportType)}`);
  writer.line(`Hole ID ${data.holeId} · ${data.holeName}`);
  writer.line(`Project ${data.projectName} · Rig ${data.rigName}`);
  writer.line(
    `Status ${data.holeStatus} · Current/final depth ${formatMetres(data.currentOrFinalDepthDm)} · Planned ${formatMetres(data.plannedDepthDm)}`,
  );
  writer.line(
    `Generated ${snapshot.generatedAt} · Report ${formatReportVersion(snapshot.version)} · By ${snapshot.generatedByNameSnapshot}`,
  );

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
