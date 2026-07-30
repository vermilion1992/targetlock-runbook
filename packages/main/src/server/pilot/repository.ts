import type {
  OperationReceipt,
  PilotDevice,
  PilotRole,
  SyncOperationEnvelope,
  WorkLease,
  WorkLeaseTarget,
} from "./types";
import type {
  CoreChangesPage,
  CoreConfigurationKind,
  CoreConflictDetails,
  CoreDirectorySnapshot,
  CoreHoleSnapshot,
  CoreOperationPlan,
} from "./core-types";

export interface LoginIdentity {
  readonly organisationId: string;
  readonly organisationName: string;
  readonly organisationStatus: "ACTIVE" | "SUSPENDED";
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly userStatus: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly role: PilotRole;
  readonly membershipStatus: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly sessionVersion: number;
  readonly mustChangePassword: boolean;
}

export interface StoredSessionIdentity extends LoginIdentity {
  readonly sessionId: string;
  readonly sessionExpiresAt: string;
  readonly sessionRevokedAt: string | null;
  readonly sessionVersionAtIssue: number;
}

export interface CreateSessionRecord {
  readonly organisationId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly sessionVersionAtIssue: number;
  readonly expiresAt: string;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}

export interface CreateDeviceRecord {
  readonly organisationId: string;
  readonly displayName: string;
  readonly tokenHash: string;
  readonly siteName: string | null;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly registeredByUserId: string;
}

export interface AuditRecord {
  readonly organisationId: string;
  readonly actorUserId: string | null;
  readonly actorDeviceId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ProvisionUserRecord {
  readonly organisationId: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly role: PilotRole;
}

export interface ProvisionedUser {
  readonly id: string;
  readonly organisationId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: PilotRole;
  readonly status: "ACTIVE";
}

export interface PilotAdminUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: PilotRole;
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly mustChangePassword: boolean;
  readonly lastLoginAt: string | null;
}

export interface PilotAdminDevice extends PilotDevice {
  readonly isPrimary: boolean;
  readonly createdAt: string;
}

export interface PasswordSecurityRecord {
  readonly passwordHash: string;
  readonly sessionVersion: number;
}

export type LeaseAcquireResult =
  | { readonly status: "ACQUIRED"; readonly lease: WorkLease }
  | { readonly status: "OWNED"; readonly lease: WorkLease };

export interface RecordOperationInput {
  readonly envelope: SyncOperationEnvelope;
  readonly envelopeHash: string;
  readonly receivedAt: string;
  readonly corePlan: CoreOperationPlan | null;
}

export interface CoreResourceScope {
  readonly projectRef: string;
  readonly rigRef: string;
  readonly holeRef: string | null;
  readonly shiftRef: string | null;
}

export interface CoreHoleSetupState {
  readonly lifecycleStatus: string;
  readonly configurationKinds: readonly CoreConfigurationKind[];
  readonly bhaSetupCount: number;
  readonly shiftCount: number;
  readonly runCount: number;
}

export interface CoreRestoreAttemptInput {
  readonly organisationId: string;
  readonly restoreId: string;
  readonly deviceId: string;
  readonly actorUserId: string;
  readonly reason: string;
  readonly holeRefs: readonly string[];
  readonly snapshotCursor: string;
  readonly dryRunRecordCount: number;
  readonly occurredAt: string;
}

export interface PilotRepository {
  atomic<T>(operation: () => Promise<T>): Promise<T>;
  findLoginIdentity(
    organisationSlug: string,
    email: string,
  ): Promise<LoginIdentity | null>;
  createSession(record: CreateSessionRecord): Promise<string>;
  findSessionIdentity(tokenHash: string): Promise<StoredSessionIdentity | null>;
  revokeSession(sessionId: string, revokedAt: string): Promise<void>;
  findPasswordSecurity(
    organisationId: string,
    userId: string,
  ): Promise<PasswordSecurityRecord | null>;
  changePassword(
    organisationId: string,
    userId: string,
    passwordHash: string,
    changedAt: string,
  ): Promise<boolean>;
  revokeAllUserSessions(
    organisationId: string,
    userId: string,
    revokedAt: string,
  ): Promise<void>;

