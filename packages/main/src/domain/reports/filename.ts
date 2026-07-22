import type { ReportFormat, ReportType } from "./types";
import { REPORT_TYPE_LABELS } from "./types";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const PATH_TRAVERSAL = /\.\./g;

export function sanitiseFilenamePart(value: string): string {
  return value
    .replace(PATH_TRAVERSAL, "")
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function formatReportVersion(version: number): string {
  return `v${String(Math.max(1, version)).padStart(3, "0")}`;
}

function dateStamp(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "unknown-date";
}

function typeSlug(reportType: ReportType): string {
  switch (reportType) {
    case "FULL_HOLE_RUNBOOK":
      return "Full_Runbook";
    case "CURRENT_SHIFT_RUNBOOK":
      return "Current_Shift";
    case "HOLE_SUMMARY":
      return "Hole_Summary";
    case "SURVEY_HISTORY":
      return "Survey_History";
    case "TRAY_REGISTER":
      return "Tray_Register";
    case "COMPONENT_HISTORY":
      return "Component_History";
    case "CASING_HISTORY":
      return "Casing_History";
    default: {
      const _exhaustive: never = reportType;
      return String(_exhaustive);
    }
  }
}

function extension(format: ReportFormat, csvDataset?: string): string {
  if (format === "PDF") return "pdf";
  if (format === "XLSX") return "xlsx";
  return csvDataset ? `${sanitiseFilenamePart(csvDataset)}.csv` : "csv";
}

export function buildReportFilename(input: {
  readonly holeId: string;
  readonly reportType: ReportType;
  readonly format: ReportFormat;
  readonly version: number;
  readonly generatedAt: string;
  readonly shiftLabel?: string;
  readonly csvDataset?: string;
}): string {
  const hole = sanitiseFilenamePart(input.holeId) || "Hole";
  const type = typeSlug(input.reportType);
  const version = formatReportVersion(input.version);
  const date = dateStamp(input.generatedAt);

  if (input.format === "XLSX") {
    return sanitiseFilenamePart(
      `${hole}_Runbook_${version}_${date}.xlsx`,
    ).replace(/\.xlsx$/i, "") + ".xlsx";
  }

  if (input.reportType === "CURRENT_SHIFT_RUNBOOK" && input.shiftLabel) {
    const shift = sanitiseFilenamePart(input.shiftLabel);
    const base = `${hole}_${type}_${shift}_${date}`;
    return `${sanitiseFilenamePart(base)}.${extension(input.format, input.csvDataset)}`;
  }

  if (input.format === "CSV" && input.csvDataset) {
    const dataset = sanitiseFilenamePart(input.csvDataset);
    const base = `${hole}_${type}_${dataset}_${version}_${date}`;
    return `${sanitiseFilenamePart(base)}.csv`;
  }

  const base = `${hole}_${type}_${version}_${date}`;
  return `${sanitiseFilenamePart(base)}.${extension(input.format)}`;
}

export function reportMimeType(
  format: ReportFormat,
): "application/pdf" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "text/csv" {
  if (format === "PDF") return "application/pdf";
  if (format === "XLSX") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "text/csv";
}

export function reportTypeLabel(reportType: ReportType): string {
  return REPORT_TYPE_LABELS[reportType];
}
