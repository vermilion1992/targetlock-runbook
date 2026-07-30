import type { PoolClient } from "pg";

import {
  firstRow,
  queryPilotDatabase,
  withTransaction,
} from "./database";
import { maximumOfflineGraceMsForOperationType } from "./lease-policy";
import {
  applyCoreMaterialization,
  readCoreChanges,
  readCoreConflictDetails,
  readCoreDirectory,
  readCoreHoleSnapshot,
} from "./postgres-core-repository";
import type {
  CoreChangesPage,
  CoreConflictDetails,
  CoreDirectorySnapshot,
  CoreHoleSnapshot,
  CoreMaterializationOutcome,
} from "./core-types";
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
  OperationReceipt,
  PilotDevice,
  PilotRole,
  SyncOperationEnvelope,
  WorkLease,
  WorkLeaseTarget,
} from "./types";

interface IdentityRow {
  organisation_id: string;
  organisation_name: string;
  organisation_status: "ACTIVE" | "SUSPENDED";
  user_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  user_status: "ACTIVE" | "DISABLED" | "REVOKED";
  role: PilotRole;
  membership_status: "ACTIVE" | "DISABLED" | "REVOKED";
  session_version: number;
  must_change_password: boolean;
  last_login_at?: Date | null;
  session_id?: string;
  session_expires_at?: Date;
  session_revoked_at?: Date | null;
  session_version_at_issue?: number;
}

interface DeviceRow {
  id: string;
  organisation_id: string;
  display_name: string;
  status: "ACTIVE" | "DISABLED" | "REVOKED";
  site_name: string | null;
  project_ref: string | null;
  rig_ref: string | null;
  last_seen_at: Date | null;
  is_primary?: boolean;
  created_at?: Date;
}

interface LeaseRow {
  id: string;
  organisation_id: string;
  resource_type: "HOLE" | "SHIFT";
  resource_ref: string;
  project_ref: string | null;
  hole_ref: string | null;
  shift_ref: string | null;
  primary_device_id: string;
  operator_user_id: string;
  status: "ACTIVE" | "RELEASED" | "EXPIRED" | "TAKEN_OVER";
  acquired_at: Date;
  heartbeat_at: Date;
  expires_at: Date;
  released_at: Date | null;
  takeover_reason: string | null;
  version: number;
  offline_grace_issued_at: Date;
  offline_grace_expires_at: Date;
  completion_grace_expires_at: Date;
}

interface ReceiptRow {
  operation_id: string;
  schema_version: number;
  organisation_id: string;
  device_id: string;
  operator_user_id: string;
  operation_type: string;
  project_ref: string | null;
  rig_ref: string | null;
  hole_ref: string | null;
  shift_ref: string | null;
  expected_version: number | null;
  revision_ref: string | null;
  client_time: Date;
  server_receipt_time: Date;
  status: "ACCEPTED" | "CONFLICT" | "REJECTED";
  reason_code: string | null;
  envelope_hash: string;
  materialization_status: "JOURNAL_ONLY" | "MATERIALIZED" | "NOT_APPLIED";
  aggregate_type: "PROJECT_DIRECTORY" | "HOLE" | null;
  aggregate_ref: string | null;
  aggregate_version: number | null;
  durable_cursor?: string | null;
}

function mapIdentity(row: IdentityRow): LoginIdentity {
  return {
    organisationId: row.organisation_id,
    organisationName: row.organisation_name,
    organisationStatus: row.organisation_status,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    userStatus: row.user_status,
    role: row.role,
    membershipStatus: row.membership_status,
    sessionVersion: row.session_version,
    mustChangePassword: row.must_change_password,
  };
}

function mapSessionIdentity(row: IdentityRow): StoredSessionIdentity {
  if (
    !row.session_id ||
    !row.session_expires_at ||
    row.session_version_at_issue === undefined
  ) {
    throw new Error("Session query returned an incomplete identity.");
  }
  return {
    ...mapIdentity(row),
    sessionId: row.session_id,
    sessionExpiresAt: row.session_expires_at.toISOString(),
    sessionRevokedAt: row.session_revoked_at?.toISOString() ?? null,
    sessionVersionAtIssue: row.session_version_at_issue,
  };
}

function mapDevice(row: DeviceRow): PilotDevice {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    displayName: row.display_name,
    status: row.status,
    siteName: row.site_name,
    projectRef: row.project_ref,
    rigRef: row.rig_ref,
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
  };
}

function mapLease(row: LeaseRow): WorkLease {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    resourceType: row.resource_type,
    resourceRef: row.resource_ref,
    projectRef: row.project_ref,
    holeRef: row.hole_ref,
    shiftRef: row.shift_ref,
    primaryDeviceId: row.primary_device_id,
    operatorUserId: row.operator_user_id,
    status: row.status,
    acquiredAt: row.acquired_at.toISOString(),
    heartbeatAt: row.heartbeat_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    offlineGraceIssuedAt: row.offline_grace_issued_at.toISOString(),
    offlineGraceExpiresAt: row.offline_grace_expires_at.toISOString(),
    completionGraceExpiresAt: row.completion_grace_expires_at.toISOString(),
    releasedAt: row.released_at?.toISOString() ?? null,
    takeoverReason: row.takeover_reason,
    version: row.version,
  };
}

function leaseGraceDates(now: string): {
  readonly issuedAt: string;
  readonly standardExpiresAt: string;
  readonly completionExpiresAt: string;
} {
  const issuedAt = Date.parse(now);
  return {
    issuedAt: now,
    standardExpiresAt: new Date(issuedAt + 30 * 60 * 1_000).toISOString(),
    completionExpiresAt: new Date(
      issuedAt + 12 * 60 * 60 * 1_000,
    ).toISOString(),
  };
}

function mapReceipt(row: ReceiptRow): OperationReceipt {
  return {
    operationId: row.operation_id,
    schemaVersion: row.schema_version,
    organisationId: row.organisation_id,
    deviceId: row.device_id,
    operatorId: row.operator_user_id,
    operationType: row.operation_type,
    projectRef: row.project_ref,
    rigRef: row.rig_ref,
    holeRef: row.hole_ref,
    shiftRef: row.shift_ref,
    expectedVersion: row.expected_version,
    revisionRef: row.revision_ref,
    clientTime: row.client_time.toISOString(),
    serverReceiptTime: row.server_receipt_time.toISOString(),
    status: row.status,
    reasonCode: row.reason_code,
    journalSemantics:
      row.materialization_status === "MATERIALIZED"
        ? "AUTHORITATIVE_CORE"
        : "AUDIT_BACKUP_ONLY",
    materializationStatus: row.materialization_status,
    aggregateType: row.aggregate_type,
    aggregateRef: row.aggregate_ref,
    aggregateVersion: row.aggregate_version,
    durableCursor: row.durable_cursor ?? null,
  };
}

