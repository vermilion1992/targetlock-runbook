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
    generatedByRoleSnapshot: "SUPERVISOR",
    holeDepthSnapshotDm: decimetres(6615),
    holeStatusSnapshot: "Active",
    sourceVersions: [],
    operationId: "op-pdf-1",
    version: 1,
    documentData: {
      holeId: "DDH041",
      holeName: "DDH041",
      projectName: "Briggs",
      projectCode: "BRG-26-01",
      clientName: "North Ridge Minerals",
      siteLocation: "Pilbara, Western Australia",
      rigName: "Rig 1",
      holeStatus: "Active",
      collar: {
        eastingM: 482315.42,
        northingM: 7514882.16,
        rlM: 487.3,
        dipDegrees: -60,
        azimuthDegrees: 128,
        northReference: "GRID",
        coordinateMode: "MINE_GRID",
        coordinateSystemName: "Pilbara Mine Grid",
        epsgCode: "EPSG:7850",
      },
      coordinateSystemLabel: "Pilbara Mine Grid · EPSG:7850",
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
      holeAnalytics: {
        calculatedAt: "2026-07-22T08:14:00.000Z",
        startingDepthDm: decimetres(6500),
        currentOrFinalDepthDm: decimetres(6615),
        plannedDepthDm: decimetres(7000),
        differenceFromPlannedDm: -385,
        totalDrilledDm: decimetres(1200),
        totalRecoveredDm: decimetres(1160),
        weightedRecoveryTenths: 967,
        totalCoreLossDm: decimetres(40),
        totalCoreGainDm: decimetres(0),
        totalCompletedRuns: 40,
        totalVoidedRuns: 0,
        totalCorrectedRuns: 1,
        averageRunLengthDm: decimetres(30),
        medianRunLengthDm: decimetres(30),
        completedShifts: 2,
        dayShifts: 1,
        nightShifts: 1,
        sharedRuns: 1,
        averageMetresPerCompletedShiftDm: decimetres(60),
        medianMetresPerCompletedShiftDm: decimetres(60),
        rodsAdded3m: 40,
        rodsAdded6m: 0,
        rodsRemoved: 0,
        bitsUsed: 2,
        reamersUsed: 1,
        surveyCount: 3,
        trayCount: 4,
        mixedNorthReferences: false,
        completeness: [],
        chartSummaries: [],
        shiftRows: [
          {
            shiftId: "shift-1",
            shiftType: "DAY",
            shiftDate: "2026-07-21",
            metresCompletedDm: decimetres(60),
            endingDepthDm: decimetres(6560),
            weightedRecoveryTenths: 960,
            analyticsAmended: false,
          },
          {
            shiftId: "shift-2",
            shiftType: "NIGHT",
            shiftDate: "2026-07-21",
            metresCompletedDm: decimetres(55),
            endingDepthDm: decimetres(6615),
            weightedRecoveryTenths: 974,
            analyticsAmended: false,
          },
        ],
        runRows: [
          {
            runNumber: 1,
            depthDm: 6530,
            drilledLengthDm: 30,
            recoveryPercentTenths: 950,
            lossDm: 2,
            gainDm: 0,
          },
          {
            runNumber: 2,
            depthDm: 6560,
            drilledLengthDm: 30,
            recoveryPercentTenths: 980,
            lossDm: 1,
            gainDm: 0,
          },
          {
            runNumber: 3,
            depthDm: 6590,
            drilledLengthDm: 30,
            recoveryPercentTenths: 970,
            lossDm: 1,
            gainDm: 0,
          },
        ],
        componentRows: [],
      },
      disclosures: ["Correction disclosed"],
    },
    ...overrides,
  };
}

