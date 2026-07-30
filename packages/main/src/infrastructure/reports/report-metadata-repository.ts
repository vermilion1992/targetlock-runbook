import { z } from "zod";

import {
  decimetres,
  type GeneratedReportRecord,
  type ReportActivityStatus,
  type ReportFormat,
  type ReportGenerationStage,
  type ReportGenerationTransaction,
  type ReportOutboxItem,
  type ReportSnapshot,
  type ReportType,
  type SavedReportRecipient,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";

const REPORT_STORAGE_VERSION = 1 as const;

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);

const reportTypeSchema = z.enum([
  "CURRENT_SHIFT_RUNBOOK",
  "FULL_HOLE_RUNBOOK",
  "HOLE_SUMMARY",
  "SURVEY_HISTORY",
  "TRAY_REGISTER",
  "COMPONENT_HISTORY",
  "CASING_HISTORY",
]);

const reportFormatSchema = z.enum(["PDF", "XLSX", "CSV"]);
const reportOperatorRoleSchema = z.enum([
  "DRILLER",
  "SUPERVISOR",
  "COMPANY_ADMIN",
]);

const generationStageSchema = z.enum([
  "SNAPSHOT_BUILDING",
  "SNAPSHOT_SAVED",
  "DOCUMENT_GENERATING",
  "DOCUMENT_GENERATED",
  "FILE_SAVING",
  "FILE_SAVED",
  "FILE_VERIFIED",
  "METADATA_SAVED",
  "COMPLETED",
  "FAILED",
]);

const activityStatusSchema = z.enum([
  "GENERATING",
  "GENERATED",
  "DOWNLOADED",
  "SHARED",
  "EMAIL_DRAFT",
  "FAILED",
]);

const dispatchStatusSchema = z.enum([
  "DRAFT",
  "READY_TO_SHARE",
  "SHARED",
  "QUEUED_FOR_FUTURE_PROVIDER",
  "FAILED",
  "CANCELLED",
]);

const snapshotSchema = z.object({
  id: z.string().min(1),
  holeId: z.string().min(1),
  shiftId: z.string().min(1).optional(),
  reportType: reportTypeSchema,
  generatedAt: z.string().datetime(),
  generatedByUserId: z.string().min(1),
  generatedByNameSnapshot: z.string().min(1),
  generatedByRoleSnapshot: reportOperatorRoleSchema.optional(),
  holeDepthSnapshotDm: z.number().int().nonnegative(),
  holeStatusSnapshot: z.string().min(1),
  sourceVersions: z.array(
    z.object({
      entityType: z.string().min(1),
      entityId: z.string().min(1),
      version: z.number().int().nonnegative(),
    }),
  ),
  documentData: z.record(z.unknown()),
  operationId: z.string().min(1),
  version: z.number().int().positive(),
});

const generatedReportSchema = z.object({
  localId: z.string().min(1),
  holeId: z.string().min(1),
  snapshotId: z.string().min(1),
  reportType: reportTypeSchema,
  format: reportFormatSchema,
  version: z.number().int().positive(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  generatedByUserId: z.string().min(1),
  generatedByNameSnapshot: z.string().min(1),
  generatedByRoleSnapshot: reportOperatorRoleSchema.optional(),
  holeDepthSnapshotDm: z.number().int().nonnegative(),
  holeStatusSnapshot: z.string().min(1),
  activityStatus: activityStatusSchema,
  operationId: z.string().min(1),
  csvDataset: z.string().min(1).optional(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versionMeta: z.number().int().positive(),
});

const transactionSchema = z.object({
  operationId: z.string().min(1),
  holeId: z.string().min(1),
  reportType: reportTypeSchema,
  format: reportFormatSchema,
  fingerprint: z.string().min(1),
  stage: generationStageSchema,
  completedStages: z.array(generationStageSchema),
  snapshotId: z.string().min(1).optional(),
  storageKey: z.string().min(1).optional(),
  reportRecordId: z.string().min(1).optional(),
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const recipientSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1).optional(),
  holeId: z.string().min(1).optional(),
  displayName: z.string().optional(),
  email: z.string().email(),
  scope: z.enum(["ORGANISATION", "PROJECT", "HOLE"]),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  syncStatus: syncStatusSchema,
  version: z.number().int().positive(),
});

const outboxSchema = z.object({
  localId: z.string().min(1),
  holeId: z.string().min(1),
  reportRecordId: z.string().min(1),
  reportVersion: z.number().int().positive(),
  toRecipients: z.array(z.string().email()),
  ccRecipients: z.array(z.string().email()),
  subject: z.string().min(1),
  message: z.string(),
  attachmentFilename: z.string().min(1),
  attachmentStorageKey: z.string().min(1),
  status: dispatchStatusSchema,
  failureReason: z.string().optional(),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().min(1),
  createdAt: z.string().datetime(),
  lastAttemptedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
  syncStatus: syncStatusSchema,
  version: z.number().int().positive(),
});

const operationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum([
    "GENERATE_REPORT",
    "SAVE_RECIPIENT",
    "SAVE_OUTBOX",
    "UPDATE_ACTIVITY",
  ]),
  fingerprint: z.string().min(1),
  resultId: z.string().min(1),
  completedAt: z.string().datetime(),
});

