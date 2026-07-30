import { compare, hash } from "bcryptjs";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

import { requirePilotPermission } from "./permissions";
import {
  canonicalPilotOperationType,
  derivePilotRevisionRef,
  pilotRepositoryMethodDefinition,
} from "@/domain/pilot-operation-manifest";
import {
  CoreOperationValidationError,
  planCoreOperation,
} from "./core-materialization";
import {
  coreChangesQuerySchema,
  coreRestoreAuditInputSchema,
  type CoreChangesPage,
  type CoreConfigurationKind,
  type CoreConflictDetails,
  type CoreDirectorySnapshot,
  type CoreHoleSnapshot,
} from "./core-types";
import type {
  AuditRecord,
  CoreResourceScope,
  PilotRepository,
} from "./repository";
import {
  acquireLeaseInputSchema,
  assignDeviceInputSchema,
  changePasswordInputSchema,
  loginInputSchema,
  provisionUserInputSchema,
  registerDeviceInputSchema,
  removeCurrentDeviceInputSchema,
  setDeviceStatusInputSchema,
  setUserStatusInputSchema,
  syncOperationEnvelopeSchema,
  supervisorReleaseLeaseInputSchema,
  takeoverLeaseInputSchema,
  workLeaseTargetSchema,
  type AcquireLeaseInput,
  type LoginInput,
  type OperationReceipt,
  type PilotDevice,
  type PilotPermission,
  type PilotPrincipal,
  type PilotRequestContext,
  type ProvisionUserInput,
  type RegisterDeviceInput,
  type SyncOperationEnvelope,
  type TakeoverLeaseInput,
  type WorkLease,
  type WorkLeaseTarget,
} from "./types";

const DUMMY_PASSWORD_HASH =
  "$2b$12$eImiTXuWVxfM37uY4JANjQeEFcHBrV6oKQ7vW3zGQJpXl4nYB1Mqe";

const INITIAL_CONFIGURATION_KIND: Readonly<
  Record<string, CoreConfigurationKind>
> = {
  "trajectory.saveCoordinateConfiguration": "COORDINATE",
  "trajectory.saveReferenceConfiguration": "REFERENCE",
  "trajectory.saveTarget": "TARGET",
  "trajectory.saveActualConfiguration": "ACTUAL",
};

export class PilotAuthenticationError extends Error {
  constructor() {
    super("The organisation, email, or password is incorrect.");
    this.name = "PilotAuthenticationError";
  }
}

export class PilotDeviceRequiredError extends Error {
  constructor() {
    super("This action requires an active registered pilot device.");
    this.name = "PilotDeviceRequiredError";
  }
}

export class PilotPasswordChangeRequiredError extends Error {
  constructor() {
    super("Change the temporary password before using pilot operations.");
    this.name = "PilotPasswordChangeRequiredError";
  }
}

export class PilotConflictError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly lease?: WorkLease,
  ) {
    super(message);
    this.name = "PilotConflictError";
  }
}

export interface LoginResult {
  readonly token: string;
  readonly principal: PilotPrincipal;
}

export interface DeviceRegistrationResult {
  readonly token: string;
  readonly device: PilotDevice;
}

export interface ServiceOptions {
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
  readonly now?: () => Date;
  readonly token?: () => string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-AU");
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

export class PilotFoundationService {
  private readonly now: () => Date;
  private readonly token: () => string;

  constructor(
    private readonly repository: PilotRepository,
    private readonly options: ServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.token =
      options.token ?? (() => randomBytes(32).toString("base64url"));
  }

  hashSecret(value: string): string {
    return createHmac("sha256", this.options.sessionSecret)
      .update(value)
      .digest("hex");
  }

  private async mutateWithMandatoryAudit<T>(
    mutation: () => Promise<T>,
    audit: (result: T) => AuditRecord,
  ): Promise<T> {
    return this.repository.atomic(async () => {
      const result = await mutation();
      await this.repository.writeAudit(audit(result));
      return result;
    });
  }

