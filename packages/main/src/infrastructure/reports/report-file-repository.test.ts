import { describe, expect, it } from "vitest";

import {
  MemoryReportFileRepository,
  ReportFileRepositoryError,
} from "./report-file-repository";

describe("MemoryReportFileRepository", () => {
  it("saves, verifies, retrieves and deletes report files", async () => {
    const repo = new MemoryReportFileRepository();
    const blob = new Blob(["pdf-bytes"], { type: "application/pdf" });
    const saved = await repo.save(
      "op-1",
      "DDH041",
      "DDH041_Full_Runbook_v001_2026-07-22.pdf",
      "application/pdf",
      blob,
    );
    expect(saved.storageKey).toContain(
      "org:memory-organisation:hole:DDH041:report:op-1",
    );
    expect(await repo.verify(saved.storageKey)).toBe(true);
    const loaded = await repo.get(saved.storageKey);
    expect(loaded).not.toBeNull();
    expect(await loaded!.text()).toBe("pdf-bytes");
    await repo.delete(saved.storageKey);
    expect(await repo.verify(saved.storageKey)).toBe(false);
  });

  it("is idempotent for the same operation id and rejects conflicts", async () => {
    const repo = new MemoryReportFileRepository();
    const blob = new Blob(["same"], { type: "application/pdf" });
    const first = await repo.save(
      "op-dup",
      "DDH041",
      "a.pdf",
      "application/pdf",
      blob,
    );
    const second = await repo.save(
      "op-dup",
      "DDH041",
      "a.pdf",
      "application/pdf",
      blob,
    );
    expect(second.storageKey).toBe(first.storageKey);
    await expect(
      repo.save(
        "op-dup",
        "DDH041",
        "b.pdf",
        "application/pdf",
        new Blob(["other"], { type: "application/pdf" }),
      ),
    ).rejects.toBeInstanceOf(ReportFileRepositoryError);

    const otherHole = await repo.save(
      "op-dup",
      "DDH042",
      "b.pdf",
      "application/pdf",
      new Blob(["other"], { type: "application/pdf" }),
    );
    expect(otherHole.storageKey).not.toBe(first.storageKey);
  });
});
