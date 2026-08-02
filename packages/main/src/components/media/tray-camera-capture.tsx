"use client";

import { Camera, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  TRAY_FRAME_ASPECT,
  fitContainedMediaInView,
  fitTrayFrameInRect,
  lockMobileViewportForCamera,
  mapContainedFrameToVideoCrop,
  restoreMobileViewportAfterCamera,
  type SourceCropRect,
  type ViewRect,
} from "@/infrastructure/media/tray-camera";

const CAPTURE_JPEG_QUALITY = 0.8;
const CAPTURE_MAX_LONG_EDGE = 2000;

interface BrowserImageCapture {
  takePhoto(): Promise<Blob>;
}

type BrowserImageCaptureConstructor = new (
  track: MediaStreamTrack,
) => BrowserImageCapture;

async function applyContinuousFocusWhenAvailable(
  track: MediaStreamTrack,
): Promise<void> {
  try {
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      focusMode?: readonly string[];
    };
    if (!capabilities.focusMode?.includes("continuous")) return;
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints);
  } catch {
    // Focus constraints vary by browser; the camera remains usable without it.
  }
}

async function takeHighResolutionStill(
  track: MediaStreamTrack | undefined,
): Promise<ImageBitmap | null> {
  if (!track || typeof window === "undefined") return null;
  const ImageCaptureApi = (
    window as unknown as {
      ImageCapture?: BrowserImageCaptureConstructor;
    }
  ).ImageCapture;
  if (!ImageCaptureApi || typeof createImageBitmap !== "function") return null;
  try {
    const blob = await new ImageCaptureApi(track).takePhoto();
    return await createImageBitmap(blob);
  } catch {
    // Safari and some Android browsers expose only the video-frame fallback.
    return null;
  }
}

function mapCropToSource(
  crop: SourceCropRect,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): SourceCropRect | null {
  const fromAspect = fromWidth / fromHeight;
  const toAspect = toWidth / toHeight;
  // A native still may come back in a different sensor orientation. Only use
  // it when normalized preview coordinates map reliably.
  if (Math.abs(Math.log(fromAspect / toAspect)) > 0.12) return null;
  return {
    sx: (crop.sx / fromWidth) * toWidth,
    sy: (crop.sy / fromHeight) * toHeight,
    sw: (crop.sw / fromWidth) * toWidth,
    sh: (crop.sh / fromHeight) * toHeight,
  };
}

