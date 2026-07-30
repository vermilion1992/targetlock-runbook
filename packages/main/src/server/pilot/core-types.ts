import { z } from "zod";

import { jsonValueSchema, type JsonValue } from "./types";

export const CORE_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export const coreEntityKindSchema = z.enum([
  "PROJECT",
  "RIG",
  "HOLE",
  "HOLE_CONFIGURATION",
  "BHA_SETUP",
  "SHIFT",
  "HANDOVER",
  "RUN",
  "ROD_EVENT",
  "RUN_CORRECTION",
  "COMPLETION_REVIEW",
  "COMPLETION_RECORD",
  "REOPEN_RECORD",
]);
export type CoreEntityKind = z.infer<typeof coreEntityKindSchema>;

export const coreJsonObjectSchema = z.record(jsonValueSchema);

export interface CoreProjection {
  readonly kind: CoreEntityKind;
  readonly localId: string;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly holeRef: string | null;
  readonly version: number;
  readonly lifecycleStatus: string;
  readonly clientCreatedAt: string | null;
  readonly clientUpdatedAt: string;
  readonly actorNameSnapshot: string | null;
  readonly sourceActorUserId?: string;
  readonly configurationKind?: CoreConfigurationKind;
  readonly state: Readonly<Record<string, JsonValue>>;
}

export type CoreConfigurationKind =
  | "COORDINATE"
  | "REFERENCE"
  | "PLAN"
  | "TARGET"
  | "ACTUAL"
  | "SURVEY_SELECTION";

export interface CoreOperationPlan {
  readonly semantics: "AUTHORITATIVE_CORE";
  readonly aggregateType: "PROJECT_DIRECTORY" | "HOLE";
  readonly aggregateRef: string;
  readonly revisionVersion: number | null;
  readonly projections: readonly CoreProjection[];
}

export interface CoreMaterializationOutcome {
  readonly status: "MATERIALIZED" | "CONFLICT";
  readonly reasonCode: string | null;
  readonly aggregateVersion: number | null;
  readonly cursor: string | null;
}

export const coreDirectoryProjectSchema = z
  .object({
    serverId: z.string().uuid(),
    localId: z.string().min(1).max(200),
    version: z.number().int().positive(),
    state: coreJsonObjectSchema,
  })
  .strict();

export const coreDirectoryRigSchema = z
  .object({
    serverId: z.string().uuid(),
    localId: z.string().min(1).max(200),
    projectLocalId: z.string().min(1).max(200),
    version: z.number().int().positive(),
    state: coreJsonObjectSchema,
  })
  .strict();

export const coreDirectoryHoleSchema = z
  .object({
    serverId: z.string().uuid(),
    localId: z.string().min(1).max(200),
    projectLocalId: z.string().min(1).max(200),
    rigLocalId: z.string().min(1).max(200),
    version: z.number().int().positive(),
    state: coreJsonObjectSchema,
    lastCursor: z.string().regex(/^\d+$/).nullable(),
  })
  .strict();

