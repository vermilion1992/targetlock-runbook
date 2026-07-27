import { describe, expect, it } from "vitest";

import {
  decimetres,
  normalizeHoleStatus,
  type AuditEntry,
  type CasingEvent,
  type CasingString,
  type Component,
  type ComponentAssignment,
  type Hole,
  type ReportType,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type SyncMetadata,
  type Tray,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type { CompletionRepository } from "@/infrastructure/completion";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalReportMetadataRepository,
  MemoryReportFileRepository,
  MemoryReportShareAdapter,
} from "@/infrastructure/reports";
import type { HoleCompletionContext } from "@/application/runbook/hole-completion-use-cases";

import {
  generateReport,
  prepareEmailDraft,
  shareReport,
  type ReportServices,
} from "./report-use-cases";

const NOW = "2026-07-22T08:14:00.000Z";

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

class MemoryAudits implements AuditRepository {
  readonly entries: AuditEntry[] = [];
  async listByHole(holeId: string) {
    return this.entries.filter((entry) => entry.holeId === holeId);
  }
  async listByEntity(holeId: string, entityType: string, entityId: string) {
    return (await this.listByHole(holeId)).filter(
      (entry) =>
        entry.entityType === entityType && entry.entityId === entityId,
    );
  }
  async append(entry: AuditEntry) {
    if (this.entries.some((item) => item.localId === entry.localId)) {
      return "already-saved";
    }
    this.entries.push(entry);
    return "saved";
  }
}

function metadata(localId: string): SyncMetadata {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: NOW,
    updatedAt: NOW,
    deviceId: "test",
    version: 1,
  };
}

