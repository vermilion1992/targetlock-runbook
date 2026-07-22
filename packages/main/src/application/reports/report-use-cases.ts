import {
  buildReportFilename,
  reportMimeType,
  reportTypeLabel,
  type GeneratedReportRecord,
  type ReportActivityStatus,
  type ReportDispatchStatus,
  type ReportFormat,
  type ReportOutboxItem,
  type ReportSnapshot,
  type ReportType,
  type SavedReportRecipient,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import {
  generateCsvBundle,
  type CsvDatasetName,
} from "@/infrastructure/reports/csv-generator";
import { generateExcelWorkbook } from "@/infrastructure/reports/excel-generator";
import { generateReportPdf } from "@/infrastructure/reports/pdf-generator";
import type { ReportFileRepository } from "@/infrastructure/reports/report-file-repository";
import type { ReportMetadataRepository } from "@/infrastructure/reports/report-metadata-repository";
import type {
  ReportShareAdapter,
  ShareReportResult,
} from "@/infrastructure/reports/report-share-adapter";
import {
  buildReportDocumentData,
  type ReportDocumentBuilderDependencies,
} from "./build-report-document";

export class ReportApplicationError extends Error {
  constructor(
    readonly code:
      | "IDEMPOTENCY_CONFLICT"
      | "GENERATION_FAILED"
      | "NOT_FOUND"
      | "STORAGE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ReportApplicationError";
  }
}

export interface ReportServices extends ReportDocumentBuilderDependencies {
  readonly reports: ReportMetadataRepository;
  readonly reportFiles: ReportFileRepository;
  readonly share: ReportShareAdapter;
  readonly audits: AuditRepository;
}

export interface GenerateReportInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly reportType: ReportType;
  readonly format: ReportFormat;
  readonly shiftId?: string;
  readonly csvDataset?: CsvDatasetName;
  readonly generatedByUserId: string;
  readonly generatedByNameSnapshot: string;
  readonly generatedAt?: string;
}

export interface GenerateReportResult {
  readonly report: GeneratedReportRecord;
  readonly recovered: boolean;
  readonly alreadyCompleted: boolean;
}

function fingerprintOf(input: GenerateReportInput): string {
  return JSON.stringify({
    holeId: input.holeId,
    reportType: input.reportType,
    format: input.format,
    shiftId: input.shiftId ?? null,
    csvDataset: input.csvDataset ?? null,
  });
}

