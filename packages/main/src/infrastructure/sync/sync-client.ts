import {
  createBrowserOutboxRepository,
  OutboxRepositoryError,
  type OutboxContext,
  type OutboxRepository,
} from "./browser-outbox-repository";
import {
  domainOperationEnvelopeSchema,
  emptyOutboxSummary,
  type DomainOperationEnvelope,
  type LeaseEvidence,
  type OutboxOperation,
  type OutboxSummary,
} from "./domain-operation";
import { getBrowserPilotLeaseCoordinator } from "./lease-client";
import {
  getBrowserRuntimeMode,
  getPilotBrowserRuntimeContext,
} from "./pilot-runtime";
import {
  getBrowserUnjournaledFailureEvidenceStore,
  type UnjournaledFailureEvidenceStore,
} from "./unjournaled-failure-evidence";
import {
  canonicalPilotOperationType,
  derivePilotOperationContext,
  derivePilotRevisionRef,
  pilotRepositoryMethodDefinition,
} from "@/domain/pilot-operation-manifest";
import { hasPilotPermission } from "@/server/pilot/permissions";

export class PilotClientAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotClientAuthorizationError";
  }
}

export class PilotPendingOperationsError extends Error {
  constructor(readonly summary: OutboxSummary) {
    super(
      "This context has pending or unavailable journal entries. Reconnect and retry sync, then export a pilot backup before logout, reassignment, or device removal.",
    );
    this.name = "PilotPendingOperationsError";
  }
}

export interface PreparedPilotMutation {
  readonly enabled: boolean;
  readonly repository: string;
  readonly method: string;
  readonly arguments: readonly unknown[];
  readonly clientTime: string;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly holeRef: string | null;
  readonly shiftRef: string | null;
  readonly expectedVersion: number | null;
  readonly leaseEvidence: LeaseEvidence | null;
}

