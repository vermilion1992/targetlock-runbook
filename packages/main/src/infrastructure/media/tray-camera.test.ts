import { describe, expect, it } from "vitest";

import {
  TRAY_FRAME_ASPECT,
  fitTrayFrameInView,
  mapCoverFrameToVideoCrop,
} from "./tray-camera";

describe("tray camera framing", () => {
  it("uses the 110×35 cm aspect ratio", () => {
    expect(TRAY_FRAME_ASPECT).toBeCloseTo(110 / 35, 9);
  });

  it("fits the tray frame inside a portrait phone viewport", () => {
    const frame = fitTrayFrameInView(390, 844, 0.08);
    expect(frame.width).toBeLessThanOrEqual(390);
    expect(frame.height).toBeLessThanOrEqual(844);
    expect(frame.width / frame.height).toBeCloseTo(TRAY_FRAME_ASPECT, 2);
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
  });

  it("maps a centered cover frame back into video pixels", () => {
    const viewW = 400;
    const viewH = 800;
    const videoW = 1920;
    const videoH = 1080;
    const frame = fitTrayFrameInView(viewW, viewH, 0.1);
    const crop = mapCoverFrameToVideoCrop(videoW, videoH, viewW, viewH, frame);
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(videoW + 1e-6);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(videoH + 1e-6);
    expect(crop.sw / crop.sh).toBeCloseTo(TRAY_FRAME_ASPECT, 1);
  });
});