function currentShiftSnapshot(): ReportSnapshot {
  const source = snapshot({ reportType: "CURRENT_SHIFT_RUNBOOK" });
  const currentShift = {
    ...source.documentData.shifts[0]!,
    startedAt: "2026-07-21T06:00:00.000Z",
    closedAt: "2026-07-21T18:00:00.000Z",
  };
  return {
    ...source,
    shiftId: currentShift.shiftId,
    documentData: {
      ...source.documentData,
      shifts: [currentShift],
      currentShift,
      surveys: [
        {
          surveyId: "survey-shift-1",
          depthDm: decimetres(6540),
          dipTenths: -612,
          azimuthTenths: 1294,
          northReference: "GRID",
          toolName: "Reflex EZ-Trac",
          toolSerial: "RX-441",
          recordedAt: "2026-07-21T10:25:00.000Z",
          corrected: false,
        },
        {
          surveyId: "survey-shift-2",
          depthDm: decimetres(6600),
          dipTenths: -619,
          azimuthTenths: 1302,
          northReference: "GRID",
          toolName: "Reflex EZ-Trac",
          toolSerial: "RX-441",
          recordedAt: "2026-07-21T16:40:00.000Z",
          corrected: false,
        },
      ],
      trays: [
        {
          trayId: "tray-shift-1",
          shiftId: currentShift.shiftId,
          trayNumber: 110,
          startDepthDm: decimetres(6500),
          endDepthDm: decimetres(6560),
          relatedRunNumbers: [1, 2],
          primaryPhotoId: "photo-shift-1",
          photoDate: "2026-07-21T11:00:00.000Z",
          finalPartial: false,
        },
        {
          trayId: "tray-shift-2",
          shiftId: currentShift.shiftId,
          trayNumber: 111,
          startDepthDm: decimetres(6560),
          endDepthDm: decimetres(6615),
          relatedRunNumbers: [3, 4],
          primaryPhotoId: "photo-shift-2",
          photoDate: "2026-07-21T17:00:00.000Z",
          finalPartial: false,
        },
      ],
      shiftAnalytics: {
        shiftId: currentShift.shiftId,
        startingDepthDm: decimetres(6500),
        endingDepthDm: decimetres(6615),
        metresCompletedDm: decimetres(115),
        completedRunCount: 40,
        sharedRunCount: 1,
        voidedRunCount: 0,
        runCorrectionCount: 0,
        averageRunLengthDm: decimetres(29),
        medianRunLengthDm: decimetres(30),
        totalRecoveredDm: decimetres(111),
        weightedRecoveryTenths: 965,
        totalCoreLossDm: decimetres(4),
        totalCoreGainDm: decimetres(0),
        startingRodNumber: 220,
        endingRodNumber: 224,
        rodsAdded3m: 4,
        rodsAdded6m: 0,
        rodsRemoved: 0,
        startingRodStringDm: decimetres(6500),
        endingRodStringDm: decimetres(6615),
        surveyCount: 2,
        trayCount: 2,
        casingEventCount: 0,
        bitChangeCount: 0,
        reamerChangeCount: 0,
        elapsedMinutes: 720,
        unresolvedItems: [],
      },
      trajectorySummary: {
        activePlanName: "DDH041 Rev A",
        desurveyMethod: "MINIMUM_CURVATURE",
        engineVersion: "trajectory-v2",
        warningCount: 0,
        targetEastingM: 482_610,
        targetNorthingM: 7_514_610,
        targetRlM: -80,
        targetRadiusM: 12,
        plannedRenderPath: [
          {
            measuredDepthM: 0,
            eastingM: 482_315,
            northingM: 7_514_882,
            rlM: 487,
          },
          {
            measuredDepthM: 350,
            eastingM: 482_450,
            northingM: 7_514_745,
            rlM: 190,
          },
          {
            measuredDepthM: 700,
            eastingM: 482_610,
            northingM: 7_514_610,
            rlM: -80,
          },
        ],
        actualRenderPath: [
          {
            measuredDepthM: 0,
            eastingM: 482_315,
            northingM: 7_514_882,
            rlM: 487,
          },
          {
            measuredDepthM: 350,
            eastingM: 482_443,
            northingM: 7_514_752,
            rlM: 196,
          },
          {
            measuredDepthM: 661.5,
            eastingM: 482_589,
            northingM: 7_514_628,
            rlM: -49,
          },
        ],
        plannedStations: [],
        actualStations: [],
        trackingRows: [],
      },
    },
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
    expect(model.cover).toMatchObject({
      holeTitle: "DDH041",
      clientLine: "North Ridge Minerals",
      siteLine: "Pilbara, Western Australia",
      coordinateSystemLabel: "Pilbara Mine Grid · EPSG:7850",
      coordinateLines: [
        "E 482315.42 m",
        "N 7514882.16 m",
        "RL 487.30 m",
      ],
      directionLine: "Dip -60.0 deg | Az 128.0 deg GRID",
      generatedByLine: "M. Hoffman | Supervisor",
    });
    expect(model.cover?.kpis.map((kpi) => kpi.label)).toEqual(
      expect.arrayContaining([
        "CURRENT / FINAL DEPTH",
        "PLANNED DEPTH",
        "DRILLED METRES",
        "WEIGHTED RECOVERY",
        "SURVEYS / TRAYS",
        "BITS / REAMERS",
      ]),
    );
    expect(model.analyticsGraphics.renderableChartCount).toBe(2);
  });
});

