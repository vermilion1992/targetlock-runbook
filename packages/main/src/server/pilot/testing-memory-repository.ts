import { randomUUID } from "node:crypto";

import type {
  AuditRecord,
  CreateDeviceRecord,
  CreateSessionRecord,
  LeaseAcquireResult,
  LoginIdentity,
  PasswordSecurityRecord,
  PilotAdminDevice,
  PilotAdminUser,
  PilotRepository,
  CoreHoleSetupState,
  CoreResourceScope,
  CoreRestoreAttemptInput,
  ProvisionedUser,
  ProvisionUserRecord,
  RecordOperationInput,
  StoredSessionIdentity,
} from "./repository";
import type {
  CoreChangesPage,
  CoreConflictDetails,
  CoreDirectorySnapshot,
  CoreEntityKind,
  CoreHoleSnapshot,
  CoreProjection,
} from "./core-types";
import type {
  OperationReceipt,
  PilotDevice,
  WorkLease,
  WorkLeaseTarget,
  SyncOperationEnvelope,
} from "./types";

function leaseGrace(now: string) {
  const issuedAt = Date.parse(now);
  return {
    offlineGraceIssuedAt: now,
    offlineGraceExpiresAt: new Date(
      issuedAt + 30 * 60 * 1_000,
    ).toISOString(),
    completionGraceExpiresAt: new Date(
      issuedAt + 12 * 60 * 60 * 1_000,
    ).toISOString(),
  };
}

interface TestIdentity extends LoginIdentity {
  readonly organisationSlug: string;
}

export class InMemoryPilotRepository implements PilotRepository {
  readonly audits: AuditRecord[] = [];
  private readonly identities: TestIdentity[] = [];
  private readonly sessions = new Map<string, StoredSessionIdentity>();
  private readonly devices = new Map<string, PilotDevice>();
  private readonly leases = new Map<string, WorkLease>();
  private readonly receipts = new Map<
    string,
    {
      readonly hash: string;
      readonly receipt: OperationReceipt;
      readonly envelope: SyncOperationEnvelope;
    }
  >();
  private readonly holeVersions = new Map<string, number>();
  private readonly revisions = new Map<string, number>();
  private readonly coreProjections = new Map<
    string,
    { readonly serverId: string; readonly projection: CoreProjection }
  >();
  private readonly aggregateHeads = new Map<string, number>();
  private readonly restoreAttempts = new Map<
    string,
    CoreRestoreAttemptInput & { status: "PREPARED" | "COMMITTED" }
  >();
  private readonly coreChanges: CoreChangesPage["changes"][number][] = [];
  private coreCursor = 0;
  private failNextAuditWrite = false;

  failNextAudit(): void {
    this.failNextAuditWrite = true;
  }

  async atomic<T>(operation: () => Promise<T>): Promise<T> {
    const snapshot = structuredClone({
      audits: this.audits,
      identities: this.identities,
      sessions: [...this.sessions],
      devices: [...this.devices],
      leases: [...this.leases],
      receipts: [...this.receipts],
      holeVersions: [...this.holeVersions],
      revisions: [...this.revisions],
      coreProjections: [...this.coreProjections],
      aggregateHeads: [...this.aggregateHeads],
      restoreAttempts: [...this.restoreAttempts],
      coreChanges: this.coreChanges,
      coreCursor: this.coreCursor,
    });
    try {
      return await operation();
    } catch (error) {
      this.audits.splice(0, this.audits.length, ...snapshot.audits);
      this.identities.splice(
        0,
        this.identities.length,
        ...snapshot.identities,
      );
      const restoreMap = <K, V>(
        target: Map<K, V>,
        entries: readonly (readonly [K, V])[],
      ) => {
        target.clear();
        for (const [key, value] of entries) target.set(key, value);
      };
      restoreMap(this.sessions, snapshot.sessions);
      restoreMap(this.devices, snapshot.devices);
      restoreMap(this.leases, snapshot.leases);
      restoreMap(this.receipts, snapshot.receipts);
      restoreMap(this.holeVersions, snapshot.holeVersions);
      restoreMap(this.revisions, snapshot.revisions);
      restoreMap(this.coreProjections, snapshot.coreProjections);
      restoreMap(this.aggregateHeads, snapshot.aggregateHeads);
      restoreMap(this.restoreAttempts, snapshot.restoreAttempts);
      this.coreChanges.splice(
        0,
        this.coreChanges.length,
        ...snapshot.coreChanges,
      );
      this.coreCursor = snapshot.coreCursor;
      throw error;
    }
  }

  addIdentity(
    identity: Omit<TestIdentity, "mustChangePassword"> & {
      readonly mustChangePassword?: boolean;
    },
  ): void {
    this.identities.push({
      ...identity,
      mustChangePassword: identity.mustChangePassword ?? false,
    });
  }

  disableUser(userId: string): void {
    const index = this.identities.findIndex(
      (identity) => identity.userId === userId,
    );
    const current = this.identities[index];
    if (index >= 0 && current) {
      this.identities[index] = { ...current, userStatus: "DISABLED" };
      for (const [hash, session] of this.sessions) {
        if (session.userId === userId) {
          this.sessions.set(hash, { ...session, userStatus: "DISABLED" });
        }
      }
    }
  }

  setHoleVersion(
    organisationId: string,
    holeRef: string,
    version: number,
  ): void {
    this.holeVersions.set(`${organisationId}:${holeRef}`, version);
  }