  findDevice(tokenHash: string): Promise<PilotDevice | null>;
  createDevice(record: CreateDeviceRecord): Promise<PilotDevice>;
  touchDevice(
    organisationId: string,
    deviceId: string,
    seenAt: string,
  ): Promise<void>;
  provisionUser(record: ProvisionUserRecord): Promise<ProvisionedUser>;
  setUserStatus(
    organisationId: string,
    userId: string,
    status: "ACTIVE" | "DISABLED" | "REVOKED",
  ): Promise<boolean>;
  assignDevice(
    organisationId: string,
    deviceId: string,
    assignment: {
      readonly siteName: string | null;
      readonly projectRef: string | null;
      readonly rigRef: string | null;
    },
  ): Promise<PilotDevice | null>;
  setDeviceStatus(
    organisationId: string,
    deviceId: string,
    status: "ACTIVE" | "DISABLED" | "REVOKED",
    changedAt: string,
    removal?: {
      readonly actorUserId: string;
      readonly reason: string;
    },
  ): Promise<PilotDevice | null>;
  listUsers(organisationId: string): Promise<readonly PilotAdminUser[]>;
  listDevices(organisationId: string): Promise<readonly PilotAdminDevice[]>;
  listActiveLeases(organisationId: string, now: string): Promise<readonly WorkLease[]>;

  acquireLease(
    organisationId: string,
    deviceId: string,
    userId: string,
    target: WorkLeaseTarget,
    expiresAt: string,
    now: string,
  ): Promise<LeaseAcquireResult>;
  findLease(
    organisationId: string,
    target: WorkLeaseTarget,
    now: string,
  ): Promise<WorkLease | null>;
  heartbeatLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    expiresAt: string,
    now: string,
  ): Promise<WorkLease | null>;
  releaseLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    releasedAt: string,
  ): Promise<WorkLease | null>;
  takeoverLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    userId: string,
    reason: string,
    expiresAt: string,
    now: string,
  ): Promise<WorkLease | null>;
  supervisorReleaseLease(
    organisationId: string,
    leaseId: string,
    releasedAt: string,
    reason: string,
  ): Promise<WorkLease | null>;

  recordOperation(input: RecordOperationInput): Promise<OperationReceipt>;
  resolveCoreScope(
    organisationId: string,
    input: {
      readonly projectRef?: string | null;
      readonly rigRef?: string | null;
      readonly holeRef?: string | null;
      readonly shiftRef?: string | null;
      readonly allowMissingHole?: boolean;
    },
  ): Promise<CoreResourceScope | null>;
  getCoreHoleSetupState(
    organisationId: string,
    holeRef: string,
  ): Promise<CoreHoleSetupState | null>;
  getCoreDirectory(
    organisationId: string,
    assignment: {
      readonly projectRef: string | null;
      readonly rigRef: string | null;
      readonly includeAvailable: boolean;
    },
    generatedAt: string,
  ): Promise<CoreDirectorySnapshot>;
  getCoreHoleSnapshot(
    organisationId: string,
    holeRef: string,
    generatedAt: string,
  ): Promise<CoreHoleSnapshot | null>;
  listCoreChanges(
    organisationId: string,
    input: {
      readonly cursor: string;
      readonly limit: number;
      readonly holeRef?: string;
    },
  ): Promise<CoreChangesPage>;
  getCoreConflictDetails(
    organisationId: string,
    operationId: string,
  ): Promise<CoreConflictDetails | null>;
  prepareCoreRestore(input: CoreRestoreAttemptInput): Promise<void>;
  commitCoreRestore(input: CoreRestoreAttemptInput): Promise<void>;
  writeAudit(record: AuditRecord): Promise<void>;
}
