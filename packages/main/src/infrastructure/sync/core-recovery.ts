import { z } from "zod";

import {
  coreChangesPageSchema,
  coreDirectorySnapshotSchema,
  coreHoleSnapshotSchema,
  type CoreDirectorySnapshot,
  type CoreHoleSnapshot,
} from "@/server/pilot/core-types";
import { completionStorageKey } from "@/infrastructure/completion";
import {
  projectDirectoryStorageKey,
} from "@/infrastructure/projects";
import { savedRunsKey } from "@/infrastructure/drafts";
import { getPilotBrowserRuntimeContext } from "./pilot-runtime";
import { getBrowserSyncCoordinator } from "./sync-client";

const RECOVERY_FORMAT_VERSION = 1 as const;

export interface CoreRecoverySummary {
  readonly status:
    | "unknown"
    | "pulling"
    | "server-current"
    | "conflict"
    | "stale-assignment"
    | "unavailable";
  readonly cursor: string | null;
  readonly lastPulledAt: string | null;
  readonly holeCount: number;
  readonly aggregateRevisions: Readonly<Record<string, number>>;
  readonly message: string | null;
}

export interface CoreRestoreDryRun {
  readonly directory: CoreDirectorySnapshot;
  readonly snapshots: readonly CoreHoleSnapshot[];
  readonly localRecordCount: number;
  readonly serverRecordCount: number;
  readonly pendingOperationCount: number;
  readonly assignmentChanged: boolean;
  readonly wouldReplaceLocalData: boolean;
  readonly canRestore: boolean;
}

