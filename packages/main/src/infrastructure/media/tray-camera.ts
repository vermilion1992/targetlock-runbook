/** Core tray photograph: physical ~110 cm × 35 cm, captured phone-vertical. */
export const TRAY_FRAME_LONG_CM = 110;
export const TRAY_FRAME_SHORT_CM = 35;
/** @deprecated Prefer TRAY_FRAME_LONG_CM — kept for existing copy. */
export const TRAY_FRAME_WIDTH_CM = TRAY_FRAME_LONG_CM;
/** @deprecated Prefer TRAY_FRAME_SHORT_CM — kept for existing copy. */
export const TRAY_FRAME_HEIGHT_CM = TRAY_FRAME_SHORT_CM;

/**
 * Photograph guide width/height with the phone upright. Tuned from a 1:2
 * full-tray guide after field photos: 15% narrower and 15% taller so the
 * corner brackets track a completed core tray more closely.
 */
export const TRAY_FRAME_ASPECT = (1 / 2) * (0.85 / 1.15);

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

/** Rectangle occupied by an object-contain video inside the camera stage. */
export function fitContainedMediaInView(
  mediaWidth: number,
  mediaHeight: number,
  viewWidth: number,
  viewHeight: number,
): ViewRect {
  if (
    mediaWidth <= 0 ||
    mediaHeight <= 0 ||
    viewWidth <= 0 ||
    viewHeight <= 0
  ) {
    throw new Error("Camera preview dimensions are invalid.");
  }
  const scale = Math.min(viewWidth / mediaWidth, viewHeight / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;
  return {
    left: (viewWidth - width) / 2,
    top: (viewHeight - height) / 2,
    width,
    height,
  };
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

/**
 * Maps a stage frame onto source video pixels when the complete video is
 * rendered with object-fit: contain. This avoids the implicit zoom/crop caused
 * by object-cover on phones whose camera stream has a different aspect ratio.
 */
export function mapContainedFrameToVideoCrop(
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
  frame: ViewRect,
): SourceCropRect {
  const preview = fitContainedMediaInView(
    videoWidth,
    videoHeight,
    viewWidth,
    viewHeight,
  );
  const scale = preview.width / videoWidth;
  let sx = (frame.left - preview.left) / scale;
  let sy = (frame.top - preview.top) / scale;
  let sw = frame.width / scale;
  let sh = frame.height / scale;

  sx = Math.max(0, Math.min(sx, videoWidth - 1));
  sy = Math.max(0, Math.min(sy, videoHeight - 1));
  sw = Math.max(1, Math.min(sw, videoWidth - sx));
  sh = Math.max(1, Math.min(sh, videoHeight - sy));
  return { sx, sy, sw, sh };
}

/** Largest vertical tray guide that fits inside the supplied preview bounds. */
export function fitTrayFrameInRect(
  bounds: ViewRect,
  paddingRatio = 0.08,
): ViewRect {
  const padX = bounds.width * paddingRatio;
  const padY = bounds.height * paddingRatio;
  const availW = Math.max(1, bounds.width - padX * 2);
  const availH = Math.max(1, bounds.height - padY * 2);
  let width = availW;
  let height = width / TRAY_FRAME_ASPECT;
  if (height > availH) {
    height = availH;
    width = height * TRAY_FRAME_ASPECT;
  }
  return {
    left: bounds.left + (bounds.width - width) / 2,
    top: bounds.top + (bounds.height - height) / 2,
    width,
    height,
  };
}

/** Largest vertical tray guide that fits inside the padded viewport. */
export function fitTrayFrameInView(
  viewWidth: number,
  viewHeight: number,
  paddingRatio = 0.08,
): ViewRect {
  return fitTrayFrameInRect(
    { left: 0, top: 0, width: viewWidth, height: viewHeight },
    paddingRatio,
  );
}

interface MobileViewportLock {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly body: Readonly<Record<string, string>>;
  readonly root: Readonly<Record<string, string>>;
}

const BODY_LOCK_PROPERTIES = [
  "position",
  "top",
  "left",
  "right",
  "width",
  "overflow",
  "overscroll-behavior",
] as const;
const ROOT_LOCK_PROPERTIES = [
  "overflow",
  "height",
  "zoom",
  "overscroll-behavior",
] as const;

let mobileViewportLock: MobileViewportLock | null = null;

function snapshotProperties(
  style: CSSStyleDeclaration,
  properties: readonly string[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    properties.map((property) => [property, style.getPropertyValue(property)]),
  );
}

function restoreProperties(
  style: CSSStyleDeclaration,
  snapshot: Readonly<Record<string, string>>,
): void {
  for (const [property, value] of Object.entries(snapshot)) {
    if (value) style.setProperty(property, value);
    else style.removeProperty(property);
  }
}

/** Lock document scroll while the in-app camera is open (avoids mobile viewport jump). */
export function lockMobileViewportForCamera(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (mobileViewportLock !== null) return;
  const body = document.body;
  const root = document.documentElement;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  mobileViewportLock = {
    scrollX,
    scrollY,
    body: snapshotProperties(body.style, BODY_LOCK_PROPERTIES),
    root: snapshotProperties(root.style, ROOT_LOCK_PROPERTIES),
  };
  body.dataset.tlCameraLock = "1";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "auto";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
}

export function restoreMobileViewportAfterCamera(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const snapshot = mobileViewportLock;
  if (snapshot === null) return;
  // Clear first so repeated close/capture cleanup is harmless.
  mobileViewportLock = null;
  const root = document.documentElement;
  const body = document.body;
  delete body.dataset.tlCameraLock;
  restoreProperties(body.style, snapshot.body);
  restoreProperties(root.style, snapshot.root);
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
  requestAnimationFrame(() => {
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);
  });
}
