import { describe, expect, it } from "vitest";

import type { Photo, ReportSnapshot } from "@/domain";
import { MemoryMediaRepository } from "@/infrastructure/media";
import type { PhotoRepository } from "@/infrastructure/trays";

import { resolveReportPdfAssets } from "./report-pdf-assets";

function reportSnapshot(): ReportSnapshot {
  return {
    reportType: "CURRENT_SHIFT_RUNBOOK",
    holeId: "DDH041",
    documentData: {
      trays: [
        {
          trayId: "tray-1",
          trayNumber: 104,
          primaryPhotoId: "photo-1",
        },
        {
          trayId: "tray-2",
          trayNumber: 105,
          primaryPhotoId: "photo-missing",
        },
      ],
    },
  } as unknown as ReportSnapshot;
}

function photo(storageKey: string): Photo {
  return {
    localId: "photo-1",
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    entityType: "TRAY",
    entityId: "tray-1",
    category: "TRAY",
    originalStorageKey: storageKey,
    previewStorageKey: storageKey,
    mimeType: "image/png",
    sizeBytes: 4,
    capturedAt: "2026-08-08T00:00:00.000Z",
    createdByUserId: "user-1",
    createdByNameSnapshot: "M. Hoffman",
  };
}

describe("resolveReportPdfAssets", () => {
  it("hydrates supported tray photographs and skips missing media", async () => {
    const media = new MemoryMediaRepository("org-1");
    const saved = await media.savePreview({
      operationId: "preview-1",
      holeId: "DDH041",
      blob: new Blob([new Uint8Array([137, 80, 78, 71])], {
        type: "image/png",
      }),
    });
    const photos = {
      getById: async (photoId: string) =>
        photoId === "photo-1" ? photo(saved.storageKey) : null,
      listByEntity: async () => [],
      create: async () => {
        throw new Error("Not used");
      },
    } as PhotoRepository;

    const assets = await resolveReportPdfAssets(reportSnapshot(), {
      photos,
      media,
    });

    expect(assets.trayPhotos).toHaveLength(1);
    expect(assets.trayPhotos?.[0]).toMatchObject({
      trayId: "tray-1",
      trayNumber: 104,
      mediaType: "image/png",
    });
    expect(assets.trayPhotos?.[0]?.bytes).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
  });
});
