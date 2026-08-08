import { describe, expect, it } from "vitest";

import { buildReportFilename, sanitiseFilenamePart } from "./filename";

describe("buildReportFilename", () => {
  it("builds a Full-Hole PDF name with padded version", () => {
    expect(
      buildReportFilename({
        holeId: "DDH041",
        reportType: "FULL_HOLE_RUNBOOK",
        format: "PDF",
        version: 3,
        generatedAt: "2026-07-22T08:14:00.000Z",
      }),
    ).toBe("DDH041_Full_Runbook_v003_2026-07-22.pdf");
  });

  it("builds Shift Report names with shift label", () => {
    expect(
      buildReportFilename({
        holeId: "DDH041",
        reportType: "CURRENT_SHIFT_RUNBOOK",
        format: "PDF",
        version: 1,
        generatedAt: "2026-07-21T18:00:00.000Z",
        shiftLabel: "Night 2026-07-21",
      }),
    ).toBe("DDH041_Shift_Report_Night_2026-07-21_2026-07-21.pdf");
  });

  it("builds Excel workbook names", () => {
    expect(
      buildReportFilename({
        holeId: "DDH041",
        reportType: "FULL_HOLE_RUNBOOK",
        format: "XLSX",
        version: 3,
        generatedAt: "2026-07-22T08:14:00.000Z",
      }),
    ).toBe("DDH041_Runbook_v003_2026-07-22.xlsx");
  });

  it("sanitises path traversal and invalid characters", () => {
    expect(sanitiseFilenamePart("../evil:name?.pdf")).toBe("evil_name_.pdf");
    expect(
      buildReportFilename({
        holeId: "DDH/041",
        reportType: "HOLE_SUMMARY",
        format: "PDF",
        version: 1,
        generatedAt: "2026-07-22T00:00:00.000Z",
      }),
    ).toBe("DDH_041_Hole_Summary_v001_2026-07-22.pdf");
  });
});
