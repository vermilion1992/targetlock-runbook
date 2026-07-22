import {
  assertHoleUnlocked,
  isHoleLockedError,
  type AuditEntry,
  type HoleStatus,
  type JsonValue,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type {
  HoleMutationGuardPort,
  HoleMutationSnapshot,
} from "@/infrastructure/completion";

const DEVICE_ID = "local-runbook-device";

export type { HoleMutationGuardPort };

export function assertServicesHoleMutable(
  holeId: string,
  guard?: HoleMutationGuardPort,
): void {
  guard?.assertHoleMutable(holeId);
}

export async function recordBlockedHoleMutationAudit(input: {
  readonly holeId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly attemptedAction: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
  readonly status: Extract<HoleStatus, "COMPLETED" | "ABANDONED" | "ARCHIVED">;
  readonly completionId?: string;
  readonly audits: AuditRepository;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}): Promise<"saved" | "already-saved"> {
  const entry: AuditEntry = {
    localId: `audit-blocked-${input.holeId}-${input.attemptedAction}-${input.entityId}`,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: "mutation_blocked_hole_locked",
    userId: input.userId,
    userNameSnapshot: input.userNameSnapshot,
    timestamp: input.occurredAt,
    metadata: {
      attemptedAction: input.attemptedAction,
      status: input.status,
      completionId: input.completionId ?? null,
      ...(input.metadata ?? {}),
    },
  };
  return input.audits.append(entry);
}

export async function withHoleLockAudit<T>(
  input: {
    readonly holeId: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly attemptedAction: string;
    readonly userId: string;
    readonly userNameSnapshot: string;
    readonly occurredAt: string;
    readonly audits: AuditRepository;
    readonly snapshot?: HoleMutationSnapshot | null;
  },
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isHoleLockedError(error)) {
      await recordBlockedHoleMutationAudit({
        holeId: input.holeId,
        entityType: input.entityType,
        entityId: input.entityId,
        attemptedAction: input.attemptedAction,
        userId: input.userId,
        userNameSnapshot: input.userNameSnapshot,
        occurredAt: input.occurredAt,
        status: error.holeStatus,
        completionId: error.completionRecordId,
        audits: input.audits,
      });
    }
    throw error;
  }
}

export function createSnapshotMutationGuard(
  getSnapshot: (holeId: string) => HoleMutationSnapshot | null,
): HoleMutationGuardPort {
  return {
    assertHoleMutable(holeId: string): void {
      const snapshot = getSnapshot(holeId);
      if (snapshot === null) return;
      assertHoleUnlocked(
        holeId,
        snapshot.status,
        snapshot.completionRecordId,
      );
    },
  };
}