function makeContext(status: Hole["status"] = "ACTIVE"): HoleCompletionContext {
  const hole: Hole = {
    ...metadata("DDH041"),
    projectId: "project-briggs",
    rigId: "rig-1",
    name: "DDH041",
    holeSize: "HQ",
    plannedDepth: decimetres(7000),
    currentDepth: decimetres(6615),
    status,
    collarEasting: 1,
    collarNorthing: 2,
    collarElevation: 3,
  };
  const shift: RunbookShift = {
    ...metadata("shift-1"),
    holeId: "DDH041",
    rigId: "rig-1",
    shiftType: "DAY",
    shiftDate: "2026-07-21",
    primaryDrillerId: "user-1",
    primaryDrillerNameSnapshot: "M. Hoffman",
    crewMembers: [{ name: "Crew" }],
    startedAt: NOW,
    startingDepthDm: decimetres(6500),
    endingDepthDm: decimetres(6615),
    startingRodNumber: 1,
    startingRodStringDm: decimetres(100),
    startingRunNumber: 1,
    status: "CLOSED",
  };
  const run: Run = {
    ...metadata("run-1"),
    holeId: "DDH041",
    startedShiftId: "shift-1",
    completedShiftId: "shift-1",
    runNumber: 1,
    rodNumber: 1,
    startedAt: NOW,
    startedByUserId: "user-1",
    startedByNameSnapshot: "Hoffman",
    completedAt: NOW,
    completedByUserId: "user-1",
    completedByNameSnapshot: "Hoffman",
    rodEventIds: [],
    rodAddedLength: decimetres(30) as Run["rodAddedLength"],
    previousCompletedDepth: decimetres(6585),
    startDepth: decimetres(6585),
    measuredStickUp: decimetres(5),
    rodStringLength: decimetres(162),
    holeDepth: decimetres(6615),
    drilledLength: decimetres(30),
    recoveredLength: decimetres(29),
    recoveryPercentage: 96.7,
    conditionTagIds: [],
    conditionTagLabelsSnapshot: [],
    comment: null,
    correctionIds: [],
    activeBitSerialNumberSnapshot: null,
    activeReamerSerialNumberSnapshot: null,
    activeBitAssignmentId: null,
    activeReamerAssignmentId: null,
    casingSummarySnapshot: null,
    status: "completed",
    holeNameSnapshot: "DDH041",
    rigNameSnapshot: "Rig 1",
  };
  const shared: Run = {
    ...run,
    ...metadata("run-2"),
    runNumber: 2,
    startedShiftId: "shift-1",
    completedShiftId: "shift-2",
    previousCompletedDepth: decimetres(6615),
    startDepth: decimetres(6615),
    holeDepth: decimetres(6645),
  };
  const config: RodStringConfiguration = {
    ...metadata("rod-config-1"),
    holeId: "DDH041",
    effectiveAt: NOW,
    bottomHoleAssemblyLength: decimetres(90),
    constantStickUp: decimetres(5),
    baseRodStringLength: decimetres(85),
    reason: "initial",
  };
  const rodEvent: RodAddition = {
    ...metadata("rod-event-1"),
    holeId: "DDH041",
    runId: "run-1",
    shiftId: "shift-1",
    sequence: 1,
    action: "add",
    rodLength: decimetres(30) as RodAddition["rodLength"],
    affectedRodNumber: 1,
    rodNumberAfterEvent: 1,
    occurredAt: NOW,
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Hoffman",
  };
  const casing: CasingString = {
    ...metadata("casing-1"),
    holeId: "DDH041",
    casingSize: "HQ",
    startDepthDm: decimetres(0),
    currentEndDepthDm: decimetres(120),
    status: "ACTIVE",
    installedAt: NOW,
    installedByUserId: "user-1",
    installedByNameSnapshot: "Hoffman",
  };
  const survey: Survey = {
    ...metadata("survey-1"),
    holeId: "DDH041",
    depthDm: decimetres(6500),
    dipTenths: -624,
    azimuthTenths: 1301,
    northReference: "GRID",
    toolNameSnapshot: "Reflex",
    toolSerialSnapshot: "RX-1",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Hoffman",
    recordedAt: NOW,
  };
  const tray: Tray = {
    ...metadata("tray-1"),
    holeId: "DDH041",
    trayNumber: 1,
    startDepthDm: decimetres(6500),
    endDepthDm: decimetres(6615),
    isFinalPartial: false,
    primaryPhotoId: "photo-1",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Hoffman",
    recordedAt: NOW,
  };
  const component: Component = {
    ...metadata("bit-1"),
    organisationId: "org-1",
    type: "BIT",
    serialNumber: "BIT-1",
    normalizedSerialNumber: "BIT-1",
    manufacturer: "Acme",
    model: "X",
    size: "HQ",
    status: "ACTIVE",
    createdByUserId: "user-1",
    createdByNameSnapshot: "Hoffman",
  };
  const assignment: ComponentAssignment = {
    ...metadata("assign-1"),
    componentId: "bit-1",
    holeId: "DDH041",
    componentType: "BIT",
    startDepthDm: decimetres(6400),
    installedAt: NOW,
    installedByUserId: "user-1",
    installedByNameSnapshot: "Hoffman",
    status: "ACTIVE",
  };

  return {
    holeId: "DDH041",
    hole: {
      ...hole,
      status: normalizeHoleStatus(
        status === "completed" ? "COMPLETED" : status,
      ),
    },
    projectId: "project-briggs",
    projectName: "Briggs",
    rigId: "rig-1",
    rigName: "Rig 1",
    currentState: {
      holeId: "DDH041",
      currentDepthDm: decimetres(6615),
      previousCompletedDepthDm: decimetres(6585),
      currentRodNumber: 2,
      currentRodStringDm: decimetres(162),
      nextRunNumber: 3,
      lastCompletedRunNumber: 2,
      activeShift: null,
      pendingHandover: null,
      draft: { status: "empty" },
      completedLocalRuns: [],
      bhaSetup: null,
      surveys: [survey],
      trays: [tray],
      casingStrings: [casing],
    },
    runs: [run, shared],
    completedRuns: [run, shared],
    finalRun: shared,
    rodConfiguration: config,
    rodEvents: [rodEvent],
    rodProjection: null,
    shifts: [shift],
    casingStrings: [casing],
    components: [component],
    componentAssignments: [assignment],
    surveys: [survey],
    trays: [tray],
    pendingOperations: { rodEvents: 0, media: 0, corrections: 0 },
  };
}

