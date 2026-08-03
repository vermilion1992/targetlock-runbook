"use client";

import { CameraOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import type { Photo } from "@/domain";

function bundledPath(storageKey: string | undefined): string | undefined {
  return storageKey?.startsWith("bundled:")
    ? storageKey.slice("bundled:".length)
    : undefined;
}

export function LocalMediaImage({
  photo,
  alt,
  className = "h-full w-full object-cover",
  priority = false,
  preferOriginal = false,
}: {
  photo: Photo | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  /** Prefer the full-resolution original when reviewing tray/survey photos. */
  preferOriginal?: boolean;
}) {
  const bundled = preferOriginal
    ? (bundledPath(photo?.originalStorageKey) ??
      bundledPath(photo?.previewStorageKey))
    : (bundledPath(photo?.previewStorageKey) ??
      bundledPath(photo?.originalStorageKey));
  const mediaKey = preferOriginal
    ? (photo?.originalStorageKey ?? photo?.previewStorageKey)
    : (photo?.previewStorageKey ?? photo?.originalStorageKey);
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly source: string;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const source =
    bundled ??
    (loaded !== null && loaded.key === mediaKey ? loaded.source : undefined);
  const failed = mediaKey !== undefined && failedKey === mediaKey;

  useEffect(() => {
    if (photo === undefined || photo === null || bundled !== undefined) {
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => setFailedKey(mediaKey ?? null));
      return;
    }
    const key = preferOriginal
      ? (photo.originalStorageKey ?? photo.previewStorageKey)
      : (photo.previewStorageKey ?? photo.originalStorageKey);
    void services.media
      .getBlob(key)
      .then((blob) => {
        if (!active || blob === null) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key, source: objectUrl });
      })
      .catch(() => {
        if (active) setFailedKey(key);
      });
    return () => {
      active = false;
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    };
  }, [bundled, mediaKey, photo, preferOriginal]);

  if (source === undefined || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt}. Photograph unavailable.`}
        className="flex h-full min-h-40 w-full flex-col items-center justify-center bg-[var(--tl-surface-sunken)] p-4 text-center"
      >
        <CameraOff aria-hidden="true" className="size-8 text-[var(--tl-ink-muted)]" />
        <span className="mt-2 text-sm font-bold text-[var(--tl-ink-muted)]">
          Photograph unavailable
        </span>
      </div>
    );
  }

  return (
    <Image
      src={source}
      alt={alt}
      width={photo?.width ?? 1_200}
      height={photo?.height ?? 900}
      unoptimized
      priority={priority}
      loading="eager"
      onError={() => setFailedKey(mediaKey ?? null)}
      className={className}
    />
  );
}
