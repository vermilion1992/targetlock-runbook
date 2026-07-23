import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildReportTrajectoryViewModel,
  drawTrajectoryGraphicsOnPdfPage,
} from "./trajectory-pdf-graphics";

describe("trajectory PDF graphics", () => {
  it("draws plan, section and 3D panels from verified path coordinates", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([841.89, 595.28]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const model = buildReportTrajectoryViewModel({
      holeId: "DDH041",
      engineVersion: "minimum-curvature-v1",
      activePlanName: "Demo",
      plannedPath: [
        { measuredDepthM: 0, eastingM: 0, northingM: 0, rlM: 0 },
        { measuredDepthM: 100, eastingM: 40, northingM: -30, rlM: -80 },
        { measuredDepthM: 200, eastingM: 90, northingM: -70, rlM: -160 },
      ],
      actualPath: [
        { measuredDepthM: 0, eastingM: 0, northingM: 0, rlM: 0 },
        { measuredDepthM: 100, eastingM: 42, northingM: -28, rlM: -79 },
      ],
      plannedStations: [
        { measuredDepthM: 0, eastingM: 0, northingM: 0, rlM: 0 },
        { measuredDepthM: 200, eastingM: 90, northingM: -70, rlM: -160 },
      ],
      actualStations: [
        { measuredDepthM: 0, eastingM: 0, northingM: 0, rlM: 0 },
        { measuredDepthM: 100, eastingM: 42, northingM: -28, rlM: -79 },
      ],
      target: {
        eastingM: 100,
        northingM: -80,
        rlM: -150,
        radiusM: 5,
      },
      sectionBearingDegrees: 135,
    });

    const nextY = drawTrajectoryGraphicsOnPdfPage({
      page,
      font,
      bold,
      model,
      x: 36,
      y: 540,
      width: 770,
      height: 200,
    });

    expect(nextY).toBeLessThan(540);
    const bytes = await doc.save();
    expect(bytes.byteLength).toBeGreaterThan(500);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
    // View-model must retain the same verified coordinates used for drawing.
    expect(model.plannedPath[1]?.eastingM).toBe(40);
    expect(model.actualPath[1]?.northingM).toBe(-28);
    expect(model.target?.radiusM).toBe(5);
  });
});
