import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  drawReportAnalyticsGraphicsOnPdfPage,
  type ReportAnalyticsGraphicsModel,
} from "./report-analytics-pdf-graphics";

describe("report analytics PDF graphics", () => {
  it("draws deterministic depth and recovery vectors from snapshot series", async () => {
    const model: ReportAnalyticsGraphicsModel = {
      depthProgression: {
        title: "Depth progression",
        unit: "m",
        plannedDepthM: 700,
        points: [
          { label: "Day 2026-07-21", x: 0, value: 650 },
          { label: "Night 2026-07-21", x: 1, value: 661.5 },
        ],
      },
      recoveryByDepth: {
        title: "Recovery by depth",
        unit: "%",
        points: [
          { label: "Run 1", x: 653, value: 95 },
          { label: "Run 2", x: 656, value: 98 },
          { label: "Run 3", x: 659, value: 97 },
        ],
      },
      renderableChartCount: 2,
    };
    const doc = await PDFDocument.create();
    const page = doc.addPage([841.89, 595.28]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const result = drawReportAnalyticsGraphicsOnPdfPage({
      page,
      font,
      bold,
      model,
      x: 36,
      y: 520,
      width: 770,
      height: 150,
    });

    expect(result.drawnCharts).toBe(2);
    expect(result.nextY).toBeLessThan(370);
    const bytes = await doc.save();
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
