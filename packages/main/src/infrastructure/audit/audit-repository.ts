import { z } from "zod";

import {
  decimetres,
  type AuditEntry,
  type JsonValue,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";

const AUDIT_STORAGE_VERSION = 1 as const;
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);
const auditEntrySchema = z.object({
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: z.enum([
    "local-only",
    "queued",
    "syncing",
    "synced",
    "conflict",
    "failed",
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
  holeId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.string().min(1),
  userId: z.string().min(1),
  userNameSnapshot: z.string().min(1),
  timestamp: z.string().datetime(),
  depthDm: z.number().int().nonnegative().optional(),
  metadata: z.record(jsonValueSchema),
});
const auditEnvelopeSchema = z.object({
  version: z.literal(AUDIT_STORAGE_VERSION),
  holeId: z.string().min(1),
  updatedAt: z.string().datetime(),
  entries: z.array(auditEntrySchema),
});

export class AuditRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditRepositoryError";
  }
}

export interface AuditRepository {
  listByHole(holeId: string): Promise<readonly AuditEntry[]>;
  listByEntity(
    holeId: string,
    entityType: string,
    entityId: string,
  ): Promise<readonly AuditEntry[]>;
  append(entry: AuditEntry): Promise<"saved" | "already-saved">;
}

function auditKey(holeId: string): string {
  return `targetlock:prototype:v${AUDIT_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:audit`;
}

function asAuditEntry(value: z.infer<typeof auditEntrySchema>): AuditEntry {
  return {
    ...value,
    depthDm:
      value.depthDm === undefined ? undefined : decimetres(value.depthDm),
  };
}

export class LocalAuditRepository implements AuditRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly seedEntries: readonly AuditEntry[] = [],
  ) {}

  private read(holeId: string): readonly AuditEntry[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(auditKey(holeId));
    } catch {
      throw new AuditRepositoryError("Browser storage is unavailable.");
    }
    if (raw === null) {
      return this.seedEntries.filter((entry) => entry.holeId === holeId);
    }

    try {
      const result = auditEnvelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (!result.success || result.data.holeId !== holeId) {
        throw new AuditRepositoryError(
          "Persisted audit records are incompatible or belong to another hole.",
        );
      }
      return result.data.entries.map(asAuditEntry);
    } catch (error) {
      if (error instanceof AuditRepositoryError) throw error;
      throw new AuditRepositoryError(
        "Persisted audit records are not valid JSON.",
      );
    }
  }

  async listByHole(holeId: string): Promise<readonly AuditEntry[]> {
    return [...this.read(holeId)].sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
  }

  async listByEntity(
    holeId: string,
    entityType: string,
    entityId: string,
  ): Promise<readonly AuditEntry[]> {
    return (await this.listByHole(holeId)).filter(
      (entry) =>
        entry.entityType === entityType && entry.entityId === entityId,
    );
  }

  async append(entry: AuditEntry): Promise<"saved" | "already-saved"> {
    const parsed = auditEntrySchema.safeParse(entry);
    if (!parsed.success || parsed.data.holeId !== entry.holeId) {
      throw new AuditRepositoryError("The audit record did not pass validation.");
    }
    const entries = this.read(entry.holeId);
    const duplicate = entries.find(({ localId }) => localId === entry.localId);
    if (duplicate !== undefined) {
      if (JSON.stringify(duplicate) === JSON.stringify(asAuditEntry(parsed.data))) {
        return "already-saved";
      }
      throw new AuditRepositoryError(
        "The audit identifier is already used by different immutable data.",
      );
    }

    const envelope = auditEnvelopeSchema.parse({
      version: AUDIT_STORAGE_VERSION,
      holeId: entry.holeId,
      updatedAt: entry.timestamp,
      entries: [...entries, parsed.data],
    });
    try {
      this.storage.setItem(auditKey(entry.holeId), JSON.stringify(envelope));
    } catch {
      throw new AuditRepositoryError(
        "This browser could not save the audit record.",
      );
    }
    return "saved";
  }
}

export function createBrowserAuditRepository(
  seedEntries: readonly AuditEntry[] = [],
): AuditRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalAuditRepository(storage, seedEntries);
}
