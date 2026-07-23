/**
 * Deterministic PNG export for trajectory graphics (browser canvas).
 * Coordinates come from the verified view-model only.
 */

import {
  type TrajectoryGraphicViewMode,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
} from "@/domain/trajectory-view-model";

import {
  DEFAULT_TRAJECTORY_CAMERA,
  drawTrajectoryGraphics,
  initialCameraForModel,
  type TrajectoryCameraState,
} from "./trajectory-canvas-draw";

export interface TrajectoryPngExportInput {
  readonly model: TrajectoryViewModel;
  readonly viewMode: TrajectoryGraphicViewMode;
  readonly verticalScaleMode: TrajectoryVerticalScaleMode;
  readonly camera?: TrajectoryCameraState;
  readonly selectedSurveyId?: string | null;
  readonly width?: number;
  readonly height?: number;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode trajectory PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function exportTrajectoryPng(
  input: TrajectoryPngExportInput,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Trajectory PNG export requires a browser canvas.");
  }
  const width = input.width ?? 1200;
  const height = input.height ?? 800;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create 2D canvas context for trajectory export.");
  }
  const camera =
    input.camera ??
    (input.viewMode === "VIEW_3D"
      ? initialCameraForModel(input.model, input.verticalScaleMode)
      : DEFAULT_TRAJECTORY_CAMERA);

  drawTrajectoryGraphics(ctx, {
    model: input.model,
    viewMode: input.viewMode,
    verticalScaleMode: input.verticalScaleMode,
    camera,
    selectedSurveyId: input.selectedSurveyId,
    width,
    height,
    showLabels: true,
  });

  return canvasToPngBlob(canvas);
}

export async function exportTrajectoryReportImageSet(
  model: TrajectoryViewModel,
): Promise<{
  readonly planPng: Blob;
  readonly sectionPng: Blob;
  readonly view3dPng: Blob;
}> {
  const [planPng, sectionPng, view3dPng] = await Promise.all([
    exportTrajectoryPng({
      model,
      viewMode: "PLAN",
      verticalScaleMode: "EQUAL",
      width: 1000,
      height: 700,
    }),
    exportTrajectoryPng({
      model,
      viewMode: "VERTICAL_SECTION",
      verticalScaleMode: "EQUAL",
      width: 1000,
      height: 700,
    }),
    exportTrajectoryPng({
      model,
      viewMode: "VIEW_3D",
      verticalScaleMode: "EQUAL",
      width: 1000,
      height: 700,
    }),
  ]);
  return { planPng, sectionPng, view3dPng };
}
