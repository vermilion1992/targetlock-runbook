/** Core tray photograph frame: physical ~110 cm × 35 cm. */
export const TRAY_FRAME_WIDTH_CM = 110;
export const TRAY_FRAME_HEIGHT_CM = 35;
/** Width / height */
export const TRAY_FRAME_ASPECT = TRAY_FRAME_WIDTH_CM / TRAY_FRAME_HEIGHT_CM;

export interface ViewRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SourceCropRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * Maps a viewport frame rectangle onto video pixel space when the video is
 * rendered with object-fit: cover inside the viewport.
 */
export function mapCoverFrameToVideoCrop(
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
  frame: ViewRect,
): SourceCropRect {
  if (
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    viewWidth <= 0 ||
    viewHeight <= 0 ||
    frame.width <= 0 ||
    frame.height <= 0
  ) {
    throw new Error("Camera frame dimensions are invalid.");
  }

  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
  const displayedWidth = videoWidth * scale;
  const displayedHeight = videoHeight * scale;
  const offsetX = (viewWidth - displayedWidth) / 2;
  const offsetY = (viewHeight - displayedHeight) / 2;

  let sx = (frame.left - offsetX) / scale;
  let sy = (frame.top - offsetY) / scale;
  let sw = frame.width / scale;
  let sh = frame.height / scale;

  sx = Math.max(0, Math.min(sx, videoWidth - 1));
  sy = Math.max(0, Math.min(sy, videoHeight - 1));
  sw = Math.max(1, Math.min(sw, videoWidth - sx));
  sh = Math.max(1, Math.min(sh, videoHeight - sy));

  return { sx, sy, sw, sh };
}

/** Largest frame of the given aspect that fits inside the padded viewport. */
export function fitTrayFrameInView(
  viewWidth: number,
  viewHeight: number,
  paddingRatio = 0.08,
): ViewRect {
  const padX = viewWidth * paddingRatio;
  const padY = viewHeight * paddingRatio;
  const availW = Math.max(1, viewWidth - padX * 2);
  const availH = Math.max(1, viewHeight - padY * 2);
  let width = availW;
  let height = width / TRAY_FRAME_ASPECT;
  if (height > availH) {
    height = availH;
    width = height * TRAY_FRAME_ASPECT;
  }
  return {
    left: (viewWidth - width) / 2,
    top: (viewHeight - height) / 2,
    width,
    height,
  };
}

export function restoreMobileViewportAfterCamera(): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("zoom", "normal");
  window.scrollTo(0, 0);
  // Nudge layout after native/camera UI releases the visual viewport.
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    if (window.visualViewport) {
      root.style.height = `${window.visualViewport.height}px`;
      requestAnimationFrame(() => {
        root.style.height = "";
      });
    }
  });
}