async function appendAudit(
  services: ReportServices,
  input: {
    readonly holeId: string;
    readonly operationId: string;
    readonly action: string;
    readonly entityId: string;
    readonly userId: string;
    readonly userName: string;
    readonly metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await services.audits.append({
    localId: `audit-${input.operationId}-${input.action}`,
    serverId: null,
    syncStatus: "local-only",
    createdAt: now,
    updatedAt: now,
    deviceId: "local-runbook-device",
    version: 1,
    holeId: input.holeId,
    entityType: "report",
    entityId: input.entityId,
    action: input.action,
    userId: input.userId,
    userNameSnapshot: input.userName,
    timestamp: now,
    metadata: {
      operationId: input.operationId,
      ...(input.metadata ?? {}),
    },
  });
}

async function generateBlob(
  snapshot: ReportSnapshot,
  format: ReportFormat,
  csvDataset?: CsvDatasetName,
): Promise<{ readonly blob: Blob; readonly csvDataset?: CsvDatasetName }> {
  if (format === "PDF") {
    return { blob: await generateReportPdf(snapshot) };
  }
  if (format === "XLSX") {
    return { blob: await generateExcelWorkbook(snapshot) };
  }
  const datasets = generateCsvBundle(snapshot.reportType, snapshot.documentData);
  const selected =
    datasets.find((item) => item.dataset === csvDataset) ?? datasets[0];
  if (selected === undefined) {
    throw new ReportApplicationError(
      "GENERATION_FAILED",
      "No CSV dataset available for this report type.",
    );
  }
  return {
    blob: new Blob([selected.content], {
      type: "text/csv;charset=utf-8",
    }),
    csvDataset: selected.dataset,
  };
}

export async function generateReport(
  input: GenerateReportInput,
  services: ReportServices,
): Promise<GenerateReportResult> {
  const fingerprint = fingerprintOf(input);
  const begin = await services.reports.beginGeneration({
    operationId: input.operationId,
    holeId: input.holeId,
    reportType: input.reportType,
    format: input.format,
    fingerprint,
  });

  if (begin.kind === "already-completed") {
    return {
      report: begin.report,
      recovered: true,
      alreadyCompleted: true,
    };
  }

  let transaction = begin.transaction;
  const recovered = begin.kind === "resume";
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  try {
    let snapshot: ReportSnapshot | null = null;
    if (transaction.snapshotId) {
      snapshot = await services.reports.getSnapshot(transaction.snapshotId);
    }

    if (transaction.stage === "SNAPSHOT_BUILDING" || snapshot === null) {
      const built = await buildReportDocumentData(
        {
          holeId: input.holeId,
          reportType: input.reportType,
          shiftId: input.shiftId,
        },
        services,
      );
      const version = await services.reports.nextVersion(
        input.holeId,
        input.reportType,
        input.format,
      );
      snapshot = {
        id: `snapshot-${input.operationId}`,
        holeId: input.holeId,
        shiftId: built.shiftId,
        reportType: input.reportType,
        generatedAt,
        generatedByUserId: input.generatedByUserId,
        generatedByNameSnapshot: input.generatedByNameSnapshot,
        holeDepthSnapshotDm: built.holeDepthSnapshotDm,
        holeStatusSnapshot: built.holeStatusSnapshot,
        sourceVersions: built.sourceVersions,
        documentData: built.documentData,
        operationId: input.operationId,
        version,
      };
      Object.freeze(snapshot);
      Object.freeze(snapshot.documentData);
      transaction = await services.reports.saveSnapshot(input.operationId, snapshot);
      await appendAudit(services, {
        holeId: input.holeId,
        operationId: input.operationId,
        action: "report_snapshot_created",
        entityId: snapshot.id,
        userId: input.generatedByUserId,
        userName: input.generatedByNameSnapshot,
        metadata: {
          reportType: input.reportType,
          format: input.format,
          version: snapshot.version,
        },
      });
    }

    if (snapshot === null) {
      throw new ReportApplicationError(
        "GENERATION_FAILED",
        "Report snapshot could not be loaded.",
      );
    }

    let blob: Blob | null = null;
    let usedCsvDataset = input.csvDataset;
    if (
      transaction.stage === "SNAPSHOT_SAVED" ||
      transaction.stage === "DOCUMENT_GENERATED"
    ) {
      if (transaction.stage === "SNAPSHOT_SAVED") {
        const generated = await generateBlob(
          snapshot,
          input.format,
          input.csvDataset,
        );
        blob = generated.blob;
        usedCsvDataset = generated.csvDataset;
        transaction = await services.reports.advanceGeneration({
          operationId: input.operationId,
          stage: "DOCUMENT_GENERATED",
        });
        await appendAudit(services, {
          holeId: input.holeId,
          operationId: input.operationId,
          action:
            input.format === "PDF"
              ? "report_pdf_generated"
              : input.format === "XLSX"
                ? "report_excel_generated"
                : "report_csv_generated",
          entityId: snapshot.id,
          userId: input.generatedByUserId,
          userName: input.generatedByNameSnapshot,
          metadata: { format: input.format, version: snapshot.version },
        });
      }
    }

    let storageKey = transaction.storageKey;
    if (
      transaction.stage === "DOCUMENT_GENERATED" ||
      transaction.stage === "FILE_SAVED"
    ) {
      if (transaction.stage === "DOCUMENT_GENERATED") {
        if (blob === null) {
          const generated = await generateBlob(
            snapshot,
            input.format,
            input.csvDataset,
          );
          blob = generated.blob;
          usedCsvDataset = generated.csvDataset;
        }
        const filename = buildReportFilename({
          holeId: input.holeId,
          reportType: input.reportType,
          format: input.format,
          version: snapshot.version,
          generatedAt: snapshot.generatedAt,
          shiftLabel: snapshot.documentData.currentShift?.label,
          csvDataset: usedCsvDataset,
        });
        const saved = await services.reportFiles.save(
          input.operationId,
          filename,
          reportMimeType(input.format),
          blob,
        );
        const verified = await services.reportFiles.verify(saved.storageKey);
        if (!verified) {
          throw new ReportApplicationError(
            "STORAGE_FAILED",
            "Generated report file could not be verified in storage.",
          );
        }
        storageKey = saved.storageKey;
        transaction = await services.reports.advanceGeneration({
          operationId: input.operationId,
          stage: "FILE_SAVED",
          storageKey,
        });
      }
    }

    if (storageKey === undefined) {
      throw new ReportApplicationError(
        "STORAGE_FAILED",
        "Report file storage key is missing.",
      );
    }

    const existingFile = await services.reportFiles.get(storageKey);
    if (existingFile === null) {
      throw new ReportApplicationError(
        "STORAGE_FAILED",
        "Report file is missing after save.",
      );
    }

    const filename = buildReportFilename({
      holeId: input.holeId,
      reportType: input.reportType,
      format: input.format,
      version: snapshot.version,
      generatedAt: snapshot.generatedAt,
      shiftLabel: snapshot.documentData.currentShift?.label,
      csvDataset: usedCsvDataset,
    });

    const report: GeneratedReportRecord = {
      localId: `report-${input.operationId}`,
      holeId: input.holeId,
      snapshotId: snapshot.id,
      reportType: input.reportType,
      format: input.format,
      version: snapshot.version,
      filename,
      mimeType: reportMimeType(input.format),
      storageKey,
      sizeBytes: existingFile.size,
      generatedAt: snapshot.generatedAt,
      generatedByUserId: input.generatedByUserId,
      generatedByNameSnapshot: input.generatedByNameSnapshot,
      holeDepthSnapshotDm: snapshot.holeDepthSnapshotDm,
      holeStatusSnapshot: snapshot.holeStatusSnapshot,
      activityStatus: "GENERATED",
      operationId: input.operationId,
      csvDataset: usedCsvDataset,
      syncStatus: "local-only",
      createdAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
      versionMeta: 1,
    };

    if (
      transaction.stage === "FILE_SAVED" ||
      transaction.stage === "METADATA_SAVED"
    ) {
      await services.reports.saveGeneratedReport(input.operationId, report);
      transaction = await services.reports.advanceGeneration({
        operationId: input.operationId,
        stage: "COMPLETED",
        storageKey,
        reportRecordId: report.localId,
      });
    }

    if (recovered) {
      await appendAudit(services, {
        holeId: input.holeId,
        operationId: `${input.operationId}-recovered`,
        action: "report_generation_recovered",
        entityId: report.localId,
        userId: input.generatedByUserId,
        userName: input.generatedByNameSnapshot,
      });
    }

    return { report, recovered, alreadyCompleted: false };
  } catch (error) {
    await services.reports.advanceGeneration({
      operationId: input.operationId,
      stage: "FAILED",
      failureReason: error instanceof Error ? error.message : "Unknown error",
    });
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: `${input.operationId}-failed`,
      action: "report_generation_failed",
      entityId: input.operationId,
      userId: input.generatedByUserId,
      userName: input.generatedByNameSnapshot,
      metadata: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function recoverInterruptedReportGeneration(
  holeId: string,
  services: ReportServices,
  actor: { readonly userId: string; readonly userName: string },
): Promise<GenerateReportResult | null> {
  const pending = await services.reports.getPendingTransaction(holeId);
  if (pending === null) return null;
  return generateReport(
    {
      operationId: pending.operationId,
      holeId: pending.holeId,
      reportType: pending.reportType,
      format: pending.format,
      generatedByUserId: actor.userId,
      generatedByNameSnapshot: actor.userName,
    },
    services,
  );
}

export async function downloadReport(
  input: {
    readonly operationId: string;
    readonly reportId: string;
    readonly holeId: string;
    readonly userId: string;
    readonly userName: string;
  },
  services: ReportServices,
): Promise<{ readonly blob: Blob; readonly filename: string; readonly mimeType: string }> {
  const report = await services.reports.getReport(input.reportId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null) {
    throw new ReportApplicationError(
      "STORAGE_FAILED",
      "Report file is no longer available locally.",
    );
  }
  await services.share.download({
    filename: report.filename,
    mimeType: report.mimeType,
    blob,
    title: report.filename,
  });
  await services.reports.updateActivityStatus(
    report.localId,
    "DOWNLOADED",
    input.operationId,
  );
  await appendAudit(services, {
    holeId: input.holeId,
    operationId: input.operationId,
    action: "report_downloaded",
    entityId: report.localId,
    userId: input.userId,
    userName: input.userName,
    metadata: { format: report.format, version: report.version },
  });
  return { blob, filename: report.filename, mimeType: report.mimeType };
}

export async function shareReport(
  input: {
    readonly operationId: string;
    readonly reportId: string;
    readonly holeId: string;
    readonly userId: string;
    readonly userName: string;
  },
  services: ReportServices,
): Promise<ShareReportResult> {
  const report = await services.reports.getReport(input.reportId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null) {
    throw new ReportApplicationError(
      "STORAGE_FAILED",
      "Report file is no longer available locally.",
    );
  }

  await appendAudit(services, {
    holeId: input.holeId,
    operationId: `${input.operationId}-initiated`,
    action: "report_share_initiated",
    entityId: report.localId,
    userId: input.userId,
    userName: input.userName,
  });

  const result = await services.share.share({
    filename: report.filename,
    mimeType: report.mimeType,
    blob,
    title: `${reportTypeLabel(report.reportType)} — ${report.holeId}`,
    text: report.filename,
  });

  if (result.status === "shared") {
    await services.reports.updateActivityStatus(
      report.localId,
      "SHARED",
      input.operationId,
    );
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: input.operationId,
      action: "report_share_completed",
      entityId: report.localId,
      userId: input.userId,
      userName: input.userName,
    });
  } else if (result.status === "cancelled") {
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: input.operationId,
      action: "report_share_cancelled",
      entityId: report.localId,
      userId: input.userId,
      userName: input.userName,
    });
  } else {
    await services.reports.updateActivityStatus(
      report.localId,
      "DOWNLOADED",
      input.operationId,
    );
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: input.operationId,
      action: "report_downloaded",
      entityId: report.localId,
      userId: input.userId,
      userName: input.userName,
      metadata: { fallback: true },
    });
  }

  return result;
}

