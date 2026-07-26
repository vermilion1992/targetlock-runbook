import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  MediaRepositoryError,
  MemoryMediaRepository,
  type MediaRepository,
  type SavedMedia,
} from "@/infrastructure/media";
import { LocalTrayRepository } from "./tray-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

class FailingMediaRepository implements MediaRepository {
  saveOriginal(): Promise<SavedMedia> {
    return Promise.reject(
      new MediaRepositoryError("STORAGE_UNAVAILABLE", "Disk full"),
    );
  }
  savePreview(): Promise<SavedMedia> {
    return Promise.reject(new Error("not reached"));
  }
  getBlob(): Promise<Blob | null> {
    return Promise.resolve(null);
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

function createInput(operationId = "operation-1") {
  return {
    operationId,
    trayId: `tray-${operationId}`,
    photoId: `photo-${operationId}`,
    holeId: "DDH041",
    trayNumber: 18,
    startDepthDm: decimetres(3_826),
    endDepthDm: decimetres(3_884),
    comment: "Completed tray",
    isFinalPartial: false,
    original: new Blob(["tray-image"], { type: "image/jpeg" }),
    originalFilename: "tray-18.jpg",
    capturedAt: "2026-07-21T10:42:00.000Z",
    userId: "user-1",
    userNameSnapshot: "M. Hoffman",
  };
}

describe("LocalTrayRepository media transactions", () => {
  it("stores original metadata before creating the tray and is idempotent", async () => {
    const media = new MemoryMediaRepository();
    const repository = new LocalTrayRepository(
      new MemoryStorage(),
      media,
    );
    const input = createInput();
    const saved = await repository.createWithPhoto(input);
    expect(saved.primaryPhotoId).toBe(input.photoId);
    const photo = await repository.getPhotoById(input.photoId, input.holeId);
    expect(photo?.originalStorageKey).toBeTruthy();
    expect(await media.verify(photo!.originalStorageKey)).toBe(true);
    await expect(repository.createWithPhoto(input)).resolves.toEqual(saved);
  });

  it("prevents duplicate tray numbers", async () => {
    const repository = new LocalTrayRepository(
      new MemoryStorage(),
      new MemoryMediaRepository(),
    );
    await repository.createWithPhoto(createInput("operation-1"));
    await expect(
      repository.createWithPhoto({
        ...createInput("operation-2"),
        trayId: "tray-2",
        photoId: "photo-2",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_TRAY_NUMBER",
    });
  });

  it("preserves the previous photo metadata during replacement", async () => {
    const repository = new LocalTrayRepository(
      new MemoryStorage(),
      new MemoryMediaRepository(),
    );
    const tray = await repository.createWithPhoto(createInput());
    const previousPhotoId = tray.primaryPhotoId;
    const replaced = await repository.replacePhoto({
      operationId: "replace-1",
      photoId: "photo-replacement",
      trayId: tray.localId,
      holeId: tray.holeId,
      expectedVersion: tray.version,
      reason: "First image was blurred",
      original: new Blob(["new-tray-image"], { type: "image/jpeg" }),
      originalFilename: "tray-18-new.jpg",
      capturedAt: "2026-07-21T10:45:00.000Z",
      userId: "user-1",
      userNameSnapshot: "M. Hoffman",
    });
    expect(replaced.primaryPhotoId).toBe("photo-replacement");
    expect(
      await repository.getPhotoById(previousPhotoId, tray.holeId),
    ).not.toBeNull();
    expect(
      await repository.listCorrections(tray.localId, tray.holeId),
    ).toMatchObject([
      {
        fieldName: "primaryPhotoId",
        previousValue: previousPhotoId,
        correctedValue: "photo-replacement",
      },
    ]);
    await expect(
      repository.getById(tray.localId, "DDH042"),
    ).resolves.toBeNull();
    await expect(
      repository.getPhotoById(previousPhotoId, "DDH042"),
    ).resolves.toBeNull();
    await expect(
      repository.listCorrections(tray.localId, "DDH042"),
    ).resolves.toEqual([]);
  });

  it("leaves no tray record when media storage fails", async () => {
    const repository = new LocalTrayRepository(
      new MemoryStorage(),
      new FailingMediaRepository(),
    );
    await expect(
      repository.createWithPhoto(createInput()),
    ).rejects.toMatchObject({
      code: "MEDIA_SAVE_FAILED",
    });
    expect(await repository.listByHole("DDH041")).toHaveLength(0);
  });

  it("lists pending transaction stages without recovering or mutating them", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalTrayRepository(
      storage,
      new MemoryMediaRepository(),
    );
    await repository.createWithPhoto(createInput());
    const key = "targetlock:prototype:v1:hole:DDH041:trays";
    const envelope = JSON.parse(storage.values.get(key)!) as {
      operations: Array<{
        operationId: string;
        stage: string;
      }>;
    };
    envelope.operations[0]!.stage = "PREVIEW_SAVED";
    storage.values.set(key, JSON.stringify(envelope));
    const beforeRead = storage.values.get(key);

    await expect(repository.listPendingOperations("DDH041")).resolves.toEqual([
      expect.objectContaining({
        operationId: "operation-1",
        stage: "PREVIEW_SAVED",
      }),
    ]);
    expect(storage.values.get(key)).toBe(beforeRead);

    envelope.operations[0]!.stage = "FAILED";
    storage.values.set(key, JSON.stringify(envelope));
    await expect(repository.listPendingOperations("DDH041")).resolves.toEqual(
      [],
    );
  });
});
