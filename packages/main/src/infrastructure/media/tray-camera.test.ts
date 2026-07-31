import { describe, expect, it } from "vitest";

import {
  TRAY_FRAME_ASPECT,
  TRAY_FRAME_LONG_CM,
  TRAY_FRAME_SHORT_CM,
  fitTrayFrameInView,
  mapCoverFrameToVideoCrop,
} from "./tray-camera";

describe("tray camera framing", () => {
  it("uses a vertical 35×110 capture aspect (phone upright)", () => {
    expect(TRAY_FRAME_ASPECT).toBeCloseTo(
      TRAY_FRAME_SHORT_CM / TRAY_FRAME_LONG_CM,
      9,
    );
    expect(TRAY_FRAME_ASPECT).toBeLessThan(1);
  });

  it("fits a tall tray frame inside a portrait phone viewport", () => {
    const frame = fitTrayFrameInView(390, 844, 0.08);
    expect(frame.width).toBeLessThanOrEqual(390);
    expect(frame.height).toBeLessThanOrEqual(844);
    expect(frame.height).toBeGreaterThan(frame.width);
    expect(frame.width / frame.height).toBeCloseTo(TRAY_FRAME_ASPECT, 2);
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
  });

  it("maps a centered cover frame back into video pixels", () => {
    const viewW = 400;
    const viewH = 800;
    const videoW = 1080;
    const videoH = 1920;
    const frame = fitTrayFrameInView(viewW, viewH, 0.1);
    const crop = mapCoverFrameToVideoCrop(videoW, videoH, viewW, viewH, frame);
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(videoW + 1e-6);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(videoH + 1e-6);
    expect(crop.sw / crop.sh).toBeCloseTo(TRAY_FRAME_ASPECT, 1);
  });
});