function makeServices(
  status: Hole["status"] = "ACTIVE",
  completionSnapshot = false,
): ReportServices & { readonly audits: MemoryAudits; readonly share: MemoryReportShareAdapter } {
  const audits = new MemoryAudits();
  const share = new MemoryReportShareAdapter();
  const reports = new LocalReportMetadataRepository(new MemoryStorage(), "org-1");
  const context = makeContext(status);
  const casingEvents: CasingEvent[] = [
    {
      ...metadata("casing-event-1"),
      holeId: "DDH041",
      casingStringId: "casing-1",
      eventType: "INSTALL",
      newEndDepthDm: decimetres(120),
      recordedByUserId: "user-1",
      recordedByNameSnapshot: "Hoffman",
      recordedAt: NOW,
      operationId: "casing-op-1",
    },
  ];

  const completion = {
    async getLifecycleState(holeId: string) {
      if (holeId !== "DDH041") return null;
      return {
        hole: context.hole,
        latestCompletionRecordId: completionSnapshot ? "completion-1" : undefined,
        latestReopenRecordId: undefined,
      };
    },
    async getReopenHistory() {
      return [];
    },
    async getLatestCompletion(holeId: string) {
      if (!completionSnapshot || holeId !== "DDH041") return null;
      return {
        ...metadata("completion-1"),
        holeId: "DDH041",
        reviewId: "review-1",
        finalStatus: "COMPLETED" as const,
        completedAt: NOW,
        completedByUserId: "user-1",
        completedByNameSnapshot: "Hoffman",
        operationId: "complete-1",
        snapshot: {
          holeId: "DDH041",
          projectId: "project-briggs",
          projectNameSnapshot: "Briggs",
          rigId: "rig-1",
          rigNameSnapshot: "Rig 1",
          finalStatus: "COMPLETED" as const,
          finalDepthDm: decimetres(6615),
          plannedDepthDm: decimetres(7000),
          finalRunNumber: 2,
          runIds: ["run-1", "run-2"],
          finalRodNumber: 2,
          currentRodStringDm: decimetres(162),
          measuredStickUpDm: decimetres(5),
          bottomHoleAssemblyLengthDm: decimetres(90),
          constantStickUpDm: decimetres(5),
          baseRodStringDm: decimetres(85),
          rodStringConfigurationId: "rod-config-1",
          casingSummary: "HQ",
          finalPartialTrayConfirmed: true,
          surveyCount: 1,
          trayCount: 1,
          totalRuns: 2,
          totalDrilledDm: decimetres(60),
          totalRecoveredDm: decimetres(58),
          totalLossDm: decimetres(2),
          totalGainDm: decimetres(0),
          overallRecoveryPercentTenths: 967,
          reason: "PLANNED_DEPTH_REACHED" as const,
          checklist: [],
          componentOutcomes: [],
          warningAcknowledgements: [
            {
              checkCode: "CASING_REVIEWED" as const,
              reason: "Reviewed",
              acknowledgedAt: NOW,
              acknowledgedByUserId: "user-1",
              acknowledgedByNameSnapshot: "Hoffman",
            },
          ],
          completedByUserId: "user-1",
          completedByNameSnapshot: "Hoffman",
          capturedAt: NOW,
        },
      };
    },
  } as unknown as CompletionRepository;

  return {
    context: { get: async () => context },
    completion,
    casing: {
      listByHole: async () => context.casingStrings,
      listEvents: async () => casingEvents,
    } as unknown as ReportServices["casing"],
    surveys: {
      listByHole: async () => context.surveys,
      listCorrections: async () => [],
    } as unknown as ReportServices["surveys"],
    reports,
    reportFiles: new MemoryReportFileRepository(),
    share,
    audits,
  };
}

