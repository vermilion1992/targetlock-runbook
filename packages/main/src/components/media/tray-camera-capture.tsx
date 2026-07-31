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
  TRAY_FRAME_HEIGHT_CM,
  TRAY_FRAME_WIDTH_CM,
  fitTrayFrameInView,
  mapCoverFrameToVideoCrop,
  restoreMobileViewportAfterCamera,
  type ViewRect,
} from "@/infrastructure/media/tray-camera";

const CAPTURE_JPEG_QUALITY = 0.92;
const CAPTURE_MAX_LONG_EDGE = 2400;

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setFrame(fitTrayFrameInView(width, height, 0.07));
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
    if (!open) {
      stopStream();
      setError(null);
      setStarting(false);
      setCapturing(false);
      restoreMobileViewportAfterCamera();
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);

    async function startCamera() {
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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
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

    void startCamera();

    return () => {
      cancelled = true;
      stopStream();
      restoreMobileViewportAfterCamera();
    };
  }, [open, measureFrame, stopStream]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
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
    try {
      const stageRect = stage.getBoundingClientRect();
      const crop = mapCoverFrameToVideoCrop(
        video.videoWidth,
        video.videoHeight,
        stageRect.width,
        stageRect.height,
        frame,
      );

      let outW = Math.round(crop.sw);
      let outH = Math.round(crop.sh);
      const longEdge = Math.max(outW, outH);
      if (longEdge > CAPTURE_MAX_LONG_EDGE) {
        const scale = CAPTURE_MAX_LONG_EDGE / longEdge;
        outW = Math.max(1, Math.round(outW * scale));
        outH = Math.max(1, Math.round(outH * scale));
      }
      // Keep exact tray aspect after rounding.
      outH = Math.max(1, Math.round(outW / TRAY_FRAME_ASPECT));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Image capture is not available in this browser.");
      }
      context.drawImage(
        video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
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
      restoreMobileViewportAfterCamera();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not capture the tray photograph.",
      );
    } finally {
      setCapturing(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tray-camera-title"
      className="fixed inset-0 z-[80] flex flex-col bg-[#0b121c] text-[#eef3f8]"
    >
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8fa3b8]">
            TargetLock · Core tray
          </p>
          <h2 id="tray-camera-title" className="truncate text-lg font-bold tracking-tight">
            Frame photograph
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

      <div ref={stageRef} className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />

        {frame ? (
          <>
            {/* Dim mask with clear tray window */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                boxShadow: `0 0 0 9999px rgb(8 14 24 / 72%)`,
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
              }}
            />

            {/* Frame border */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[2px] border border-white/85"
              style={{
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                boxShadow: "inset 0 0 0 1px rgb(31 111 235 / 35%)",
              }}
            />

            {/* Corner brackets — emphasize top-right start */}
            <CornerBrackets frame={frame} />

            {/* Start-of-tray overlay (top-right) */}
            <div
              className="pointer-events-none absolute z-10"
              style={{
                left: frame.left + frame.width - Math.min(118, frame.width * 0.28),
                top: frame.top + 8,
                width: Math.min(110, frame.width * 0.26),
              }}
            >
              <div className="rounded-md border border-[#60a5fa]/70 bg-[#0b121c]/78 px-2 py-1.5 shadow-[0_8px_24px_rgb(0_0_0_/45%)] backdrop-blur-[2px]">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#93c5fd]">
                  Tray start
                </p>
                <p className="mt-0.5 text-[0.7rem] font-bold leading-tight text-white">
                  Top-right corner
                </p>
              </div>
              <svg
                viewBox="0 0 48 28"
                className="ml-auto mt-1 h-5 w-9 text-[#93c5fd]"
                aria-hidden="true"
              >
                <path
                  d="M4 14h28M26 6l12 8-12 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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

      <footer className="relative z-20 space-y-3 border-t border-white/10 bg-[#0b121c]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <p className="text-center text-xs leading-relaxed text-[#a9b8c8]">
          Align the completed tray inside the {TRAY_FRAME_WIDTH_CM} ×{" "}
          {TRAY_FRAME_HEIGHT_CM} cm frame. Place the{" "}
          <span className="font-semibold text-white">start of tray</span> at the
          top-right mark so every photograph stays consistent.
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
  const arm = Math.min(28, frame.height * 0.22, frame.width * 0.08);
  const thick = 3;
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
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "white"}`
                : undefined,
            borderBottom:
              corner.hy < 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "white"}`
                : undefined,
            borderLeft:
              corner.hx > 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "white"}`
                : undefined,
            borderRight:
              corner.hx < 0
                ? `${thick}px solid ${corner.emphasize ? "#60a5fa" : "white"}`
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
