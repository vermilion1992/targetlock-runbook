import { describe, expect, it } from "vitest";

import { decimetres, type ReportDocumentData } from "@/domain";

import { generateCsvDataset } from "./csv-generator";

function sampleData(): ReportDocumentData {
  return {
    holeId: "DDH041",
    holeName: "DDH041",
    projectName: "Briggs",
    rigName: "Rig 1",
    holeStatus: "Active",
    currentOrFinalDepthDm: decimetres(6615),
    plannedDepthDm: decimetres(7000),
    shifts: [],
    runsheet: [
      {
        runNumber: 1,
        runId: "run-1",
        shared: false,
        rodNumber: 10,
        rodAddedDm: decimetres(30),
        rodStringDm: decimetres(100),
        stickUpDm: decimetres(5),
        holeDepthDm: decimetres(6615),
        drilledDm: decimetres(30),
        recoveredDm: decimetres(29),
        recoveryPercentTenths: 967,
      },
    ],
    rodEvents: [],
    rodConfigurationSummary: "",
    currentRodState: "",
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
        previousValue: "ok",
        correctedValue: "=1+1",
        reason: "fix",
        correctedByName: "Lee",
        correctedAt: "2026-07-22T00:00:00.000Z",
      },
    ],
    timelineSummary: [],
    significantEvents: [],
    statistics: {
      totalRuns: 1,
      totalDrilledDm: decimetres(30),
      totalRecoveredDm: decimetres(29),
      weightedRecoveryPercentTenths: 967,
      totalLossDm: decimetres(1),
      totalGainDm: decimetres(0),
      surveyCount: 0,
      trayCount: 0,
      shiftCount: 0,
    },
    disclosures: [],
  };
}

describe("generateCsvDataset", () => {
  it("writes UTF-8 BOM, numeric depths and formula-safe text", () => {
    const runs = generateCsvDataset("runs", sampleData());
    expect(runs.startsWith("\uFEFF")).toBe(true);
    expect(runs).toContain("end_depth_m");
    expect(runs).toContain("661.5");

    const corrections = generateCsvDataset("corrections", sampleData());
    expect(corrections).toContain("'=1+1");
  });

  it("supports empty datasets", () => {
    const empty = sampleData();
    const csv = generateCsvDataset("surveys", {
      ...empty,
      surveys: [],
    });
    expect(csv).toContain("depth_m");
    expect(csv.trim().split(/\r?\n/).length).toBe(1);
  });
});