const IDENTITY_COLUMNS = `
  o.id AS organisation_id,
  o.name AS organisation_name,
  o.status AS organisation_status,
  u.id AS user_id,
  u.email,
  u.display_name,
  u.password_hash,
  u.status AS user_status,
  m.role,
  m.status AS membership_status,
  u.session_version,
  u.must_change_password,
  u.last_login_at
`;

async function lockResource(
  client: PoolClient,
  organisationId: string,
  target: WorkLeaseTarget,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `${organisationId}:${target.resourceType}:${target.resourceRef}`,
  ]);
}

async function upsertReference(
  client: PoolClient,
  table: "pilot_projects" | "pilot_rigs" | "pilot_holes",
  organisationId: string,
  externalRef: string,
  foreignKeys: {
    readonly projectId?: string | null;
    readonly rigId?: string | null;
  } = {},
): Promise<{ readonly id: string; readonly contextMatches: boolean }> {
  if (table === "pilot_projects") {
    await client.query(
      `INSERT INTO pilot_projects (organisation_id, external_ref, display_name)
       VALUES ($1, $2, $2)
       ON CONFLICT (organisation_id, external_ref) DO NOTHING`,
      [organisationId, externalRef],
    );
  } else if (table === "pilot_rigs") {
    await client.query(
      `INSERT INTO pilot_rigs (
         organisation_id, project_id, external_ref, display_name
       ) VALUES ($1, $2, $3, $3)
       ON CONFLICT (organisation_id, external_ref) DO NOTHING`,
      [organisationId, foreignKeys.projectId ?? null, externalRef],
    );
    if (foreignKeys.projectId) {
      await client.query(
        `UPDATE pilot_rigs
         SET project_id = COALESCE(project_id, $3)
         WHERE organisation_id = $1 AND external_ref = $2`,
        [organisationId, externalRef, foreignKeys.projectId],
      );
    }
  } else {
    await client.query(
      `INSERT INTO pilot_holes (
         organisation_id, project_id, rig_id, external_ref, display_name
       ) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (organisation_id, external_ref) DO NOTHING`,
      [
        organisationId,
        foreignKeys.projectId ?? null,
        foreignKeys.rigId ?? null,
        externalRef,
      ],
    );
    await client.query(
      `UPDATE pilot_holes
       SET project_id = COALESCE(project_id, $3),
           rig_id = COALESCE(rig_id, $4)
       WHERE organisation_id = $1 AND external_ref = $2`,
      [
        organisationId,
        externalRef,
        foreignKeys.projectId ?? null,
        foreignKeys.rigId ?? null,
      ],
    );
  }
  const contextColumns =
    table === "pilot_projects"
      ? "NULL::uuid AS project_id, NULL::uuid AS rig_id"
      : table === "pilot_rigs"
        ? "project_id, NULL::uuid AS rig_id"
        : "project_id, rig_id";
  const result = await client.query<{
    id: string;
    project_id?: string | null;
    rig_id?: string | null;
  }>(
    `SELECT id, ${contextColumns}
     FROM ${table}
     WHERE organisation_id = $1 AND external_ref = $2`,
    [organisationId, externalRef],
  );
  const row = firstRow(result.rows);
  if (row === null) throw new Error("Reference registration returned no row.");
  return {
    id: row.id,
    contextMatches:
      (foreignKeys.projectId === undefined ||
        row.project_id === foreignKeys.projectId) &&
      (foreignKeys.rigId === undefined || row.rig_id === foreignKeys.rigId),
  };
}

async function registerDomainReferences(
  client: PoolClient,
  envelope: SyncOperationEnvelope,
): Promise<{
  readonly projectId: string | null;
  readonly rigId: string | null;
  readonly holeId: string | null;
  readonly contextMatches: boolean;
}> {
  const project = envelope.projectRef
    ? await upsertReference(
        client,
        "pilot_projects",
        envelope.organisationId,
        envelope.projectRef,
      )
    : null;
  const rig = envelope.rigRef
    ? await upsertReference(
        client,
        "pilot_rigs",
        envelope.organisationId,
        envelope.rigRef,
        { projectId: project?.id ?? null },
      )
    : null;
  const hole = envelope.holeRef
    ? await upsertReference(
        client,
        "pilot_holes",
        envelope.organisationId,
        envelope.holeRef,
        {
          projectId: project?.id ?? null,
          rigId: rig?.id ?? null,
        },
      )
    : null;
  return {
    projectId: project?.id ?? null,
    rigId: rig?.id ?? null,
    holeId: hole?.id ?? null,
    contextMatches:
      (project?.contextMatches ?? true) &&
      (rig?.contextMatches ?? true) &&
      (hole?.contextMatches ?? true),
  };
}

export class PostgresPilotRepository implements PilotRepository {
  async atomic<T>(operation: () => Promise<T>): Promise<T> {
    return withTransaction(() => operation());
  }