  async login(
    input: LoginInput,
    metadata: { readonly ipAddress?: string; readonly userAgent?: string },
  ): Promise<LoginResult> {
    const parsed = loginInputSchema.parse(input);
    const identity = await this.repository.findLoginIdentity(
      parsed.organisation.toLocaleLowerCase("en-AU"),
      normalizeEmail(parsed.email),
    );
    const passwordMatches = await compare(
      parsed.password,
      identity?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (
      identity === null ||
      !passwordMatches ||
      identity.organisationStatus !== "ACTIVE" ||
      identity.userStatus !== "ACTIVE" ||
      identity.membershipStatus !== "ACTIVE"
    ) {
      throw new PilotAuthenticationError();
    }

    const now = this.now();
    const expiresAt = addSeconds(
      now,
      this.options.sessionTtlSeconds,
    ).toISOString();
    const token = this.token();
    const sessionId = await this.repository.createSession({
      organisationId: identity.organisationId,
      userId: identity.userId,
      tokenHash: this.hashSecret(token),
      sessionVersionAtIssue: identity.sessionVersion,
      expiresAt,
      ipHash: metadata.ipAddress
        ? this.hashSecret(metadata.ipAddress)
        : null,
      userAgent: metadata.userAgent?.slice(0, 500) ?? null,
    });

    return {
      token,
      principal: {
        organisationId: identity.organisationId,
        organisationName: identity.organisationName,
        userId: identity.userId,
        email: identity.email,
        displayName: identity.displayName,
        role: identity.role,
        mustChangePassword: identity.mustChangePassword,
        sessionId,
        sessionExpiresAt: expiresAt,
      },
    };
  }

  async resolvePrincipal(token: string | null): Promise<PilotPrincipal | null> {
    if (!token) return null;
    const identity = await this.repository.findSessionIdentity(
      this.hashSecret(token),
    );
    if (
      identity === null ||
      identity.sessionRevokedAt !== null ||
      Date.parse(identity.sessionExpiresAt) <= this.now().getTime() ||
      identity.organisationStatus !== "ACTIVE" ||
      identity.userStatus !== "ACTIVE" ||
      identity.membershipStatus !== "ACTIVE" ||
      identity.sessionVersionAtIssue !== identity.sessionVersion
    ) {
      return null;
    }
    return {
      organisationId: identity.organisationId,
      organisationName: identity.organisationName,
      userId: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
      role: identity.role,
      mustChangePassword: identity.mustChangePassword,
      sessionId: identity.sessionId,
      sessionExpiresAt: identity.sessionExpiresAt,
    };
  }

  async logout(principal: PilotPrincipal): Promise<void> {
    await this.repository.revokeSession(
      principal.sessionId,
      this.now().toISOString(),
    );
  }

  async resolveDevice(
    principal: PilotPrincipal,
    token: string | null,
  ): Promise<PilotDevice | null> {
    if (!token) return null;
    const device = await this.repository.findDevice(this.hashSecret(token));
    if (
      device === null ||
      device.organisationId !== principal.organisationId ||
      device.status !== "ACTIVE"
    ) {
      return null;
    }
    await this.repository.touchDevice(
      principal.organisationId,
      device.id,
      this.now().toISOString(),
    );
    return device;
  }

  async registerDevice(
    principal: PilotPrincipal,
    input: RegisterDeviceInput,
  ): Promise<DeviceRegistrationResult> {
    requirePilotPermission(principal, "REGISTER_DEVICE");
    const parsed = registerDeviceInputSchema.parse(input);
    const token = this.token();
    const device = await this.mutateWithMandatoryAudit(
      () =>
        this.repository.createDevice({
          organisationId: principal.organisationId,
          displayName: parsed.displayName,
          tokenHash: this.hashSecret(token),
          siteName: parsed.siteName ?? null,
          projectRef: parsed.projectRef ?? null,
          rigRef: parsed.rigRef ?? null,
          registeredByUserId: principal.userId,
        }),
      (created) => ({
        organisationId: principal.organisationId,
        actorUserId: principal.userId,
        actorDeviceId: created.id,
        action: "DEVICE_REGISTERED",
        targetType: "DEVICE",
        targetId: created.id,
        reason: null,
        metadata: {
          displayName: created.displayName,
          projectRef: created.projectRef,
          rigRef: created.rigRef,
        },
      }),
    );
    return { token, device };
  }

  async provisionUser(
    principal: PilotPrincipal,
    input: ProvisionUserInput,
  ) {
    requirePilotPermission(principal, "PROVISION_USER");
    const parsed = provisionUserInputSchema.parse(input);
    const passwordHash = await hash(parsed.temporaryPassword, 12);
    return this.mutateWithMandatoryAudit(
      () =>
        this.repository.provisionUser({
          organisationId: principal.organisationId,
          email: normalizeEmail(parsed.email),
          displayName: parsed.displayName,
          passwordHash,
          role: parsed.role,
        }),
      (user) => ({
        organisationId: principal.organisationId,
        actorUserId: principal.userId,
        actorDeviceId: null,
        action: "USER_PROVISIONED",
        targetType: "USER",
        targetId: user.id,
        reason: null,
        metadata: { role: user.role },
      }),
    );
  }

  async setUserStatus(
    principal: PilotPrincipal,
    input: {
      readonly userId: string;
      readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
      readonly reason: string;
    },
  ): Promise<void> {
    requirePilotPermission(principal, "PROVISION_USER");
    const parsed = setUserStatusInputSchema.parse(input);
    if (parsed.userId === principal.userId && parsed.status !== "ACTIVE") {
      throw new PilotConflictError(
        "A company administrator cannot disable their current account.",
        "CANNOT_DISABLE_CURRENT_ADMIN",
      );
    }
    await this.repository.atomic(async () => {
      const changed = await this.repository.setUserStatus(
        principal.organisationId,
        parsed.userId,
        parsed.status,
      );
      if (!changed) {
        throw new PilotConflictError(
          "The user was not found in this organisation.",
          "USER_NOT_FOUND",
        );
      }
      await this.repository.writeAudit({
        organisationId: principal.organisationId,
        actorUserId: principal.userId,
        actorDeviceId: null,
        action: "USER_STATUS_CHANGED",
        targetType: "USER",
        targetId: parsed.userId,
        reason: parsed.reason,
        metadata: { status: parsed.status },
      });
    });
  }

  async assignDevice(
    context: PilotRequestContext,
    input: {
      readonly deviceId: string;
      readonly siteName: string | null;
      readonly projectRef: string | null;
      readonly rigRef: string | null;
      readonly reason: string;
    },
  ): Promise<PilotDevice> {
    requirePilotPermission(context.principal, "ASSIGN_DEVICE");
    const parsed = assignDeviceInputSchema.parse(input);
    return this.mutateWithMandatoryAudit(
      async () => {
        const device = await this.repository.assignDevice(
          context.principal.organisationId,
          parsed.deviceId,
          {
            siteName: parsed.siteName,
            projectRef: parsed.projectRef,
            rigRef: parsed.rigRef,
          },
        );
        if (device === null) {
          throw new PilotConflictError(
            "The device was not found in this organisation.",
            "DEVICE_NOT_FOUND",
          );
        }
        return device;
      },
      (device) => ({
        organisationId: context.principal.organisationId,
        actorUserId: context.principal.userId,
        actorDeviceId: context.device?.id ?? null,
        action: "DEVICE_ASSIGNED",
        targetType: "DEVICE",
        targetId: device.id,
        reason: parsed.reason,
        metadata: {
          siteName: device.siteName,
          projectRef: device.projectRef,
          rigRef: device.rigRef,
        },
      }),
    );
  }

  async setDeviceStatus(
    context: PilotRequestContext,
    input: {
      readonly deviceId: string;
      readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
      readonly reason: string;
    },
  ): Promise<PilotDevice> {
    requirePilotPermission(context.principal, "ASSIGN_DEVICE");
    const parsed = setDeviceStatusInputSchema.parse(input);
    return this.mutateWithMandatoryAudit(
      async () => {
        const device = await this.repository.setDeviceStatus(
          context.principal.organisationId,
          parsed.deviceId,
          parsed.status,
          this.now().toISOString(),
          parsed.status === "REVOKED"
            ? {
                actorUserId: context.principal.userId,
                reason: parsed.reason,
              }
            : undefined,
        );
        if (device === null) {
          throw new PilotConflictError(
            "The device was not found in this organisation.",
            "DEVICE_NOT_FOUND",
          );
        }
        return device;
      },
      (device) => ({
        organisationId: context.principal.organisationId,
        actorUserId: context.principal.userId,
        actorDeviceId: context.device?.id ?? null,
        action: "DEVICE_STATUS_CHANGED",
        targetType: "DEVICE",
        targetId: device.id,
        reason: parsed.reason,
        metadata: { status: parsed.status },
      }),
    );
  }

  async removeCurrentDevice(
    context: PilotRequestContext,
    input: { readonly reason: string },
  ): Promise<PilotDevice> {
    const device = this.requireDevice(context);
    const parsed = removeCurrentDeviceInputSchema.parse(input);
    return this.mutateWithMandatoryAudit(
      async () => {
        const removed = await this.repository.setDeviceStatus(
          context.principal.organisationId,
          device.id,
          "REVOKED",
          this.now().toISOString(),
          {
            actorUserId: context.principal.userId,
            reason: parsed.reason,
          },
        );
        if (removed === null) {
          throw new PilotConflictError(
            "This device is no longer registered.",
            "DEVICE_NOT_FOUND",
          );
        }
        return removed;
      },
      () => ({
        organisationId: context.principal.organisationId,
        actorUserId: context.principal.userId,
        actorDeviceId: device.id,
        action: "CURRENT_DEVICE_REMOVED",
        targetType: "DEVICE",
        targetId: device.id,
        reason: parsed.reason,
        metadata: { displayName: device.displayName },
      }),
    );
  }

  async changePassword(
    principal: PilotPrincipal,
    input: {
      readonly currentPassword: string;
      readonly newPassword: string;
    },
  ): Promise<void> {
    const parsed = changePasswordInputSchema.parse(input);
    const security = await this.repository.findPasswordSecurity(
      principal.organisationId,
      principal.userId,
    );
    const matches = await compare(
      parsed.currentPassword,
      security?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (security === null || !matches) throw new PilotAuthenticationError();
    const changedAt = this.now().toISOString();
    const passwordHash = await hash(parsed.newPassword, 12);
    await this.repository.atomic(async () => {
      const changed = await this.repository.changePassword(
        principal.organisationId,
        principal.userId,
        passwordHash,
        changedAt,
      );
      if (!changed) throw new PilotAuthenticationError();
      await this.repository.revokeAllUserSessions(
        principal.organisationId,
        principal.userId,
        changedAt,
      );
      await this.repository.writeAudit({
        organisationId: principal.organisationId,
        actorUserId: principal.userId,
        actorDeviceId: null,
        action: "PASSWORD_CHANGED",
        targetType: "USER",
        targetId: principal.userId,
        reason: null,
        metadata: { priorSessionsRevoked: true },
      });
    });
  }

  async getAdminOverview(principal: PilotPrincipal) {
    requirePilotPermission(principal, "VIEW_PILOT_ADMIN");
    const now = this.now().toISOString();
    const [users, devices, leases] = await Promise.all([
      this.repository.listUsers(principal.organisationId),
      this.repository.listDevices(principal.organisationId),
      this.repository.listActiveLeases(principal.organisationId, now),
    ]);
    return { users, devices, leases, generatedAt: now };
  }

  async acquireLease(
    context: PilotRequestContext,
    input: AcquireLeaseInput,
  ): Promise<WorkLease> {
    requirePilotPermission(context.principal, "LEASE_WRITE");
    const device = this.requireDevice(context);
    const parsed = acquireLeaseInputSchema.parse(input);
    const now = this.now();
    const requestedHoleRef = parsed.holeRef ?? parsed.resourceRef;
    const existingHoleScope =
      parsed.resourceType === "HOLE"
        ? await this.repository.resolveCoreScope(
            context.principal.organisationId,
            { holeRef: requestedHoleRef },
          )
        : null;
    const isAssignedDraftLease =
      parsed.resourceType === "HOLE" &&
      existingHoleScope === null &&
      parsed.shiftRef == null &&
      parsed.projectRef != null &&
      parsed.projectRef === device.projectRef &&
      device.rigRef != null;
    const overrideAudit = await this.authorizeDeviceScope(
      context,
      {
        projectRef: parsed.projectRef,
        rigRef: isAssignedDraftLease ? device.rigRef : undefined,
        holeRef: requestedHoleRef,
        shiftRef: parsed.shiftRef,
        allowMissingHole: isAssignedDraftLease,
      },
      "LEASE_ACQUIRE",
    );
    const result = await this.repository.atomic(async () => {
      const acquired = await this.repository.acquireLease(
        context.principal.organisationId,
        device.id,
        context.principal.userId,
        parsed,
        addSeconds(now, parsed.ttlSeconds).toISOString(),
        now.toISOString(),
      );
      if (overrideAudit) await this.repository.writeAudit(overrideAudit);
      return acquired;
    });
    if (result.status === "OWNED") {
      throw new PilotConflictError(
        "Another registered device owns the active work lease.",
        "LEASE_OWNED_BY_ANOTHER_DEVICE",
        result.lease,
      );
    }
    return result.lease;
  }

  async getLeaseStatus(
    context: PilotRequestContext,
    target: WorkLeaseTarget,
  ): Promise<{
    readonly state: "AVAILABLE" | "OWNED_BY_THIS_DEVICE" | "READ_ONLY";
    readonly lease: WorkLease | null;
  }> {
    const parsed = workLeaseTargetSchema.parse(target);
    const lease = await this.repository.findLease(
      context.principal.organisationId,
      parsed,
      this.now().toISOString(),
    );
    if (lease === null) return { state: "AVAILABLE", lease: null };
    return {
      state:
        context.device?.id === lease.primaryDeviceId
          ? "OWNED_BY_THIS_DEVICE"
          : "READ_ONLY",
      lease,
    };
  }

  async heartbeatLease(
    context: PilotRequestContext,
    leaseId: string,
    ttlSeconds = 300,
  ): Promise<WorkLease> {
    const device = this.requireDevice(context);
    const now = this.now();
    const lease = await this.repository.heartbeatLease(
      context.principal.organisationId,
      leaseId,
      device.id,
      addSeconds(now, Math.min(Math.max(ttlSeconds, 60), 900)).toISOString(),
      now.toISOString(),
    );
    if (lease === null) {
      throw new PilotConflictError(
        "The lease is missing, expired, or owned by another device.",
        "LEASE_NOT_WRITABLE",
      );
    }
    return lease;
  }

  async releaseLease(
    context: PilotRequestContext,
    leaseId: string,
  ): Promise<WorkLease> {
    const device = this.requireDevice(context);
    const lease = await this.repository.releaseLease(
      context.principal.organisationId,
      leaseId,
      device.id,
      this.now().toISOString(),
    );
    if (lease === null) {
      throw new PilotConflictError(
        "The active lease is not owned by this device.",
        "LEASE_NOT_OWNED",
      );
    }
    return lease;
  }

  async takeoverLease(
    context: PilotRequestContext,
    input: TakeoverLeaseInput,
  ): Promise<WorkLease> {
    requirePilotPermission(context.principal, "LEASE_TAKEOVER");
    const device = this.requireDevice(context);
    const parsed = takeoverLeaseInputSchema.parse(input);
    const now = this.now();
    return this.mutateWithMandatoryAudit(
      async () => {
        const lease = await this.repository.takeoverLease(
          context.principal.organisationId,
          parsed.leaseId,
          device.id,
          context.principal.userId,
          parsed.reason,
          addSeconds(now, parsed.ttlSeconds).toISOString(),
          now.toISOString(),
        );
        if (lease === null) {
          throw new PilotConflictError(
            "The lease is no longer active.",
            "LEASE_NOT_ACTIVE",
          );
        }
        return lease;
      },
      (lease) => ({
        organisationId: context.principal.organisationId,
        actorUserId: context.principal.userId,
        actorDeviceId: device.id,
        action: "LEASE_TAKEOVER",
        targetType: "WORK_LEASE",
        targetId: lease.id,
        reason: parsed.reason,
        metadata: { supersededLeaseId: parsed.leaseId },
      }),
    );
  }

  async supervisorReleaseLease(
    context: PilotRequestContext,
    input: { readonly leaseId: string; readonly reason: string },
  ): Promise<WorkLease> {
    requirePilotPermission(context.principal, "LEASE_TAKEOVER");
    const parsed = supervisorReleaseLeaseInputSchema.parse(input);
    return this.mutateWithMandatoryAudit(
      async () => {
        const lease = await this.repository.supervisorReleaseLease(
          context.principal.organisationId,
          parsed.leaseId,
          this.now().toISOString(),
          parsed.reason,
        );
        if (lease === null) {
          throw new PilotConflictError(
            "The lease is no longer active.",
            "LEASE_NOT_ACTIVE",
          );
        }
        return lease;
      },
      (lease) => ({
        organisationId: context.principal.organisationId,
        actorUserId: context.principal.userId,
        actorDeviceId: context.device?.id ?? null,
        action: "LEASE_SUPERVISOR_RELEASE",
        targetType: "WORK_LEASE",
        targetId: lease.id,
        reason: parsed.reason,
        metadata: { resourceRef: lease.resourceRef },
      }),
    );
  }

  async recordOperation(
    context: PilotRequestContext,
    envelope: SyncOperationEnvelope,
  ): Promise<OperationReceipt> {
    requirePilotPermission(context.principal, "SYNC_OPERATION");
    const device = this.requireDevice(context);
    const parsed = syncOperationEnvelopeSchema.parse(envelope);
    if (
      parsed.organisationId !== context.principal.organisationId ||
      parsed.deviceId !== device.id ||
      parsed.operatorId !== context.principal.userId
    ) {
      throw new PilotConflictError(
        "The operation identity does not match the authenticated context.",
        "OPERATION_CONTEXT_MISMATCH",
      );
    }
    const operationDefinition = pilotRepositoryMethodDefinition(
      parsed.payload.repository,
      parsed.payload.method,
    );
    const canonicalOperationType = canonicalPilotOperationType(
      parsed.payload.repository,
      parsed.payload.method,
    );
    if (operationDefinition?.kind !== "mutation" || !canonicalOperationType) {
      throw new PilotConflictError(
        "The operation payload does not identify a registered mutation.",
        "UNKNOWN_OPERATION",
      );
    }
    if (parsed.operationType !== canonicalOperationType) {
      throw new PilotConflictError(
        "The operation type does not match its validated payload.",
        "OPERATION_TYPE_MISMATCH",
      );
    }
    const revisionRef = derivePilotRevisionRef(
      parsed.payload.repository,
      parsed.payload.arguments,
    );
    if ((parsed.revisionRef ?? null) !== revisionRef) {
      throw new PilotConflictError(
        "The operation revision reference does not match its validated payload.",
        "REVISION_REF_MISMATCH",
      );
    }
    if (parsed.expectedVersion != null && revisionRef === null) {
      throw new PilotConflictError(
        "Versioned operations require a canonical revision reference.",
        "REVISION_REF_REQUIRED",
      );
    }
    if (operationDefinition.permission !== null) {
      requirePilotPermission(
        context.principal,
        operationDefinition.permission,
      );
    }
    const overrideAudit = await this.authorizeDeviceScope(
      context,
      {
        projectRef: parsed.projectRef,
        rigRef: parsed.rigRef,
        holeRef: parsed.holeRef,
        shiftRef: parsed.shiftRef,
        allowMissingHole:
          parsed.payload.repository === "completion" &&
          ["createHole", "activateDraftHole"].includes(parsed.payload.method),
      },
      "CORE_OPERATION_WRITE",
      operationDefinition.materializer === "PROJECT_DIRECTORY",
    );
    const calculatedPayloadHash = createHash("sha256")
      .update(JSON.stringify(parsed.payload))
      .digest("hex");
    if (calculatedPayloadHash !== parsed.payloadHash) {
      throw new PilotConflictError(
        "The operation payload hash does not match its validated payload.",
        "PAYLOAD_HASH_MISMATCH",
      );
    }
    const receivedAt = this.now();
    if (Date.parse(parsed.clientTime) > receivedAt.getTime() + 5 * 60 * 1_000) {
      throw new PilotConflictError(
        "The operation client timestamp is too far in the future.",
        "CLIENT_TIME_AHEAD",
      );
    }
    const envelopeHash = createHash("sha256")
      .update(JSON.stringify(parsed))
      .digest("hex");
    let corePlan;
    try {
      corePlan = planCoreOperation(parsed);
    } catch (error) {
      if (error instanceof CoreOperationValidationError) {
        throw new PilotConflictError(error.message, error.code);
      }
      throw error;
    }
    if (operationDefinition.materializer !== null && corePlan === null) {
      throw new PilotConflictError(
        "The registered authoritative operation has no server materializer.",
        "CORE_HANDLER_MISSING",
      );
    }
    return this.repository.atomic(async () => {
      await this.assertDrillerFieldSetupAllowed(
        context,
        parsed,
        operationDefinition.permission,
      );
      const receipt = await this.repository.recordOperation({
        envelope: parsed,
        envelopeHash,
        receivedAt: receivedAt.toISOString(),
        corePlan,
      });
      if (overrideAudit) await this.repository.writeAudit(overrideAudit);
      return receipt;
    });
  }

  async getCoreDirectory(
    context: PilotRequestContext,
  ): Promise<CoreDirectorySnapshot> {
    const device = this.requireDevice(context);
    if (
      context.principal.role === "DRILLER" &&
      device.projectRef === null &&
      device.rigRef === null
    ) {
      throw new PilotConflictError(
        "This Driller device has no authoritative project or rig assignment.",
        "DEVICE_ASSIGNMENT_REQUIRED",
      );
    }
    return this.repository.getCoreDirectory(
      context.principal.organisationId,
      {
        projectRef: device.projectRef,
        rigRef: device.rigRef,
        includeAvailable:
          context.principal.role === "COMPANY_ADMIN" ||
          context.principal.role === "SUPERVISOR",
      },
      this.now().toISOString(),
    );
  }

  async getCoreHoleSnapshot(
    context: PilotRequestContext,
    holeRef: string,
  ): Promise<CoreHoleSnapshot> {
    this.requireDevice(context);
    const normalized = z
      .string()
      .trim()
      .min(1)
      .max(120)
      .parse(holeRef);
    const snapshot = await this.repository.getCoreHoleSnapshot(
      context.principal.organisationId,
      normalized,
      this.now().toISOString(),
    );
    if (snapshot === null) {
      throw new PilotConflictError(
        "The requested authoritative hole was not found.",
        "CORE_HOLE_NOT_FOUND",
      );
    }
    await this.authorizeAndAuditDeviceScope(
      context,
      {
        projectRef: snapshot.project.localId,
        rigRef: snapshot.rig.localId,
        holeRef: snapshot.hole.localId,
      },
      "CORE_SNAPSHOT_READ",
    );
    return snapshot;
  }

  async listCoreChanges(
    context: PilotRequestContext,
    input: {
      readonly cursor?: string;
      readonly limit?: number;
      readonly holeRef?: string;
    },
  ): Promise<CoreChangesPage> {
    this.requireDevice(context);
    const parsed = coreChangesQuerySchema.parse(input);
    if (context.principal.role === "DRILLER" && !parsed.holeRef) {
      throw new PilotConflictError(
        "Driller change pulls must be scoped to an assigned hole.",
        "CORE_HOLE_SCOPE_REQUIRED",
      );
    }
    if (parsed.holeRef) {
      await this.getCoreHoleSnapshot(context, parsed.holeRef);
    }
    return this.repository.listCoreChanges(
      context.principal.organisationId,
      parsed,
    );
  }

  async getCoreConflictDetails(
    context: PilotRequestContext,
    operationId: string,
  ): Promise<CoreConflictDetails> {
    this.requireDevice(context);
    const parsedOperationId = z.string().uuid().parse(operationId);
    const details = await this.repository.getCoreConflictDetails(
      context.principal.organisationId,
      parsedOperationId,
    );
    if (details === null) {
      throw new PilotConflictError(
        "The requested conflict was not found.",
        "CORE_CONFLICT_NOT_FOUND",
      );
    }
    await this.authorizeAndAuditDeviceScope(
      context,
      {
        projectRef: details.projectRef,
        rigRef: details.rigRef,
        holeRef: details.holeRef,
      },
      "CORE_CONFLICT_READ",
      details.aggregateRef !== null && details.holeRef === null,
    );
    return details;
  }

  async recordCoreRestore(
    context: PilotRequestContext,
    input: unknown,
  ): Promise<void> {
    const device = this.requireDevice(context);
    const parsed = coreRestoreAuditInputSchema.parse(input);
    for (const holeRef of parsed.holeRefs) {
      await this.authorizeAndAuditDeviceScope(
        context,
        { holeRef },
        `CORE_RESTORE_${parsed.phase}`,
      );
    }
    const attempt = {
      organisationId: context.principal.organisationId,
      restoreId: parsed.restoreId,
      deviceId: device.id,
      actorUserId: context.principal.userId,
      reason: parsed.reason,
      holeRefs: parsed.holeRefs,
      snapshotCursor: parsed.snapshotCursor,
      dryRunRecordCount: parsed.dryRunRecordCount,
      occurredAt: this.now().toISOString(),
    };
    if (parsed.phase === "PREPARE") {
      await this.repository.prepareCoreRestore(attempt);
    } else {
      await this.repository.commitCoreRestore(attempt);
    }
  }

  private async authorizeAndAuditDeviceScope(
    context: PilotRequestContext,
    target: {
      readonly projectRef?: string | null;
      readonly rigRef?: string | null;
      readonly holeRef?: string | null;
      readonly shiftRef?: string | null;
      readonly allowMissingHole?: boolean;
    },
    action: string,
    allowUnmaterializedPrivileged = false,
  ): Promise<CoreResourceScope | null> {
    const audit = await this.authorizeDeviceScope(
      context,
      target,
      action,
      allowUnmaterializedPrivileged,
    );
    if (audit) await this.repository.writeAudit(audit);
    return this.repository.resolveCoreScope(
      context.principal.organisationId,
      target,
    );
  }

  private async assertDrillerFieldSetupAllowed(
    context: PilotRequestContext,
    envelope: SyncOperationEnvelope,
    permission: PilotPermission | null,
  ): Promise<void> {
    if (
      context.principal.role !== "DRILLER" ||
      (permission !== "CREATE_ASSIGNED_HOLE" &&
        permission !== "INITIALISE_ASSIGNED_HOLE" &&
        permission !== "START_ASSIGNED_HOLE")
    ) {
      return;
    }
    const holeRef = envelope.holeRef?.trim();
    if (!holeRef) {
      throw new PilotConflictError(
        "Assigned field setup requires a hole reference.",
        "ASSIGNED_HOLE_REQUIRED",
      );
    }
    if (permission === "CREATE_ASSIGNED_HOLE") {
      const result = envelope.payload.result;
      const planReferenceValue =
        result !== null &&
        typeof result === "object" &&
        !Array.isArray(result)
          ? (result as Readonly<Record<string, unknown>>).planReference
          : null;
      const planReference =
        typeof planReferenceValue === "string"
          ? planReferenceValue.trim()
          : "";
      if (planReference.length < 2) {
        throw new PilotConflictError(
          "A client plan or work-instruction reference is required when a Driller creates a hole.",
          "CLIENT_PLAN_REFERENCE_REQUIRED",
        );
      }
      return;
    }
    const state = await this.repository.getCoreHoleSetupState(
      context.principal.organisationId,
      holeRef,
    );
    if (state === null) {
      throw new PilotConflictError(
        "The assigned draft hole is not available on the authoritative server.",
        "ASSIGNED_HOLE_NOT_FOUND",
      );
    }
    if (
      state.lifecycleStatus !== "DRAFT" ||
      state.shiftCount > 0 ||
      state.runCount > 0
    ) {
      throw new PilotConflictError(
        "Drillers may only initialise an assigned Draft hole before its first shift or Run.",
        "INITIAL_FIELD_SETUP_CLOSED",
      );
    }
    if (permission === "START_ASSIGNED_HOLE") {
      if (state.bhaSetupCount === 0) {
        throw new PilotConflictError(
          "Record the initial BHA and constant stick-up before starting this hole.",
          "INITIAL_BHA_REQUIRED",
        );
      }
      return;
    }
    const operationKey = `${envelope.payload.repository}.${envelope.payload.method}`;
    if (operationKey === "bha-setups.save") {
      if (state.bhaSetupCount > 0) {
        throw new PilotConflictError(
          "The initial BHA is already recorded. A Supervisor must authorise later configuration changes.",
          "INITIAL_BHA_ALREADY_RECORDED",
        );
      }
      return;
    }
    const configurationKind = INITIAL_CONFIGURATION_KIND[operationKey];
    if (configurationKind === undefined) {
      throw new PilotConflictError(
        "This setup action remains Supervisor-only.",
        "INITIAL_FIELD_SETUP_ACTION_DENIED",
      );
    }
    if (state.configurationKinds.includes(configurationKind)) {
      throw new PilotConflictError(
        "This initial hole-plan configuration is already recorded. A Supervisor must authorise changes.",
        "INITIAL_CONFIGURATION_ALREADY_RECORDED",
      );
    }
  }

  private async authorizeDeviceScope(
    context: PilotRequestContext,
    target: {
      readonly projectRef?: string | null;
      readonly rigRef?: string | null;
      readonly holeRef?: string | null;
      readonly shiftRef?: string | null;
      readonly allowMissingHole?: boolean;
    },
    action: string,
    allowUnmaterializedPrivileged = false,
  ): Promise<AuditRecord | null> {
    const device = this.requireDevice(context);
    const scope = await this.repository.resolveCoreScope(
      context.principal.organisationId,
      target,
    );
    if (scope === null && !allowUnmaterializedPrivileged) {
      throw new PilotConflictError(
        "The requested project, rig, hole, or shift context is missing or relationally inconsistent.",
        "REFERENCE_CONTEXT_MISMATCH",
      );
    }
    const assignmentExists =
      device.projectRef !== null || device.rigRef !== null;
    const assignmentMatches =
      scope !== null &&
      (device.projectRef === null || scope.projectRef === device.projectRef) &&
      (device.rigRef === null || scope.rigRef === device.rigRef);
    if (context.principal.role === "DRILLER") {
      if (!assignmentExists || !assignmentMatches) {
        throw new PilotConflictError(
          "This Driller device is not assigned to the authoritative project and rig for this action.",
          "DEVICE_ASSIGNMENT_MISMATCH",
        );
      }
      return null;
    }
    if (assignmentMatches) return null;
    return {
      organisationId: context.principal.organisationId,
      actorUserId: context.principal.userId,
      actorDeviceId: device.id,
      action: "DEVICE_ASSIGNMENT_OVERRIDE",
      targetType: action,
      targetId: scope?.holeRef ?? scope?.rigRef ?? scope?.projectRef ?? null,
      reason:
        "Supervisor or Company admin override outside the registered device assignment.",
      metadata: {
        requestedAction: action,
        deviceProjectRef: device.projectRef,
        deviceRigRef: device.rigRef,
        targetProjectRef: scope?.projectRef ?? target.projectRef ?? null,
        targetRigRef: scope?.rigRef ?? target.rigRef ?? null,
        targetHoleRef: scope?.holeRef ?? target.holeRef ?? null,
        targetShiftRef: scope?.shiftRef ?? target.shiftRef ?? null,
      },
    };
  }

  private requireDevice(context: PilotRequestContext): PilotDevice {
    if (context.device === null) throw new PilotDeviceRequiredError();
    return context.device;
  }
}