  seedCoreScope(
    organisationId: string,
    projectRef: string,
    rigRef: string,
    holeRef: string,
    holeStatus = "ACTIVE",
  ): void {
    const updatedAt = new Date(0).toISOString();
    const add = (projection: CoreProjection) => {
      this.coreProjections.set(
        this.coreProjectionKey(organisationId, projection),
        { serverId: randomUUID(), projection },
      );
    };
    add({
      kind: "PROJECT",
      localId: projectRef,
      projectRef,
      rigRef: null,
      holeRef: null,
      version: 1,
      lifecycleStatus: "active",
      clientCreatedAt: updatedAt,
      clientUpdatedAt: updatedAt,
      actorNameSnapshot: null,
      state: { localId: projectRef, name: projectRef },
    });
    add({
      kind: "RIG",
      localId: rigRef,
      projectRef,
      rigRef,
      holeRef: null,
      version: 1,
      lifecycleStatus: "operating",
      clientCreatedAt: updatedAt,
      clientUpdatedAt: updatedAt,
      actorNameSnapshot: null,
      state: { localId: rigRef, projectId: projectRef, name: rigRef },
    });
    add({
      kind: "HOLE",
      localId: holeRef,
      projectRef,
      rigRef,
      holeRef,
      version: 1,
      lifecycleStatus: holeStatus,
      clientCreatedAt: updatedAt,
      clientUpdatedAt: updatedAt,
      actorNameSnapshot: null,
      state: {
        localId: holeRef,
        projectId: projectRef,
        rigId: rigRef,
        name: holeRef,
        status: holeStatus,
      },
    });
  }

  async findLoginIdentity(
    organisationSlug: string,
    email: string,
  ): Promise<LoginIdentity | null> {
    return (
      this.identities.find(
        (identity) =>
          identity.organisationSlug === organisationSlug &&
          identity.email === email,
      ) ?? null
    );
  }

  async createSession(record: CreateSessionRecord): Promise<string> {
    const identity = this.identities.find(
      (candidate) =>
        candidate.organisationId === record.organisationId &&
        candidate.userId === record.userId,
    );
    if (!identity) throw new Error("Unknown test identity.");
    const sessionId = randomUUID();
    this.sessions.set(record.tokenHash, {
      ...identity,
      sessionId,
      sessionExpiresAt: record.expiresAt,
      sessionRevokedAt: null,
      sessionVersionAtIssue: record.sessionVersionAtIssue,
    });
    return sessionId;
  }

