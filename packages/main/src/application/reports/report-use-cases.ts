import {
  assertValidReportBlob,
  buildReportFilename,
  evaluateReportCurrency,
  reportMimeType,
  reportTypeLabel,
  type GeneratedReportRecord,
  type ReportActivityStatus,
  type ReportCurrencyResult,
  type ReportDispatchStatus,
  type ReportFormat,
  type ReportGenerationStage,
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
      | "STORAGE_FAILED"
      | "VERIFICATION_FAILED"
      | "UNSUPPORTED"
      | "POPUP_BLOCKED"
      | "QUOTA_EXCEEDED"
      | "STALE_OPERATION",
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

export type ReportGenerationProgress =
  | "Building report snapshot…"
  | "Generating PDF…"
  | "Generating Excel…"
  | "Generating CSV…"
  | "Saving report locally…"
  | "Verifying file…";

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
  readonly onProgress?: (stage: ReportGenerationProgress) => void;
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

function userFacingError(error: unknown): ReportApplicationError {
  if (error instanceof ReportApplicationError) {
    return error;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const lower = message.toLowerCase();
  if (
    lower.includes("quota") ||
    (lower.includes("storage") && lower.includes("exceed"))
  ) {
    return new ReportApplicationError(
      "QUOTA_EXCEEDED",
      "Browser storage is full. Download older reports or free space, then retry.",
    );
  }
  if (
    lower.includes("indexeddb") ||
    lower.includes("storage is unavailable") ||
    lower.includes("localstorage")
  ) {
    return new ReportApplicationError(
      "STORAGE_FAILED",
      "Browser storage is unavailable for reports on this device.",
    );
  }
  if (lower.includes("unsupported") || lower.includes("no csv dataset")) {
    return new ReportApplicationError(
      "UNSUPPORTED",
      "That report type or format combination is not supported.",
    );
  }
  return new ReportApplicationError(
    "GENERATION_FAILED",
    "Report generation failed. Retry the same report, or choose another format.",
  );
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

function documentProgress(format: ReportFormat): ReportGenerationProgress {
  if (format === "PDF") return "Generating PDF…";
  if (format === "XLSX") return "Generating Excel…";
  return "Generating CSV…";
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
      "UNSUPPORTED",
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

function isFileReadyStage(stage: ReportGenerationStage): boolean {
  return (
    stage === "FILE_SAVED" ||
    stage === "FILE_VERIFIED" ||
    stage === "METADATA_SAVED"
  );
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
  const notify = input.onProgress;

  try {
    let snapshot: ReportSnapshot | null = null;
    if (transaction.snapshotId) {
      snapshot = await services.reports.getSnapshot(
        transaction.snapshotId,
        input.holeId,
      );
    }

    if (transaction.stage === "SNAPSHOT_BUILDING" || snapshot === null) {
      notify?.("Building report snapshot…");
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
      transaction = await services.reports.saveSnapshot(
        input.operationId,
        snapshot,
      );
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
      transaction.stage === "DOCUMENT_GENERATING"
    ) {
      notify?.(documentProgress(input.format));
      transaction = await services.reports.advanceGeneration({
        operationId: input.operationId,
        stage: "DOCUMENT_GENERATING",
      });
      const generated = await generateBlob(
        snapshot,
        input.format,
        input.csvDataset,
      );
      blob = generated.blob;
      usedCsvDataset = generated.csvDataset;
      if (blob.size <= 0) {
        throw new ReportApplicationError(
          "VERIFICATION_FAILED",
          "The generator produced an empty file.",
        );
      }
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

    let storageKey = transaction.storageKey;
    const mimeType = reportMimeType(input.format);
    const filename = buildReportFilename({
      holeId: input.holeId,
      reportType: input.reportType,
      format: input.format,
      version: snapshot.version,
      generatedAt: snapshot.generatedAt,
      shiftLabel: snapshot.documentData.currentShift?.label,
      csvDataset: usedCsvDataset,
    });

    if (
      transaction.stage === "DOCUMENT_GENERATED" ||
      transaction.stage === "FILE_SAVING"
    ) {
      notify?.("Saving report locally…");
      if (transaction.stage === "DOCUMENT_GENERATED") {
        transaction = await services.reports.advanceGeneration({
          operationId: input.operationId,
          stage: "FILE_SAVING",
        });
      }
      storageKey = transaction.storageKey ?? storageKey;
      if (storageKey === undefined) {
        if (blob === null) {
          const generated = await generateBlob(
            snapshot,
            input.format,
            input.csvDataset,
          );
          blob = generated.blob;
          usedCsvDataset = generated.csvDataset;
        }
        await assertValidReportBlob({
          blob,
          format: input.format,
          filename,
          mimeType,
        });
        const saved = await services.reportFiles.save(
          input.operationId,
          input.holeId,
          filename,
          mimeType,
          blob,
        );
        storageKey = saved.storageKey;
      }
    }

    if (
      transaction.stage === "FILE_SAVING" ||
      transaction.stage === "FILE_SAVED"
    ) {
      notify?.("Verifying file…");
      storageKey = storageKey ?? transaction.storageKey;
      if (storageKey === undefined) {
        throw new ReportApplicationError(
          "STORAGE_FAILED",
          "Report file storage key is missing.",
        );
      }
      const verified = await services.reportFiles.verify(storageKey, {
        format: input.format,
        filename,
        mimeType,
      });
      if (!verified) {
        throw new ReportApplicationError(
          "VERIFICATION_FAILED",
          "Generated report file could not be verified in storage.",
        );
      }
      const retrieved = await services.reportFiles.get(storageKey);
      if (retrieved === null || retrieved.size <= 0) {
        throw new ReportApplicationError(
          "VERIFICATION_FAILED",
          "Stored report file could not be retrieved after save.",
        );
      }
      await assertValidReportBlob({
        blob: retrieved,
        format: input.format,
        filename,
        mimeType,
      });
      transaction = await services.reports.advanceGeneration({
        operationId: input.operationId,
        stage: "FILE_VERIFIED",
        storageKey,
      });
    }

    if (storageKey === undefined) {
      throw new ReportApplicationError(
        "STORAGE_FAILED",
        "Report file storage key is missing.",
      );
    }

    const existingFile = await services.reportFiles.get(storageKey);
    if (existingFile === null || existingFile.size <= 0) {
      throw new ReportApplicationError(
        "STORAGE_FAILED",
        "Report file is missing after save.",
      );
    }

    const report: GeneratedReportRecord = {
      localId: `report-${input.operationId}`,
      holeId: input.holeId,
      snapshotId: snapshot.id,
      reportType: input.reportType,
      format: input.format,
      version: snapshot.version,
      filename,
      mimeType,
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
      transaction.stage === "FILE_VERIFIED" ||
      isFileReadyStage(transaction.stage) ||
      transaction.stage === "METADATA_SAVED"
    ) {
      if (
        transaction.stage !== "FILE_VERIFIED" &&
        transaction.stage !== "METADATA_SAVED" &&
        transaction.stage !== "COMPLETED"
      ) {
        // Legacy FILE_SAVED resume: re-verify before metadata.
        notify?.("Verifying file…");
        const verified = await services.reportFiles.verify(storageKey, {
          format: input.format,
          filename,
          mimeType,
        });
        if (!verified) {
          throw new ReportApplicationError(
            "VERIFICATION_FAILED",
            "Generated report file could not be verified in storage.",
          );
        }
        transaction = await services.reports.advanceGeneration({
          operationId: input.operationId,
          stage: "FILE_VERIFIED",
          storageKey,
        });
      }
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
    const facing = userFacingError(error);
    await services.reports.advanceGeneration({
      operationId: input.operationId,
      stage: "FAILED",
      failureReason: facing.message,
    });
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: `${input.operationId}-failed`,
      action: "report_generation_failed",
      entityId: input.operationId,
      userId: input.generatedByUserId,
      userName: input.generatedByNameSnapshot,
      metadata: {
        reason: facing.code,
        stage: transaction.stage,
      },
    });
    // Log technical detail without private report contents.
    console.error("[TargetLock reports]", facing.code, {
      operationId: input.operationId,
      holeId: input.holeId,
      reportType: input.reportType,
      format: input.format,
      stage: transaction.stage,
      technical:
        error instanceof Error ? error.message : "non-error rejection",
    });
    throw facing;
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
): Promise<{
  readonly blob: Blob;
  readonly filename: string;
  readonly mimeType: string;
}> {
  const report = await services.reports.getReport(input.reportId, input.holeId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null || blob.size <= 0) {
    throw new ReportApplicationError(
      "STORAGE_FAILED",
      "Report file is no longer available locally.",
    );
  }
  await assertValidReportBlob({
    blob,
    format: report.format,
    filename: report.filename,
    mimeType: report.mimeType,
  });
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

export type OpenReportResult =
  | { readonly status: "opened"; readonly filename: string }
  | {
      readonly status: "popup_blocked";
      readonly filename: string;
      readonly downloadOffered: boolean;
    };

export async function openReport(
  input: {
    readonly operationId: string;
    readonly reportId: string;
    readonly holeId: string;
    readonly userId: string;
    readonly userName: string;
  },
  services: ReportServices,
): Promise<OpenReportResult> {
  const report = await services.reports.getReport(input.reportId, input.holeId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  if (report.format !== "PDF") {
    throw new ReportApplicationError(
      "UNSUPPORTED",
      "Open in browser is available for PDF reports only.",
    );
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null || blob.size <= 0) {
    throw new ReportApplicationError(
      "STORAGE_FAILED",
      "Report file is no longer available locally.",
    );
  }
  await assertValidReportBlob({
    blob,
    format: report.format,
    filename: report.filename,
    mimeType: report.mimeType,
  });

  if (typeof window === "undefined" || typeof URL === "undefined") {
    throw new ReportApplicationError(
      "UNSUPPORTED",
      "Opening reports requires a browser window.",
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (opened === null) {
    URL.revokeObjectURL(objectUrl);
    await services.share.download({
      filename: report.filename,
      mimeType: report.mimeType,
      blob,
      title: report.filename,
    });
    await appendAudit(services, {
      holeId: input.holeId,
      operationId: input.operationId,
      action: "report_open_popup_blocked",
      entityId: report.localId,
      userId: input.userId,
      userName: input.userName,
    });
    return {
      status: "popup_blocked",
      filename: report.filename,
      downloadOffered: true,
    };
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  await appendAudit(services, {
    holeId: input.holeId,
    operationId: input.operationId,
    action: "report_opened",
    entityId: report.localId,
    userId: input.userId,
    userName: input.userName,
  });
  return { status: "opened", filename: report.filename };
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
  const report = await services.reports.getReport(input.reportId, input.holeId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null || blob.size <= 0) {
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
  const report = await services.reports.getReport(input.reportId, input.holeId);
  if (report === null || report.holeId !== input.holeId) {
    throw new ReportApplicationError("NOT_FOUND", "Report was not found.");
  }
  const blob = await services.reportFiles.get(report.storageKey);
  if (blob === null || blob.size <= 0) {
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

export async function evaluateGeneratedReportCurrency(
  report: GeneratedReportRecord,
  services: ReportServices,
): Promise<ReportCurrencyResult> {
  const snapshot = await services.reports.getSnapshot(
    report.snapshotId,
    report.holeId,
  );
  if (snapshot === null) {
    return {
      status: "out_of_date",
      generatedFingerprint: "",
      currentFingerprint: "missing-snapshot",
      changesDetected: ["Report snapshot missing"],
    };
  }
  const current = await buildReportDocumentData(
    {
      holeId: report.holeId,
      reportType: report.reportType,
    },
    services,
  );
  return evaluateReportCurrency(snapshot.sourceVersions, current.sourceVersions);
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
