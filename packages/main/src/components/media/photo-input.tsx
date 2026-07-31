"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { TrayCameraCapture } from "@/components/media/tray-camera-capture";
import {
  MAX_ORIGINAL_IMAGE_BYTES,
  TRAY_FRAME_HEIGHT_CM,
  TRAY_FRAME_WIDTH_CM,
  restoreMobileViewportAfterCamera,
  validateImageBlob,
} from "@/infrastructure/media";

export function PhotoInput({
  id,
  label,
  file,
  onFile,
  required = false,
  mode = "generic",
}: {
  id: string;
  label: string;
  file: File | null;
  onFile: (file: File | null) => void;
  required?: boolean;
  /** Tray mode opens a framed in-app camera (110×35 cm, start top-right). */
  mode?: "generic" | "tray";
}) {
  const generatedId = useId();
  const libraryInputId = `${id}-library-${generatedId}`;
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(
    () => () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  useEffect(() => {
    if (file === null) {
      setPreview((current) => {
        if (current !== null) URL.revokeObjectURL(current);
        return null;
      });
    }
  }, [file]);

  function acceptFile(selected: File | null) {
    if (selected === null) {
      setError(null);
      setPreview((current) => {
        if (current !== null) URL.revokeObjectURL(current);
        return null;
      });
      onFile(null);
      return;
    }
    try {
      validateImageBlob(selected);
      setError(null);
      setPreview((current) => {
        if (current !== null) URL.revokeObjectURL(current);
        return URL.createObjectURL(selected);
      });
      onFile(selected);
      restoreMobileViewportAfterCamera();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The selected photograph is not supported.",
      );
      onFile(null);
    }
  }

  const isTray = mode === "tray";

  return (
    <div className="space-y-2">
      <span className="block text-sm font-bold text-[var(--tl-ink)]">
        {label}
        {required ? " *" : ""}
      </span>

      {isTray ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-dashed border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] px-4 py-3 font-bold text-[var(--tl-primary)]"
          >
            <Camera aria-hidden="true" className="size-6" />
            FRAME TRAY PHOTO
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 py-3 font-bold text-[var(--tl-ink)]"
          >
            <ImagePlus aria-hidden="true" className="size-5" />
            Choose from library
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-dashed border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] px-4 py-3 font-bold text-[var(--tl-primary)]"
        >
          <Camera aria-hidden="true" className="size-6" />
          TAKE OR CHOOSE PHOTO
        </label>
      )}

      <input
        id={isTray ? libraryInputId : id}
        ref={libraryRef}
        type="file"
        accept="image/*"
        capture={isTray ? undefined : "environment"}
        required={required && file === null}
        className="sr-only"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          acceptFile(selected);
          event.currentTarget.value = "";
        }}
      />

      {isTray ? (
        <TrayCameraCapture
          open={cameraOpen}
          onClose={() => {
            setCameraOpen(false);
            restoreMobileViewportAfterCamera();
          }}
          onCapture={(captured) => acceptFile(captured)}
        />
      ) : null}

      <p id={`${id}-help`} className="text-xs text-[var(--tl-ink-muted)]">
        {isTray
          ? `Opens a guided camera framed for a ~${TRAY_FRAME_WIDTH_CM} × ${TRAY_FRAME_HEIGHT_CM} cm core tray. Place the start of the tray in the top-right mark. Maximum ${MAX_ORIGINAL_IMAGE_BYTES / 1024 / 1024} MB.`
          : `Camera capture is used where supported. Otherwise choose a photograph from this device. Maximum ${MAX_ORIGINAL_IMAGE_BYTES / 1024 / 1024} MB.`}
      </p>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm font-bold text-[var(--tl-danger)]"
        >
          {error}
        </p>
      ) : null}
      {preview !== null && file !== null ? (
        <div className="overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]">
          <Image
            src={preview}
            alt={`Preview of selected ${label.toLocaleLowerCase("en-AU")}`}
            width={isTray ? 1_100 : 1_200}
            height={isTray ? 350 : 900}
            unoptimized
            className={`w-full object-contain ${isTray ? "max-h-44 bg-[#0b121c]" : "max-h-80"}`}
          />
          <div className="flex items-center justify-between gap-3 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--tl-ink-muted)]">
              <ImagePlus aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{file.name}</span>
            </span>
            <button
              type="button"
              onClick={() => acceptFile(null)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold"
            >
              <X aria-hidden="true" className="size-4" />
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