  async findSessionIdentity(
    tokenHash: string,
  ): Promise<StoredSessionIdentity | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.sessionId === sessionId) {
        this.sessions.set(hash, {
          ...session,
          sessionRevokedAt: revokedAt,
        });
      }
    }
  }

  async findPasswordSecurity(
    organisationId: string,
    userId: string,
  ): Promise<PasswordSecurityRecord | null> {
    const identity = this.identities.find(
      (candidate) =>
        candidate.organisationId === organisationId &&
        candidate.userId === userId,
    );
    return identity
      ? {
          passwordHash: identity.passwordHash,
          sessionVersion: identity.sessionVersion,
        }
      : null;
  }

  async changePassword(
    organisationId: string,
    userId: string,
    passwordHash: string,
    changedAt: string,
  ): Promise<boolean> {
    void changedAt;
    const index = this.identities.findIndex(
      (candidate) =>
        candidate.organisationId === organisationId &&
        candidate.userId === userId,
    );
    const current = this.identities[index];
    if (index < 0 || !current) return false;
    this.identities[index] = {
      ...current,
      passwordHash,
      mustChangePassword: false,
      sessionVersion: current.sessionVersion + 1,
    };
    return true;
  }

  async revokeAllUserSessions(
    organisationId: string,
    userId: string,
    revokedAt: string,
  ): Promise<void> {
    for (const [tokenHash, session] of this.sessions) {
      if (
        session.organisationId === organisationId &&
        session.userId === userId
      ) {
        this.sessions.set(tokenHash, {
          ...session,
          sessionRevokedAt: revokedAt,
        });
      }
    }
  }

  async findDevice(tokenHash: string): Promise<PilotDevice | null> {
    return this.devices.get(tokenHash) ?? null;
  }

  async createDevice(record: CreateDeviceRecord): Promise<PilotDevice> {
    const device: PilotDevice = {
      id: randomUUID(),
      organisationId: record.organisationId,
      displayName: record.displayName,
      status: "ACTIVE",
      siteName: record.siteName,
      projectRef: record.projectRef,
      rigRef: record.rigRef,
      lastSeenAt: null,
    };
    this.devices.set(record.tokenHash, device);
    return device;
  }

  async touchDevice(
    organisationId: string,
    deviceId: string,
    seenAt: string,
  ): Promise<void> {
    for (const [hash, device] of this.devices) {
      if (
        device.organisationId === organisationId &&
        device.id === deviceId
      ) {
        this.devices.set(hash, { ...device, lastSeenAt: seenAt });
      }
    }
  }

  async provisionUser(
    record: ProvisionUserRecord,
  ): Promise<ProvisionedUser> {
    const organisation = this.identities.find(
      (identity) => identity.organisationId === record.organisationId,
    );
    if (!organisation) throw new Error("Unknown test organisation.");
    const user: ProvisionedUser = {
      id: randomUUID(),
      organisationId: record.organisationId,
      email: record.email,
      displayName: record.displayName,
      role: record.role,
      status: "ACTIVE",
    };
    this.addIdentity({
      organisationSlug: organisation.organisationSlug,
      organisationId: organisation.organisationId,
      organisationName: organisation.organisationName,
      organisationStatus: "ACTIVE",
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      passwordHash: record.passwordHash,
      userStatus: "ACTIVE",
      role: user.role,
      membershipStatus: "ACTIVE",
      sessionVersion: 1,
      mustChangePassword: true,
    });
    return user;
  }

  async setUserStatus(
    organisationId: string,
    userId: string,
    status: "ACTIVE" | "DISABLED" | "REVOKED",
  ): Promise<boolean> {
    const index = this.identities.findIndex(
      (identity) =>
        identity.organisationId === organisationId &&
        identity.userId === userId,
    );
    const current = this.identities[index];
    if (index < 0 || !current) return false;
    this.identities[index] = {
      ...current,
      userStatus: status,
      membershipStatus: status,
      sessionVersion: current.sessionVersion + 1,
    };
    for (const [hash, session] of this.sessions) {
      if (
        session.organisationId === organisationId &&
        session.userId === userId
      ) {
        this.sessions.set(hash, {
          ...session,
          userStatus: status,
          membershipStatus: status,
          sessionVersion: session.sessionVersion + 1,
        });
      }
    }
    return true;
  }

  async assignDevice(
    organisationId: string,
    deviceId: string,
    assignment: {
      readonly siteName: string | null;
      readonly projectRef: string | null;
      readonly rigRef: string | null;
    },
  ): Promise<PilotDevice | null> {
    for (const [hash, device] of this.devices) {
      if (
        device.organisationId === organisationId &&
        device.id === deviceId
      ) {
        const updated = { ...device, ...assignment };
        this.devices.set(hash, updated);
        return updated;
      }
    }
    return null;
  }

  async setDeviceStatus(
    organisationId: string,
    deviceId: string,
    status: "ACTIVE" | "DISABLED" | "REVOKED",
    changedAt: string,
    removal?: {
      readonly actorUserId: string;
      readonly reason: string;
    },
  ): Promise<PilotDevice | null> {
    void changedAt;
    void removal;
    for (const [hash, device] of this.devices) {
      if (
        device.organisationId === organisationId &&
        device.id === deviceId
      ) {
        const updated = { ...device, status };
        this.devices.set(hash, updated);
        return updated;
      }
    }
    return null;
  }

  async listUsers(organisationId: string): Promise<readonly PilotAdminUser[]> {
    return this.identities
      .filter((identity) => identity.organisationId === organisationId)
      .map((identity) => ({
        id: identity.userId,
        email: identity.email,
        displayName: identity.displayName,
        role: identity.role,
        status: identity.membershipStatus,
        mustChangePassword: identity.mustChangePassword,
        lastLoginAt: null,
      }));
  }

  async listDevices(
    organisationId: string,
  ): Promise<readonly PilotAdminDevice[]> {
    return [...this.devices.values()]
      .filter((device) => device.organisationId === organisationId)
      .map((device) => ({
        ...device,
        isPrimary: true,
        createdAt: new Date(0).toISOString(),
      }));
  }

  async listActiveLeases(
    organisationId: string,
    now: string,
  ): Promise<readonly WorkLease[]> {
    const leases: WorkLease[] = [];
    for (const lease of this.leases.values()) {
      const active = this.findActiveLease(
        organisationId,
        {
          resourceType: lease.resourceType,
          resourceRef: lease.resourceRef,
          projectRef: lease.projectRef,
          holeRef: lease.holeRef,
          shiftRef: lease.shiftRef,
        },
        now,
      );
      if (active?.id === lease.id) leases.push(active);
    }
    return leases;
  }

  async acquireLease(
    organisationId: string,
    deviceId: string,
    userId: string,
    target: WorkLeaseTarget,
    expiresAt: string,
    now: string,
  ): Promise<LeaseAcquireResult> {
    const current = this.findActiveLease(organisationId, target, now);
    if (current && current.primaryDeviceId !== deviceId) {
      return { status: "OWNED", lease: current };
    }
    const lease: WorkLease = current
      ? {
          ...current,
          operatorUserId: userId,
          heartbeatAt: now,
          expiresAt,
          ...leaseGrace(now),
          version: current.version + 1,
        }
      : {
          id: randomUUID(),
          organisationId,
          resourceType: target.resourceType,
          resourceRef: target.resourceRef,
          projectRef: target.projectRef ?? null,
          holeRef: target.holeRef ?? null,
          shiftRef: target.shiftRef ?? null,
          primaryDeviceId: deviceId,
          operatorUserId: userId,
          status: "ACTIVE",
          acquiredAt: now,
          heartbeatAt: now,
          expiresAt,
          ...leaseGrace(now),
          releasedAt: null,
          takeoverReason: null,
          version: 1,
        };
    this.leases.set(lease.id, lease);
    return { status: "ACQUIRED", lease };
  }

  async findLease(
    organisationId: string,
    target: WorkLeaseTarget,
    now: string,
  ): Promise<WorkLease | null> {
    return this.findActiveLease(organisationId, target, now);
  }

  async heartbeatLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    expiresAt: string,
    now: string,
  ): Promise<WorkLease | null> {
    const current = this.leases.get(leaseId);
    if (
      !current ||
      current.organisationId !== organisationId ||
      current.primaryDeviceId !== deviceId ||
      current.status !== "ACTIVE" ||
      Date.parse(current.expiresAt) <= Date.parse(now)
    ) {
      return null;
    }
    const updated = {
      ...current,
      heartbeatAt: now,
      expiresAt,
      ...leaseGrace(now),
      version: current.version + 1,
    };
    this.leases.set(leaseId, updated);
    return updated;
  }

  async releaseLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    releasedAt: string,
  ): Promise<WorkLease | null> {
    const current = this.leases.get(leaseId);
    if (
      !current ||
      current.organisationId !== organisationId ||
      current.primaryDeviceId !== deviceId ||
      current.status !== "ACTIVE"
    ) {
      return null;
    }
    const updated: WorkLease = {
      ...current,
      status: "RELEASED",
      releasedAt,
      version: current.version + 1,
    };
    this.leases.set(leaseId, updated);
    return updated;
  }

  async supervisorReleaseLease(
    organisationId: string,
    leaseId: string,
    releasedAt: string,
    reason: string,
  ): Promise<WorkLease | null> {
    const current = this.leases.get(leaseId);
    if (
      !current ||
      current.organisationId !== organisationId ||
      current.status !== "ACTIVE"
    ) {
      return null;
    }
    const updated: WorkLease = {
      ...current,
      status: "RELEASED",
      releasedAt,
      takeoverReason: reason,
      version: current.version + 1,
    };
    this.leases.set(leaseId, updated);
    return updated;
  }

  async takeoverLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    userId: string,
    reason: string,
    expiresAt: string,
    now: string,
  ): Promise<WorkLease | null> {
    const current = this.leases.get(leaseId);
    if (
      !current ||
      current.organisationId !== organisationId ||
      current.status !== "ACTIVE"
    ) {
      return null;
    }
    this.leases.set(leaseId, {
      ...current,
      status: "TAKEN_OVER",
      releasedAt: now,
      takeoverReason: reason,
    });
    const replacement: WorkLease = {
      ...current,
      id: randomUUID(),
      primaryDeviceId: deviceId,
      operatorUserId: userId,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt,
      ...leaseGrace(now),
      releasedAt: null,
      takeoverReason: reason,
      version: 1,
    };
    this.leases.set(replacement.id, replacement);
    return replacement;
  }

  async resolveCoreScope(
    organisationId: string,
    input: {
      readonly projectRef?: string | null;
      readonly rigRef?: string | null;
      readonly holeRef?: string | null;
      readonly shiftRef?: string | null;
      readonly allowMissingHole?: boolean;
    },
  ): Promise<CoreResourceScope | null> {
    const projections = this.organisationCoreProjections(organisationId).map(
      (entry) => entry.projection,
    );
    const hole = input.holeRef
      ? projections.find(
          (projection) =>
            projection.kind === "HOLE" &&
            projection.localId === input.holeRef,
        )
      : null;
    const shift = input.shiftRef
      ? projections.find(
          (projection) =>
            projection.kind === "SHIFT" &&
            projection.localId === input.shiftRef,
        )
      : null;
    if (input.shiftRef && (!shift || !shift.holeRef)) return null;
    if (
      hole &&
      shift &&
      (shift.holeRef !== hole.localId ||
        shift.projectRef !== hole.projectRef ||
        shift.rigRef !== hole.rigRef)
    ) {
      return null;
    }
    const effectiveHole =
      hole ??
      (shift?.holeRef
        ? projections.find(
            (projection) =>
              projection.kind === "HOLE" &&
              projection.localId === shift.holeRef,
          )
        : null);
    if (input.holeRef && !effectiveHole && !input.allowMissingHole) return null;
    const projectRef =
      effectiveHole?.projectRef ?? shift?.projectRef ?? input.projectRef ?? null;
    const rigRef =
      effectiveHole?.rigRef ?? shift?.rigRef ?? input.rigRef ?? null;
    if (!projectRef || !rigRef) return null;
    const project = projections.find(
      (projection) =>
        projection.kind === "PROJECT" && projection.localId === projectRef,
    );
    const rig = projections.find(
      (projection) =>
        projection.kind === "RIG" &&
        projection.localId === rigRef &&
        projection.projectRef === projectRef,
    );
    if (!project || !rig) return null;
    if (
      (input.projectRef && input.projectRef !== projectRef) ||
      (input.rigRef && input.rigRef !== rigRef) ||
      (input.holeRef &&
        effectiveHole &&
        effectiveHole.localId !== input.holeRef)
    ) {
      return null;
    }
    return {
      projectRef,
      rigRef,
      holeRef: effectiveHole?.localId ?? input.holeRef ?? null,
      shiftRef: shift?.localId ?? null,
    };
  }

  async getCoreHoleSetupState(
    organisationId: string,
    holeRef: string,
  ): Promise<CoreHoleSetupState | null> {
    const projections = this.organisationCoreProjections(organisationId).map(
      (entry) => entry.projection,
    );
    const hole = projections.find(
      (projection) =>
        projection.kind === "HOLE" && projection.localId === holeRef,
    );
    if (!hole) return null;
    const forHole = projections.filter(
      (projection) => projection.holeRef === holeRef,
    );
    return {
      lifecycleStatus: hole.lifecycleStatus,
      configurationKinds: [
        ...new Set(
          forHole
            .filter(
              (projection) =>
                projection.kind === "HOLE_CONFIGURATION" &&
                projection.configurationKind !== undefined,
            )
            .map((projection) => projection.configurationKind!),
        ),
      ],
      bhaSetupCount: forHole.filter(
        (projection) => projection.kind === "BHA_SETUP",
      ).length,
      shiftCount: forHole.filter((projection) => projection.kind === "SHIFT")
        .length,
      runCount: forHole.filter((projection) => projection.kind === "RUN")
        .length,
    };
  }

  async recordOperation(
    input: RecordOperationInput,
  ): Promise<OperationReceipt> {
    const key = `${input.envelope.organisationId}:${input.envelope.operationId}`;
    const existing = this.receipts.get(key);
    if (existing) {
      return existing.hash === input.envelopeHash
        ? existing.receipt
        : {
            ...existing.receipt,
            status: "REJECTED",
            reasonCode: "OPERATION_ID_REUSED",
            serverReceiptTime: input.receivedAt,
          };
    }
    const revisionKey = input.envelope.revisionRef
      ? `${input.envelope.organisationId}:${input.envelope.revisionRef}`
      : null;
    const version =
      revisionKey === null
        ? input.envelope.holeRef === null ||
          input.envelope.holeRef === undefined
          ? undefined
          : this.holeVersions.get(
              `${input.envelope.organisationId}:${input.envelope.holeRef}`,
            )
        : (this.revisions.get(revisionKey) ?? 0);
    const evidence = input.envelope.leaseEvidence;
    const lease =
      evidence?.leaseId === null || evidence?.leaseId === undefined
        ? undefined
        : this.leases.get(evidence.leaseId);
    const requiresLease =
      input.envelope.holeRef !== null &&
      input.envelope.holeRef !== undefined;
    const leaseContextMatches =
      !requiresLease ||
      (lease !== undefined &&
        lease.organisationId === input.envelope.organisationId &&
        lease.primaryDeviceId === input.envelope.deviceId &&
        lease.resourceType === "HOLE" &&
        lease.resourceRef === input.envelope.holeRef);
    const leaseVersionMatches =
      !requiresLease ||
      (lease !== undefined && evidence?.leaseVersion === lease.version);
    const isCompletionGrace =
      /complete|close|handover|finalize/i.test(input.envelope.operationType);
    const graceExpiresAt =
      lease === undefined
        ? Number.NaN
        : Date.parse(
            isCompletionGrace
              ? lease.completionGraceExpiresAt
              : lease.offlineGraceExpiresAt,
          );
    const hasNewerLease =
      lease !== undefined &&
      [...this.leases.values()].some(
        (candidate) =>
          candidate.organisationId === lease.organisationId &&
          candidate.resourceType === lease.resourceType &&
          candidate.resourceRef === lease.resourceRef &&
          candidate.id !== lease.id &&
          Date.parse(candidate.acquiredAt) > Date.parse(lease.acquiredAt),
      );
    const primaryIsValid =
      !requiresLease ||
      (evidence?.state === "PRIMARY_WRITER" &&
        lease?.status === "ACTIVE" &&
        lease.releasedAt === null &&
        Date.parse(lease.expiresAt) > Date.parse(input.receivedAt));
    const graceIsValid =
      !requiresLease ||
      (evidence?.state === "OFFLINE_GRACE" &&
        lease !== undefined &&
        ["ACTIVE", "EXPIRED"].includes(lease.status) &&
        lease.takeoverReason === null &&
        !hasNewerLease &&
        Date.parse(input.receivedAt) <= graceExpiresAt);
    const leaseIsValid =
      !requiresLease ||
      (leaseContextMatches &&
        leaseVersionMatches &&
        (primaryIsValid || graceIsValid));
    const evidenceMissing =
      requiresLease &&
      (!evidence ||
        evidence.state === "NOT_REQUIRED" ||
        evidence.leaseId === null);
    let status: OperationReceipt["status"] = evidenceMissing
      ? "REJECTED"
      : !leaseIsValid
      ? "CONFLICT"
      : input.envelope.expectedVersion !== null &&
            input.envelope.expectedVersion !== undefined &&
            input.envelope.expectedVersion !== version
          ? "CONFLICT"
          : "ACCEPTED";
    let reasonCode =
      status === "REJECTED"
        ? "LEASE_EVIDENCE_REQUIRED"
        : status === "CONFLICT" && !leaseIsValid && !leaseContextMatches
        ? "LEASE_NOT_OWNED"
        : status === "CONFLICT" && !leaseIsValid && !leaseVersionMatches
          ? "LEASE_VERSION_STALE"
          : status === "CONFLICT" &&
              !leaseIsValid &&
              requiresLease &&
              evidence?.state === "OFFLINE_GRACE"
            ? "OFFLINE_GRACE_INVALID"
            : status === "CONFLICT" && !leaseIsValid && requiresLease
              ? "LEASE_NOT_ACTIVE"
        : status === "CONFLICT"
          ? "EXPECTED_VERSION_STALE"
          : evidence?.state === "OFFLINE_GRACE"
            ? "OFFLINE_GRACE_RECORDED"
            : null;
    let aggregateVersion: number | null = null;
    let durableCursor: string | null = null;
    const corePlan = input.corePlan;
    if (status === "ACCEPTED" && corePlan !== null) {
      for (const projection of corePlan.projections) {
        const projectionKey = this.coreProjectionKey(
          input.envelope.organisationId,
          projection,
        );
        const existingProjection = this.coreProjections.get(projectionKey);
        if (
          existingProjection &&
          (existingProjection.projection.version > projection.version ||
            (existingProjection.projection.version === projection.version &&
              JSON.stringify(existingProjection.projection.state) !==
                JSON.stringify(projection.state)))
        ) {
          status = "CONFLICT";
          reasonCode = "CORE_ENTITY_VERSION_CONFLICT";
          break;
        }
        if (
          projection.kind === "SHIFT" &&
          ["OPEN", "HANDOVER_PENDING"].includes(projection.lifecycleStatus)
        ) {
          const duplicate = [...this.coreProjections.values()].some(
            (candidate) =>
              candidate.projection.kind === "SHIFT" &&
              candidate.projection.holeRef === projection.holeRef &&
              candidate.projection.localId !== projection.localId &&
              ["OPEN", "HANDOVER_PENDING"].includes(
                candidate.projection.lifecycleStatus,
              ),
          );
          if (duplicate) {
            status = "CONFLICT";
            reasonCode = "ACTIVE_SHIFT_EXISTS";
            break;
          }
        }
        if (
          projection.kind === "RUN" &&
          projection.lifecycleStatus !== "void"
        ) {
          const runNumber = (
            projection.state as { readonly runNumber?: number }
          ).runNumber;
          const duplicate = [...this.coreProjections.values()].some(
            (candidate) =>
              candidate.projection.kind === "RUN" &&
              candidate.projection.holeRef === projection.holeRef &&
              candidate.projection.localId !== projection.localId &&
              candidate.projection.lifecycleStatus !== "void" &&
              (
                candidate.projection.state as {
                  readonly runNumber?: number;
                }
              ).runNumber === runNumber,
          );
          if (duplicate) {
            status = "CONFLICT";
            reasonCode = "DUPLICATE_RUN_NUMBER";
            break;
          }
        }
      }
      if (status === "ACCEPTED") {
        for (const projection of corePlan.projections) {
          const projectionKey = this.coreProjectionKey(
            input.envelope.organisationId,
            projection,
          );
          const existingProjection = this.coreProjections.get(projectionKey);
          this.coreProjections.set(projectionKey, {
            serverId: existingProjection?.serverId ?? randomUUID(),
            projection,
          });
        }
        if (corePlan.aggregateType === "HOLE") {
          const entries = this.organisationCoreProjections(
            input.envelope.organisationId,
          );
          const latestRun = entries
            .filter(
              ({ projection }) =>
                projection.kind === "RUN" &&
                projection.holeRef === corePlan.aggregateRef &&
                projection.lifecycleStatus !== "void",
            )
            .sort(
              (left, right) =>
                Number(right.projection.state.runNumber) -
                Number(left.projection.state.runNumber),
            )[0];
          const hole = entries.find(
            ({ projection }) =>
              projection.kind === "HOLE" &&
              projection.localId === corePlan.aggregateRef,
          );
          if (latestRun && hole) {
            const key = this.coreProjectionKey(
              input.envelope.organisationId,
              hole.projection,
            );
            this.coreProjections.set(key, {
              serverId: hole.serverId,
              projection: {
                ...hole.projection,
                state: {
                  ...hole.projection.state,
                  currentDepth: latestRun.projection.state.holeDepthDm,
                },
              },
            });
          }
        }
        const aggregateKey = `${input.envelope.organisationId}:${corePlan.aggregateType}:${corePlan.aggregateRef}`;
        aggregateVersion = (this.aggregateHeads.get(aggregateKey) ?? 0) + 1;
        this.aggregateHeads.set(aggregateKey, aggregateVersion);
        this.coreCursor += 1;
        durableCursor = String(this.coreCursor);
        this.coreChanges.push({
          cursor: durableCursor,
          operationId: input.envelope.operationId,
          aggregateType: corePlan.aggregateType,
          aggregateRef: corePlan.aggregateRef,
          aggregateVersion,
          holeRef:
            corePlan.aggregateType === "HOLE" ? corePlan.aggregateRef : null,
          operationType: input.envelope.operationType,
          entityKinds: [
            ...new Set(
              corePlan.projections.map((projection) => projection.kind),
            ),
          ],
          serverReceivedAt: input.receivedAt,
          clientTime: input.envelope.clientTime,
        });
        await this.writeAudit({
          organisationId: input.envelope.organisationId,
          actorUserId: input.envelope.operatorId,
          actorDeviceId: input.envelope.deviceId,
          action: "CORE_OPERATION_MATERIALIZED",
          targetType: corePlan.aggregateType,
          targetId: corePlan.aggregateRef,
          reason: null,
          metadata: {
            operationId: input.envelope.operationId,
            aggregateVersion,
          },
        });
      }
    }
    const receipt: OperationReceipt = {
      operationId: input.envelope.operationId,
      schemaVersion: input.envelope.schemaVersion,
      organisationId: input.envelope.organisationId,
      deviceId: input.envelope.deviceId,
      operatorId: input.envelope.operatorId,
      operationType: input.envelope.operationType,
      projectRef: input.envelope.projectRef ?? null,
      rigRef: input.envelope.rigRef ?? null,
      holeRef: input.envelope.holeRef ?? null,
      shiftRef: input.envelope.shiftRef ?? null,
      expectedVersion: input.envelope.expectedVersion ?? null,
      revisionRef: input.envelope.revisionRef ?? null,
      clientTime: input.envelope.clientTime,
      serverReceiptTime: input.receivedAt,
      status,
      reasonCode,
      journalSemantics:
        corePlan !== null && status === "ACCEPTED"
          ? "AUTHORITATIVE_CORE"
          : "AUDIT_BACKUP_ONLY",
      materializationStatus:
        corePlan === null
          ? "JOURNAL_ONLY"
          : status === "ACCEPTED"
            ? "MATERIALIZED"
            : "NOT_APPLIED",
      aggregateType: corePlan?.aggregateType ?? null,
      aggregateRef: corePlan?.aggregateRef ?? null,
      aggregateVersion,
      durableCursor,
    };
    this.receipts.set(key, {
      hash: input.envelopeHash,
      receipt,
      envelope: input.envelope,
    });
    if (status === "ACCEPTED" && revisionKey !== null) {
      this.revisions.set(
        revisionKey,
        Math.max((version ?? 0) + 1, corePlan?.revisionVersion ?? 0),
      );
    }
    return receipt;
  }

  async getCoreDirectory(
    organisationId: string,
    assignment: {
      readonly projectRef: string | null;
      readonly rigRef: string | null;
      readonly includeAvailable: boolean;
    },
    generatedAt: string,
  ): Promise<CoreDirectorySnapshot> {
    const entries = this.organisationCoreProjections(organisationId);
    const allProjects = entries.filter(
      ({ projection }) => projection.kind === "PROJECT",
    );
    const allRigs = entries.filter(
      ({ projection }) => projection.kind === "RIG",
    );
    const allowedProjectIds = new Set(
      allProjects
        .filter(
          ({ projection }) =>
            assignment.includeAvailable ||
            projection.localId === assignment.projectRef ||
            allRigs.some(
              ({ projection: rig }) =>
                rig.localId === assignment.rigRef &&
                rig.projectRef === projection.localId,
            ),
        )
        .map(({ projection }) => projection.localId),
    );
    const rigs = allRigs.filter(
      ({ projection }) =>
        allowedProjectIds.has(projection.projectRef ?? "") &&
        (assignment.includeAvailable ||
          assignment.rigRef === null ||
          projection.localId === assignment.rigRef),
    );
    const allowedRigIds = new Set(
      rigs.map(({ projection }) => projection.localId),
    );
    const holes = entries.filter(
      ({ projection }) =>
        projection.kind === "HOLE" &&
        allowedProjectIds.has(projection.projectRef ?? "") &&
        allowedRigIds.has(projection.rigRef ?? ""),
    );
    const changes = this.organisationCoreChanges(organisationId);
    const cursor = changes.at(-1)?.cursor ?? "0";
    const state = (
      entry: (typeof entries)[number],
    ): CoreProjection["state"] => ({
      ...entry.projection.state,
      serverId: entry.serverId,
      syncStatus: "synced",
    });
    return {
      schemaVersion: 1,
      generatedAt,
      organisationId,
      assignment: {
        projectRef: assignment.projectRef,
        rigRef: assignment.rigRef,
      },
      source: "AUTHORITATIVE_SERVER",
      projects: allProjects
        .filter(({ projection }) => allowedProjectIds.has(projection.localId))
        .map((entry) => ({
          serverId: entry.serverId,
          localId: entry.projection.localId,
          version: entry.projection.version,
          state: state(entry),
        })),
      rigs: rigs.map((entry) => ({
        serverId: entry.serverId,
        localId: entry.projection.localId,
        projectLocalId: entry.projection.projectRef!,
        version: entry.projection.version,
        state: state(entry),
      })),
      holes: holes.map((entry) => ({
        serverId: entry.serverId,
        localId: entry.projection.localId,
        projectLocalId: entry.projection.projectRef!,
        rigLocalId: entry.projection.rigRef!,
        version: entry.projection.version,
        state: state(entry),
        lastCursor:
          changes
            .filter(
              (change) =>
                change.aggregateType === "HOLE" &&
                change.aggregateRef === entry.projection.localId,
            )
            .at(-1)?.cursor ?? null,
      })),
      cursor,
    };
  }

  async getCoreHoleSnapshot(
    organisationId: string,
    holeRef: string,
    generatedAt: string,
  ): Promise<CoreHoleSnapshot | null> {
    const directory = await this.getCoreDirectory(
      organisationId,
      { projectRef: null, rigRef: null, includeAvailable: true },
      generatedAt,
    );
    const hole = directory.holes.find(
      (candidate) => candidate.localId === holeRef,
    );
    if (!hole) return null;
    const project = directory.projects.find(
      (candidate) => candidate.localId === hole.projectLocalId,
    );
    const rig = directory.rigs.find(
      (candidate) => candidate.localId === hole.rigLocalId,
    );
    if (!project || !rig) return null;
    const entries = this.organisationCoreProjections(organisationId).filter(
      ({ projection }) => projection.holeRef === holeRef,
    );
    const toRecord = (entry: (typeof entries)[number]) => ({
      serverId: entry.serverId,
      localId: entry.projection.localId,
      version: entry.projection.version,
      state: {
        ...entry.projection.state,
        serverId: entry.serverId,
        syncStatus: "synced",
      },
    });
    const byKind = (kind: CoreEntityKind) =>
      entries.filter(({ projection }) => projection.kind === kind);
    return {
      schemaVersion: 1,
      generatedAt,
      organisationId,
      source: "AUTHORITATIVE_SERVER",
      cursor: hole.lastCursor ?? directory.cursor,
      aggregateRevision:
        this.aggregateHeads.get(`${organisationId}:HOLE:${holeRef}`) ?? 1,
      project,
      rig,
      hole,
      configurations: byKind("HOLE_CONFIGURATION").map((entry) => ({
        ...toRecord(entry),
        kind: entry.projection.configurationKind!,
      })),
      bhaSetups: byKind("BHA_SETUP").map(toRecord),
      shifts: byKind("SHIFT").map(toRecord),
      handovers: byKind("HANDOVER").map(toRecord),
      runs: byKind("RUN").map(toRecord),
      rodEvents: byKind("ROD_EVENT").map((entry) => ({
        ...toRecord(entry),
        runLocalId: String(entry.projection.state.runId),
      })),
      runCorrections: byKind("RUN_CORRECTION").map((entry) => ({
        ...toRecord(entry),
        runLocalId: String(entry.projection.state.runId),
      })),
      completionReviews: byKind("COMPLETION_REVIEW").map(toRecord),
      completionRecords: byKind("COMPLETION_RECORD").map(toRecord),
      reopenRecords: byKind("REOPEN_RECORD").map(toRecord),
      media: [],
    };
  }

  async listCoreChanges(
    organisationId: string,
    input: {
      readonly cursor: string;
      readonly limit: number;
      readonly holeRef?: string;
    },
  ): Promise<CoreChangesPage> {
    const candidates = this.organisationCoreChanges(organisationId).filter(
      (change) =>
        BigInt(change.cursor) > BigInt(input.cursor) &&
        (input.holeRef === undefined || change.holeRef === input.holeRef),
    );
    const hasMore = candidates.length > input.limit;
    const changes = candidates.slice(0, input.limit);
    return {
      schemaVersion: 1,
      changes,
      nextCursor: changes.at(-1)?.cursor ?? input.cursor,
      hasMore,
    };
  }

  async getCoreConflictDetails(
    organisationId: string,
    operationId: string,
  ): Promise<CoreConflictDetails | null> {
    const stored = this.receipts.get(`${organisationId}:${operationId}`);
    if (!stored || stored.receipt.status !== "CONFLICT") return null;
    const revisionKey = stored.receipt.revisionRef
      ? `${organisationId}:${stored.receipt.revisionRef}`
      : null;
    return {
      operationId,
      operationType: stored.receipt.operationType,
      aggregateRef: stored.receipt.aggregateRef,
      projectRef: stored.receipt.projectRef,
      rigRef: stored.receipt.rigRef,
      holeRef: stored.receipt.holeRef,
      revisionRef: stored.receipt.revisionRef,
      expectedVersion: stored.receipt.expectedVersion,
      currentVersion:
        revisionKey === null ? null : (this.revisions.get(revisionKey) ?? 0),
      reasonCode: stored.receipt.reasonCode,
      serverReceivedAt: stored.receipt.serverReceiptTime,
      pendingPayload: stored.envelope.payload,
    };
  }

  async prepareCoreRestore(input: CoreRestoreAttemptInput): Promise<void> {
    const key = `${input.organisationId}:${input.restoreId}`;
    const existing = this.restoreAttempts.get(key);
    if (existing) {
      if (
        JSON.stringify(existing) !==
        JSON.stringify({ ...input, status: existing.status })
      ) {
        throw new Error("RESTORE_ID_REUSED");
      }
      return;
    }
    this.restoreAttempts.set(key, { ...input, status: "PREPARED" });
    await this.writeAudit({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      actorDeviceId: input.deviceId,
      action: "CORE_RESTORE_PREPARED",
      targetType: "DEVICE",
      targetId: input.deviceId,
      reason: input.reason,
      metadata: {
        restoreId: input.restoreId,
        holeRefs: input.holeRefs,
        snapshotCursor: input.snapshotCursor,
        dryRunRecordCount: input.dryRunRecordCount,
      },
    });
  }

  async commitCoreRestore(input: CoreRestoreAttemptInput): Promise<void> {
    const key = `${input.organisationId}:${input.restoreId}`;
    const existing = this.restoreAttempts.get(key);
    if (!existing) throw new Error("RESTORE_NOT_PREPARED");
    if (existing.status === "COMMITTED") return;
    this.restoreAttempts.set(key, { ...existing, status: "COMMITTED" });
    await this.writeAudit({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      actorDeviceId: input.deviceId,
      action: "CORE_DEVICE_RESTORED",
      targetType: "DEVICE",
      targetId: input.deviceId,
      reason: input.reason,
      metadata: {
        restoreId: input.restoreId,
        holeRefs: input.holeRefs,
        snapshotCursor: input.snapshotCursor,
        dryRunRecordCount: input.dryRunRecordCount,
      },
    });
  }

  async writeAudit(record: AuditRecord): Promise<void> {
    if (this.failNextAuditWrite) {
      this.failNextAuditWrite = false;
      throw new Error("Injected mandatory audit failure.");
    }
    this.audits.push(record);
  }

  private coreProjectionKey(
    organisationId: string,
    projection: CoreProjection,
  ): string {
    return [
      organisationId,
      projection.kind,
      projection.holeRef ?? "-",
      projection.localId,
    ].join(":");
  }

  private organisationCoreProjections(organisationId: string) {
    return [...this.coreProjections.entries()]
      .filter(([key]) => key.startsWith(`${organisationId}:`))
      .map(([, value]) => value);
  }

  private organisationCoreChanges(
    organisationId: string,
  ): CoreChangesPage["changes"] {
    return this.coreChanges.filter((change) =>
      [...this.receipts.values()].some(
        ({ receipt }) =>
          receipt.organisationId === organisationId &&
          receipt.operationId === change.operationId,
      ),
    );
  }

  private findActiveLease(
    organisationId: string,
    target: WorkLeaseTarget,
    now: string,
  ): WorkLease | null {
    for (const [id, lease] of this.leases) {
      if (
        lease.organisationId === organisationId &&
        lease.resourceType === target.resourceType &&
        lease.resourceRef === target.resourceRef &&
        lease.status === "ACTIVE"
      ) {
        if (Date.parse(lease.expiresAt) <= Date.parse(now)) {
          this.leases.set(id, {
            ...lease,
            status: "EXPIRED",
            releasedAt: now,
          });
          return null;
        }
        return lease;
      }
    }
    return null;
  }
}