const envelopeSchema = z.object({
  version: z.literal(REPORT_STORAGE_VERSION),
  organisationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  snapshots: z.array(snapshotSchema),
  reports: z.array(generatedReportSchema),
  transactions: z.array(transactionSchema),
  recipients: z.array(recipientSchema),
  outbox: z.array(outboxSchema),
  operations: z.array(operationSchema),
});

type ReportEnvelope = z.infer<typeof envelopeSchema>;

export class ReportMetadataRepositoryError extends Error {
  constructor(
    readonly code:
      | "IDEMPOTENCY_CONFLICT"
      | "STORAGE_UNAVAILABLE"
      | "NOT_FOUND"
      | "INVALID_STATE",
    message: string,
  ) {
    super(message);
    this.name = "ReportMetadataRepositoryError";
  }
}

export function reportStorageKey(organisationId: string): string {
  return `targetlock:prototype:v${REPORT_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:reports`;
}

function emptyEnvelope(organisationId: string): ReportEnvelope {
  return {
    version: REPORT_STORAGE_VERSION,
    organisationId,
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    snapshots: [],
    reports: [],
    transactions: [],
    recipients: [],
    outbox: [],
    operations: [],
  };
}

function brandSnapshot(snapshot: z.infer<typeof snapshotSchema>): ReportSnapshot {
  return {
    ...snapshot,
    holeDepthSnapshotDm: decimetres(snapshot.holeDepthSnapshotDm),
    documentData: snapshot.documentData as unknown as ReportSnapshot["documentData"],
  };
}

function toPlainSnapshot(
  snapshot: ReportSnapshot,
): z.infer<typeof snapshotSchema> {
  return JSON.parse(JSON.stringify(snapshot)) as z.infer<typeof snapshotSchema>;
}

function toPlainTransaction(
  transaction: ReportGenerationTransaction,
): z.infer<typeof transactionSchema> {
  return JSON.parse(JSON.stringify(transaction)) as z.infer<
    typeof transactionSchema
  >;
}

function toPlainOutbox(
  item: ReportOutboxItem,
): z.infer<typeof outboxSchema> {
  return JSON.parse(JSON.stringify(item)) as z.infer<typeof outboxSchema>;
}

function brandReport(
  report: z.infer<typeof generatedReportSchema>,
): GeneratedReportRecord {
  return {
    ...report,
    holeDepthSnapshotDm: decimetres(report.holeDepthSnapshotDm),
  };
}