export function TrayCameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [frame, setFrame] = useState<ViewRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const measureFrame = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { width, height } = stage.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const video = videoRef.current;
    const previewBounds =
      video && video.videoWidth > 0 && video.videoHeight > 0
        ? fitContainedMediaInView(
            video.videoWidth,
            video.videoHeight,
            width,
            height,
          )
        : { left: 0, top: 0, width, height };
    setFrame(fitTrayFrameInRect(previewBounds, 0.045));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measureFrame();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureFrame());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [open, measureFrame]);

  useEffect(() => {
    if (!open) return;

    lockMobileViewportForCamera();
    let cancelled = false;

    async function startCamera() {
      if (cancelled) return;
      setStarting(true);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setError(
            "This device cannot open an in-app camera. Use Choose from library instead.",
          );
          setStarting(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            // Ask for detail without forcing a sensor aspect/orientation.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) await applyContinuousFocusWhenAvailable(videoTrack);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStarting(false);
        measureFrame();
      } catch {
        if (!cancelled) {
          setError(
            "Camera permission was denied or unavailable. Use Choose from library, or allow camera access and try again.",
          );
          setStarting(false);
        }
      }
    }

    void Promise.resolve().then(startCamera);

    return () => {
      cancelled = true;
      stopStream();
      restoreMobileViewportAfterCamera();
    };
  }, [open, measureFrame, stopStream]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function capture() {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !frame || capturing) return;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError("Camera is still starting. Wait a moment, then capture again.");
      return;
    }

    setCapturing(true);
    let stillToClose: ImageBitmap | null = null;
    try {
      const stageRect = stage.getBoundingClientRect();
      const previewCrop = mapContainedFrameToVideoCrop(
        video.videoWidth,
        video.videoHeight,
        stageRect.width,
        stageRect.height,
        frame,
      );

      let source: CanvasImageSource = video;
      let sourceCrop = previewCrop;
      const still = await takeHighResolutionStill(
        streamRef.current?.getVideoTracks()[0],
      );
      if (still) {
        const stillCrop = mapCropToSource(
          previewCrop,
          video.videoWidth,
          video.videoHeight,
          still.width,
          still.height,
        );
        if (stillCrop) {
          source = still;
          sourceCrop = stillCrop;
          stillToClose = still;
        } else {
          still.close();
        }
      }

      let outW = Math.round(sourceCrop.sw);
      let outH = Math.round(sourceCrop.sh);
      const longEdge = Math.max(outW, outH);
      if (longEdge > CAPTURE_MAX_LONG_EDGE) {
        const scale = CAPTURE_MAX_LONG_EDGE / longEdge;
        outW = Math.max(1, Math.round(outW * scale));
        outH = Math.max(1, Math.round(outH * scale));
      }
      // Keep the full-tray guide aspect exact after rounding.
      outH = Math.max(1, Math.round(outW / TRAY_FRAME_ASPECT));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Image capture is not available in this browser.");
      }
      context.drawImage(
        source,
        sourceCrop.sx,
        sourceCrop.sy,
        sourceCrop.sw,
        sourceCrop.sh,
        0,
        0,
        outW,
        outH,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not encode the tray photograph.")),
          "image/jpeg",
          CAPTURE_JPEG_QUALITY,
        );
      });

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `tray-${stamp}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      onCapture(file);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not capture the tray photograph.",
      );
    } finally {
      stillToClose?.close();
      setCapturing(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tray-camera-title"
      className="fixed inset-0 z-[80] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden overscroll-none bg-[#0b121c] text-[#eef3f8]"
      style={{ touchAction: "none" }}
    >
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8fa3b8]">
            TargetLock · Core tray
          </p>
          <h2 id="tray-camera-title" className="truncate text-lg font-bold tracking-tight">
            Take core photo
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--tl-radius-sm)] border border-white/20 bg-white/5"
          aria-label="Close camera"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div
        ref={stageRef}
        className="relative z-10 min-h-0 flex-1 overflow-hidden"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={measureFrame}
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />

        {frame ? (
          <>
            {/* Dim outside the full-tray guide while keeping the feed visible. */}
            <div
              aria-hidden="true"
              data-testid="tray-guide-aperture"
              className="pointer-events-none absolute"
              style={{
                boxShadow: `0 0 0 9999px rgb(8 14 24 / 58%)`,
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
              }}
            />

            <CornerBrackets frame={frame} />

            {/* Keep the vertical start marker outside the top-right bracket. */}
            <div
              data-testid="tray-start-marker"
              className="pointer-events-none absolute z-10 origin-top-left rotate-90 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#60a5fa] [text-shadow:0_1px_3px_rgb(0_0_0_/_90%)]"
              style={{
                left: frame.left + frame.width + 24,
                top: frame.top + 8,
              }}
            >
              Start
            </div>
          </>
        ) : null}

        {(starting || error) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b121c]/55 px-6 text-center">
            <p className="max-w-sm text-sm font-semibold text-white/90">
              {error ?? "Opening rear camera…"}
            </p>
          </div>
        )}
      </div>

      <footer className="relative z-20 shrink-0 space-y-3 border-t border-white/10 bg-[#0b121c]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <p className="text-center text-xs leading-relaxed text-[#a9b8c8]">
          Hold the phone upright. Fit the{" "}
          <span className="font-semibold text-white">entire tray</span> inside
          the guide with a small margin. Keep the start at the top-right.
        </p>
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 w-16 flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[#a9b8c8]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void capture()}
            disabled={Boolean(error) || starting || capturing || !frame}
            className="relative flex size-[4.5rem] items-center justify-center rounded-full border-[3px] border-white bg-transparent disabled:opacity-40"
            aria-label="Capture tray photograph"
          >
            <span className="size-[3.55rem] rounded-full bg-white shadow-[0_0_0_2px_#0b121c]" />
            <Camera
              aria-hidden="true"
              className="pointer-events-none absolute size-5 text-[#0b121c]"
            />
          </button>

          <div className="w-16" aria-hidden="true" />
        </div>
      </footer>
    </div>,
    document.body,
  );
}

function CornerBrackets({ frame }: { frame: ViewRect }) {
  const arm = Math.min(44, Math.max(28, frame.width * 0.2));
  const thick = 4;
  const corners = [
    { x: frame.left, y: frame.top, hx: 1, hy: 1, emphasize: false },
    {
      x: frame.left + frame.width,
      y: frame.top,
      hx: -1,
      hy: 1,
      emphasize: true,
    },
    {
      x: frame.left,
      y: frame.top + frame.height,
      hx: 1,
      hy: -1,
      emphasize: false,
    },
    {
      x: frame.left + frame.width,
      y: frame.top + frame.height,
      hx: -1,
      hy: -1,
      emphasize: false,
    },
  ] as const;

  return (
    <>
      {corners.map((corner, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: corner.x - (corner.hx < 0 ? thick : 0),
            top: corner.y - (corner.hy < 0 ? thick : 0),
            width: arm,
            height: arm,
            borderTop:
              corner.hy > 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "#f8fafc"}`
                : undefined,
            borderBottom:
              corner.hy < 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "#f8fafc"}`
                : undefined,
            borderLeft:
              corner.hx > 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "#f8fafc"}`
                : undefined,
            borderRight:
              corner.hx < 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "#f8fafc"}`
                : undefined,
            boxShadow: corner.emphasize
              ? "0 0 12px rgb(96 165 251 / 55%)"
              : undefined,
          }}
        />
      ))}
    </>
  );
}
