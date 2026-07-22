import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { decimetres, type ReportSnapshot } from "@/domain";

import { EXCEL_REQUIRED_SHEETS, generateExcelWorkbook } from "./excel-generator";

function snapshot(): ReportSnapshot {
  return {
    id: "snap-1",
    holeId: "DDH041",
    reportType: "FULL_HOLE_RUNBOOK",
    generatedAt: "2026-07-22T08:14:00.000Z",
    generatedByUserId: "user-1",
    generatedByNameSnapshot: "M. Hoffman",
    holeDepthSnapshotDm: decimetres(6615),
    holeStatusSnapshot: "Completed",
    sourceVersions: [],
    operationId: "op-xlsx-1",
    version: 1,
    documentData: {
      holeId: "DDH041",
      holeName: "DDH041",
      projectName: "Briggs",
      rigName: "Rig 1",
      holeStatus: "Completed",
      currentOrFinalDepthDm: decimetres(6615),
      plannedDepthDm: decimetres(7000),
      shifts: [],
      runsheet: [
        {
          runNumber: 1,
          runId: "run-1",
          shared: false,
          rodNumber: 1,
          rodAddedDm: decimetres(30),
          rodStringDm: decimetres(100),
          stickUpDm: decimetres(5),
          holeDepthDm: decimetres(6615),
          drilledDm: decimetres(30),
          recoveredDm: decimetres(30),
          recoveryPercentTenths: 1000,
        },
      ],
      rodEvents: [],
      rodConfigurationSummary: "base",
      currentRodState: "rod 1",
      casingSummary: "",
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
          fieldName: "comment",
          previousValue: "x",
          correctedValue: "+cmd|'/C calc'!A0",
          reason: "test",
          correctedByName: "Lee",
          correctedAt: "2026-07-22T00:00:00.000Z",
        },
      ],
      timelineSummary: ["timeline"],
      significantEvents: ["event"],
      statistics: {
        totalRuns: 1,
        totalDrilledDm: decimetres(30),
        totalRecoveredDm: decimetres(30),
        weightedRecoveryPercentTenths: 1000,
        totalLossDm: decimetres(0),
        totalGainDm: decimetres(0),
        surveyCount: 0,
        trayCount: 0,
        shiftCount: 0,
      },
      disclosures: [],
    },
  };
}

describe("generateExcelWorkbook", () => {
  it("includes required sheets, numeric cells and formula protection", async () => {
    const blob = await generateExcelWorkbook(snapshot());
    const buffer = Buffer.from(await blob.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    for (const name of EXCEL_REQUIRED_SHEETS) {
      expect(workbook.getWorksheet(name), name).toBeDefined();
    }

    const runs = workbook.getWorksheet("Runs");
    expect(runs).toBeDefined();
    expect(runs!.getRow(2).getCell(6).value).toBe(661.5);

    const corrections = workbook.getWorksheet("Corrections");
    const corrected = String(corrections!.getRow(2).getCell(5).value);
    expect(corrected.startsWith("'")).toBe(true);
  });
});
