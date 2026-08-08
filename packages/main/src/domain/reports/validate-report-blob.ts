import type { ReportFormat } from "./types";

export type ReportBlobValidationCode =
  | "EMPTY"
  | "MIME"
  | "FILENAME"
  | "SIGNATURE"
  | "STRUCTURE";

export class ReportBlobValidationError extends Error {
  constructor(
    readonly code: ReportBlobValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportBlobValidationError";
  }
}

const PDF_MIME = "application/pdf";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME_PREFIX = "text/csv";

function startsWithBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  if (bytes.length < expected.length) return false;
  return expected.every((value, index) => bytes[index] === value);
}

function includesBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  if (expected.length === 0) return true;
  for (let offset = 0; offset <= bytes.length - expected.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < expected.length; index += 1) {
      if (bytes[offset + index] !== expected[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

async function readPrefix(blob: Blob, length: number): Promise<Uint8Array> {
  const slice = blob.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function assertValidReportBlob(input: {
  readonly blob: Blob;
  readonly format: ReportFormat;
  readonly filename: string;
  readonly mimeType: string;
}): Promise<void> {
  if (input.blob.size <= 0) {
    throw new ReportBlobValidationError(
      "EMPTY",
      "Generated report file is empty and cannot be saved.",
    );
  }

  if (input.format === "PDF") {
    if (!input.filename.toLowerCase().endsWith(".pdf")) {
      throw new ReportBlobValidationError(
        "FILENAME",
        "PDF reports must use a .pdf filename.",
      );
    }
    if (input.mimeType !== PDF_MIME && input.blob.type !== PDF_MIME) {
      throw new ReportBlobValidationError(
        "MIME",
        "PDF reports must use application/pdf.",
      );
    }
    const prefix = await readPrefix(input.blob, 8);
    const header = String.fromCharCode(...prefix.slice(0, 5));
    if (header !== "%PDF-") {
      throw new ReportBlobValidationError(
        "SIGNATURE",
        "PDF signature validation failed.",
      );
    }
    // Minimal structure check: require an EOF marker somewhere in the payload.
    const sample = await readPrefix(input.blob, Math.min(input.blob.size, 256_000));
    const hasEof =
      includesBytes(sample, [0x25, 0x25, 0x45, 0x4f, 0x46]) ||
      (await input.blob.slice(Math.max(0, input.blob.size - 1024)).text()).includes(
        "%%EOF",
      );
    if (!hasEof) {
      throw new ReportBlobValidationError(
        "STRUCTURE",
        "PDF structure validation failed (missing EOF).",
      );
    }
    return;
  }

  if (input.format === "XLSX") {
    if (!input.filename.toLowerCase().endsWith(".xlsx")) {
      throw new ReportBlobValidationError(
        "FILENAME",
        "Excel reports must use a .xlsx filename.",
      );
    }
    if (input.mimeType !== XLSX_MIME && input.blob.type !== XLSX_MIME) {
      throw new ReportBlobValidationError(
        "MIME",
        "Excel reports must use the XLSX MIME type.",
      );
    }
    const prefix = await readPrefix(input.blob, 4);
    // ZIP local file header / empty archive — XLSX is a ZIP package.
    if (!startsWithBytes(prefix, [0x50, 0x4b, 0x03, 0x04]) &&
      !startsWithBytes(prefix, [0x50, 0x4b, 0x05, 0x06]) &&
      !startsWithBytes(prefix, [0x50, 0x4b, 0x07, 0x08])) {
      throw new ReportBlobValidationError(
        "SIGNATURE",
        "Excel ZIP/XLSX signature validation failed.",
      );
    }
    return;
  }

  if (!input.filename.toLowerCase().endsWith(".csv")) {
    throw new ReportBlobValidationError(
      "FILENAME",
      "CSV reports must use a .csv filename.",
    );
  }
  if (
    !input.mimeType.startsWith(CSV_MIME_PREFIX) &&
    !input.blob.type.startsWith(CSV_MIME_PREFIX)
  ) {
    throw new ReportBlobValidationError(
      "MIME",
      "CSV reports must use text/csv.",
    );
  }
  const text = await input.blob.slice(0, Math.min(input.blob.size, 8_192)).text();
  if (text.trim().length === 0) {
    throw new ReportBlobValidationError(
      "EMPTY",
      "CSV report content is empty.",
    );
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
