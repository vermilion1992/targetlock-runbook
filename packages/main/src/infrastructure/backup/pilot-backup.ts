import { z } from "zod";

import { listBrowserMediaManifest } from "@/infrastructure/media";
import {
  createBrowserOutboxRepository,
  acknowledgeExportedUnjournaledFailureEvidence,
  outboxOperationSchema,
} from "@/infrastructure/sync";

const BACKUP_FORMAT = "targetlock-shadow-pilot-backup";
const BACKUP_VERSION = 2 as const;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const storageRecordSchema = z
  .object({
    key: z.string().startsWith("targetlock:"),
    value: z.string(),
  })
  .strict();

const mediaManifestEntrySchema = z
  .object({
    organisationId: z.string().uuid(),
    storageKey: z.string().min(1),
    operationId: z.string().min(1),
    holeId: z.string().min(1),
    kind: z.enum(["ORIGINAL", "PREVIEW"]),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();

const backupBodySchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.string().datetime(),
    organisationId: z.string().uuid(),
    operatorId: z.string().uuid(),
    appSchemaVersion: z.literal("stage-7c-v1"),
    completeness: z.literal("METADATA_AND_MEDIA_MANIFEST_ONLY"),
    blobPayloadsIncluded: z.literal(false),
    localStorage: z.array(storageRecordSchema),
    outbox: z.array(outboxOperationSchema),
    mediaManifest: z.array(mediaManifestEntrySchema),
    serverRecovery: z
      .object({
        cursor: z.string().regex(/^\d+$/).nullable(),
        aggregates: z.record(
          z
            .object({
              serverId: z.string().uuid(),
              revision: z.number().int().positive(),
              cursor: z.string().regex(/^\d+$/),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

const backupSchema = backupBodySchema
  .extend({
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const legacyBackupSchema = backupBodySchema
  .omit({
    version: true,
    appSchemaVersion: true,
    serverRecovery: true,
  })
  .extend({
    version: z.literal(1),
    appSchemaVersion: z.literal("stage-7b-v1"),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const importBackupSchema = z.union([backupSchema, legacyBackupSchema]);

export type PilotBackup = z.infer<typeof backupSchema>;

export interface PilotBackupContext {
  readonly organisationId: string;
  readonly operatorId: string;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

function extractOrganisationScopedHoles(
  records: readonly { readonly key: string; readonly value: string }[],
  organisationId: string,
): ReadonlySet<string> {
  const holes = new Set<string>();
  for (const record of records) {
    if (
      !record.key.includes(`:organisation:${encoded(organisationId)}:`) ||
      !record.key.endsWith(":completion")
    ) {
      continue;
    }
    try {
      const value = JSON.parse(record.value) as {
        readonly holes?: readonly {
          readonly localId?: unknown;
          readonly name?: unknown;
        }[];
      };
      for (const hole of value.holes ?? []) {
        if (typeof hole.localId === "string") holes.add(hole.localId);
        if (typeof hole.name === "string") holes.add(hole.name);
      }
    } catch {
      // The backup schema dry-run rejects damaged JSON-bearing records later.
    }
  }
  return holes;
}

export function localStorageRecordBelongsToPilotContext(
  key: string,
  context: PilotBackupContext,
  organisationHoleIds: ReadonlySet<string>,
): boolean {
  const organisationMarker = `:organisation:${encoded(
    context.organisationId,
  )}:`;
  const shortOrganisationMarker = `:org:${encoded(context.organisationId)}:`;
  if (
    key.includes(organisationMarker) ||
    key.includes(shortOrganisationMarker) ||
    key.startsWith(
      `targetlock:pilot:lease-evidence:${encoded(context.organisationId)}:`,
    )
  ) {
    return true;
  }
  if (
    /:(?:organisation|org):/.test(key) ||
    key.startsWith("targetlock:pilot:lease-evidence:")
  ) {
    return false;
  }
  if (
    key ===
    `targetlock:pilot:last-hole:${encoded(context.operatorId)}`
  ) {
    return true;
  }
  const holeMatch = key.match(/:hole:([^:]+):/);
  if (holeMatch) {
    return organisationHoleIds.has(decodeURIComponent(holeMatch[1]!));
  }
  return false;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPilotBackup(
  context: PilotBackupContext,
): Promise<PilotBackup> {
  const allLocalRecords: { key: string; value: string }[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("targetlock:")) continue;
    const value = localStorage.getItem(key);
    if (value !== null) allLocalRecords.push({ key, value });
  }
  const organisationHoleIds = extractOrganisationScopedHoles(
    allLocalRecords,
    context.organisationId,
  );
  const localRecords = allLocalRecords.filter(({ key }) =>
    localStorageRecordBelongsToPilotContext(
      key,
      context,
      organisationHoleIds,
    ),
  );
  localRecords.sort((left, right) => left.key.localeCompare(right.key, "en"));
  const outbox = (
    (await createBrowserOutboxRepository()?.listAll()) ?? []
  ).filter(
    (operation) =>
      operation.envelope.organisationId === context.organisationId,
  );
  const mediaManifest = (await listBrowserMediaManifest()).filter(
    (media) => media.organisationId === context.organisationId,
  );
  const recoveryKey = allLocalRecords
    .map((record) => record.key)
    .filter(
      (key) =>
        key.startsWith(
          `targetlock:pilot:v1:org:${encoded(context.organisationId)}:`,
        ) && key.endsWith(":core-restore-metadata"),
    )
    .sort()
    .at(-1);
  let serverRecovery: {
    cursor: string | null;
    aggregates: Record<
      string,
      { serverId: string; revision: number; cursor: string }
    >;
  } = { cursor: null, aggregates: {} };
  const rawRecovery = recoveryKey
    ? localStorage.getItem(recoveryKey)
    : null;
  if (rawRecovery) {
    const parsed = z
      .object({
        cursor: z.string().regex(/^\d+$/),
        aggregates: z.record(
          z.object({
            serverId: z.string().uuid(),
            revision: z.number().int().positive(),
            cursor: z.string().regex(/^\d+$/),
          }),
        ),
      })
      .passthrough()
      .safeParse(JSON.parse(rawRecovery) as unknown);
    if (parsed.success) {
      serverRecovery = {
        cursor: parsed.data.cursor,
        aggregates: parsed.data.aggregates,
      };
    }
  }
  const body = backupBodySchema.parse({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    organisationId: context.organisationId,
    operatorId: context.operatorId,
    appSchemaVersion: "stage-7c-v1",
    completeness: "METADATA_AND_MEDIA_MANIFEST_ONLY",
    blobPayloadsIncluded: false,
    localStorage: localRecords,
    outbox,
    mediaManifest,
    serverRecovery,
  });
  return {
    ...body,
    checksumSha256: await sha256(JSON.stringify(body)),
  };
}

export async function downloadPilotBackup(
  context: PilotBackupContext,
): Promise<string> {
  const backup = await createPilotBackup(context);
  const json = JSON.stringify(backup, null, 2);
  const href = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  const date = backup.exportedAt.slice(0, 10);
  anchor.href = href;
  anchor.download = `TargetLock_Pilot_Backup_${date}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
  await createBrowserOutboxRepository()?.deleteQuarantined(
    context.organisationId,
  );
  acknowledgeExportedUnjournaledFailureEvidence(context);
  return backup.checksumSha256;
}

export interface PilotBackupDryRun {
  readonly valid: boolean;
  readonly message: string;
  readonly organisationMatches: boolean;
  readonly localRecordCount: number;
  readonly operationCount: number;
  readonly mediaManifestCount: number;
  readonly blobsRecoverableFromFile: false;
}

export async function validatePilotBackupDryRun(
  file: File,
  expectedOrganisationId: string,
): Promise<PilotBackupDryRun> {
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      valid: false,
      message: "Backup exceeds the 25 MiB validation limit.",
      organisationMatches: false,
      localRecordCount: 0,
      operationCount: 0,
      mediaManifestCount: 0,
      blobsRecoverableFromFile: false,
    };
  }
  try {
    const parsed = importBackupSchema.parse(
      JSON.parse(await file.text()) as unknown,
    );
    const { checksumSha256, ...body } = parsed;
    const checksumMatches =
      (await sha256(JSON.stringify(body))) === checksumSha256;
    const organisationMatches =
      parsed.organisationId === expectedOrganisationId;
    const recordsAreIsolated =
      parsed.outbox.every(
        (operation) =>
          operation.envelope.organisationId === parsed.organisationId,
      ) &&
      parsed.mediaManifest.every(
        (media) => media.organisationId === parsed.organisationId,
      ) &&
      parsed.localStorage.every(({ key }) =>
        localStorageRecordBelongsToPilotContext(
          key,
          {
            organisationId: parsed.organisationId,
            operatorId: parsed.operatorId,
          },
          extractOrganisationScopedHoles(
            parsed.localStorage,
            parsed.organisationId,
          ),
        ),
      );
    return {
      valid: checksumMatches && organisationMatches && recordsAreIsolated,
      message: !checksumMatches
        ? "Checksum mismatch: the backup is damaged or modified."
        : !organisationMatches
          ? "The backup belongs to another organisation."
          : !recordsAreIsolated
            ? "The backup contains mixed-organisation records and was rejected."
          : "Dry-run passed. Metadata is structurally recoverable; media blobs are not contained in this file.",
      organisationMatches,
      localRecordCount: parsed.localStorage.length,
      operationCount: parsed.outbox.length,
      mediaManifestCount: parsed.mediaManifest.length,
      blobsRecoverableFromFile: false,
    };
  } catch {
    return {
      valid: false,
      message: "The selected file is not a compatible TargetLock pilot backup.",
      organisationMatches: false,
      localRecordCount: 0,
      operationCount: 0,
      mediaManifestCount: 0,
      blobsRecoverableFromFile: false,
    };
  }
}

export async function getBrowserStorageEstimate(): Promise<{
  readonly usage: number | null;
  readonly quota: number | null;
  readonly percentUsed: number | null;
}> {
  if (!navigator.storage?.estimate) {
    return { usage: null, quota: null, percentUsed: null };
  }
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage ?? null;
  const quota = estimate.quota ?? null;
  return {
    usage,
    quota,
    percentUsed:
      usage !== null && quota !== null && quota > 0
        ? Math.round((usage / quota) * 1_000) / 10
        : null,
  };
}