interface OperationReceiptResponse {
  readonly receipt?: {
    readonly status: "ACCEPTED" | "CONFLICT" | "REJECTED";
    readonly serverReceiptTime: string;
    readonly reasonCode: string | null;
  };
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

function firstStringByKeys(
  value: unknown,
  keys: ReadonlySet<string>,
  depth = 0,
): string | null {
  if (depth > 5 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstStringByKeys(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, candidate] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (keys.has(key) && typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  for (const candidate of Object.values(value as Record<string, unknown>)) {
    const found = firstStringByKeys(candidate, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function assertClientPermission(
  role: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER",
  repository: string,
  method: string,
): void {
  const definition = pilotRepositoryMethodDefinition(repository, method);
  if (definition?.kind !== "mutation") {
    throw new PilotClientAuthorizationError(
      "This operation is not registered for secure pilot coordination.",
    );
  }
  if (
    definition.permission !== null &&
    !hasPilotPermission(role, definition.permission)
  ) {
    throw new PilotClientAuthorizationError(
      "Your pilot role does not permit this setup or correction action.",
    );
  }
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function operationIdForLocalMutation(
  scope: {
    readonly organisationId: string;
    readonly deviceId: string;
    readonly repository: string;
    readonly method: string;
  },
  clientMutationId: string | null,
): Promise<string> {
  if (clientMutationId === null) return crypto.randomUUID();
  const digest = await sha256(
    [
      scope.organisationId,
      scope.deviceId,
      scope.repository,
      scope.method,
      clientMutationId,
    ].join("\u001f"),
  );
  const variant = ((Number.parseInt(digest[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(
    13,
    16,
  )}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

async function toJournalValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): Promise<unknown> {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      kind: "LOCAL_BLOB_METADATA",
      mimeType: value.type || "application/octet-stream",
      sizeBytes: value.size,
      checksumSha256: await sha256(await value.arrayBuffer()),
      blobUploadStatus: "LOCAL_ONLY_NOT_UPLOADED",
    };
  }
  if (depth > 8 || typeof value !== "object") return null;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    const items = [];
    for (const item of value) {
      items.push(await toJournalValue(item, seen, depth + 1));
    }
    return items;
  }
  const result: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(
    value as Record<string, unknown>,
  )) {
    result[key] = await toJournalValue(candidate, seen, depth + 1);
  }
  return result;
}

function retryDelay(attempts: number): number {
  return Math.min(5 * 60_000, 2 ** Math.min(attempts, 8) * 1_000);
}

export class BrowserSyncCoordinator {
  private summarySnapshot: OutboxSummary = emptyOutboxSummary();
  private readonly listeners = new Set<() => void>();
  private flushing: Promise<void> | null = null;
  private warning: string | null = null;
  private initialized = false;
  private initialization: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unpersistedFailures = 0;
  private contextKey: string | null = null;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly failureEvidence: UnjournaledFailureEvidenceStore =
      getBrowserUnjournaledFailureEvidenceStore(),
  ) {}

  getSnapshot = (): OutboxSummary => this.summarySnapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        await this.repository.resetSending(new Date().toISOString());
        this.initialized = true;
        const context = await this.ensureContext();
        if (context) {
          this.unpersistedFailures = this.failureEvidence.list(context).length;
        }
        await this.refreshSummary();
        if (context) await this.scheduleRetry(context);
      } catch (error) {
        this.summarySnapshot = {
          ...emptyOutboxSummary("unavailable"),
          incomplete: 1,
          storageErrors: 1,
          unsynced: 1,
          warning:
            error instanceof Error
              ? error.message
              : "The durable operation journal is unavailable.",
        };
        for (const listener of this.listeners) listener();
        throw error;
      }
    })().finally(() => {
      this.initialization = null;
    });
    return this.initialization;
  }

  async enqueueMutation(
    preparation: PreparedPilotMutation,
    result: unknown,
  ): Promise<void> {
    if (!preparation.enabled) return;
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) {
      this.unpersistedFailures += 1;
      this.setWarning(
        "A local field change could not be journaled because this device is not registered.",
      );
      return;
    }
    try {
      const journalArguments = [];
      for (const argument of preparation.arguments) {
        journalArguments.push(await toJournalValue(argument));
      }
      const resultValue = await toJournalValue(result);
      const clientMutationId = firstStringByKeys(
        preparation.arguments,
        new Set(["operationId"]),
      );
      const payload = {
        repository: preparation.repository,
        method: preparation.method,
        arguments: journalArguments,
        clientMutationId,
        result: resultValue,
      };
      const payloadJson = JSON.stringify(payload);
      if (new TextEncoder().encode(payloadJson).byteLength > 262_144) {
        throw new OutboxRepositoryError(
          "QUOTA_EXCEEDED",
          "The local change was saved, but its complete authoritative operation exceeds 256 KiB and was not queued. Export the failure evidence and contact a supervisor; TargetLock will not truncate this record.",
        );
      }
      const envelope = domainOperationEnvelopeSchema.parse({
        operationId: await operationIdForLocalMutation(
          {
            organisationId: runtime.organisationId,
            deviceId: runtime.device.id,
            repository: preparation.repository,
            method: preparation.method,
          },
          clientMutationId,
        ),
        schemaVersion: 1,
        organisationId: runtime.organisationId,
        deviceId: runtime.device.id,
        operatorId: runtime.operatorId,
        operationType:
          canonicalPilotOperationType(
            preparation.repository,
            preparation.method,
          ) ?? "invalid.invalid.v1",
        projectRef:
          preparation.projectRef ??
          firstStringByKeys(result, new Set(["projectId", "projectRef"])),
        rigRef:
          preparation.rigRef ??
          firstStringByKeys(result, new Set(["rigId", "rigRef"])),
        holeRef:
          preparation.holeRef ??
          firstStringByKeys(result, new Set(["holeId", "holeRef"])),
        shiftRef:
          preparation.shiftRef ??
          firstStringByKeys(result, new Set(["shiftId", "shiftRef"])),
        expectedVersion: preparation.expectedVersion,
        revisionRef: derivePilotRevisionRef(
          preparation.repository,
          journalArguments,
        ),
        clientTime: preparation.clientTime,
        payloadHash: await sha256(payloadJson),
        payload,
        leaseEvidence: preparation.leaseEvidence,
      }) as DomainOperationEnvelope;
      await this.repository.enqueue(envelope);
      await this.ensureContext();
      this.setWarning(null);
      await this.refreshSummary();
      void this.flush();
    } catch (error) {
      const context = this.currentContext();
      if (context) {
        try {
          this.failureEvidence.record(context, {
            operationType: `${preparation.repository}.${preparation.method}.v1`,
            occurredAt: preparation.clientTime,
            reason:
              error instanceof Error
                ? error.message
                : "The operation could not be queued.",
          });
          this.unpersistedFailures = this.failureEvidence.list(context).length;
        } catch {
          this.unpersistedFailures += 1;
        }
      } else {
        this.unpersistedFailures += 1;
      }
      this.setWarning(
        error instanceof Error
          ? `Local change saved; operation journal warning: ${error.message}`
          : "Local change saved; the operation could not be queued.",
      );
      await this.refreshSummary();
    }
  }

