import type { ReportSnapshot } from "@/domain";
import {
  generateImagePreview,
  type MediaRepository,
} from "@/infrastructure/media";
import type { ReportPdfAssets } from "@/infrastructure/reports/pdf-generator";
import type { PhotoRepository } from "@/infrastructure/trays";

export interface ReportPdfAssetDependencies {
  readonly photos: PhotoRepository;
  readonly media: MediaRepository;
  readonly fetcher?: typeof fetch;
}

function bundledPath(storageKey: string): string | undefined {
  if (!storageKey.startsWith("bundled:")) return undefined;
  const path = storageKey.slice("bundled:".length);
  return path.startsWith("/") ? path : `/${path}`;
}

async function loadPhotoBlob(
  storageKey: string,
  dependencies: ReportPdfAssetDependencies,
): Promise<Blob | null> {
  const publicPath = bundledPath(storageKey);
  if (publicPath !== undefined) {
    const fetcher = dependencies.fetcher ?? globalThis.fetch;
    if (typeof fetcher !== "function") return null;
    const response = await fetcher(publicPath);
    return response.ok ? response.blob() : null;
  }
  return dependencies.media.getBlob(storageKey);
}

async function normaliseForPdf(
  blob: Blob,
): Promise<
  | {
      readonly bytes: Uint8Array;
      readonly mediaType: "image/png" | "image/jpeg";
    }
  | undefined
> {
  const type = blob.type.toLocaleLowerCase("en-AU");
  if (type === "image/png" || type === "image/jpeg" || type === "image/jpg") {
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mediaType: type === "image/png" ? "image/png" : "image/jpeg",
    };
  }
  try {
    const preview = await generateImagePreview(blob, 1_600);
    return {
      bytes: new Uint8Array(await preview.blob.arrayBuffer()),
      mediaType:
        preview.blob.type === "image/png" ? "image/png" : "image/jpeg",
    };
  } catch {
    return undefined;
  }
}

export async function resolveReportPdfAssets(
  snapshot: ReportSnapshot,
  dependencies: ReportPdfAssetDependencies,
): Promise<ReportPdfAssets> {
  if (snapshot.reportType !== "CURRENT_SHIFT_RUNBOOK") return {};

  const assets = await Promise.all(
    snapshot.documentData.trays.map(async (tray) => {
      if (!tray.primaryPhotoId) return undefined;
      try {
        const photo = await dependencies.photos.getById(
          tray.primaryPhotoId,
          snapshot.holeId,
        );
        if (!photo) return undefined;
        const keys = [
          photo.previewStorageKey,
          photo.originalStorageKey,
        ].filter((key): key is string => Boolean(key));
        for (const key of [...new Set(keys)]) {
          const blob = await loadPhotoBlob(key, dependencies);
          if (!blob) continue;
          const normalised = await normaliseForPdf(blob);
          if (!normalised) continue;
          return {
            trayId: tray.trayId,
            trayNumber: tray.trayNumber,
            ...normalised,
          };
        }
      } catch {
        // A missing/corrupt photograph must not prevent the shift report itself.
      }
      return undefined;
    }),
  );

  return {
    trayPhotos: assets.filter(
      (asset): asset is NonNullable<typeof asset> => asset !== undefined,
    ),
  };
}
