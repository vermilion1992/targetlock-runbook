import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { decimetres, type ReportSnapshot } from "@/domain";

import { buildPdfLayoutModel, generateReportPdf } from "./pdf-generator";

function snapshot(overrides?: Partial<ReportSnapshot>): ReportSnapshot {
  return {
    id: "snap-pdf",
    holeId: "DDH041",
    reportType: "FULL_HOLE_RUNBOOK",
    generatedAt: "2026-07-22T08:14:00.000Z",
    generatedByUserId: "user-1",
    generatedByNameSnapshot: "M. Hoffman",
    holeDepthSnapshotDm: decimetres(6615),
    holeStatusSnapshot: "Active",
    sourceVersions: [],
    operationId: "op-pdf-1",
    version: 1,
    documentData: {
      holeId: "DDH041",
      holeName: "DDH041",
      projectName: "Briggs",
      rigName: "Rig 1",
      holeStatus: "Active",
      currentOrFinalDepthDm: decimetres(6615),
      plannedDepthDm: decimetres(7000),
      shifts: [
        {
          shiftId: "shift-1",
          shiftType: "DAY",
          shiftDate: "2026-07-21",
          label: "Day Shift 2026-07-21",
          primaryDrillerName: "Hoffman",
          crewNames: ["A"],
          startingDepthDm: decimetres(6500),
          endingDepthDm: decimetres(6615),
          runIds: ["run-1", "run-2"],
          sharedRunIds: ["run-2"],
        },
      ],
      runsheet: Array.from({ length: 40 }, (_, index) => ({
        runNumber: index + 1,
        runId: `run-${index + 1}`,
        shared: index === 1,
        rodNumber: index + 1,
        rodAddedDm: decimetres(30),
        rodStringDm: decimetres(100 + index),
        stickUpDm: decimetres(5),
        holeDepthDm: decimetres(6500 + index * 3),
        drilledDm: decimetres(30),
        recoveredDm: decimetres(29),
        recoveryPercentTenths: 967,
        shiftLabel: "Day Shift 2026-07-21",
      })),
      rodEvents: [],
      rodConfigurationSummary: "config",
      currentRodState: "state",
      casingSummary: "HQ",
      casingEvents: [],
      bits: [],
      reamers: [],
      surveys: [],
      surveySummary: {
        total: 0,
        duplicateDepthCount: 0,
        correctionCount: 0,
      },
      trays: [],
      corrections: [
        {
          correctionId: "c1",
          entityType: "survey",
          entityId: "s1",
          fieldName: "dipTenths",
          previousValue: "1",
          correctedValue: "2",
          reason: "typo",
          correctedByName: "Lee",
          correctedAt: "2026-07-22T00:00:00.000Z",
        },
      ],
      timelineSummary: [],
      significantEvents: [],
      statistics: {
        totalRuns: 40,
        totalDrilledDm: decimetres(1200),
        totalRecoveredDm: decimetres(1160),
        weightedRecoveryPercentTenths: 967,
        totalLossDm: decimetres(40),
        totalGainDm: decimetres(0),
        surveyCount: 0,
        trayCount: 0,
        shiftCount: 1,
      },
      disclosures: ["Correction disclosed"],
    },
    ...overrides,
  };
}

describe("buildPdfLayoutModel", () => {
  it("groups shifts, marks shared runs and one-decimal samples", () => {
    const model = buildPdfLayoutModel(snapshot());
    expect(model.shiftGroups).toEqual([
      {
        label: "Day Shift 2026-07-21",
        sharedRunCount: 1,
        runCount: 2,
      },
    ]);
    expect(model.landscapePages).toBeGreaterThan(1);
    expect(model.oneDecimalSamples[0]).toBe("650.0 m");
    expect(model.hasCorrections).toBe(true);
  });
});

describe("generateReportPdf", () => {
  it("produces a non-empty PDF blob with %PDF- signature", async () => {
    const blob = await generateReportPdf(snapshot());
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(header).toBe("%PDF-");
    const tail = await blob.slice(Math.max(0, blob.size - 1024)).text();
    expect(tail).toContain("%%EOF");
  });

  it("includes Hole Summary layout and at least one openable page", async () => {
    const holeSummary = snapshot({ reportType: "HOLE_SUMMARY", version: 1 });
    const model = buildPdfLayoutModel(holeSummary);
    expect(model.holeId).toBe("DDH041");
    expect(model.version).toBe(1);
    expect(model.sections).toEqual(
      expect.arrayContaining(["Hole information", "Statistics"]),
    );

    const blob = await generateReportPdf(holeSummary);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
