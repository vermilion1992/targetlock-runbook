import { z } from "zod";

export const pilotRoleSchema = z.enum([
  "COMPANY_ADMIN",
  "SUPERVISOR",
  "DRILLER",
]);
export type PilotRole = z.infer<typeof pilotRoleSchema>;

export const pilotPermissionSchema = z.enum([
  "PROJECT_SETUP",
  "CREATE_ASSIGNED_HOLE",
  "INITIALISE_ASSIGNED_HOLE",
  "START_ASSIGNED_HOLE",
  "HOLE_SETUP",
  "HOLE_COMPLETE",
  "HOLE_REOPEN",
  "RECORD_CORRECTION",
  "VIEW_PILOT_ADMIN",
  "PROVISION_USER",
  "REGISTER_DEVICE",
  "ASSIGN_DEVICE",
  "LEASE_TAKEOVER",
  "LEASE_WRITE",
  "SYNC_OPERATION",
]);
export type PilotPermission = z.infer<typeof pilotPermissionSchema>;

export interface PilotPrincipal {
  readonly organisationId: string;
  readonly organisationName: string;
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: PilotRole;
  readonly mustChangePassword: boolean;
  readonly sessionId: string;
  readonly sessionExpiresAt: string;
}

export interface PilotDevice {
  readonly id: string;
  readonly organisationId: string;
  readonly displayName: string;
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly siteName: string | null;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly lastSeenAt: string | null;
}

export interface PilotRequestContext {
  readonly principal: PilotPrincipal;
  readonly device: PilotDevice | null;
}

export const loginInputSchema = z
  .object({
    organisation: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(320),
    password: z.string().min(10).max(200),
  })
  .strict();
export type LoginInput = z.infer<typeof loginInputSchema>;

export const registerDeviceInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    siteName: z.string().trim().min(1).max(120).nullable().optional(),
    projectRef: z.string().trim().min(1).max(120).nullable().optional(),
    rigRef: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .strict();
export type RegisterDeviceInput = z.infer<typeof registerDeviceInputSchema>;

export const provisionUserInputSchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().min(2).max(100),
    role: pilotRoleSchema,
    temporaryPassword: z.string().min(12).max(200),
  })
  .strict();
export type ProvisionUserInput = z.infer<typeof provisionUserInputSchema>;

export const accountStatusSchema = z.enum(["ACTIVE", "DISABLED", "REVOKED"]);

