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
      holeId: "DDH041",
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
      holeId: "DDH041",
      blob,
    });
    await expect(
      repository.savePreview({
        operationId: "operation-1",
        holeId: "DDH041",
        blob,
      }),
    ).resolves.toEqual(first);
  });

  it("rejects conflicting duplicate operation IDs", async () => {
    const repository = new MemoryMediaRepository();
    await repository.saveOriginal({
      operationId: "operation-1",
      holeId: "DDH041",
      blob: new Blob(["first"], { type: "image/jpeg" }),
    });
    await expect(
      repository.saveOriginal({
        operationId: "operation-1",
        holeId: "DDH041",
        blob: new Blob(["different-size"], { type: "image/jpeg" }),
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("namespaces the same operation ID independently for each hole", async () => {
    const repository = new MemoryMediaRepository("organisation-1");
    const first = await repository.saveOriginal({
      operationId: "capture-1",
      holeId: "DDH041",
      blob: new Blob(["first"], { type: "image/jpeg" }),
    });
    const second = await repository.saveOriginal({
      operationId: "capture-1",
      holeId: "DDH042",
      blob: new Blob(["second"], { type: "image/jpeg" }),
    });

    expect(first.storageKey).not.toBe(second.storageKey);
    expect(first.storageKey).toContain("org:organisation-1:hole:DDH041");
    expect(second.storageKey).toContain("org:organisation-1:hole:DDH042");
  });

  it("fails preview generation safely when browser image APIs are unavailable", async () => {
    await expect(
      generateImagePreview(new Blob(["image"], { type: "image/jpeg" })),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });
});
