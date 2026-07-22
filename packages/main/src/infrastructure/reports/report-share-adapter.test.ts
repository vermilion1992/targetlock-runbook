import { describe, expect, it } from "vitest";

import { MemoryReportShareAdapter } from "./report-share-adapter";

describe("MemoryReportShareAdapter", () => {
  it("records successful share without delivery claims", async () => {
    const adapter = new MemoryReportShareAdapter();
    adapter.nextShareResult = { status: "shared" };
    const result = await adapter.share({
      filename: "a.pdf",
      mimeType: "application/pdf",
      blob: new Blob(["x"], { type: "application/pdf" }),
      title: "Report",
    });
    expect(result).toEqual({ status: "shared" });
    expect(adapter.shared).toHaveLength(1);
  });

  it("does not treat cancelled share as success", async () => {
    const adapter = new MemoryReportShareAdapter();
    adapter.nextShareResult = { status: "cancelled" };
    const result = await adapter.share({
      filename: "a.pdf",
      mimeType: "application/pdf",
      blob: new Blob(["x"], { type: "application/pdf" }),
      title: "Report",
    });
    expect(result.status).toBe("cancelled");
    expect(adapter.shared).toHaveLength(0);
  });

  it("falls back to download when unsupported", async () => {
    const adapter = new MemoryReportShareAdapter();
    adapter.nextShareResult = { status: "unsupported", downloaded: true };
    const result = await adapter.share({
      filename: "a.pdf",
      mimeType: "application/pdf",
      blob: new Blob(["x"], { type: "application/pdf" }),
      title: "Report",
    });
    expect(result).toEqual({ status: "unsupported", downloaded: true });
    expect(adapter.downloaded).toHaveLength(1);
  });
});