export const setUserStatusInputSchema = z
  .object({
    userId: z.string().uuid(),
    status: accountStatusSchema,
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const assignDeviceInputSchema = z
  .object({
    deviceId: z.string().uuid(),
    siteName: z.string().trim().min(1).max(120).nullable(),
    projectRef: z.string().trim().min(1).max(120).nullable(),
    rigRef: z.string().trim().min(1).max(120).nullable(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const setDeviceStatusInputSchema = z
  .object({
    deviceId: z.string().uuid(),
    status: z.enum(["ACTIVE", "DISABLED", "REVOKED"]),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const removeCurrentDeviceInputSchema = z
  .object({
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(10).max(200),
    newPassword: z.string().min(12).max(200),
  })
  .strict()
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "The new password must be different.",
    path: ["newPassword"],
  });

export const workResourceTypeSchema = z.enum(["HOLE", "SHIFT"]);
export type WorkResourceType = z.infer<typeof workResourceTypeSchema>;

export const workLeaseTargetSchema = z
  .object({
    resourceType: workResourceTypeSchema,
    resourceRef: z.string().trim().min(1).max(160),
    projectRef: z.string().trim().min(1).max(120).nullable().optional(),
    holeRef: z.string().trim().min(1).max(120).nullable().optional(),
    shiftRef: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .strict();
export type WorkLeaseTarget = z.infer<typeof workLeaseTargetSchema>;

export const acquireLeaseInputSchema = workLeaseTargetSchema.extend({
  ttlSeconds: z.number().int().min(60).max(900).default(300),
});
export type AcquireLeaseInput = z.infer<typeof acquireLeaseInputSchema>;

export const leaseIdInputSchema = z
  .object({
    leaseId: z.string().uuid(),
  })
  .strict();

export const takeoverLeaseInputSchema = leaseIdInputSchema.extend({
  reason: z.string().trim().min(10).max(500),
  ttlSeconds: z.number().int().min(60).max(900).default(300),
});
export type TakeoverLeaseInput = z.infer<typeof takeoverLeaseInputSchema>;

export const supervisorReleaseLeaseInputSchema = leaseIdInputSchema.extend({
  reason: z.string().trim().min(10).max(500),
});

export interface WorkLease {
  readonly id: string;
  readonly organisationId: string;
  readonly resourceType: WorkResourceType;
  readonly resourceRef: string;
  readonly projectRef: string | null;
  readonly holeRef: string | null;
  readonly shiftRef: string | null;
  readonly primaryDeviceId: string;
  readonly operatorUserId: string;
  readonly status: "ACTIVE" | "RELEASED" | "EXPIRED" | "TAKEN_OVER";
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly expiresAt: string;
  readonly offlineGraceIssuedAt: string;
  readonly offlineGraceExpiresAt: string;
  readonly completionGraceExpiresAt: string;
  readonly releasedAt: string | null;
  readonly takeoverReason: string | null;
  readonly version: number;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const domainOperationPayloadSchema = z
  .object({
    repository: z.string().trim().min(2).max(60),
    method: z.string().trim().min(2).max(80),
    arguments: z.array(jsonValueSchema).max(20),
    clientMutationId: z.string().trim().min(1).max(200).nullable(),
    result: jsonValueSchema.optional(),
  })
  .strict();

export const leaseEvidenceSchema = z
  .object({
    state: z.enum(["PRIMARY_WRITER", "OFFLINE_GRACE", "NOT_REQUIRED"]),
    leaseId: z.string().uuid().nullable(),
    leaseVersion: z.number().int().positive().nullable(),
    lastVerifiedAt: z.string().datetime().nullable(),
    graceExpiresAt: z.string().datetime().nullable(),
  })
  .strict();

export const syncOperationEnvelopeSchema = z
  .object({
    operationId: z.string().uuid(),
    schemaVersion: z.literal(1),
    organisationId: z.string().uuid(),
    deviceId: z.string().uuid(),
    operatorId: z.string().uuid(),
    operationType: z
      .string()
      .trim()
      .min(6)
      .max(140)
      .regex(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9]*\.v1$/),
    projectRef: z.string().trim().min(1).max(120).nullable().optional(),
    rigRef: z.string().trim().min(1).max(120).nullable().optional(),
    holeRef: z.string().trim().min(1).max(120).nullable().optional(),
    shiftRef: z.string().trim().min(1).max(120).nullable().optional(),
    expectedVersion: z.number().int().min(0).nullable().optional(),
    revisionRef: z.string().trim().min(3).max(260).nullable().optional(),
    clientTime: z.string().datetime(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: domainOperationPayloadSchema,
    leaseEvidence: leaseEvidenceSchema.nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const payloadBytes = Buffer.byteLength(JSON.stringify(input.payload), "utf8");
    if (payloadBytes > 262_144) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The operation payload exceeds 256 KiB.",
        path: ["payload"],
      });
    }
  });
export type SyncOperationEnvelope = z.infer<
  typeof syncOperationEnvelopeSchema
>;

export interface OperationReceipt {
  readonly operationId: string;
  readonly schemaVersion: number;
  readonly organisationId: string;
  readonly deviceId: string;
  readonly operatorId: string;
  readonly operationType: string;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly holeRef: string | null;
  readonly shiftRef: string | null;
  readonly expectedVersion: number | null;
  readonly revisionRef: string | null;
  readonly clientTime: string;
  readonly serverReceiptTime: string;
  readonly status: "ACCEPTED" | "CONFLICT" | "REJECTED";
  readonly reasonCode: string | null;
  readonly journalSemantics:
    | "AUDIT_BACKUP_ONLY"
    | "AUTHORITATIVE_CORE";
  readonly materializationStatus:
    | "JOURNAL_ONLY"
    | "MATERIALIZED"
    | "NOT_APPLIED";
  readonly aggregateType: "PROJECT_DIRECTORY" | "HOLE" | null;
  readonly aggregateRef: string | null;
  readonly aggregateVersion: number | null;
  readonly durableCursor: string | null;
}