export interface ReportMetadataRepository {
  listReports(holeId: string): Promise<readonly GeneratedReportRecord[]>;
  getReport(
    reportId: string,
    holeId: string,
  ): Promise<GeneratedReportRecord | null>;
  getSnapshot(snapshotId: string, holeId: string): Promise<ReportSnapshot | null>;
  nextVersion(holeId: string, reportType: ReportType, format: ReportFormat): Promise<number>;
  beginGeneration(input: {
    readonly operationId: string;
    readonly holeId: string;
    readonly reportType: ReportType;
    readonly format: ReportFormat;
    readonly fingerprint: string;
  }): Promise<
    | { readonly kind: "started"; readonly transaction: ReportGenerationTransaction }
    | { readonly kind: "already-completed"; readonly report: GeneratedReportRecord }
    | { readonly kind: "resume"; readonly transaction: ReportGenerationTransaction }
  >;
  saveSnapshot(
    operationId: string,
    snapshot: ReportSnapshot,
  ): Promise<ReportGenerationTransaction>;
  advanceGeneration(input: {
    readonly operationId: string;
    readonly stage: ReportGenerationStage;
    readonly storageKey?: string;
    readonly reportRecordId?: string;
    readonly failureReason?: string;
  }): Promise<ReportGenerationTransaction>;
  saveGeneratedReport(
    operationId: string,
    report: GeneratedReportRecord,
  ): Promise<GeneratedReportRecord>;
  updateActivityStatus(
    reportId: string,
    status: ReportActivityStatus,
    operationId: string,
  ): Promise<GeneratedReportRecord>;
  getPendingTransaction(
    holeId: string,
  ): Promise<ReportGenerationTransaction | null>;
  listFailedTransactions(
    holeId: string,
  ): Promise<readonly ReportGenerationTransaction[]>;
  listRecipients(input: {
    readonly holeId?: string;
    readonly projectId?: string;
  }): Promise<readonly SavedReportRecipient[]>;
  saveRecipient(
    operationId: string,
    recipient: SavedReportRecipient,
  ): Promise<SavedReportRecipient>;
  listOutbox(holeId: string): Promise<readonly ReportOutboxItem[]>;
  saveOutboxItem(
    operationId: string,
    item: ReportOutboxItem,
  ): Promise<ReportOutboxItem>;
}