describe("generateReport", () => {
  const types: ReportType[] = [
    "FULL_HOLE_RUNBOOK",
    "CURRENT_SHIFT_RUNBOOK",
    "HOLE_SUMMARY",
    "SURVEY_HISTORY",
    "TRAY_REGISTER",
    "COMPONENT_HISTORY",
    "CASING_HISTORY",
  ];

  for (const reportType of types) {
    it(`builds ${reportType} for an active hole`, async () => {
      const services = makeServices("ACTIVE");
      const result = await generateReport(
        {
          operationId: `op-${reportType}`,
          holeId: "DDH041",
          reportType,
          format: "PDF",
          generatedByUserId: "user-1",
          generatedByNameSnapshot: "Hoffman",
          generatedAt: NOW,
        },
        services,
      );
      expect(result.report.version).toBe(1);
      expect(result.report.holeId).toBe("DDH041");
      expect(result.report.activityStatus).toBe("GENERATED");
      expect(await services.reportFiles.verify(result.report.storageKey)).toBe(
        true,
      );
    });
  }

  it("uses completion snapshot for completed holes and keeps versions", async () => {
    const services = makeServices("COMPLETED", true);
    const first = await generateReport(
      {
        operationId: "op-completed-1",
        holeId: "DDH041",
        reportType: "FULL_HOLE_RUNBOOK",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
      },
      services,
    );
    expect(first.report.holeStatusSnapshot).toBe("Completed");
    expect(first.report.holeDepthSnapshotDm).toBe(6615);

    const second = await generateReport(
      {
        operationId: "op-completed-2",
        holeId: "DDH041",
        reportType: "FULL_HOLE_RUNBOOK",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: "2026-07-22T09:00:00.000Z",
      },
      services,
    );
    expect(second.report.version).toBe(2);
    const listed = await services.reports.listReports("DDH041");
    expect(listed).toHaveLength(2);
  });

  it("is idempotent for duplicate operation ids", async () => {
    const services = makeServices();
    const input = {
      operationId: "op-idempotent",
      holeId: "DDH041" as const,
      reportType: "HOLE_SUMMARY" as const,
      format: "CSV" as const,
      generatedByUserId: "user-1",
      generatedByNameSnapshot: "Hoffman",
      generatedAt: NOW,
    };
    const first = await generateReport(input, services);
    const second = await generateReport(input, services);
    expect(second.alreadyCompleted).toBe(true);
    expect(second.report.localId).toBe(first.report.localId);
    expect(await services.reports.listReports("DDH041")).toHaveLength(1);
  });

  it("records share cancellation without SHARED status", async () => {
    const services = makeServices();
    const generated = await generateReport(
      {
        operationId: "op-share",
        holeId: "DDH041",
        reportType: "SURVEY_HISTORY",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
      },
      services,
    );
    services.share.nextShareResult = { status: "cancelled" };
    const result = await shareReport(
      {
        operationId: "share-1",
        reportId: generated.report.localId,
        holeId: "DDH041",
        userId: "user-1",
        userName: "Hoffman",
      },
      services,
    );
    expect(result.status).toBe("cancelled");
    const report = await services.reports.getReport(
      generated.report.localId,
      "DDH041",
    );
    expect(report?.activityStatus).not.toBe("SHARED");
    expect(
      services.audits.entries.some((entry) => entry.action === "report_share_cancelled"),
    ).toBe(true);
  });

  it("prepares email draft without claiming delivery", async () => {
    const services = makeServices();
    const generated = await generateReport(
      {
        operationId: "op-email",
        holeId: "DDH041",
        reportType: "HOLE_SUMMARY",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
      },
      services,
    );
    const draft = await prepareEmailDraft(
      {
        operationId: "email-1",
        reportId: generated.report.localId,
        holeId: "DDH041",
        toRecipients: ["supervisor@briggs.example"],
        userId: "user-1",
        userName: "Hoffman",
        openMailClient: false,
      },
      services,
    );
    expect(draft.manualAttachRequired).toBe(true);
    expect(draft.outbox.status).toBe("DRAFT");
    expect(
      services.audits.entries.some(
        (entry) => entry.action === "report_email_draft_prepared",
      ),
    ).toBe(true);
    expect(
      services.audits.entries.some((entry) =>
        entry.action.toLowerCase().includes("deliver"),
      ),
    ).toBe(false);
  });

  it("isolates report listings by hole", async () => {
    const services = makeServices();
    await generateReport(
      {
        operationId: "op-hole-a",
        holeId: "DDH041",
        reportType: "TRAY_REGISTER",
        format: "CSV",
        csvDataset: "trays",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
      },
      services,
    );
    expect(await services.reports.listReports("DDH099")).toHaveLength(0);
  });

  it("does not mark failed generation as generated and allows retry with new op id", async () => {
    const services = makeServices();
    const original = services.reportFiles.save.bind(services.reportFiles);
    let calls = 0;
    services.reportFiles.save = async (...args) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("IndexedDB quota exceeded");
      }
      return original(...args);
    };

    await expect(
      generateReport(
        {
          operationId: "op-fail-once",
          holeId: "DDH041",
          reportType: "HOLE_SUMMARY",
          format: "PDF",
          generatedByUserId: "user-1",
          generatedByNameSnapshot: "Hoffman",
          generatedAt: NOW,
        },
        services,
      ),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    expect(await services.reports.listReports("DDH041")).toHaveLength(0);
    const failed = await services.reports.listFailedTransactions("DDH041");
    expect(failed[0]?.stage).toBe("FAILED");

    const retried = await generateReport(
      {
        operationId: "op-fail-retry",
        holeId: "DDH041",
        reportType: "HOLE_SUMMARY",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
      },
      services,
    );
    expect(retried.report.activityStatus).toBe("GENERATED");
    expect(retried.report.sizeBytes).toBeGreaterThan(0);
    expect(await services.reports.listReports("DDH041")).toHaveLength(1);
  });

  it("emits staged progress callbacks before completion", async () => {
    const services = makeServices();
    const stages: string[] = [];
    await generateReport(
      {
        operationId: "op-progress",
        holeId: "DDH041",
        reportType: "HOLE_SUMMARY",
        format: "PDF",
        generatedByUserId: "user-1",
        generatedByNameSnapshot: "Hoffman",
        generatedAt: NOW,
        onProgress: (stage) => stages.push(stage),
      },
      services,
    );
    expect(stages).toEqual([
      "Building report snapshot…",
      "Generating PDF…",
      "Saving report locally…",
      "Verifying file…",
    ]);
  });
});