interface StoragePort {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CoreRecoveryOptions {
  readonly storage: StoragePort;
  readonly fetcher?: typeof fetch;
  readonly now?: () => Date;
  readonly pendingOperations?: () => number;
  readonly notify?: () => void;
  readonly runExclusive?: <T>(operation: () => Promise<T>) => Promise<T>;
}

const initialSummary: CoreRecoverySummary = {
  status: "unknown",
  cursor: null,
  lastPulledAt: null,
  holeCount: 0,
  aggregateRevisions: {},
  message: null,
};

function encoded(value: string): string {
  return encodeURIComponent(value);
}

function assignmentIdentity(runtime: NonNullable<ReturnType<typeof getPilotBrowserRuntimeContext>>): string {
  return [
    runtime.organisationId,
    runtime.device?.id ?? "no-device",
    runtime.device?.projectRef ?? "no-project",
    runtime.device?.rigRef ?? "no-rig",
  ].join("|");
}

function assignmentToken(identity: string): string {
  return encoded(identity);
}

function cursorKey(organisationId: string, identity: string): string {
  return `targetlock:pilot:v1:org:${encoded(organisationId)}:assignment:${assignmentToken(identity)}:core-pull-cursor`;
}

function restoreMetadataKey(organisationId: string, identity: string): string {
  return `targetlock:pilot:v1:org:${encoded(organisationId)}:assignment:${assignmentToken(identity)}:core-restore-metadata`;
}

function restoreTransactionKey(organisationId: string): string {
  return `targetlock:pilot:v1:org:${encoded(organisationId)}:core-restore-transaction`;
}

function assignmentMarkerKey(organisationId: string): string {
  return `targetlock:pilot:v1:org:${encoded(organisationId)}:core-assignment-marker`;
}

function pendingRestoreAuditKey(organisationId: string): string {
  return `targetlock:pilot:v1:org:${encoded(organisationId)}:core-restore-audit-pending`;
}

function shiftStorageKey(holeId: string): string {
  return `targetlock:prototype:v1:hole:${encoded(holeId)}:shifts`;
}

function bhaStorageKey(holeId: string): string {
  return `targetlock:prototype:v1:hole:${encoded(holeId)}:bha-setups`;
}

function trajectoryStorageKey(holeId: string): string {
  return `targetlock:prototype:v1:hole:${encoded(holeId)}:trajectory`;
}

function holeStorageKeys(holeId: string): readonly string[] {
  return [
    shiftStorageKey(holeId),
    bhaStorageKey(holeId),
    savedRunsKey(holeId),
    trajectoryStorageKey(holeId),
  ];
}

function maxCursor(values: readonly string[]): string {
  return values.reduce(
    (maximum, value) => (BigInt(value) > BigInt(maximum) ? value : maximum),
    "0",
  );
}

function coreStorageKeys(
  organisationId: string,
  identity: string,
  holeIds: readonly string[],
): readonly string[] {
  return [
    projectDirectoryStorageKey(organisationId),
    completionStorageKey(organisationId),
    cursorKey(organisationId, identity),
    restoreMetadataKey(organisationId, identity),
    assignmentMarkerKey(organisationId),
    ...holeIds.flatMap(holeStorageKeys),
  ];
}

function countSnapshotRecords(snapshot: CoreHoleSnapshot): number {
  return (
    3 +
    snapshot.configurations.length +
    snapshot.bhaSetups.length +
    snapshot.shifts.length +
    snapshot.handovers.length +
    snapshot.runs.length +
    snapshot.rodEvents.length +
    snapshot.runCorrections.length +
    snapshot.completionReviews.length +
    snapshot.completionRecords.length +
    snapshot.reopenRecords.length +
    snapshot.media.length
  );
}

function serverWrites(
  organisationId: string,
  identity: string,
  directory: CoreDirectorySnapshot,
  snapshots: readonly CoreHoleSnapshot[],
): ReadonlyMap<string, string> {
  const generatedAt = directory.generatedAt;
  const writes = new Map<string, string>();
  writes.set(
    projectDirectoryStorageKey(organisationId),
    JSON.stringify({
      version: 1,
      organisationId,
      revision: Number(directory.cursor),
      updatedAt: generatedAt,
      projects: directory.projects.map((project) => project.state),
      rigs: directory.rigs.map((rig) => rig.state),
      operations: [],
    }),
  );
  writes.set(
    completionStorageKey(organisationId),
    JSON.stringify({
      version: 1,
      organisationId,
      revision: snapshots.reduce(
        (total, snapshot) => total + snapshot.aggregateRevision,
        0,
      ),
      updatedAt: generatedAt,
      holes: directory.holes.map((hole) => hole.state),
      reviews: snapshots.flatMap((snapshot) =>
        snapshot.completionReviews.map((record) => record.state),
      ),
      completions: snapshots.flatMap((snapshot) =>
        snapshot.completionRecords.map((record) => record.state),
      ),
      reopens: snapshots.flatMap((snapshot) =>
        snapshot.reopenRecords.map((record) => record.state),
      ),
      transactions: [],
      operations: [],
    }),
  );

  for (const snapshot of snapshots) {
    const holeId = snapshot.hole.localId;
    const shifts = snapshot.shifts
      .map((record) => record.state)
      .sort(
        (left, right) =>
          Date.parse(String(left.startedAt)) - Date.parse(String(right.startedAt)),
      );
    writes.set(
      shiftStorageKey(holeId),
      JSON.stringify({
        version: 1,
        holeId,
        revision: snapshot.aggregateRevision,
        updatedAt: snapshot.generatedAt,
        shifts,
      }),
    );
    writes.set(
      bhaStorageKey(holeId),
      JSON.stringify({
        version: 1,
        holeId,
        setups: snapshot.bhaSetups.map((record) => record.state),
      }),
    );
    writes.set(
      savedRunsKey(holeId),
      JSON.stringify({
        version: 5,
        holeId,
        syncStatus: "synced",
        updatedAt: snapshot.generatedAt,
        revision: snapshot.aggregateRevision,
        snapshots: snapshot.runs
          .map((record) => record.state)
          .sort(
            (left, right) =>
              Number(left.runNumber) - Number(right.runNumber),
          ),
        corrections: snapshot.runCorrections.map((record) => record.state),
        operations: [],
        rodEventOverrides: [],
      }),
    );
    const configurations = snapshot.configurations;
    const latest = (kind: (typeof configurations)[number]["kind"]) =>
      configurations
        .filter((record) => record.kind === kind)
        .sort((left, right) => left.version - right.version)
        .at(-1)?.state ?? null;
    writes.set(
      trajectoryStorageKey(holeId),
      JSON.stringify({
        version: 1,
        holeId,
        revision: snapshot.aggregateRevision,
        updatedAt: snapshot.generatedAt,
        coordinateConfiguration: latest("COORDINATE"),
        referenceConfiguration: latest("REFERENCE"),
        plans: configurations
          .filter((record) => record.kind === "PLAN")
          .map((record) => record.state),
        target: latest("TARGET"),
        actualConfiguration: latest("ACTUAL"),
        selections: configurations
          .filter((record) => record.kind === "SURVEY_SELECTION")
          .map((record) => record.state),
        tolerance: null,
        operations: [],
      }),
    );
  }

  const cursor = maxCursor([
    directory.cursor,
    ...snapshots.map((snapshot) => snapshot.cursor),
  ]);
  writes.set(cursorKey(organisationId, identity), cursor);
  writes.set(
    restoreMetadataKey(organisationId, identity),
    JSON.stringify({
      formatVersion: RECOVERY_FORMAT_VERSION,
      source: "AUTHORITATIVE_SERVER",
      assignmentIdentity: identity,
      cursor,
      restoredAt: generatedAt,
      aggregates: Object.fromEntries(
        snapshots.map((snapshot) => [
          snapshot.hole.localId,
          {
            serverId: snapshot.hole.serverId,
            revision: snapshot.aggregateRevision,
            cursor: snapshot.cursor,
          },
        ]),
      ),
    }),
  );
  writes.set(
    assignmentMarkerKey(organisationId),
    JSON.stringify({
      assignmentIdentity: identity,
      holeIds: directory.holes.map((hole) => hole.localId),
      updatedAt: generatedAt,
    }),
  );
  return writes;
}

async function requestJson(
  fetcher: typeof fetch,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetcher(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as {
    readonly error?: { readonly message?: string };
  };
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `Authoritative sync returned HTTP ${response.status}.`,
    );
  }
  return body;
}