  async flush(manual = false): Promise<void> {
    if (this.flushing) return this.flushing;
    if (
      getBrowserRuntimeMode() !== "pilot" ||
      !getPilotBrowserRuntimeContext()?.device ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      await this.refreshSummary();
      return;
    }
    this.flushing = this.performFlush(manual).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async performFlush(manual: boolean): Promise<void> {
    await this.initialize();
    const context = await this.ensureContext();
    if (context === null) return;
    const now = new Date().toISOString();
    if (manual) {
      const operations = await this.repository.listAll();
      await Promise.all(
        operations
          .filter(
            (operation) =>
              operation.state === "failed" &&
              operation.envelope.organisationId === context.organisationId &&
              operation.envelope.deviceId === context.deviceId &&
              operation.envelope.operatorId === context.operatorId,
          )
          .map((operation) =>
            this.repository.markOutcome(operation.operationId, {
              state: "failed",
              occurredAt: now,
              retryAt: now,
              error: operation.lastError,
            }),
          ),
      );
    }
    const operations = await this.repository.claimReady(now, context);
    await this.refreshSummary();
    for (const operation of operations) {
      await this.send(operation);
    }
    await this.refreshSummary();
    await this.scheduleRetry(context);
    if (this.summarySnapshot.unsynced === 0) {
      const { getBrowserCoreRecoveryCoordinator } = await import(
        "./core-recovery"
      );
      await getBrowserCoreRecoveryCoordinator()?.pullAfterPush();
    }
  }

  private async send(operation: OutboxOperation): Promise<void> {
    const occurredAt = new Date().toISOString();
    try {
      const response = await fetch("/api/pilot/sync/operations", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation.envelope),
      });
      const body = (await response.json()) as OperationReceiptResponse;
      if (response.status === 401) {
        window.dispatchEvent(new Event("targetlock:pilot-session-expired"));
      }
      if (body.receipt) {
        const state =
          body.receipt.status === "ACCEPTED"
            ? "accepted"
            : body.receipt.status === "CONFLICT"
              ? "conflict"
              : "rejected";
        await this.repository.markOutcome(operation.operationId, {
          state,
          occurredAt,
          serverReceiptTime: body.receipt.serverReceiptTime,
          reasonCode: body.receipt.reasonCode,
          error:
            state === "accepted"
              ? null
              : body.receipt.reasonCode ?? "Server journal rejected operation.",
        });
        return;
      }
      if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 425, 429].includes(response.status)
      ) {
        await this.repository.markOutcome(operation.operationId, {
          state: response.status === 409 ? "conflict" : "rejected",
          occurredAt,
          reasonCode:
            body.error?.code ?? `HTTP_${response.status}_TERMINAL`,
          error:
            body.error?.message ??
            `The server permanently rejected this operation with HTTP ${response.status}.`,
        });
        return;
      }
      throw new Error(
        body.error?.message ??
          `The server journal returned HTTP ${response.status}.`,
      );
    } catch (error) {
      await this.repository.markOutcome(operation.operationId, {
        state: "failed",
        occurredAt,
        retryAt: new Date(
          Date.now() + retryDelay(operation.attempts),
        ).toISOString(),
        error:
          error instanceof Error ? error.message : "Network sync failed.",
      });
    }
  }

  private async refreshSummary(): Promise<void> {
    try {
      const context = this.currentContext();
      const persisted = await this.repository.summary(context ?? undefined);
      this.summarySnapshot = {
        ...persisted,
        failed: persisted.failed + this.unpersistedFailures,
        incomplete: persisted.incomplete + this.unpersistedFailures,
        storageErrors: persisted.storageErrors + this.unpersistedFailures,
        unsynced: persisted.unsynced + this.unpersistedFailures,
        warning: this.warning,
      };
    } catch (error) {
      this.summarySnapshot = {
        ...emptyOutboxSummary("unavailable"),
        incomplete: Math.max(1, this.unpersistedFailures),
        storageErrors: Math.max(1, this.unpersistedFailures),
        unsynced: Math.max(1, this.unpersistedFailures),
        warning:
          error instanceof Error
            ? error.message
            : "The operation journal is unavailable.",
      };
    }
    for (const listener of this.listeners) listener();
  }

  private currentContext(): OutboxContext | null {
    const runtime = getPilotBrowserRuntimeContext();
    return runtime?.device
      ? {
          organisationId: runtime.organisationId,
          deviceId: runtime.device.id,
          operatorId: runtime.operatorId,
        }
      : null;
  }

  private async ensureContext(): Promise<OutboxContext | null> {
    const context = this.currentContext();
    if (context === null) return null;
    const key = [
      context.organisationId,
      context.deviceId,
      context.operatorId,
    ].join(":");
    if (key !== this.contextKey) {
      await this.repository.quarantineForeign(
        context,
        new Date().toISOString(),
      );
      this.contextKey = key;
      this.unpersistedFailures = this.failureEvidence.list(context).length;
    }
    return context;
  }

  private async scheduleRetry(context: OutboxContext): Promise<void> {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    const operation = (await this.repository.listAll())
      .filter(
        (item) =>
          item.state === "failed" &&
          item.envelope.organisationId === context.organisationId &&
          item.envelope.deviceId === context.deviceId &&
          item.envelope.operatorId === context.operatorId,
      )
      .sort(
        (left, right) =>
          Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt),
      )[0];
    if (!operation) {
      this.retryTimer = null;
      return;
    }
    const delay = Math.max(
      0,
      Math.min(5 * 60_000, Date.parse(operation.nextAttemptAt) - Date.now()),
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }

  async prepareForContextExit(): Promise<OutboxSummary> {
    await this.flush(true);
    await this.refreshSummary();
    return this.summarySnapshot;
  }

  private setWarning(warning: string | null): void {
    this.warning = warning;
    this.summarySnapshot = { ...this.summarySnapshot, warning };
    for (const listener of this.listeners) listener();
  }
}

