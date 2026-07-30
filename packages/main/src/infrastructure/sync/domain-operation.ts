import { z } from "zod";

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const leaseEvidenceSchema = z
  .object({
    state: z.enum(["PRIMARY_WRITER", "OFFLINE_GRACE", "NOT_REQUIRED"]),
    leaseId: z.string().uuid().nullable(),
    leaseVersion: z.number().int().positive().nullable(),
    lastVerifiedAt: z.string().datetime().nullable(),
    graceExpiresAt: z.string().datetime().nullable(),
  })
  .strict();
export type LeaseEvidence = z.infer<typeof leaseEvidenceSchema>;

export const domainOperationEnvelopeSchema = z
  .object({
    operationId: z.string().uuid(),
    schemaVersion: z.literal(1),
    organisationId: z.string().uuid(),
    deviceId: z.string().uuid(),
    operatorId: z.string().uuid(),
    operationType: z
      .string()
      .regex(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9]*\.v1$/),
    projectRef: z.string().min(1).max(120).nullable(),
    rigRef: z.string().min(1).max(120).nullable(),
    holeRef: z.string().min(1).max(120).nullable(),
    shiftRef: z.string().min(1).max(120).nullable(),
    expectedVersion: z.number().int().min(0).nullable(),
    revisionRef: z.string().min(3).max(260).nullable(),
    clientTime: z.string().datetime(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: z
      .object({
        repository: z.string().min(2).max(60),
        method: z.string().min(2).max(80),
        arguments: z.array(jsonValueSchema).max(20),
        clientMutationId: z.string().min(1).max(200).nullable(),
        result: jsonValueSchema.optional(),
      })
      .strict(),
    leaseEvidence: leaseEvidenceSchema.nullable(),
  })
  .strict();
export type DomainOperationEnvelope = z.infer<
  typeof domainOperationEnvelopeSchema
>;

export const outboxStateSchema = z.enum([
  "pending",
  "sending",
  "accepted",
  "conflict",
  "rejected",
  "failed",
  "quarantined",
]);
export type OutboxState = z.infer<typeof outboxStateSchema>;

export const outboxOperationSchema = z
  .object({
    operationId: z.string().uuid(),
    envelope: domainOperationEnvelopeSchema,
    state: outboxStateSchema,
    attempts: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    nextAttemptAt: z.string().datetime(),
    serverReceiptTime: z.string().datetime().nullable(),
    reasonCode: z.string().max(120).nullable(),
    lastError: z.string().max(500).nullable(),
  })
  .strict();
export type OutboxOperation = z.infer<typeof outboxOperationSchema>;

export interface OutboxSummary {
  readonly availability: "initializing" | "ready" | "unavailable";
  readonly pending: number;
  readonly sending: number;
  readonly accepted: number;
  readonly conflict: number;
  readonly rejected: number;
  readonly failed: number;
  readonly quarantined: number;
  readonly incomplete: number;
  readonly storageErrors: number;
  readonly unsynced: number;
  readonly lastAcceptedAt: string | null;
  readonly warning: string | null;
}

export function emptyOutboxSummary(
  availability: OutboxSummary["availability"] = "initializing",
): OutboxSummary {
  return {
    availability,
    pending: 0,
    sending: 0,
    accepted: 0,
    conflict: 0,
    rejected: 0,
    failed: 0,
    quarantined: 0,
    incomplete: 0,
    storageErrors: 0,
    unsynced: 0,
    lastAcceptedAt: null,
    warning: null,
  };
}