export class BrowserCoreRecoveryCoordinator {
  private summary: CoreRecoverySummary = initialSummary;
  private readonly listeners = new Set<() => void>();
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly pendingOperations: () => number;
  private readonly runExclusive: <T>(operation: () => Promise<T>) => Promise<T>;
  private recoveryError: string | null = null;

  constructor(private readonly options: CoreRecoveryOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.pendingOperations = options.pendingOperations ?? (() => 0);
    this.runExclusive =
      options.runExclusive ??
      (async <T>(operation: () => Promise<T>): Promise<T> => {
        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request(
            "targetlock:runbook-storage:v1",
            { mode: "exclusive" },
            operation,
          );
        }
        return operation();
      });
    try {
      this.recoverInterruptedRestore();
    } catch (error) {
      this.recoveryError =
        error instanceof Error
          ? error.message
          : "An interrupted restore could not be recovered.";
      this.summary = {
        ...initialSummary,
        status: "unavailable",
        message: this.recoveryError,
      };
    }
  }

  getSnapshot = (): CoreRecoverySummary => this.summary;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: CoreRecoverySummary): void {
    this.summary = next;
    for (const listener of this.listeners) listener();
  }

  async inspectRestore(): Promise<CoreRestoreDryRun> {
    return this.runExclusive(() => this.inspectRestoreUnlocked());
  }

  private async inspectRestoreUnlocked(): Promise<CoreRestoreDryRun> {
    if (this.recoveryError) throw new Error(this.recoveryError);
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) {
      throw new Error("Register this browser before restoring server state.");
    }
    const beforeFetchPending = this.pendingOperations();
    this.publish({ ...this.summary, status: "pulling", message: null });
    const directoryBody = (await requestJson(
      this.fetcher,
      "/api/pilot/core/directory",
    )) as { readonly directory?: unknown };
    const directory = coreDirectorySnapshotSchema.parse(
      directoryBody.directory,
    );
    if (directory.organisationId !== runtime.organisationId) {
      throw new Error(
        "Server recovery data belongs to another organisation.",
      );
    }
    if (directory.holes.length > 50) {
      throw new Error(
        "This assignment exceeds the 50-hole restore limit. Narrow the device assignment before restoring.",
      );
    }
    const snapshots: CoreHoleSnapshot[] = [];
    for (const hole of directory.holes.slice(0, 50)) {
      const body = (await requestJson(
        this.fetcher,
        `/api/pilot/core/holes/${encodeURIComponent(hole.localId)}/snapshot`,
      )) as { readonly snapshot?: unknown };
      const snapshot = coreHoleSnapshotSchema.parse(body.snapshot);
      if (snapshot.organisationId !== runtime.organisationId) {
        throw new Error(
          "Server recovery data belongs to another organisation.",
        );
      }
      snapshots.push(snapshot);
    }
    const keys = coreStorageKeys(
      runtime.organisationId,
      assignmentIdentity(runtime),
      directory.holes.map((hole) => hole.localId),
    );
    const localRecordCount = keys.filter(
      (key) =>
        !key.endsWith(":core-pull-cursor") &&
        !key.endsWith(":core-restore-metadata") &&
        this.options.storage.getItem(key) !== null,
    ).length;
    const pendingOperationCount = Math.max(
      beforeFetchPending,
      this.pendingOperations(),
    );
    const marker = this.readAssignmentMarker(runtime.organisationId);
    const assignmentChanged =
      marker !== null &&
      marker.assignmentIdentity !== assignmentIdentity(runtime);
    const dryRun = {
      directory,
      snapshots,
      localRecordCount,
      serverRecordCount:
        directory.projects.length +
        directory.rigs.length +
        directory.holes.length +
        snapshots.reduce(
          (total, snapshot) => total + countSnapshotRecords(snapshot),
          0,
        ),
      pendingOperationCount,
      assignmentChanged,
      wouldReplaceLocalData: localRecordCount > 0,
      canRestore: pendingOperationCount === 0,
    };
    this.publish({
      ...this.summary,
      status:
        pendingOperationCount === 0
          ? assignmentChanged ||
            (directory.holes.length === 0 && localRecordCount > 0)
            ? "stale-assignment"
            : this.summary.status === "server-current"
            ? "server-current"
            : "unknown"
          : "conflict",
      message:
        pendingOperationCount === 0
          ? assignmentChanged
            ? "The registered device assignment changed. Explicit restore confirmation will quarantine and replace the prior assignment cache."
            : directory.holes.length === 0 && localRecordCount > 0
              ? "The server assignment is empty. Explicit restore confirmation is required before stale local core records are cleared."
              : null
          : "Pending local operations must be journalled or exported before server restore.",
    });
    return dryRun;
  }

  async restore(
    dryRun: CoreRestoreDryRun,
    input: { readonly confirmed: boolean; readonly reason: string },
  ): Promise<CoreRecoverySummary> {
    return this.runExclusive(() => this.restoreUnlocked(dryRun, input));
  }

  private async restoreUnlocked(
    dryRun: CoreRestoreDryRun,
    input: { readonly confirmed: boolean; readonly reason: string },
  ): Promise<CoreRecoverySummary> {
    if (this.recoveryError) throw new Error(this.recoveryError);
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) throw new Error("A registered pilot device is required.");
    if (!input.confirmed) {
      throw new Error("Confirm the server restore before replacing local state.");
    }
    if (input.reason.trim().length < 10) {
      throw new Error("Enter a restore reason of at least 10 characters.");
    }
    if (!dryRun.canRestore || this.pendingOperations() > 0) {
      this.publish({
        ...this.summary,
        status: "conflict",
        message:
          "Restore blocked: this device has pending local operations. Export before any discard decision.",
      });
      throw new Error(this.summary.message!);
    }
    const freshDryRun = await this.inspectRestoreUnlocked();
    if (!freshDryRun.canRestore || this.pendingOperations() > 0) {
      throw new Error(
        "Restore blocked because local operations changed during the authoritative fetch.",
      );
    }
    const cursor = maxCursor([
      freshDryRun.directory.cursor,
      ...freshDryRun.snapshots.map((snapshot) => snapshot.cursor),
    ]);
    const restoreId = crypto.randomUUID();
    const auditInput = {
      restoreId,
      reason: input.reason.trim(),
      holeRefs: freshDryRun.snapshots.map(
        (snapshot) => snapshot.hole.localId,
      ),
      snapshotCursor: cursor,
      dryRunRecordCount: freshDryRun.serverRecordCount,
    };
    await requestJson(this.fetcher, "/api/pilot/core/restore", {
      method: "POST",
      body: JSON.stringify({
        ...auditInput,
        phase: "PREPARE",
      }),
    });
    this.options.storage.setItem(
      pendingRestoreAuditKey(runtime.organisationId),
      JSON.stringify(auditInput),
    );
    await this.applySnapshots(
      freshDryRun.directory,
      freshDryRun.snapshots,
      true,
    );
    await requestJson(this.fetcher, "/api/pilot/core/restore", {
      method: "POST",
      body: JSON.stringify({ ...auditInput, phase: "COMMIT" }),
    });
    this.options.storage.removeItem(
      pendingRestoreAuditKey(runtime.organisationId),
    );
    const next: CoreRecoverySummary = {
      status: "server-current",
      cursor,
      lastPulledAt: this.now().toISOString(),
      holeCount: freshDryRun.snapshots.length,
      aggregateRevisions: Object.fromEntries(
        freshDryRun.snapshots.map((snapshot) => [
          snapshot.hole.localId,
          snapshot.aggregateRevision,
        ]),
      ),
      message:
        "Authoritative core state restored. Media blobs remain local to their original devices.",
    };
    this.publish(next);
    return next;
  }

  async pullAfterPush(): Promise<CoreRecoverySummary> {
    return this.runExclusive(() => this.pullAfterPushUnlocked());
  }

  private async pullAfterPushUnlocked(): Promise<CoreRecoverySummary> {
    if (this.recoveryError) return this.summary;
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) return this.summary;
    await this.commitPendingRestoreAudit(runtime.organisationId);
    if (this.pendingOperations() > 0) {
      const next = {
        ...this.summary,
        status: "conflict" as const,
        message:
          "Server pull paused because local operations are still pending or conflicted.",
      };
      this.publish(next);
      return next;
    }
    try {
      const identity = assignmentIdentity(runtime);
      const existingCursor =
        this.options.storage.getItem(
          cursorKey(runtime.organisationId, identity),
        ) ?? "0";
      const directoryBody = (await requestJson(
        this.fetcher,
        "/api/pilot/core/directory",
      )) as { readonly directory?: unknown };
      const directory = coreDirectorySnapshotSchema.parse(
        directoryBody.directory,
      );
      if (directory.holes.length > 50) {
        throw new Error(
          "This assignment exceeds the 50-hole hydration limit. Narrow the device assignment.",
        );
      }
      const localHasCore =
        this.options.storage.getItem(
          completionStorageKey(runtime.organisationId),
        ) !== null;
      const marker = this.readAssignmentMarker(runtime.organisationId);
      if (marker && marker.assignmentIdentity !== identity && localHasCore) {
        const next: CoreRecoverySummary = {
          ...this.summary,
          status: "stale-assignment",
          message:
            "The device assignment changed. Preview and explicitly confirm server restore before replacing the prior assignment cache.",
        };
        this.publish(next);
        return next;
      }
      if (directory.holes.length === 0) {
        if (localHasCore) {
          const next: CoreRecoverySummary = {
            ...this.summary,
            status: "stale-assignment",
            message:
              "The authoritative assignment is empty, but local core records remain. Preview and confirm restore before clearing them.",
          };
          this.publish(next);
          return next;
        }
        const next: CoreRecoverySummary = {
          status: "server-current",
          cursor: directory.cursor,
          lastPulledAt: this.now().toISOString(),
          holeCount: 0,
          aggregateRevisions: {},
          message: "No authoritative holes are assigned to this device.",
        };
        this.options.storage.setItem(
          cursorKey(runtime.organisationId, identity),
          directory.cursor,
        );
        this.publish(next);
        return next;
      }
      const changedHoles = new Set<string>();
      const directoryChanged =
        BigInt(directory.cursor) > BigInt(existingCursor);
      for (const hole of directory.holes) {
        const search = new URLSearchParams({
          cursor: existingCursor,
          limit: "100",
          holeRef: hole.localId,
        });
        const page = coreChangesPageSchema.parse(
          await requestJson(
            this.fetcher,
            `/api/pilot/core/changes?${search.toString()}`,
          ),
        );
        if (page.changes.length > 0 || !localHasCore) {
          changedHoles.add(hole.localId);
        }
      }
      if (changedHoles.size === 0 && !directoryChanged) {
        const next = {
          ...this.summary,
          status: "server-current" as const,
          cursor: maxCursor([existingCursor, directory.cursor]),
          lastPulledAt: this.now().toISOString(),
          holeCount: directory.holes.length,
          message: "Local core records match the latest server cursor.",
        };
        this.options.storage.setItem(
          cursorKey(runtime.organisationId, identity),
          next.cursor,
        );
        this.publish(next);
        return next;
      }
      const snapshots: CoreHoleSnapshot[] = [];
      for (const hole of directory.holes.slice(0, 50)) {
        const body = (await requestJson(
          this.fetcher,
          `/api/pilot/core/holes/${encodeURIComponent(hole.localId)}/snapshot`,
        )) as { readonly snapshot?: unknown };
        snapshots.push(coreHoleSnapshotSchema.parse(body.snapshot));
      }
      if (this.pendingOperations() > 0) {
        throw new Error(
          "Server pull stopped because a local mutation was queued during hydration.",
        );
      }
      await this.applySnapshots(directory, snapshots, false);
      const next: CoreRecoverySummary = {
        status: "server-current",
        cursor: maxCursor([
          directory.cursor,
          ...snapshots.map((snapshot) => snapshot.cursor),
        ]),
        lastPulledAt: this.now().toISOString(),
        holeCount: snapshots.length,
        aggregateRevisions: Object.fromEntries(
          snapshots.map((snapshot) => [
            snapshot.hole.localId,
            snapshot.aggregateRevision,
          ]),
        ),
        message: localHasCore
          ? "Accepted remote core changes were hydrated after local push completed."
          : "This device was hydrated from authoritative server state.",
      };
      this.publish(next);
      return next;
    } catch (error) {
      const next: CoreRecoverySummary = {
        ...this.summary,
        status: "unavailable",
        message:
          error instanceof Error
            ? error.message
            : "Authoritative server pull is unavailable.",
      };
      this.publish(next);
      return next;
    }
  }

  private async applySnapshots(
    directory: CoreDirectorySnapshot,
    snapshots: readonly CoreHoleSnapshot[],
    explicitRestore: boolean,
  ): Promise<void> {
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime) throw new Error("The pilot runtime is unavailable.");
    if (
      directory.organisationId !== runtime.organisationId ||
      snapshots.some(
        (snapshot) => snapshot.organisationId !== runtime.organisationId,
      )
    ) {
      throw new Error("Server recovery data belongs to another organisation.");
    }
    const identity = assignmentIdentity(runtime);
    const writes = serverWrites(
      runtime.organisationId,
      identity,
      directory,
      snapshots,
    );
    const marker = this.readAssignmentMarker(runtime.organisationId);
    const newHoleIds = new Set(directory.holes.map((hole) => hole.localId));
    const staleKeys =
      explicitRestore && marker
        ? marker.holeIds
            .filter((holeId) => !newHoleIds.has(holeId))
            .flatMap(holeStorageKeys)
        : [];
    const touchedKeys = [...new Set([...writes.keys(), ...staleKeys])];
    const previous = touchedKeys.map((key) => [
      key,
      this.options.storage.getItem(key),
    ] as const);
    const transactionKey = restoreTransactionKey(runtime.organisationId);
    this.options.storage.setItem(
      transactionKey,
      JSON.stringify({
        version: RECOVERY_FORMAT_VERSION,
        startedAt: this.now().toISOString(),
        previous,
      }),
    );
    try {
      if (this.pendingOperations() > 0) {
        throw new Error(
          "Hydration was cancelled because a local mutation was queued before the storage commit.",
        );
      }
      for (const key of staleKeys) this.options.storage.removeItem(key);
      for (const [key, value] of writes) this.options.storage.setItem(key, value);
      this.options.storage.removeItem(transactionKey);
    } catch (error) {
      for (const [key, value] of previous) {
        if (value === null) this.options.storage.removeItem(key);
        else this.options.storage.setItem(key, value);
      }
      this.options.storage.removeItem(transactionKey);
      throw error;
    }
    this.options.notify?.();
  }

  private readAssignmentMarker(organisationId: string): {
    readonly assignmentIdentity: string;
    readonly holeIds: readonly string[];
  } | null {
    const raw = this.options.storage.getItem(
      assignmentMarkerKey(organisationId),
    );
    if (!raw) return null;
    const parsed = z
      .object({
        assignmentIdentity: z.string().min(1),
        holeIds: z.array(z.string().min(1)),
      })
      .passthrough()
      .safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  }

  private async commitPendingRestoreAudit(
    organisationId: string,
  ): Promise<void> {
    const key = pendingRestoreAuditKey(organisationId);
    const raw = this.options.storage.getItem(key);
    if (!raw) return;
    const parsed = z
      .object({
        restoreId: z.string().uuid(),
        reason: z.string().min(10),
        holeRefs: z.array(z.string()),
        snapshotCursor: z.string().regex(/^\d+$/),
        dryRunRecordCount: z.number().int().nonnegative(),
      })
      .strict()
      .parse(JSON.parse(raw) as unknown);
    await requestJson(this.fetcher, "/api/pilot/core/restore", {
      method: "POST",
      body: JSON.stringify({ ...parsed, phase: "COMMIT" }),
    });
    this.options.storage.removeItem(key);
  }

  private recoverInterruptedRestore(): void {
    for (let index = 0; index < this.options.storage.length; index += 1) {
      const key = this.options.storage.key(index);
      if (!key?.endsWith(":core-restore-transaction")) continue;
      const raw = this.options.storage.getItem(key);
      if (!raw) continue;
      const transaction = z
        .object({
          version: z.literal(RECOVERY_FORMAT_VERSION),
          previous: z.array(z.tuple([z.string(), z.string().nullable()])),
        })
        .passthrough()
        .safeParse(JSON.parse(raw) as unknown);
      if (!transaction.success) {
        throw new Error(
          "An interrupted server restore has invalid recovery metadata. Preserve this browser profile and contact support.",
        );
      }
      for (const [storageKey, previousValue] of transaction.data.previous) {
        if (previousValue === null) this.options.storage.removeItem(storageKey);
        else this.options.storage.setItem(storageKey, previousValue);
      }
      this.options.storage.removeItem(key);
      index -= 1;
    }
  }
}

let browserCoreRecoveryCoordinator: BrowserCoreRecoveryCoordinator | null = null;

export function getBrowserCoreRecoveryCoordinator(): BrowserCoreRecoveryCoordinator | null {
  if (typeof window === "undefined") return null;
  browserCoreRecoveryCoordinator ??= new BrowserCoreRecoveryCoordinator({
    storage: window.localStorage,
    pendingOperations: () =>
      getBrowserSyncCoordinator()?.getSnapshot().unsynced ?? 1,
    notify: () => {
      window.dispatchEvent(new Event("targetlock:core-restored"));
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    },
  });
  return browserCoreRecoveryCoordinator;
}
