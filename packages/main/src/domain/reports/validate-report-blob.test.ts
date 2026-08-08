import { describe, expect, it } from "vitest";

import {
  assertValidReportBlob,
  formatFileSize,
  ReportBlobValidationError,
} from "./validate-report-blob";

describe("assertValidReportBlob", () => {
  it("accepts a minimal valid PDF", async () => {
    const content = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";
    await expect(
      assertValidReportBlob({
        blob: new Blob([content], { type: "application/pdf" }),
        format: "PDF",
        filename: "DDH041_Hole_Summary_v001_2026-07-24.pdf",
        mimeType: "application/pdf",
      }),
    ).resolves.toBeUndefined();
  });

  it("validates large PDFs without spreading the payload onto the call stack", async () => {
    const body = new Uint8Array(300_000);
    const blob = new Blob(["%PDF-1.7\n", body, "\n%%EOF\n"], {
      type: "application/pdf",
    });
    await expect(
      assertValidReportBlob({
        blob,
        format: "PDF",
        filename: "DDH041_Hole_Summary_v001_2026-07-24.pdf",
        mimeType: "application/pdf",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects empty blobs", async () => {
    await expect(
      assertValidReportBlob({
        blob: new Blob([], { type: "application/pdf" }),
        format: "PDF",
        filename: "empty.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toBeInstanceOf(ReportBlobValidationError);
  });

  it("rejects HTML disguised as PDF", async () => {
    await expect(
      assertValidReportBlob({
        blob: new Blob(["<html><body>not a pdf</body></html>"], {
          type: "application/pdf",
        }),
        format: "PDF",
        filename: "fake.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toMatchObject({ code: "SIGNATURE" });
  });

  it("accepts ZIP/XLSX signature", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    await expect(
      assertValidReportBlob({
        blob: new Blob([zip], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        format: "XLSX",
        filename: "DDH041_Runbook_v001_2026-07-24.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts UTF-8 CSV", async () => {
    await expect(
      assertValidReportBlob({
        blob: new Blob(["\uFEFFhole_id,depth\nDDH041,661.5\n"], {
          type: "text/csv;charset=utf-8",
        }),
        format: "CSV",
        filename: "DDH041_Hole_Summary_runs_v001_2026-07-24.csv",
        mimeType: "text/csv",
      }),
    ).resolves.toBeUndefined();
  });

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
});
