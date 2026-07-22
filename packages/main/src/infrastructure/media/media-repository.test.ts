import { describe, expect, it } from "vitest";

import {
  generateImagePreview,
  MemoryMediaRepository,
} from ".";

describe("MemoryMediaRepository", () => {
  it("saves, retrieves, verifies and deletes original media", async () => {
    const repository = new MemoryMediaRepository();
    const blob = new Blob(["image"], { type: "image/jpeg" });
    const saved = await repository.saveOriginal({
      operationId: "operation-1",
      blob,
    });
    expect(await repository.verify(saved.storageKey)).toBe(true);
    expect(await repository.getBlob(saved.storageKey)).toEqual(blob);
    await repository.delete(saved.storageKey);
    expect(await repository.verify(saved.storageKey)).toBe(false);
    expect(await repository.getBlob("missing")).toBeNull();
  });

  it("saves a preview and makes duplicate operation IDs idempotent", async () => {
    const repository = new MemoryMediaRepository();
    const blob = new Blob(["preview"], { type: "image/jpeg" });
    const first = await repository.savePreview({
      operationId: "operation-1",
      blob,
    });
    await expect(
      repository.savePreview({ operationId: "operation-1", blob }),
    ).resolves.toEqual(first);
  });

  it("rejects conflicting duplicate operation IDs", async () => {
    const repository = new MemoryMediaRepository();
    await repository.saveOriginal({
      operationId: "operation-1",
      blob: new Blob(["first"], { type: "image/jpeg" }),
    });
    await expect(
      repository.saveOriginal({
        operationId: "operation-1",
        blob: new Blob(["different-size"], { type: "image/jpeg" }),
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("fails preview generation safely when browser image APIs are unavailable", async () => {
    await expect(
      generateImagePreview(new Blob(["image"], { type: "image/jpeg" })),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });
});