let browserSyncCoordinator: BrowserSyncCoordinator | null = null;

export function getBrowserSyncCoordinator(): BrowserSyncCoordinator | null {
  if (typeof window === "undefined") return null;
  if (browserSyncCoordinator) return browserSyncCoordinator;
  const repository = createBrowserOutboxRepository();
  if (!repository) return null;
  browserSyncCoordinator = new BrowserSyncCoordinator(repository);
  void browserSyncCoordinator
    .initialize()
    .then(() => {
      window.addEventListener("online", () => {
        void browserSyncCoordinator?.flush();
      });
    })
    .catch(() => undefined);
  return browserSyncCoordinator;
}

export async function requireClearPilotOutboxForContextExit(): Promise<void> {
  const coordinator = getBrowserSyncCoordinator();
  if (coordinator === null) {
    throw new PilotPendingOperationsError({
      ...emptyOutboxSummary("unavailable"),
      incomplete: 1,
      storageErrors: 1,
      unsynced: 1,
    });
  }
  const summary = await coordinator.prepareForContextExit();
  if (summary.availability !== "ready" || summary.unsynced > 0) {
    throw new PilotPendingOperationsError(summary);
  }
}

export async function preparePilotMutation(
  repository: string,
  method: string,
  args: readonly unknown[],
): Promise<PreparedPilotMutation> {
  if (getBrowserRuntimeMode() !== "pilot") {
    return {
      enabled: false,
      repository,
      method,
      arguments: args,
      clientTime: new Date().toISOString(),
      projectRef: null,
      rigRef: null,
      holeRef: null,
      shiftRef: null,
      expectedVersion: null,
      leaseEvidence: null,
    };
  }
  const runtime = getPilotBrowserRuntimeContext();
  if (!runtime) {
    throw new PilotClientAuthorizationError(
      "The secure pilot session expired. Sign in again.",
    );
  }
  assertClientPermission(runtime.role, repository, method);
  const operationContext = derivePilotOperationContext(
    repository,
    method,
    args,
    {
      projectRef: runtime.device?.projectRef,
      rigRef: runtime.device?.rigRef,
    },
  );
  const {
    projectRef,
    rigRef,
    holeRef,
    shiftRef,
    expectedVersion,
  } = operationContext;
  const leaseEvidence = await getBrowserPilotLeaseCoordinator().ensureWritable(
    holeRef,
    method,
    projectRef,
  );
  const journalEnabled =
    pilotRepositoryMethodDefinition(repository, method)?.journal === true;
  return {
    enabled: journalEnabled,
    repository,
    method,
    arguments: args,
    clientTime: new Date().toISOString(),
    projectRef,
    rigRef,
    holeRef,
    shiftRef,
    expectedVersion,
    leaseEvidence,
  };
}

export async function completePilotMutation(
  preparation: PreparedPilotMutation,
  result: unknown,
): Promise<void> {
  const noRecoveryChange =
    /^recover/i.test(preparation.method) &&
    (result === null || result === undefined || result === 0);
  if (!noRecoveryChange) {
    await getBrowserSyncCoordinator()?.enqueueMutation(preparation, result);
  }
  if (
    preparation.enabled &&
    /close.*handover|closeFinalShift|completeShift|commitCompletion/i.test(
      preparation.method,
    )
  ) {
    await getBrowserPilotLeaseCoordinator().releaseActive().catch(() => undefined);
  }
}