export class LocalReportMetadataRepository implements ReportMetadataRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly organisationId: string,
    private readonly seedRecipients: readonly SavedReportRecipient[] = [],
  ) {}

  private key(): string {
    return reportStorageKey(this.organisationId);
  }

  private read(): ReportEnvelope {
    const raw = this.storage.getItem(this.key());
    if (raw === null) {
      const seeded = emptyEnvelope(this.organisationId);
      if (this.seedRecipients.length > 0) {
        return {
          ...seeded,
          recipients: [...this.seedRecipients],
          updatedAt: new Date().toISOString(),
        };
      }
      return seeded;
    }
    const parsed = envelopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new ReportMetadataRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Stored report metadata is invalid.",
      );
    }
    return parsed.data;
  }

  private write(envelope: ReportEnvelope): void {
    const next = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const parsed = envelopeSchema.safeParse(next);
    if (!parsed.success) {
      throw new ReportMetadataRepositoryError(
        "INVALID_STATE",
        "Report metadata failed validation before save.",
      );
    }
    this.storage.setItem(this.key(), JSON.stringify(parsed.data));
  }

  private findOperation(envelope: ReportEnvelope, operationId: string) {
    return envelope.operations.find((op) => op.operationId === operationId);
  }

  async listReports(holeId: string): Promise<readonly GeneratedReportRecord[]> {
    return this.read()
      .reports.filter((report) => report.holeId === holeId)
      .map(brandReport)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  }

  async getReport(
    reportId: string,
    holeId: string,
  ): Promise<GeneratedReportRecord | null> {
    const report = this.read().reports.find(
      (item) => item.localId === reportId && item.holeId === holeId,
    );
    return report === undefined ? null : brandReport(report);
  }

  async getSnapshot(
    snapshotId: string,
    holeId: string,
  ): Promise<ReportSnapshot | null> {
    const snapshot = this.read().snapshots.find(
      (item) => item.id === snapshotId && item.holeId === holeId,
    );
    return snapshot === undefined ? null : brandSnapshot(snapshot);
  }

  async nextVersion(
    holeId: string,
    reportType: ReportType,
    format: ReportFormat,
  ): Promise<number> {
    const versions = this.read()
      .reports.filter(
        (report) =>
          report.holeId === holeId &&
          report.reportType === reportType &&
          report.format === format,
      )
      .map((report) => report.version);
    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async beginGeneration(input: {
    readonly operationId: string;
    readonly holeId: string;
    readonly reportType: ReportType;
    readonly format: ReportFormat;
    readonly fingerprint: string;
  }): Promise<
    | { readonly kind: "started"; readonly transaction: ReportGenerationTransaction }
    | { readonly kind: "already-completed"; readonly report: GeneratedReportRecord }
    | { readonly kind: "resume"; readonly transaction: ReportGenerationTransaction }
  > {
    const envelope = this.read();
    const existingOp = this.findOperation(envelope, input.operationId);
    if (existingOp !== undefined) {
      if (existingOp.fingerprint !== input.fingerprint) {
        throw new ReportMetadataRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This report operation identifier is already used with different input.",
        );
      }
      const report = envelope.reports.find(
        (item) => item.localId === existingOp.resultId,
      );
      if (report !== undefined) {
        return { kind: "already-completed", report: brandReport(report) };
      }
    }

    const pending = envelope.transactions.find(
      (transaction) =>
        transaction.operationId === input.operationId &&
        transaction.stage !== "COMPLETED" &&
        transaction.stage !== "FAILED",
    );
    if (pending !== undefined) {
      if (pending.fingerprint !== input.fingerprint) {
        throw new ReportMetadataRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "This report operation identifier is already used with different input.",
        );
      }
      return { kind: "resume", transaction: pending };
    }

    const now = new Date().toISOString();
    const transaction: ReportGenerationTransaction = {
      operationId: input.operationId,
      holeId: input.holeId,
      reportType: input.reportType,
      format: input.format,
      fingerprint: input.fingerprint,
      stage: "SNAPSHOT_BUILDING",
      completedStages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.write({
      ...envelope,
      transactions: [
        ...envelope.transactions.filter(
          (item) => item.operationId !== input.operationId,
        ),
        toPlainTransaction(transaction),
      ],
    });
    return { kind: "started", transaction };
  }

  async saveSnapshot(
    operationId: string,
    snapshot: ReportSnapshot,
  ): Promise<ReportGenerationTransaction> {
    const envelope = this.read();
    const transaction = envelope.transactions.find(
      (item) => item.operationId === operationId,
    );
    if (transaction === undefined) {
      throw new ReportMetadataRepositoryError(
        "NOT_FOUND",
        "Report generation transaction was not found.",
      );
    }
    const existing = envelope.snapshots.find((item) => item.id === snapshot.id);
    if (existing !== undefined && existing.operationId !== operationId) {
      throw new ReportMetadataRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "Snapshot identifier already exists.",
      );
    }
    const nextTransaction: ReportGenerationTransaction = {
      ...transaction,
      stage: "SNAPSHOT_SAVED",
      completedStages: uniqueStages([
        ...transaction.completedStages,
        "SNAPSHOT_BUILDING",
        "SNAPSHOT_SAVED",
      ]),
      snapshotId: snapshot.id,
      updatedAt: new Date().toISOString(),
    };
    this.write({
      ...envelope,
      snapshots: [
        ...envelope.snapshots.filter((item) => item.id !== snapshot.id),
        toPlainSnapshot(snapshot),
      ],
      transactions: envelope.transactions.map((item) =>
        item.operationId === operationId
          ? toPlainTransaction(nextTransaction)
          : item,
      ),
    });
    return nextTransaction;
  }

  async advanceGeneration(input: {
    readonly operationId: string;
    readonly stage: ReportGenerationStage;
    readonly storageKey?: string;
    readonly reportRecordId?: string;
    readonly failureReason?: string;
  }): Promise<ReportGenerationTransaction> {
    const envelope = this.read();
    const transaction = envelope.transactions.find(
      (item) => item.operationId === input.operationId,
    );
    if (transaction === undefined) {
      throw new ReportMetadataRepositoryError(
        "NOT_FOUND",
        "Report generation transaction was not found.",
      );
    }
    if (
      transaction.stage === input.stage &&
      (input.storageKey === undefined ||
        input.storageKey === transaction.storageKey) &&
      (input.reportRecordId === undefined ||
        input.reportRecordId === transaction.reportRecordId) &&
      input.failureReason === transaction.failureReason
    ) {
      return transaction;
    }
    const next: ReportGenerationTransaction = {
      ...transaction,
      stage: input.stage,
      completedStages: uniqueStages([
        ...transaction.completedStages,
        transaction.stage,
        input.stage,
      ]),
      storageKey: input.storageKey ?? transaction.storageKey,
      reportRecordId: input.reportRecordId ?? transaction.reportRecordId,
      failureReason: input.failureReason,
      updatedAt: new Date().toISOString(),
    };
    this.write({
      ...envelope,
      transactions: envelope.transactions.map((item) =>
        item.operationId === input.operationId
          ? toPlainTransaction(next)
          : item,
      ),
    });
    return next;
  }

  async saveGeneratedReport(
    operationId: string,
    report: GeneratedReportRecord,
  ): Promise<GeneratedReportRecord> {
    const envelope = this.read();
    const existingOp = this.findOperation(envelope, operationId);
    if (existingOp !== undefined) {
      if (existingOp.fingerprint !== report.operationId && existingOp.resultId !== report.localId) {
        // fingerprint checked at begin; return existing report
      }
      const existing = envelope.reports.find(
        (item) => item.localId === existingOp.resultId,
      );
      if (existing !== undefined) {
        return brandReport(existing);
      }
    }
    const duplicate = envelope.reports.find(
      (item) => item.operationId === operationId,
    );
    if (duplicate !== undefined) {
      return brandReport(duplicate);
    }
    const now = new Date().toISOString();
    const stored = {
      ...report,
      holeDepthSnapshotDm: Number(report.holeDepthSnapshotDm),
    };
    const transaction = envelope.transactions.find(
      (item) => item.operationId === operationId,
    );
    this.write({
      ...envelope,
      reports: [...envelope.reports, stored],
      transactions: envelope.transactions.map((item) =>
        item.operationId === operationId
          ? toPlainTransaction({
              ...item,
              stage: "METADATA_SAVED",
              completedStages: uniqueStages([
                ...item.completedStages,
                "METADATA_SAVED",
              ]),
              reportRecordId: report.localId,
              updatedAt: now,
            })
          : item,
      ),
      operations: [
        ...envelope.operations.filter((item) => item.operationId !== operationId),
        {
          operationId,
          kind: "GENERATE_REPORT" as const,
          fingerprint: transaction?.fingerprint ?? operationId,
          resultId: report.localId,
          completedAt: now,
        },
      ],
    });
    return brandReport(stored);
  }

  async updateActivityStatus(
    reportId: string,
    status: ReportActivityStatus,
    operationId: string,
  ): Promise<GeneratedReportRecord> {
    const envelope = this.read();
    const existingOp = this.findOperation(envelope, operationId);
    if (existingOp !== undefined) {
      const report = envelope.reports.find(
        (item) => item.localId === existingOp.resultId,
      );
      if (report !== undefined) {
        return brandReport(report);
      }
    }
    const report = envelope.reports.find((item) => item.localId === reportId);
    if (report === undefined) {
      throw new ReportMetadataRepositoryError(
        "NOT_FOUND",
        "Generated report was not found.",
      );
    }
    const now = new Date().toISOString();
    const next = {
      ...report,
      activityStatus: status,
      updatedAt: now,
      versionMeta: report.versionMeta + 1,
    };
    this.write({
      ...envelope,
      reports: envelope.reports.map((item) =>
        item.localId === reportId ? next : item,
      ),
      operations: [
        ...envelope.operations,
        {
          operationId,
          kind: "UPDATE_ACTIVITY",
          fingerprint: `${reportId}:${status}`,
          resultId: reportId,
          completedAt: now,
        },
      ],
    });
    return brandReport(next);
  }

  async getPendingTransaction(
    holeId: string,
  ): Promise<ReportGenerationTransaction | null> {
    return (
      this.read().transactions.find(
        (transaction) =>
          transaction.holeId === holeId &&
          transaction.stage !== "COMPLETED" &&
          transaction.stage !== "FAILED",
      ) ?? null
    );
  }

  async listFailedTransactions(
    holeId: string,
  ): Promise<readonly ReportGenerationTransaction[]> {
    return this.read()
      .transactions.filter(
        (transaction) =>
          transaction.holeId === holeId && transaction.stage === "FAILED",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listRecipients(input: {
    readonly holeId?: string;
    readonly projectId?: string;
  }): Promise<readonly SavedReportRecipient[]> {
    return this.read().recipients.filter((recipient) => {
      if (recipient.scope === "ORGANISATION") return true;
      if (
        recipient.scope === "PROJECT" &&
        input.projectId !== undefined &&
        recipient.projectId === input.projectId
      ) {
        return true;
      }
      if (
        recipient.scope === "HOLE" &&
        input.holeId !== undefined &&
        recipient.holeId === input.holeId
      ) {
        return true;
      }
      return false;
    });
  }

  async saveRecipient(
    operationId: string,
    recipient: SavedReportRecipient,
  ): Promise<SavedReportRecipient> {
    const envelope = this.read();
    const existingOp = this.findOperation(envelope, operationId);
    if (existingOp !== undefined) {
      const found = envelope.recipients.find(
        (item) => item.id === existingOp.resultId,
      );
      if (found !== undefined) return found;
    }
    const now = new Date().toISOString();
    const existing = envelope.recipients.find((item) => item.id === recipient.id);
    const next = existing
      ? {
          ...recipient,
          version: existing.version + 1,
          updatedAt: now,
          createdAt: existing.createdAt,
        }
      : recipient;
    this.write({
      ...envelope,
      recipients: [
        ...envelope.recipients.filter((item) => item.id !== recipient.id),
        next,
      ],
      operations: [
        ...envelope.operations.filter((item) => item.operationId !== operationId),
        {
          operationId,
          kind: "SAVE_RECIPIENT",
          fingerprint: JSON.stringify({
            id: next.id,
            email: next.email,
            version: next.version,
          }),
          resultId: next.id,
          completedAt: now,
        },
      ],
    });
    return next;
  }

  async listOutbox(holeId: string): Promise<readonly ReportOutboxItem[]> {
    return this.read().outbox.filter((item) => item.holeId === holeId);
  }

  async saveOutboxItem(
    operationId: string,
    item: ReportOutboxItem,
  ): Promise<ReportOutboxItem> {
    const envelope = this.read();
    const existingOp = this.findOperation(envelope, operationId);
    if (existingOp !== undefined) {
      const found = envelope.outbox.find(
        (entry) => entry.localId === existingOp.resultId,
      );
      if (found !== undefined) return found;
    }
    const now = new Date().toISOString();
    const existing = envelope.outbox.find(
      (entry) => entry.localId === item.localId,
    );
    const next = existing
      ? { ...item, version: existing.version + 1, updatedAt: now }
      : item;
    this.write({
      ...envelope,
      outbox: [
        ...envelope.outbox.filter((entry) => entry.localId !== item.localId),
        toPlainOutbox(next),
      ],
      operations: [
        ...envelope.operations.filter((entry) => entry.operationId !== operationId),
        {
          operationId,
          kind: "SAVE_OUTBOX",
          fingerprint: JSON.stringify({
            id: next.localId,
            status: next.status,
            version: next.version,
          }),
          resultId: next.localId,
          completedAt: now,
        },
      ],
    });
    return next;
  }
}

function uniqueStages(
  stages: readonly ReportGenerationStage[],
): ReportGenerationStage[] {
  return [...new Set(stages)];
}

export function createBrowserReportMetadataRepository(
  organisationId: string,
  seedRecipients: readonly SavedReportRecipient[] = [],
): ReportMetadataRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalReportMetadataRepository(
        storage,
        organisationId,
        seedRecipients,
      );
}