export async function prepareEmailDraft(
  input: {
    readonly operationId: string;
    readonly reportId: string;
    readonly holeId: string;
    readonly toRecipients: readonly string[];
    readonly ccRecipients?: readonly string[];
    readonly subject?: string;
    readonly message?: string;
    readonly userId: string;
    readonly userName: string;
    readonly openMailClient?: boolean;
  },
  services: ReportServices,
): Promise<{
  readonly outbox: ReportOutboxItem;
  readonly mailtoUrl: string;
  readonly manualAttachRequired: boolean;
}> {
  const report = await services.reports.getReport(input.reportId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null) {
    throw new ReportApplicationError(
      "STORAGE_FAILED",
      "Report file is no longer available locally.",
    );
  }

  const subject =
    input.subject ??
    `TargetLock Runbook — ${report.holeId} — ${reportTypeLabel(report.reportType)}`;
  const message =
    input.message ??
    `Please find the ${report.holeId} ${reportTypeLabel(report.reportType)} attached.\n\nNote: the email app may require the file to be attached manually. This draft was not sent by TargetLock.`;

  const now = new Date().toISOString();
  const outbox: ReportOutboxItem = {
    localId: `outbox-${input.operationId}`,
    holeId: input.holeId,
    reportRecordId: report.localId,
    reportVersion: report.version,
    toRecipients: input.toRecipients,
    ccRecipients: input.ccRecipients ?? [],
    subject,
    message,
    attachmentFilename: report.filename,
    attachmentStorageKey: report.storageKey,
    status: "DRAFT",
    createdByUserId: input.userId,
    createdByNameSnapshot: input.userName,
    createdAt: now,
    updatedAt: now,
    syncStatus: "local-only",
    version: 1,
  };

  const saved = await services.reports.saveOutboxItem(input.operationId, outbox);
  await services.reports.updateActivityStatus(
    report.localId,
    "EMAIL_DRAFT",
    `${input.operationId}-activity`,
  );
  await appendAudit(services, {
    holeId: input.holeId,
    operationId: input.operationId,
    action: "report_email_draft_prepared",
    entityId: report.localId,
    userId: input.userId,
    userName: input.userName,
    metadata: {
      toCount: input.toRecipients.length,
      status: "DRAFT",
    },
  });

  // mailto cannot attach files — download for manual attach.
  await services.share.download({
    filename: report.filename,
    mimeType: report.mimeType,
    blob,
    title: report.filename,
  });

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set(
    "body",
    `${message}\n\nAttachment (attach manually): ${report.filename}`,
  );
  if ((input.ccRecipients ?? []).length > 0) {
    params.set("cc", (input.ccRecipients ?? []).join(","));
  }
  const mailtoUrl = `mailto:${input.toRecipients.join(",")}?${params.toString()}`;

  if (input.openMailClient !== false && typeof window !== "undefined") {
    // Prefer a new browsing context so Report Centre stays mounted.
    window.open(mailtoUrl, "_blank", "noopener,noreferrer");
  }

  await services.reports.saveOutboxItem(`${input.operationId}-ready`, {
    ...saved,
    status: "READY_TO_SHARE",
    lastAttemptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: saved.version + 1,
  });

  return { outbox: saved, mailtoUrl, manualAttachRequired: true };
}

