"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  MAX_ORIGINAL_IMAGE_BYTES,
  validateImageBlob,
} from "@/infrastructure/media";

export function PhotoInput({
  id,
  label,
  file,
  onFile,
  required = false,
}: {
  id: string;
  label: string;
  file: File | null;
  onFile: (file: File | null) => void;
  required?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-bold text-[var(--tl-ink)]"
      >
        {label}
        {required ? " *" : ""}
      </label>
      <label
        htmlFor={id}
        className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-[var(--tl-radius-md)] border-2 border-dashed border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] px-4 py-3 font-bold text-[var(--tl-primary)]"
      >
        <Camera aria-hidden="true" className="size-6" />
        TAKE OR CHOOSE PHOTO
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        required={required && file === null}
        className="sr-only"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          if (selected === null) {
            onFile(null);
            return;
          }
          try {
            validateImageBlob(selected);
            setError(null);
            setPreview(URL.createObjectURL(selected));
            onFile(selected);
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "The selected photograph is not supported.",
            );
            event.currentTarget.value = "";
            onFile(null);
          }
        }}
      />
      <p id={`${id}-help`} className="text-xs text-[var(--tl-ink-muted)]">
        Camera capture is used where supported. Otherwise choose a photograph
        from this device. Maximum {MAX_ORIGINAL_IMAGE_BYTES / 1024 / 1024} MB.
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-bold text-[var(--tl-danger)]">
          {error}
        </p>
      ) : null}
      {preview !== null && file !== null ? (
        <div className="overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]">
          <Image
            src={preview}
            alt={`Preview of selected ${label.toLocaleLowerCase("en-AU")}`}
            width={1_200}
            height={900}
            unoptimized
            className="max-h-80 w-full object-contain"
          />
          <div className="flex items-center justify-between gap-3 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--tl-ink-muted)]">
              <ImagePlus aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{file.name}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onFile(null);
              }}
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