describe("generateReportPdf", () => {
  it("renders populated Current-Shift sections across readable landscape pages", async () => {
    const source = currentShiftSnapshot();
    const model = buildPdfLayoutModel(source);
    expect(model.landscapePages).toBe(5);
    expect(model.sections).toEqual([
      "Executive overview",
      "Shift runbook",
      "Surveys",
      "Core photography",
    ]);
    expect(model.cover?.kpis.map((kpi) => kpi.label)).toEqual([
      "METRES DRILLED",
      "STARTING DEPTH",
      "ENDING DEPTH",
      "RUNS COMPLETED",
      "AVERAGE RUN",
      "SHIFT DURATION",
      "SURVEYS RECORDED",
      "TRAYS PHOTOGRAPHED",
    ]);

    const png = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const blob = await generateReportPdf(source, {
      trayPhotos: [
        {
          trayId: "tray-shift-1",
          trayNumber: 110,
          bytes: png,
          mediaType: "image/png",
        },
      ],
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(5);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBeCloseTo(841.89, 1);
      expect(page.getHeight()).toBeCloseTo(595.28, 1);
    }
    expect(blob.size).toBeGreaterThan(5_000);
  });

  it("omits empty Current-Shift sections instead of stretching the report", async () => {
    const source = currentShiftSnapshot();
    const sparse: ReportSnapshot = {
      ...source,
      documentData: {
        ...source.documentData,
        runsheet: [],
        surveys: [],
        trays: [],
      },
    };

    const model = buildPdfLayoutModel(sparse);
    expect(model.landscapePages).toBe(1);
    expect(model.sections).toEqual(["Executive overview"]);

    const blob = await generateReportPdf(sparse);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
  });

  it("paginates dense runbooks, surveys, and tray galleries", async () => {
    const source = currentShiftSnapshot();
    const run = source.documentData.runsheet[0]!;
    const survey = source.documentData.surveys[0]!;
    const tray = source.documentData.trays[0]!;
    const dense: ReportSnapshot = {
      ...source,
      documentData: {
        ...source.documentData,
        runsheet: Array.from({ length: 25 }, (_, index) => ({
          ...run,
          runId: `run-dense-${index + 1}`,
          runNumber: index + 1,
        })),
        surveys: Array.from({ length: 23 }, (_, index) => ({
          ...survey,
          surveyId: `survey-dense-${index + 1}`,
          depthDm: decimetres(6_500 + index),
        })),
        trays: Array.from({ length: 10 }, (_, index) => ({
          ...tray,
          trayId: `tray-dense-${index + 1}`,
          trayNumber: 200 + index,
          primaryPhotoId: undefined,
        })),
      },
    };

    const model = buildPdfLayoutModel(dense);
    expect(model.landscapePages).toBe(7);

    const blob = await generateReportPdf(dense);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(7);
  });

  it("produces a non-empty PDF blob with %PDF- signature", async () => {
    const source = snapshot();
    const blob = await generateReportPdf(source);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(header).toBe("%PDF-");
    const tail = await blob.slice(Math.max(0, blob.size - 1024)).text();
    expect(tail).toContain("%%EOF");
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getTitle()).toContain("DDH041");
    expect(doc.getPageCount()).toBeGreaterThan(2);

    const repeated = await generateReportPdf(source);
    const repeatedDoc = await PDFDocument.load(await repeated.arrayBuffer());
    expect(repeatedDoc.getPageCount()).toBe(doc.getPageCount());
    expect(repeated.size).toBe(blob.size);
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
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("keeps old snapshots without enriched optional cover fields readable", async () => {
    const source = snapshot({ reportType: "HOLE_SUMMARY" });
    const legacy = {
      ...source,
      generatedByRoleSnapshot: undefined,
      documentData: {
        ...source.documentData,
        projectCode: undefined,
        clientName: undefined,
        siteLocation: undefined,
        collar: undefined,
        coordinateSystemLabel: undefined,
        generatedBy: undefined,
        reportVersion: undefined,
        reportGeneratedAt: undefined,
      },
    };
    const model = buildPdfLayoutModel(legacy);
    expect(model.cover?.locationFallback).toBe(
      "Collar coordinates not recorded",
    );
    expect(model.cover?.generatedByLine).toBe("M. Hoffman");
    const blob = await generateReportPdf(legacy);
    await expect(PDFDocument.load(await blob.arrayBuffer())).resolves.toBeDefined();
  });
});