export async function saveReportRecipient(
  input: {
    readonly operationId: string;
    readonly recipient: SavedReportRecipient;
    readonly holeId: string;
    readonly userId: string;
    readonly userName: string;
  },
  services: ReportServices,
): Promise<SavedReportRecipient> {
  const saved = await services.reports.saveRecipient(
    input.operationId,
    input.recipient,
  );
  await appendAudit(services, {
    holeId: input.holeId,
    operationId: input.operationId,
    action: "report_recipient_saved",
    entityId: saved.id,
    userId: input.userId,
    userName: input.userName,
    metadata: { email: saved.email, scope: saved.scope },
  });
  return saved;
}

export async function listGeneratedReports(
  holeId: string,
  services: Pick<ReportServices, "reports">,
): Promise<readonly GeneratedReportRecord[]> {
  return services.reports.listReports(holeId);
}

export async function updateReportOutboxStatus(
  input: {
    readonly operationId: string;
    readonly item: ReportOutboxItem;
    readonly status: ReportDispatchStatus;
    readonly failureReason?: string;
  },
  services: ReportServices,
): Promise<ReportOutboxItem> {
  return services.reports.saveOutboxItem(input.operationId, {
    ...input.item,
    status: input.status,
    failureReason: input.failureReason,
    lastAttemptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: input.item.version + 1,
  });
}

export type { ReportActivityStatus };
