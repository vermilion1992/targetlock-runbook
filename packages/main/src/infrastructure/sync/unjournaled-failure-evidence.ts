import { z } from "zod";

import type { OutboxContext } from "./browser-outbox-repository";

const failureEvidenceSchema = z
  .object({
    id: z.string().uuid(),
    organisationId: z.string().uuid(),
    deviceId: z.string().uuid(),
    operatorId: z.string().uuid(),
    operationType: z.string().min(1).max(200),
    occurredAt: z.string().datetime(),
    reason: z.string().min(1).max(2_000),
  })
  .strict();

export type UnjournaledFailureEvidence = z.infer<
  typeof failureEvidenceSchema
>;

export interface UnjournaledFailureEvidenceStore {
  list(context: OutboxContext): readonly UnjournaledFailureEvidence[];
  record(
    context: OutboxContext,
    input: {
      readonly operationType: string;
      readonly reason: string;
      readonly occurredAt: string;
    },
  ): void;
  acknowledgeExported(context: {
    readonly organisationId: string;
    readonly operatorId: string;
  }): number;
}

function key(context: OutboxContext): string {
  return [
    "targetlock:pilot:v1:org",
    encodeURIComponent(context.organisationId),
    "device",
    encodeURIComponent(context.deviceId),
    "operator",
    encodeURIComponent(context.operatorId),
    "unjournaled-failures",
  ].join(":");
}

export class MemoryUnjournaledFailureEvidenceStore
  implements UnjournaledFailureEvidenceStore
{
  private readonly records = new Map<
    string,
    readonly UnjournaledFailureEvidence[]
  >();

  list(context: OutboxContext): readonly UnjournaledFailureEvidence[] {
    return this.records.get(key(context)) ?? [];
  }

  record(
    context: OutboxContext,
    input: {
      readonly operationType: string;
      readonly reason: string;
      readonly occurredAt: string;
    },
  ): void {
    this.records.set(key(context), [
      ...this.list(context),
      failureEvidenceSchema.parse({
        id: crypto.randomUUID(),
        ...context,
        ...input,
      }),
    ]);
  }

  acknowledgeExported(context: {
    readonly organisationId: string;
    readonly operatorId: string;
  }): number {
    let removed = 0;
    for (const [recordKey, records] of this.records) {
      if (
        records.some(
          (record) =>
            record.organisationId === context.organisationId &&
            record.operatorId === context.operatorId,
        )
      ) {
        removed += records.length;
        this.records.delete(recordKey);
      }
    }
    return removed;
  }
}

export class LocalStorageUnjournaledFailureEvidenceStore
  implements UnjournaledFailureEvidenceStore
{
  constructor(private readonly storage: Storage) {}

  list(context: OutboxContext): readonly UnjournaledFailureEvidence[] {
    const raw = this.storage.getItem(key(context));
    if (!raw) return [];
    return z.array(failureEvidenceSchema).parse(JSON.parse(raw) as unknown);
  }

  record(
    context: OutboxContext,
    input: {
      readonly operationType: string;
      readonly reason: string;
      readonly occurredAt: string;
    },
  ): void {
    const records = [
      ...this.list(context),
      failureEvidenceSchema.parse({
        id: crypto.randomUUID(),
        ...context,
        ...input,
      }),
    ];
    this.storage.setItem(key(context), JSON.stringify(records));
  }

  acknowledgeExported(context: {
    readonly organisationId: string;
    readonly operatorId: string;
  }): number {
    const matches: string[] = [];
    let removed = 0;
    for (let index = 0; index < this.storage.length; index += 1) {
      const storageKey = this.storage.key(index);
      if (
        storageKey?.startsWith(
          `targetlock:pilot:v1:org:${encodeURIComponent(context.organisationId)}:`,
        ) &&
        storageKey.includes(
          `:operator:${encodeURIComponent(context.operatorId)}:`,
        ) &&
        storageKey.endsWith(":unjournaled-failures")
      ) {
        matches.push(storageKey);
      }
    }
    for (const storageKey of matches) {
      const raw = this.storage.getItem(storageKey);
      if (raw) {
        const parsed = z
          .array(failureEvidenceSchema)
          .safeParse(JSON.parse(raw) as unknown);
        if (parsed.success) removed += parsed.data.length;
      }
      this.storage.removeItem(storageKey);
    }
    return removed;
  }
}

let browserStore: UnjournaledFailureEvidenceStore | null = null;

export function getBrowserUnjournaledFailureEvidenceStore(): UnjournaledFailureEvidenceStore {
  if (browserStore) return browserStore;
  browserStore =
    typeof localStorage === "undefined"
      ? new MemoryUnjournaledFailureEvidenceStore()
      : new LocalStorageUnjournaledFailureEvidenceStore(localStorage);
  return browserStore;
}

export function acknowledgeExportedUnjournaledFailureEvidence(context: {
  readonly organisationId: string;
  readonly operatorId: string;
}): number {
  return getBrowserUnjournaledFailureEvidenceStore().acknowledgeExported(
    context,
  );
}
