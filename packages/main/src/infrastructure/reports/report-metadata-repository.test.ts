import { describe, expect, it } from "vitest";

import { decimetres, type ReportSnapshot } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";

import { LocalReportMetadataRepository } from "./report-metadata-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function snapshot(version: number): ReportSnapshot {
  return {
    id: `snap-${version}`,
    holeId: "DDH041",
    reportType: "FULL_HOLE_RUNBOOK",
    generatedAt: "2026-07-22T08:14:00.000Z",
    generatedByUserId: "user-1",
    generatedByNameSnapshot: "M. Hoffman",
    holeDepthSnapshotDm: decimetres(6615),
    holeStatusSnapshot: "Active",
    sourceVersions: [{ entityType: "hole", entityId: "DDH041", version: 1 }],
    operationId: `op-${version}`,
    version,
    documentData: {
      holeId: "DDH041",
      holeName: "DDH041",
      projectName: "Briggs",
      rigName: "Rig",
      holeStatus: "Active",
      currentOrFinalDepthDm: decimetres(6615),
      plannedDepthDm: decimetres(7000),
      shifts: [],
      runsheet: [],
      rodEvents: [],
      rodConfigurationSummary: "",
      currentRodState: "",
      casingSummary: "",
      casingEvents: [],
      bits: [],
      reamers: [],
      surveys: [],
      surveySummary: {
        total: 0,
        duplicateDepthCount: 0,
        correctionCount: 0,
      },
      trays: [],
      corrections: [],
      timelineSummary: [],
      significantEvents: [],
      statistics: {
        totalRuns: 0,
        totalDrilledDm: decimetres(0),
        totalRecoveredDm: decimetres(0),
        weightedRecoveryPercentTenths: 0,
        totalLossDm: decimetres(0),
        totalGainDm: decimetres(0),
        surveyCount: 0,
        trayCount: 0,
        shiftCount: 0,
      },
      disclosures: [],
    },
  };
}

describe("LocalReportMetadataRepository", () => {
  it("versions reports and retains previous generations", async () => {
    const repo = new LocalReportMetadataRepository(
      new MemoryStorage(),
      "org-1",
      [
        {
          id: "r1",
          email: "ops@example.com",
          scope: "PROJECT",
          projectId: "project-briggs",
          isDefault: true,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
          syncStatus: "local-only",
          version: 1,
        },
      ],
    );

    expect(await repo.nextVersion("DDH041", "FULL_HOLE_RUNBOOK", "PDF")).toBe(1);
    await repo.beginGeneration({
      operationId: "op-1",
      holeId: "DDH041",
      reportType: "FULL_HOLE_RUNBOOK",
      format: "PDF",
      fingerprint: "fp-1",
    });
    await repo.saveSnapshot("op-1", snapshot(1));
    await repo.saveGeneratedReport("op-1", {
      localId: "report-op-1",
      holeId: "DDH041",
      snapshotId: "snap-1",
      reportType: "FULL_HOLE_RUNBOOK",
      format: "PDF",
      version: 1,
      filename: "a.pdf",
      mimeType: "application/pdf",
      storageKey: "report:op-1",
      sizeBytes: 10,
      generatedAt: "2026-07-22T08:14:00.000Z",
      generatedByUserId: "user-1",
      generatedByNameSnapshot: "M. Hoffman",
      holeDepthSnapshotDm: decimetres(6615),
      holeStatusSnapshot: "Active",
      activityStatus: "GENERATED",
      operationId: "op-1",
      syncStatus: "local-only",
      createdAt: "2026-07-22T08:14:00.000Z",
      updatedAt: "2026-07-22T08:14:00.000Z",
      versionMeta: 1,
    });

    expect(await repo.nextVersion("DDH041", "FULL_HOLE_RUNBOOK", "PDF")).toBe(2);

    await repo.beginGeneration({
      operationId: "op-2",
      holeId: "DDH041",
      reportType: "FULL_HOLE_RUNBOOK",
      format: "PDF",
      fingerprint: "fp-2",
    });
    await repo.saveSnapshot("op-2", snapshot(2));
    await repo.saveGeneratedReport("op-2", {
      localId: "report-op-2",
      holeId: "DDH041",
      snapshotId: "snap-2",
      reportType: "FULL_HOLE_RUNBOOK",
      format: "PDF",
      version: 2,
      filename: "b.pdf",
      mimeType: "application/pdf",
      storageKey: "report:op-2",
      sizeBytes: 12,
      generatedAt: "2026-07-22T09:00:00.000Z",
      generatedByUserId: "user-1",
      generatedByNameSnapshot: "M. Hoffman",
      holeDepthSnapshotDm: decimetres(6615),
      holeStatusSnapshot: "Active",
      activityStatus: "GENERATED",
      operationId: "op-2",
      syncStatus: "local-only",
      createdAt: "2026-07-22T09:00:00.000Z",
      updatedAt: "2026-07-22T09:00:00.000Z",
      versionMeta: 1,
    });

    const list = await repo.listReports("DDH041");
    expect(list).toHaveLength(2);
    expect(list.map((item) => item.version).sort()).toEqual([1, 2]);
    await expect(
      repo.getReport("report-op-1", "DDH041"),
    ).resolves.not.toBeNull();
    await expect(
      repo.getReport("report-op-1", "DDH042"),
    ).resolves.toBeNull();
    await expect(repo.getSnapshot("snap-1", "DDH041")).resolves.not.toBeNull();
    await expect(repo.getSnapshot("snap-1", "DDH042")).resolves.toBeNull();

    const again = await repo.beginGeneration({
      operationId: "op-1",
      holeId: "DDH041",
      reportType: "FULL_HOLE_RUNBOOK",
      format: "PDF",
      fingerprint: "fp-1",
    });
    expect(again.kind).toBe("already-completed");

    const recipients = await repo.listRecipients({
      holeId: "DDH041",
      projectId: "project-briggs",
    });
    expect(recipients[0]?.email).toBe("ops@example.com");
  });
});
