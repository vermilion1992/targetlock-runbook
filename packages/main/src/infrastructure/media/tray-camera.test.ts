import { describe, expect, it } from "vitest";

import {
  TRAY_FRAME_ASPECT,
  fitContainedMediaInView,
  fitTrayFrameInRect,
  fitTrayFrameInView,
  mapContainedFrameToVideoCrop,
  mapCoverFrameToVideoCrop,
} from "./tray-camera";

describe("tray camera framing", () => {
  it("uses a vertical 1:2 full-tray photograph aspect", () => {
    expect(TRAY_FRAME_ASPECT).toBeCloseTo(0.5, 9);
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

  it("fits the guide inside the complete contained camera preview", () => {
    const preview = fitContainedMediaInView(1080, 1920, 390, 620);
    const frame = fitTrayFrameInRect(preview, 0.045);
    expect(preview.left).toBeGreaterThan(0);
    expect(frame.left).toBeGreaterThanOrEqual(preview.left);
    expect(frame.top).toBeGreaterThanOrEqual(preview.top);
    expect(frame.left + frame.width).toBeLessThanOrEqual(
      preview.left + preview.width,
    );
    expect(frame.top + frame.height).toBeLessThanOrEqual(
      preview.top + preview.height,
    );
    expect(frame.width / frame.height).toBeCloseTo(0.5, 3);
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

  it("maps an object-contain guide without hidden preview zoom", () => {
    const viewW = 390;
    const viewH = 620;
    const videoW = 1080;
    const videoH = 1920;
    const preview = fitContainedMediaInView(
      videoW,
      videoH,
      viewW,
      viewH,
    );
    const frame = fitTrayFrameInRect(preview, 0.045);
    const crop = mapContainedFrameToVideoCrop(
      videoW,
      videoH,
      viewW,
      viewH,
      frame,
    );
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(videoW + 1e-6);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(videoH + 1e-6);
    expect(crop.sw / crop.sh).toBeCloseTo(TRAY_FRAME_ASPECT, 2);
  });
});