  async findLoginIdentity(
    organisationSlug: string,
    email: string,
  ): Promise<LoginIdentity | null> {
    const result = await queryPilotDatabase<IdentityRow>(
      `SELECT ${IDENTITY_COLUMNS}
       FROM pilot_organisations o
       JOIN pilot_memberships m ON m.organisation_id = o.id
       JOIN pilot_users u ON u.id = m.user_id
       WHERE o.slug = lower($1) AND u.email = lower($2)
       LIMIT 1`,
      [organisationSlug, email],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapIdentity(row);
  }

  async createSession(record: CreateSessionRecord): Promise<string> {
    return withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO pilot_sessions (
           organisation_id, user_id, token_hash, session_version_at_issue,
           expires_at, ip_hash, user_agent
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          record.organisationId,
          record.userId,
          record.tokenHash,
          record.sessionVersionAtIssue,
          record.expiresAt,
          record.ipHash,
          record.userAgent,
        ],
      );
      await client.query(
        "UPDATE pilot_users SET last_login_at = now() WHERE id = $1",
        [record.userId],
      );
      const row = firstRow(result.rows);
      if (row === null) throw new Error("Session creation returned no ID.");
      return row.id;
    });
  }

  async findSessionIdentity(
    tokenHash: string,
  ): Promise<StoredSessionIdentity | null> {
    const result = await queryPilotDatabase<IdentityRow>(
      `SELECT ${IDENTITY_COLUMNS},
         s.id AS session_id,
         s.expires_at AS session_expires_at,
         s.revoked_at AS session_revoked_at,
         s.session_version_at_issue
       FROM pilot_sessions s
       JOIN pilot_organisations o ON o.id = s.organisation_id
       JOIN pilot_memberships m
         ON m.organisation_id = s.organisation_id AND m.user_id = s.user_id
       JOIN pilot_users u ON u.id = s.user_id
       WHERE s.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapSessionIdentity(row);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    await queryPilotDatabase(
      `UPDATE pilot_sessions
       SET revoked_at = COALESCE(revoked_at, $2)
       WHERE id = $1`,
      [sessionId, revokedAt],
    );
  }

  async findPasswordSecurity(
    organisationId: string,
    userId: string,
  ): Promise<PasswordSecurityRecord | null> {
    const result = await queryPilotDatabase<PasswordSecurityRecord & {
      password_hash: string;
      session_version: number;
    }>(
      `SELECT u.password_hash, u.session_version
       FROM pilot_users u
       JOIN pilot_memberships m ON m.user_id = u.id
       WHERE m.organisation_id = $1 AND u.id = $2
       LIMIT 1`,
      [organisationId, userId],
    );
    const row = firstRow(result.rows);
    return row === null
      ? null
      : {
          passwordHash: row.password_hash,
          sessionVersion: row.session_version,
        };
  }

  async changePassword(
    organisationId: string,
    userId: string,
    passwordHash: string,
    changedAt: string,
  ): Promise<boolean> {
    const result = await queryPilotDatabase(
      `UPDATE pilot_users u
       SET password_hash = $3, password_changed_at = $4,
           must_change_password = false,
           session_version = session_version + 1, updated_at = $4
       FROM pilot_memberships m
       WHERE m.organisation_id = $1 AND m.user_id = u.id AND u.id = $2`,
      [organisationId, userId, passwordHash, changedAt],
    );
    return result.rowCount === 1;
  }

  async revokeAllUserSessions(
    organisationId: string,
    userId: string,
    revokedAt: string,
  ): Promise<void> {
    await queryPilotDatabase(
      `UPDATE pilot_sessions
       SET revoked_at = COALESCE(revoked_at, $3)
       WHERE organisation_id = $1 AND user_id = $2`,
      [organisationId, userId, revokedAt],
    );
  }

  async findDevice(tokenHash: string): Promise<PilotDevice | null> {
    const result = await queryPilotDatabase<DeviceRow>(
      `SELECT id, organisation_id, display_name, status, site_name,
              project_ref, rig_ref, last_seen_at
       FROM pilot_devices
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapDevice(row);
  }

  async createDevice(record: CreateDeviceRecord): Promise<PilotDevice> {
    const result = await queryPilotDatabase<DeviceRow>(
      `INSERT INTO pilot_devices (
         organisation_id, display_name, token_hash, site_name,
         project_ref, rig_ref, registered_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, organisation_id, display_name, status, site_name,
                 project_ref, rig_ref, last_seen_at`,
      [
        record.organisationId,
        record.displayName,
        record.tokenHash,
        record.siteName,
        record.projectRef,
        record.rigRef,
        record.registeredByUserId,
      ],
    );
    const row = firstRow(result.rows);
    if (row === null) throw new Error("Device registration returned no row.");
    return mapDevice(row);
  }

  async touchDevice(
    organisationId: string,
    deviceId: string,
    seenAt: string,
  ): Promise<void> {
    await queryPilotDatabase(
      `UPDATE pilot_devices
       SET last_seen_at = $3, updated_at = $3
       WHERE organisation_id = $1 AND id = $2 AND status = 'ACTIVE'`,
      [organisationId, deviceId, seenAt],
    );
  }

  async provisionUser(
    record: ProvisionUserRecord,
  ): Promise<ProvisionedUser> {
    return withTransaction(async (client) => {
      const userResult = await client.query<{
        id: string;
        email: string;
        display_name: string;
      }>(
        `INSERT INTO pilot_users (
           email, display_name, password_hash, must_change_password
         )
         VALUES (lower($1), $2, $3, true)
         RETURNING id, email, display_name`,
        [record.email, record.displayName, record.passwordHash],
      );
      const user = firstRow(userResult.rows);
      if (user === null) throw new Error("User provisioning returned no row.");
      await client.query(
        `INSERT INTO pilot_memberships (organisation_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [record.organisationId, user.id, record.role],
      );
      return {
        id: user.id,
        organisationId: record.organisationId,
        email: user.email,
        displayName: user.display_name,
        role: record.role,
        status: "ACTIVE",
      };
    });
  }

  async setUserStatus(
    organisationId: string,
    userId: string,
    status: "ACTIVE" | "DISABLED" | "REVOKED",
  ): Promise<boolean> {
    return withTransaction(async (client) => {
      const membership = await client.query(
        `UPDATE pilot_memberships
         SET status = $3, updated_at = now()
         WHERE organisation_id = $1 AND user_id = $2`,
        [organisationId, userId, status],
      );
      if (membership.rowCount !== 1) return false;
      await client.query(
        `UPDATE pilot_users
         SET status = $2, session_version = session_version + 1,
             updated_at = now()
         WHERE id = $1`,
        [userId, status],
      );
      return true;
    });
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
    const result = await queryPilotDatabase<DeviceRow>(
      `UPDATE pilot_devices
       SET site_name = $3, project_ref = $4, rig_ref = $5, updated_at = now()
       WHERE organisation_id = $1 AND id = $2
       RETURNING id, organisation_id, display_name, status, site_name,
                 project_ref, rig_ref, last_seen_at`,
      [
        organisationId,
        deviceId,
        assignment.siteName,
        assignment.projectRef,
        assignment.rigRef,
      ],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapDevice(row);
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
    const result = await queryPilotDatabase<DeviceRow>(
      `UPDATE pilot_devices
       SET status = $3,
           revoked_at = CASE WHEN $3 = 'REVOKED' THEN $4 ELSE NULL END,
           removed_by_user_id = CASE
             WHEN $3 = 'REVOKED' THEN $5::uuid ELSE NULL
           END,
           removal_reason = CASE
             WHEN $3 = 'REVOKED' THEN $6 ELSE NULL
           END,
           updated_at = $4
       WHERE organisation_id = $1 AND id = $2
       RETURNING id, organisation_id, display_name, status, site_name,
                 project_ref, rig_ref, last_seen_at`,
      [
        organisationId,
        deviceId,
        status,
        changedAt,
        removal?.actorUserId ?? null,
        removal?.reason ?? null,
      ],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapDevice(row);
  }

  async listUsers(organisationId: string): Promise<readonly PilotAdminUser[]> {
    const result = await queryPilotDatabase<{
      id: string;
      email: string;
      display_name: string;
      role: PilotRole;
      status: "ACTIVE" | "DISABLED" | "REVOKED";
      must_change_password: boolean;
      last_login_at: Date | null;
    }>(
      `SELECT u.id, u.email, u.display_name, m.role, m.status,
              u.must_change_password, u.last_login_at
       FROM pilot_memberships m
       JOIN pilot_users u ON u.id = m.user_id
       WHERE m.organisation_id = $1
       ORDER BY u.display_name, u.email`,
      [organisationId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      mustChangePassword: row.must_change_password,
      lastLoginAt: row.last_login_at?.toISOString() ?? null,
    }));
  }

  async listDevices(
    organisationId: string,
  ): Promise<readonly PilotAdminDevice[]> {
    const result = await queryPilotDatabase<DeviceRow>(
      `SELECT id, organisation_id, display_name, status, site_name,
              project_ref, rig_ref, last_seen_at, is_primary, created_at
       FROM pilot_devices
       WHERE organisation_id = $1
       ORDER BY status, display_name`,
      [organisationId],
    );
    return result.rows.map((row) => ({
      ...mapDevice(row),
      isPrimary: row.is_primary ?? false,
      createdAt: row.created_at?.toISOString() ?? new Date(0).toISOString(),
    }));
  }

  async listActiveLeases(
    organisationId: string,
    now: string,
  ): Promise<readonly WorkLease[]> {
    await queryPilotDatabase(
      `UPDATE pilot_work_leases
       SET status = 'EXPIRED', released_at = $2
       WHERE organisation_id = $1 AND status = 'ACTIVE' AND expires_at <= $2`,
      [organisationId, now],
    );
    const result = await queryPilotDatabase<LeaseRow>(
      `SELECT *
       FROM pilot_work_leases
       WHERE organisation_id = $1 AND status = 'ACTIVE'
       ORDER BY heartbeat_at DESC`,
      [organisationId],
    );
    return result.rows.map(mapLease);
  }

  async acquireLease(
    organisationId: string,
    deviceId: string,
    userId: string,
    target: WorkLeaseTarget,
    expiresAt: string,
    now: string,
  ): Promise<LeaseAcquireResult> {
    return withTransaction(async (client) => {
      const grace = leaseGraceDates(now);
      await lockResource(client, organisationId, target);
      await client.query(
        `UPDATE pilot_work_leases
         SET status = 'EXPIRED', released_at = $4
         WHERE organisation_id = $1 AND resource_type = $2
           AND resource_ref = $3 AND status = 'ACTIVE' AND expires_at <= $4`,
        [organisationId, target.resourceType, target.resourceRef, now],
      );
      const currentResult = await client.query<LeaseRow>(
        `SELECT * FROM pilot_work_leases
         WHERE organisation_id = $1 AND resource_type = $2
           AND resource_ref = $3 AND status = 'ACTIVE'
         LIMIT 1`,
        [organisationId, target.resourceType, target.resourceRef],
      );
      const current = firstRow(currentResult.rows);
      if (current !== null && current.primary_device_id !== deviceId) {
        return { status: "OWNED", lease: mapLease(current) };
      }
      if (current !== null) {
        const refreshed = await client.query<LeaseRow>(
          `UPDATE pilot_work_leases
           SET operator_user_id = $3, heartbeat_at = $4, expires_at = $5,
               offline_grace_issued_at = $4,
               offline_grace_expires_at = $6,
               completion_grace_expires_at = $7,
               version = version + 1
           WHERE organisation_id = $1 AND id = $2
           RETURNING *`,
          [
            organisationId,
            current.id,
            userId,
            now,
            expiresAt,
            grace.standardExpiresAt,
            grace.completionExpiresAt,
          ],
        );
        const row = firstRow(refreshed.rows);
        if (row === null) throw new Error("Lease refresh returned no row.");
        return { status: "ACQUIRED", lease: mapLease(row) };
      }
      const inserted = await client.query<LeaseRow>(
        `INSERT INTO pilot_work_leases (
           organisation_id, resource_type, resource_ref, project_ref,
           hole_ref, shift_ref, primary_device_id, operator_user_id,
           acquired_at, heartbeat_at, expires_at, offline_grace_issued_at,
           offline_grace_expires_at, completion_grace_expires_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $9, $11, $12
         )
         RETURNING *`,
        [
          organisationId,
          target.resourceType,
          target.resourceRef,
          target.projectRef ?? null,
          target.holeRef ?? null,
          target.shiftRef ?? null,
          deviceId,
          userId,
          now,
          expiresAt,
          grace.standardExpiresAt,
          grace.completionExpiresAt,
        ],
      );
      const row = firstRow(inserted.rows);
      if (row === null) throw new Error("Lease acquisition returned no row.");
      return { status: "ACQUIRED", lease: mapLease(row) };
    });
  }

  async findLease(
    organisationId: string,
    target: WorkLeaseTarget,
    now: string,
  ): Promise<WorkLease | null> {
    return withTransaction(async (client) => {
      await lockResource(client, organisationId, target);
      await client.query(
        `UPDATE pilot_work_leases
         SET status = 'EXPIRED', released_at = $4
         WHERE organisation_id = $1 AND resource_type = $2
           AND resource_ref = $3 AND status = 'ACTIVE' AND expires_at <= $4`,
        [organisationId, target.resourceType, target.resourceRef, now],
      );
      const result = await client.query<LeaseRow>(
        `SELECT * FROM pilot_work_leases
         WHERE organisation_id = $1 AND resource_type = $2
           AND resource_ref = $3 AND status = 'ACTIVE'
         LIMIT 1`,
        [organisationId, target.resourceType, target.resourceRef],
      );
      const row = firstRow(result.rows);
      return row === null ? null : mapLease(row);
    });
  }

  async heartbeatLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    expiresAt: string,
    now: string,
  ): Promise<WorkLease | null> {
    const grace = leaseGraceDates(now);
    const result = await queryPilotDatabase<LeaseRow>(
      `UPDATE pilot_work_leases
       SET heartbeat_at = $4, expires_at = $5,
           offline_grace_issued_at = $4,
           offline_grace_expires_at = $6,
           completion_grace_expires_at = $7,
           version = version + 1
       WHERE organisation_id = $1 AND id = $2 AND primary_device_id = $3
         AND status = 'ACTIVE' AND expires_at > $4
       RETURNING *`,
      [
        organisationId,
        leaseId,
        deviceId,
        now,
        expiresAt,
        grace.standardExpiresAt,
        grace.completionExpiresAt,
      ],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapLease(row);
  }

  async releaseLease(
    organisationId: string,
    leaseId: string,
    deviceId: string,
    releasedAt: string,
  ): Promise<WorkLease | null> {
    const result = await queryPilotDatabase<LeaseRow>(
      `UPDATE pilot_work_leases
       SET status = 'RELEASED', released_at = $4, version = version + 1
       WHERE organisation_id = $1 AND id = $2 AND primary_device_id = $3
         AND status = 'ACTIVE'
       RETURNING *`,
      [organisationId, leaseId, deviceId, releasedAt],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapLease(row);
  }

  async supervisorReleaseLease(
    organisationId: string,
    leaseId: string,
    releasedAt: string,
    reason: string,
  ): Promise<WorkLease | null> {
    const result = await queryPilotDatabase<LeaseRow>(
      `UPDATE pilot_work_leases
       SET status = 'RELEASED', released_at = $3, takeover_reason = $4,
           version = version + 1
       WHERE organisation_id = $1 AND id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [organisationId, leaseId, releasedAt, reason],
    );
    const row = firstRow(result.rows);
    return row === null ? null : mapLease(row);
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
    return withTransaction(async (client) => {
      const grace = leaseGraceDates(now);
      const currentResult = await client.query<LeaseRow>(
        `SELECT * FROM pilot_work_leases
         WHERE organisation_id = $1 AND id = $2 AND status = 'ACTIVE'
         FOR UPDATE`,
        [organisationId, leaseId],
      );
      const current = firstRow(currentResult.rows);
      if (current === null) return null;
      await client.query(
        `UPDATE pilot_work_leases
         SET status = 'TAKEN_OVER', released_at = $3,
             takeover_reason = $4, version = version + 1
         WHERE organisation_id = $1 AND id = $2`,
        [organisationId, leaseId, now, reason],
      );
      const inserted = await client.query<LeaseRow>(
        `INSERT INTO pilot_work_leases (
           organisation_id, resource_type, resource_ref, project_ref,
           hole_ref, shift_ref, primary_device_id, operator_user_id,
           acquired_at, heartbeat_at, expires_at, takeover_reason,
           supersedes_lease_id, offline_grace_issued_at,
           offline_grace_expires_at, completion_grace_expires_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12,
           $9, $13, $14
         )
         RETURNING *`,
        [
          organisationId,
          current.resource_type,
          current.resource_ref,
          current.project_ref,
          current.hole_ref,
          current.shift_ref,
          deviceId,
          userId,
          now,
          expiresAt,
          reason,
          leaseId,
          grace.standardExpiresAt,
          grace.completionExpiresAt,
        ],
      );
      const row = firstRow(inserted.rows);
      return row === null ? null : mapLease(row);
    });
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
    return withTransaction(async (client) => {
      let holeScope: CoreResourceScope | null = null;
      if (input.holeRef) {
        const hole = firstRow(
          (
            await client.query<{
              project_ref: string;
              rig_ref: string;
              hole_ref: string;
            }>(
              `SELECT p.external_ref AS project_ref,
                      r.external_ref AS rig_ref,
                      h.external_ref AS hole_ref
               FROM pilot_holes h
               JOIN pilot_projects p
                 ON p.organisation_id = h.organisation_id
                AND p.id = h.project_id
               JOIN pilot_rigs r
                 ON r.organisation_id = h.organisation_id
                AND r.id = h.rig_id
                AND r.project_id = p.id
               WHERE h.organisation_id = $1 AND h.external_ref = $2
               LIMIT 1`,
              [organisationId, input.holeRef],
            )
          ).rows,
        );
        if (hole) {
          holeScope = {
            projectRef: hole.project_ref,
            rigRef: hole.rig_ref,
            holeRef: hole.hole_ref,
            shiftRef: null,
          };
        } else if (!input.allowMissingHole) {
          return null;
        }
      }

      let shiftScope: CoreResourceScope | null = null;
      if (input.shiftRef) {
        const shift = firstRow(
          (
            await client.query<{
              project_ref: string;
              rig_ref: string;
              hole_ref: string;
              shift_ref: string;
            }>(
              `SELECT p.external_ref AS project_ref,
                      r.external_ref AS rig_ref,
                      h.external_ref AS hole_ref,
                      s.local_id AS shift_ref
               FROM pilot_core_shifts s
               JOIN pilot_holes h
                 ON h.organisation_id = s.organisation_id
                AND h.id = s.hole_id
               JOIN pilot_projects p
                 ON p.organisation_id = h.organisation_id
                AND p.id = h.project_id
               JOIN pilot_rigs r
                 ON r.organisation_id = h.organisation_id
                AND r.id = h.rig_id
                AND r.project_id = p.id
               WHERE s.organisation_id = $1 AND s.local_id = $2
               LIMIT 1`,
              [organisationId, input.shiftRef],
            )
          ).rows,
        );
        if (!shift) return null;
        shiftScope = {
          projectRef: shift.project_ref,
          rigRef: shift.rig_ref,
          holeRef: shift.hole_ref,
          shiftRef: shift.shift_ref,
        };
      }

      const authoritative = holeScope ?? shiftScope;
      if (
        holeScope &&
        shiftScope &&
        (holeScope.projectRef !== shiftScope.projectRef ||
          holeScope.rigRef !== shiftScope.rigRef ||
          holeScope.holeRef !== shiftScope.holeRef)
      ) {
        return null;
      }
      const projectRef = authoritative?.projectRef ?? input.projectRef ?? null;
      const rigRef = authoritative?.rigRef ?? input.rigRef ?? null;
      if (!projectRef || !rigRef) return null;
      if (
        (input.projectRef && input.projectRef !== projectRef) ||
        (input.rigRef && input.rigRef !== rigRef)
      ) {
        return null;
      }
      const directory = firstRow(
        (
          await client.query(
            `SELECT 1
             FROM pilot_rigs r
             JOIN pilot_projects p
               ON p.organisation_id = r.organisation_id
              AND p.id = r.project_id
             WHERE r.organisation_id = $1
               AND r.external_ref = $2
               AND p.external_ref = $3
             LIMIT 1`,
            [organisationId, rigRef, projectRef],
          )
        ).rows,
      );
      if (!directory) return null;
      return {
        projectRef,
        rigRef,
        holeRef: authoritative?.holeRef ?? input.holeRef ?? null,
        shiftRef: shiftScope?.shiftRef ?? null,
      };
    });
  }

  async getCoreHoleSetupState(
    organisationId: string,
    holeRef: string,
  ): Promise<CoreHoleSetupState | null> {
    const holeResult = await queryPilotDatabase<{
      id: string;
      lifecycle_status: string;
    }>(
      `SELECT h.id, h.status AS lifecycle_status
         FROM pilot_holes h
        WHERE h.organisation_id = $1
          AND h.external_ref = $2
        LIMIT 1
        FOR UPDATE OF h`,
      [organisationId, holeRef],
    );
    const hole = firstRow(holeResult.rows);
    if (hole === null) return null;
    const statsResult = await queryPilotDatabase<{
      configuration_kinds: string[];
      bha_setup_count: string;
      shift_count: string;
      run_count: string;
    }>(
      `SELECT COALESCE(
                ARRAY(
                  SELECT DISTINCT c.configuration_kind
                  FROM pilot_core_hole_configurations c
                  WHERE c.organisation_id = $1
                    AND c.hole_id = $2
                  ORDER BY c.configuration_kind
                ),
                ARRAY[]::text[]
              ) AS configuration_kinds,
              (SELECT count(*)::text
                 FROM pilot_core_bha_setups b
                WHERE b.organisation_id = $1
                  AND b.hole_id = $2) AS bha_setup_count,
              (SELECT count(*)::text
                 FROM pilot_core_shifts s
                WHERE s.organisation_id = $1
                  AND s.hole_id = $2) AS shift_count,
              (SELECT count(*)::text
                 FROM pilot_core_runs r
                WHERE r.organisation_id = $1
                  AND r.hole_id = $2) AS run_count`,
      [organisationId, hole.id],
    );
    const row = firstRow(statsResult.rows);
    if (row === null) throw new Error("Core hole setup state is unavailable.");
    return {
      lifecycleStatus: hole.lifecycle_status,
      configurationKinds:
        row.configuration_kinds as CoreHoleSetupState["configurationKinds"],
      bhaSetupCount: Number(row.bha_setup_count),
      shiftCount: Number(row.shift_count),
      runCount: Number(row.run_count),
    };
  }

  async recordOperation(
    input: RecordOperationInput,
  ): Promise<OperationReceipt> {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${input.envelope.organisationId}:${input.envelope.operationId}`,
      ]);
      const existingResult = await client.query<ReceiptRow>(
        `SELECT operation_id, schema_version, organisation_id, device_id,
                operator_user_id, operation_type, project_ref, rig_ref,
                hole_ref, shift_ref, expected_version, revision_ref,
                client_time, server_received_at AS server_receipt_time,
                status, reason_code, envelope_hash, materialization_status,
                aggregate_type, aggregate_ref, aggregate_version,
                (SELECT c.cursor_id::text
                 FROM pilot_core_change_feed c
                 WHERE c.organisation_id = pilot_domain_operations.organisation_id
                   AND c.operation_id = pilot_domain_operations.operation_id)
                  AS durable_cursor
         FROM pilot_domain_operations
         WHERE organisation_id = $1 AND operation_id = $2`,
        [input.envelope.organisationId, input.envelope.operationId],
      );
      const existing = firstRow(existingResult.rows);
      if (existing !== null) {
        if (existing.envelope_hash === input.envelopeHash) {
          return mapReceipt(existing);
        }
        return {
          ...mapReceipt(existing),
          serverReceiptTime: input.receivedAt,
          status: "REJECTED",
          reasonCode: "OPERATION_ID_REUSED",
        };
      }

      let status: "ACCEPTED" | "CONFLICT" | "REJECTED" = "ACCEPTED";
      let reasonCode: string | null = null;
      const references = await registerDomainReferences(client, input.envelope);
      if (!references.contextMatches) {
        status = "REJECTED";
        reasonCode = "REFERENCE_CONTEXT_MISMATCH";
      }

      if (status === "ACCEPTED" && input.envelope.holeRef) {
        const evidence = input.envelope.leaseEvidence;
        if (!evidence || evidence.state === "NOT_REQUIRED" || !evidence.leaseId) {
          status = "REJECTED";
          reasonCode = "LEASE_EVIDENCE_REQUIRED";
        } else {
          const leaseResult = await client.query<LeaseRow>(
            `SELECT *
             FROM pilot_work_leases
             WHERE organisation_id = $1 AND id = $2
             LIMIT 1`,
            [
              input.envelope.organisationId,
              evidence.leaseId,
            ],
          );
          const lease = firstRow(leaseResult.rows);
          if (
            lease === null ||
            lease.primary_device_id !== input.envelope.deviceId ||
            lease.resource_type !== "HOLE" ||
            lease.resource_ref !== input.envelope.holeRef
          ) {
            status = "CONFLICT";
            reasonCode = "LEASE_NOT_OWNED";
          } else if (evidence.leaseVersion !== lease.version) {
            status = "CONFLICT";
            reasonCode = "LEASE_VERSION_STALE";
          } else if (evidence.state === "PRIMARY_WRITER") {
            if (
              lease.status !== "ACTIVE" ||
              Date.parse(lease.expires_at.toISOString()) <=
                Date.parse(input.receivedAt) ||
              lease.released_at !== null
            ) {
              status = "CONFLICT";
              reasonCode = "LEASE_NOT_ACTIVE";
            }
          } else {
            const useCompletionGrace =
              maximumOfflineGraceMsForOperationType(
                input.envelope.operationType,
              ) >
              30 * 60 * 1_000;
            const authoritativeGraceExpiry = useCompletionGrace
              ? lease.completion_grace_expires_at
              : lease.offline_grace_expires_at;
            const superseding = await client.query(
              `SELECT 1
               FROM pilot_work_leases
               WHERE organisation_id = $1
                 AND resource_type = $2
                 AND resource_ref = $3
                 AND id <> $4
                 AND acquired_at > $5
               LIMIT 1`,
              [
                input.envelope.organisationId,
                lease.resource_type,
                lease.resource_ref,
                lease.id,
                lease.acquired_at,
              ],
            );
            if (
              !["ACTIVE", "EXPIRED"].includes(lease.status) ||
              lease.takeover_reason !== null ||
              (lease.status === "ACTIVE" && lease.released_at !== null) ||
              superseding.rowCount ||
              Date.parse(input.receivedAt) >
                authoritativeGraceExpiry.getTime()
            ) {
              status = "CONFLICT";
              reasonCode = "OFFLINE_GRACE_INVALID";
            } else {
              reasonCode = "OFFLINE_GRACE_RECORDED";
            }
          }
        }
      }

      let currentRevision: number | null = null;
      if (status === "ACCEPTED" && input.envelope.revisionRef) {
        await client.query(
          `INSERT INTO pilot_domain_revisions (
             organisation_id, revision_ref, current_version, updated_at
           ) VALUES ($1, $2, 0, $3)
           ON CONFLICT (organisation_id, revision_ref) DO NOTHING`,
          [
            input.envelope.organisationId,
            input.envelope.revisionRef,
            input.receivedAt,
          ],
        );
        const current = firstRow(
          (
            await client.query<{ current_version: number }>(
              `SELECT current_version
               FROM pilot_domain_revisions
               WHERE organisation_id = $1 AND revision_ref = $2
               FOR UPDATE`,
              [
                input.envelope.organisationId,
                input.envelope.revisionRef,
              ],
            )
          ).rows,
        );
        currentRevision = current?.current_version ?? 0;
        if (
          input.envelope.expectedVersion != null &&
          input.envelope.expectedVersion !== currentRevision
        ) {
          status = "CONFLICT";
          reasonCode = "EXPECTED_VERSION_STALE";
        }
      }

      let materialization: CoreMaterializationOutcome = {
        status: "MATERIALIZED",
        reasonCode: null,
        aggregateVersion: null,
        cursor: null,
      };
      if (status === "ACCEPTED" && input.corePlan !== null) {
        materialization = await applyCoreMaterialization(client, input);
        if (materialization.status === "CONFLICT") {
          status = "CONFLICT";
          reasonCode = materialization.reasonCode;
        }
      }

      if (
        status === "ACCEPTED" &&
        input.envelope.revisionRef &&
        currentRevision !== null
      ) {
        const requestedNext =
          input.envelope.expectedVersion != null
            ? input.envelope.expectedVersion + 1
            : Math.max(
                currentRevision + 1,
                input.corePlan?.revisionVersion ?? 0,
              );
        await client.query(
          `UPDATE pilot_domain_revisions
           SET current_version = $3, updated_at = $4, last_operation_id = $5
           WHERE organisation_id = $1 AND revision_ref = $2`,
          [
            input.envelope.organisationId,
            input.envelope.revisionRef,
            requestedNext,
            input.receivedAt,
            input.envelope.operationId,
          ],
        );
      }

      const materializationStatus =
        input.corePlan === null
          ? "JOURNAL_ONLY"
          : status === "ACCEPTED"
            ? "MATERIALIZED"
            : "NOT_APPLIED";
      const payload = JSON.stringify(input.envelope.payload);
      const inserted = await client.query<ReceiptRow>(
        `INSERT INTO pilot_domain_operations (
           organisation_id, operation_id, schema_version, device_id,
           operator_user_id, operation_type, project_id, rig_id, hole_id,
           project_ref, rig_ref, hole_ref, shift_ref, expected_version,
           revision_ref,
           client_time, server_received_at, envelope_hash, payload_hash,
           payload_size_bytes, payload, lease_evidence, status, reason_code,
           materialization_status, aggregate_type, aggregate_ref,
           aggregate_version
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb, $23,
           $24, $25, $26, $27, $28
         )
         RETURNING operation_id, schema_version, organisation_id, device_id,
                   operator_user_id, operation_type, project_ref, rig_ref,
                   hole_ref, shift_ref, expected_version, revision_ref, client_time,
                   server_received_at AS server_receipt_time, status,
                   reason_code, envelope_hash, materialization_status,
                   aggregate_type, aggregate_ref, aggregate_version`,
        [
          input.envelope.organisationId,
          input.envelope.operationId,
          input.envelope.schemaVersion,
          input.envelope.deviceId,
          input.envelope.operatorId,
          input.envelope.operationType,
          references.projectId,
          references.rigId,
          references.holeId,
          input.envelope.projectRef ?? null,
          input.envelope.rigRef ?? null,
          input.envelope.holeRef ?? null,
          input.envelope.shiftRef ?? null,
          input.envelope.expectedVersion ?? null,
          input.envelope.revisionRef ?? null,
          input.envelope.clientTime,
          input.receivedAt,
          input.envelopeHash,
          input.envelope.payloadHash,
          Buffer.byteLength(payload, "utf8"),
          payload,
          input.envelope.leaseEvidence === undefined
            ? null
            : JSON.stringify(input.envelope.leaseEvidence),
          status,
          reasonCode,
          materializationStatus,
          input.corePlan?.aggregateType ?? null,
          input.corePlan?.aggregateRef ?? null,
          materialization.aggregateVersion,
        ],
      );
      const row = firstRow(inserted.rows);
      if (row === null) throw new Error("Operation receipt returned no row.");
      if (status === "ACCEPTED" && input.corePlan !== null) {
        await client.query(
          `INSERT INTO pilot_audit_events (
             organisation_id, actor_user_id, actor_device_id, action,
             target_type, target_id, reason, metadata, occurred_at
           ) VALUES ($1,$2,$3,'CORE_OPERATION_MATERIALIZED',$4,$5,NULL,$6::jsonb,$7)`,
          [
            input.envelope.organisationId,
            input.envelope.operatorId,
            input.envelope.deviceId,
            input.corePlan.aggregateType,
            input.corePlan.aggregateRef,
            JSON.stringify({
              operationId: input.envelope.operationId,
              operationType: input.envelope.operationType,
              aggregateVersion: materialization.aggregateVersion,
              clientTime: input.envelope.clientTime,
              entityKinds: [
                ...new Set(
                  input.corePlan.projections.map((projection) => projection.kind),
                ),
              ],
            }),
            input.receivedAt,
          ],
        );
      }
      return {
        ...mapReceipt(row),
        durableCursor: materialization.cursor,
      };
    });
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
    return withTransaction((client) =>
      readCoreDirectory(client, organisationId, assignment, generatedAt),
    );
  }

  async getCoreHoleSnapshot(
    organisationId: string,
    holeRef: string,
    generatedAt: string,
  ): Promise<CoreHoleSnapshot | null> {
    return withTransaction((client) =>
      readCoreHoleSnapshot(client, organisationId, holeRef, generatedAt),
    );
  }

  async listCoreChanges(
    organisationId: string,
    input: {
      readonly cursor: string;
      readonly limit: number;
      readonly holeRef?: string;
    },
  ): Promise<CoreChangesPage> {
    return withTransaction((client) =>
      readCoreChanges(client, organisationId, input),
    );
  }

  async getCoreConflictDetails(
    organisationId: string,
    operationId: string,
  ): Promise<CoreConflictDetails | null> {
    return withTransaction((client) =>
      readCoreConflictDetails(client, organisationId, operationId),
    );
  }

  async prepareCoreRestore(input: CoreRestoreAttemptInput): Promise<void> {
    await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO pilot_core_restore_attempts (
           organisation_id, restore_id, device_id, actor_user_id, status,
           reason, hole_refs, snapshot_cursor, dry_run_record_count, prepared_at
         ) VALUES ($1,$2,$3,$4,'PREPARED',$5,$6::text[],$7::bigint,$8,$9)
         ON CONFLICT (organisation_id, restore_id) DO NOTHING`,
        [
          input.organisationId,
          input.restoreId,
          input.deviceId,
          input.actorUserId,
          input.reason,
          input.holeRefs,
          input.snapshotCursor,
          input.dryRunRecordCount,
          input.occurredAt,
        ],
      );
      const existing = firstRow(
        (
          await client.query<{
            device_id: string;
            actor_user_id: string;
            reason: string;
            hole_refs: string[];
            snapshot_cursor: string;
            dry_run_record_count: number;
          }>(
            `SELECT device_id, actor_user_id, reason, hole_refs,
                    snapshot_cursor::text, dry_run_record_count
             FROM pilot_core_restore_attempts
             WHERE organisation_id = $1 AND restore_id = $2`,
            [input.organisationId, input.restoreId],
          )
        ).rows,
      );
      if (
        !existing ||
        existing.device_id !== input.deviceId ||
        existing.actor_user_id !== input.actorUserId ||
        existing.reason !== input.reason ||
        JSON.stringify(existing.hole_refs) !== JSON.stringify(input.holeRefs) ||
        existing.snapshot_cursor !== input.snapshotCursor ||
        existing.dry_run_record_count !== input.dryRunRecordCount
      ) {
        throw new Error("RESTORE_ID_REUSED");
      }
      if (inserted.rowCount) {
        await client.query(
          `INSERT INTO pilot_audit_events (
             organisation_id, actor_user_id, actor_device_id, action,
             target_type, target_id, reason, metadata, occurred_at
           ) VALUES ($1,$2,$3,'CORE_RESTORE_PREPARED','DEVICE',$3,$4,$5::jsonb,$6)`,
          [
            input.organisationId,
            input.actorUserId,
            input.deviceId,
            input.reason,
            JSON.stringify({
              restoreId: input.restoreId,
              holeRefs: input.holeRefs,
              snapshotCursor: input.snapshotCursor,
              dryRunRecordCount: input.dryRunRecordCount,
            }),
            input.occurredAt,
          ],
        );
      }
    });
  }

  async commitCoreRestore(input: CoreRestoreAttemptInput): Promise<void> {
    await withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE pilot_core_restore_attempts
         SET status = 'COMMITTED', committed_at = $3
         WHERE organisation_id = $1 AND restore_id = $2
           AND device_id = $4 AND actor_user_id = $5
           AND status = 'PREPARED'
         RETURNING restore_id`,
        [
          input.organisationId,
          input.restoreId,
          input.occurredAt,
          input.deviceId,
          input.actorUserId,
        ],
      );
      if (!updated.rowCount) {
        const existing = await client.query(
          `SELECT 1 FROM pilot_core_restore_attempts
           WHERE organisation_id = $1 AND restore_id = $2
             AND device_id = $3 AND actor_user_id = $4
             AND status = 'COMMITTED'`,
          [
            input.organisationId,
            input.restoreId,
            input.deviceId,
            input.actorUserId,
          ],
        );
        if (!existing.rowCount) throw new Error("RESTORE_NOT_PREPARED");
        return;
      }
      await client.query(
        `INSERT INTO pilot_audit_events (
           organisation_id, actor_user_id, actor_device_id, action,
           target_type, target_id, reason, metadata, occurred_at
         ) VALUES ($1,$2,$3,'CORE_DEVICE_RESTORED','DEVICE',$3,$4,$5::jsonb,$6)`,
        [
          input.organisationId,
          input.actorUserId,
          input.deviceId,
          input.reason,
          JSON.stringify({
            restoreId: input.restoreId,
            holeRefs: input.holeRefs,
            snapshotCursor: input.snapshotCursor,
            dryRunRecordCount: input.dryRunRecordCount,
          }),
          input.occurredAt,
        ],
      );
    });
  }

  async writeAudit(record: AuditRecord): Promise<void> {
    await queryPilotDatabase(
      `INSERT INTO pilot_audit_events (
         organisation_id, actor_user_id, actor_device_id, action,
         target_type, target_id, reason, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        record.organisationId,
        record.actorUserId,
        record.actorDeviceId,
        record.action,
        record.targetType,
        record.targetId,
        record.reason,
        JSON.stringify(record.metadata),
      ],
    );
  }
}
