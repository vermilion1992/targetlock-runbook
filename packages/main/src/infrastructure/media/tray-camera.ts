/** Core tray photograph: physical ~110 cm × 35 cm, captured phone-vertical. */
export const TRAY_FRAME_LONG_CM = 110;
export const TRAY_FRAME_SHORT_CM = 35;
/** @deprecated Prefer TRAY_FRAME_LONG_CM — kept for existing copy. */
export const TRAY_FRAME_WIDTH_CM = TRAY_FRAME_LONG_CM;
/** @deprecated Prefer TRAY_FRAME_SHORT_CM — kept for existing copy. */
export const TRAY_FRAME_HEIGHT_CM = TRAY_FRAME_SHORT_CM;

/**
 * Capture frame width/height with the phone upright and the tray long axis
 * running vertically (35 cm across × 110 cm tall).
 */
export const TRAY_FRAME_ASPECT = TRAY_FRAME_SHORT_CM / TRAY_FRAME_LONG_CM;

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

/** Largest vertical tray frame that fits inside the padded viewport. */
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

let lockedScrollY = 0;

/** Lock document scroll while the in-app camera is open (avoids mobile viewport jump). */
export function lockMobileViewportForCamera(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  body.dataset.tlCameraLock = "1";
  body.style.position = "fixed";
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

export function restoreMobileViewportAfterCamera(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  const wasLocked = body.dataset.tlCameraLock === "1";
  const y = wasLocked
    ? Math.abs(Number.parseInt(body.style.top || "0", 10)) || lockedScrollY
    : window.scrollY;

  delete body.dataset.tlCameraLock;
  body.style.removeProperty("position");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("right");
  body.style.removeProperty("width");
  body.style.removeProperty("overflow");
  root.style.removeProperty("overflow");
  root.style.removeProperty("height");
  root.style.removeProperty("zoom");

  window.scrollTo(0, y);
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    window.dispatchEvent(new Event("resize"));
  });
}