export const coreDirectorySnapshotSchema = z
  .object({
    schemaVersion: z.literal(CORE_SNAPSHOT_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    organisationId: z.string().uuid(),
    assignment: z
      .object({
        projectRef: z.string().nullable(),
        rigRef: z.string().nullable(),
      })
      .strict(),
    source: z.literal("AUTHORITATIVE_SERVER"),
    projects: z.array(coreDirectoryProjectSchema).max(250),
    rigs: z.array(coreDirectoryRigSchema).max(500),
    holes: z.array(coreDirectoryHoleSchema).max(1_000),
    cursor: z.string().regex(/^\d+$/),
  })
  .strict();
export type CoreDirectorySnapshot = z.infer<
  typeof coreDirectorySnapshotSchema
>;

const coreSnapshotRecordSchema = z
  .object({
    serverId: z.string().uuid(),
    localId: z.string().min(1).max(240),
    version: z.number().int().positive(),
    state: coreJsonObjectSchema,
  })
  .strict();

export const coreHoleSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CORE_SNAPSHOT_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    organisationId: z.string().uuid(),
    source: z.literal("AUTHORITATIVE_SERVER"),
    cursor: z.string().regex(/^\d+$/),
    aggregateRevision: z.number().int().positive(),
    project: coreDirectoryProjectSchema,
    rig: coreDirectoryRigSchema,
    hole: coreDirectoryHoleSchema,
    configurations: z.array(
      coreSnapshotRecordSchema.extend({
        kind: z.enum([
          "COORDINATE",
          "REFERENCE",
          "PLAN",
          "TARGET",
          "ACTUAL",
          "SURVEY_SELECTION",
        ]),
      }),
    ),
    bhaSetups: z.array(coreSnapshotRecordSchema),
    shifts: z.array(coreSnapshotRecordSchema),
    handovers: z.array(coreSnapshotRecordSchema),
    runs: z.array(coreSnapshotRecordSchema),
    rodEvents: z.array(
      coreSnapshotRecordSchema.extend({
        runLocalId: z.string().min(1),
      }),
    ),
    runCorrections: z.array(
      coreSnapshotRecordSchema.extend({
        runLocalId: z.string().min(1),
      }),
    ),
    completionReviews: z.array(coreSnapshotRecordSchema),
    completionRecords: z.array(coreSnapshotRecordSchema),
    reopenRecords: z.array(coreSnapshotRecordSchema),
    media: z
      .array(
        z
          .object({
            storageKey: z.string().min(1),
            checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
            uploadStatus: z.literal("LOCAL_ONLY_NOT_UPLOADED"),
            metadata: coreJsonObjectSchema,
          })
          .strict(),
      )
      .max(2_000),
  })
  .strict();
export type CoreHoleSnapshot = z.infer<typeof coreHoleSnapshotSchema>;

export const coreChangeSchema = z
  .object({
    cursor: z.string().regex(/^\d+$/),
    operationId: z.string().uuid(),
    aggregateType: z.enum(["PROJECT_DIRECTORY", "HOLE"]),
    aggregateRef: z.string().min(1).max(240),
    aggregateVersion: z.number().int().positive(),
    holeRef: z.string().nullable(),
    operationType: z.string().min(1),
    entityKinds: z.array(coreEntityKindSchema),
    serverReceivedAt: z.string().datetime(),
    clientTime: z.string().datetime(),
  })
  .strict();

export const coreChangesPageSchema = z
  .object({
    schemaVersion: z.literal(CORE_SNAPSHOT_SCHEMA_VERSION),
    changes: z.array(coreChangeSchema).max(100),
    nextCursor: z.string().regex(/^\d+$/),
    hasMore: z.boolean(),
  })
  .strict();
export type CoreChangesPage = z.infer<typeof coreChangesPageSchema>;

export const coreConflictDetailsSchema = z
  .object({
    operationId: z.string().uuid(),
    operationType: z.string(),
    aggregateRef: z.string().nullable(),
    projectRef: z.string().nullable(),
    rigRef: z.string().nullable(),
    holeRef: z.string().nullable(),
    revisionRef: z.string().nullable(),
    expectedVersion: z.number().int().nonnegative().nullable(),
    currentVersion: z.number().int().nonnegative().nullable(),
    reasonCode: z.string().nullable(),
    serverReceivedAt: z.string().datetime(),
    pendingPayload: coreJsonObjectSchema,
  })
  .strict();
export type CoreConflictDetails = z.infer<
  typeof coreConflictDetailsSchema
>;

export const coreChangesQuerySchema = z
  .object({
    cursor: z.string().regex(/^\d+$/).default("0"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    holeRef: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const coreRestoreAuditInputSchema = z
  .object({
    phase: z.enum(["PREPARE", "COMMIT"]),
    restoreId: z.string().uuid(),
    reason: z.string().trim().min(10).max(500),
    holeRefs: z.array(z.string().trim().min(1).max(120)).max(50),
    snapshotCursor: z.string().regex(/^\d+$/),
    dryRunRecordCount: z.number().int().nonnegative().max(100_000),
  })
  .strict();
