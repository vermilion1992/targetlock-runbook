import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { PilotAuthorizationError } from "./permissions";
import {
  PilotAuthenticationError,
  PilotConflictError,
  PilotFoundationService,
} from "./services";
import { InMemoryPilotRepository } from "./testing-memory-repository";
import type {
  PilotPrincipal,
  PilotRequestContext,
  SyncOperationEnvelope,
} from "./types";

const ORG_A = "10000000-0000-4000-8000-000000000001";
const ORG_B = "10000000-0000-4000-8000-000000000002";
const ADMIN = "20000000-0000-4000-8000-000000000001";
const DRILLER = "20000000-0000-4000-8000-000000000002";
const SUPERVISOR_B = "20000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-07-28T12:00:00.000Z");
let passwordHash = "";

beforeAll(async () => {
  passwordHash = await hash("safe-test-password", 4);
});

function setup() {
  const repository = new InMemoryPilotRepository();
  repository.addIdentity({
    organisationSlug: "alpha-drilling",
    organisationId: ORG_A,
    organisationName: "Alpha Drilling",
    organisationStatus: "ACTIVE",
    userId: ADMIN,
    email: "admin@alpha.test",
    displayName: "Alex Admin",
    passwordHash,
    userStatus: "ACTIVE",
    role: "COMPANY_ADMIN",
    membershipStatus: "ACTIVE",
    sessionVersion: 1,
  });
  repository.addIdentity({
    organisationSlug: "alpha-drilling",
    organisationId: ORG_A,
    organisationName: "Alpha Drilling",
    organisationStatus: "ACTIVE",
    userId: DRILLER,
    email: "driller@alpha.test",
    displayName: "Drew Driller",
    passwordHash,
    userStatus: "ACTIVE",
    role: "DRILLER",
    membershipStatus: "ACTIVE",
    sessionVersion: 1,
  });
  repository.addIdentity({
    organisationSlug: "beta-drilling",
    organisationId: ORG_B,
    organisationName: "Beta Drilling",
    organisationStatus: "ACTIVE",
    userId: SUPERVISOR_B,
    email: "supervisor@beta.test",
    displayName: "Sam Supervisor",
    passwordHash,
    userStatus: "ACTIVE",
    role: "SUPERVISOR",
    membershipStatus: "ACTIVE",
    sessionVersion: 1,
  });
  const tokens = [
    "admin-session",
    "device-a",
    "device-b",
    "driller-session",
    "beta-session",
    "device-beta",
  ];
  const service = new PilotFoundationService(repository, {
    sessionSecret: "test-secret-that-is-long-enough-for-hmac",
    sessionTtlSeconds: 3600,
    now: () => NOW,
    token: () => tokens.shift() ?? "fallback-token",
  });
  return { repository, service };
}

async function signIn(
  service: PilotFoundationService,
  organisation: string,
  email: string,
): Promise<{ principal: PilotPrincipal; token: string }> {
  return service.login(
    { organisation, email, password: "safe-test-password" },
    {},
  );
}

describe("pilot identity, device, lease, and sync services", () => {
  it("returns one generic error for unknown or invalid login details", async () => {
    const { service } = setup();
    await expect(
      service.login(
        {
          organisation: "alpha-drilling",
          email: "unknown@alpha.test",
          password: "safe-test-password",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PilotAuthenticationError);
  });

  it("expires access immediately when a user is disabled or a session revoked", async () => {
    const { service } = setup();
    const login = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    expect(await service.resolvePrincipal(login.token)).not.toBeNull();

    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    await service.setUserStatus(admin.principal, {
      userId: DRILLER,
      status: "DISABLED",
      reason: "Operator access withdrawn for the controlled pilot.",
    });
    expect(await service.resolvePrincipal(login.token)).toBeNull();

    await service.logout(admin.principal);
    expect(await service.resolvePrincipal(admin.token)).toBeNull();
  });

  it("registers a durable organisation-scoped device and audits it", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(ORG_A, "PROJECT-1", "RIG-04-A", "DDH-041");
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Rig 04 primary tablet",
      siteName: "North lease",
      projectRef: "PROJECT-1",
      rigRef: "RIG-04",
    });
    expect(
      await service.resolveDevice(admin.principal, registration.token),
    ).toMatchObject({
      organisationId: ORG_A,
      rigRef: "RIG-04",
    });
    expect(repository.audits).toContainEqual(
      expect.objectContaining({ action: "DEVICE_REGISTERED" }),
    );

    const beta = await signIn(
      service,
      "beta-drilling",
      "supervisor@beta.test",
    );
    expect(
      await service.resolveDevice(beta.principal, registration.token),
    ).toBeNull();
  });

  it("blocks lease contention, supports audited supervisor takeover, and isolates organisations", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(ORG_A, "PROJECT-1", "RIG-04-A", "DDH-041");
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const deviceA = await service.registerDevice(admin.principal, {
      displayName: "Rig 04 tablet A",
      rigRef: "RIG-04-A",
    });
    const deviceB = await service.registerDevice(admin.principal, {
      displayName: "Rig 04 tablet B",
      rigRef: "RIG-04-B",
    });
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    const contextA: PilotRequestContext = {
      principal: driller.principal,
      device: await service.resolveDevice(driller.principal, deviceA.token),
    };
    const contextB: PilotRequestContext = {
      principal: admin.principal,
      device: await service.resolveDevice(admin.principal, deviceB.token),
    };
    const target = {
      resourceType: "HOLE" as const,
      resourceRef: "DDH-041",
      projectRef: "PROJECT-1",
      holeRef: "DDH-041",
    };
    const lease = await service.acquireLease(contextA, {
      ...target,
      ttlSeconds: 300,
    });

    await expect(
      service.acquireLease(contextB, { ...target, ttlSeconds: 300 }),
    ).rejects.toMatchObject({
      code: "LEASE_OWNED_BY_ANOTHER_DEVICE",
    });
    const replacement = await service.takeoverLease(contextB, {
      leaseId: lease.id,
      reason: "Primary tablet failed during the active shift.",
      ttlSeconds: 300,
    });
    expect(replacement.primaryDeviceId).toBe(contextB.device?.id);
    expect(repository.audits).toContainEqual(
      expect.objectContaining({ action: "LEASE_TAKEOVER" }),
    );

    const beta = await signIn(
      service,
      "beta-drilling",
      "supervisor@beta.test",
    );
    const betaStatus = await service.getLeaseStatus(
      { principal: beta.principal, device: null },
      target,
    );
    expect(betaStatus).toEqual({ state: "AVAILABLE", lease: null });
  });

  it("persists idempotent typed journal envelopes with lease evidence", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(ORG_A, "PROJECT-1", "RIG-05", "DDH-041");
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Receipt tablet",
      rigRef: "RIG-05",
    });
    const context: PilotRequestContext = {
      principal: admin.principal,
      device: await service.resolveDevice(
        admin.principal,
        registration.token,
      ),
    };
    const lease = await service.acquireLease(context, {
      resourceType: "HOLE",
      resourceRef: "DDH-041",
      projectRef: "PROJECT-1",
      holeRef: "DDH-041",
      ttlSeconds: 300,
    });
    const payload = {
      repository: "surveys",
      method: "create",
      arguments: [{ holeId: "DDH-041", localId: "survey-148" }],
      clientMutationId: "survey-recorded-148",
      result: { status: "recorded" },
    };
    const envelope: SyncOperationEnvelope = {
      operationId: "30000000-0000-4000-8000-000000000001",
      schemaVersion: 1,
      organisationId: ORG_A,
      deviceId: context.device!.id,
      operatorId: ADMIN,
      operationType: "surveys.create.v1",
      projectRef: "PROJECT-1",
      rigRef: "RIG-05",
      holeRef: "DDH-041",
      expectedVersion: 0,
      revisionRef: "surveys:survey-148",
      clientTime: "2026-07-28T11:59:00.000Z",
      payloadHash: createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      payload,
      leaseEvidence: {
        state: "PRIMARY_WRITER",
        leaseId: lease.id,
        leaseVersion: lease.version,
        lastVerifiedAt: "2026-07-28T11:59:00.000Z",
        graceExpiresAt: null,
      },
    };
    const first = await service.recordOperation(context, envelope);
    const duplicate = await service.recordOperation(context, envelope);
    expect(first.status).toBe("ACCEPTED");
    expect(duplicate).toEqual(first);
    const stale = await service.recordOperation(context, {
      ...envelope,
      operationId: "30000000-0000-4000-8000-000000000002",
    });
    expect(stale).toMatchObject({
      status: "CONFLICT",
      reasonCode: "EXPECTED_VERSION_STALE",
    });

    const reused = await service.recordOperation(context, {
      ...envelope,
      payload: { ...payload, result: { status: "different" } },
      payloadHash: createHash("sha256")
        .update(
          JSON.stringify({ ...payload, result: { status: "different" } }),
        )
        .digest("hex"),
    });
    expect(reused).toMatchObject({
      status: "REJECTED",
      reasonCode: "OPERATION_ID_REUSED",
    });

    await expect(
      service.recordOperation(context, {
        ...envelope,
        operationId: "30000000-0000-4000-8000-000000000003",
        organisationId: ORG_B,
      }),
    ).rejects.toBeInstanceOf(PilotConflictError);
    await expect(
      service.recordOperation(context, {
        ...envelope,
        operationId: "30000000-0000-4000-8000-000000000004",
        clientTime: "2026-07-28T12:05:01.000Z",
      }),
    ).rejects.toMatchObject({ code: "CLIENT_TIME_AHEAD" });
  });

  it("enforces authoritative device assignment scope and audits privileged cross-scope reads", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(ORG_A, "PROJECT-A", "RIG-A", "HOLE-A");
    repository.seedCoreScope(ORG_A, "PROJECT-B", "RIG-B", "HOLE-B");
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Assigned rig tablet",
      projectRef: "PROJECT-A",
      rigRef: "RIG-A",
    });
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    const device = await service.resolveDevice(
      driller.principal,
      registration.token,
    );
    const drillerContext = { principal: driller.principal, device };

    await expect(
      service.acquireLease(drillerContext, {
        resourceType: "HOLE",
        resourceRef: "HOLE-B",
        projectRef: "PROJECT-B",
        holeRef: "HOLE-B",
        ttlSeconds: 300,
      }),
    ).rejects.toMatchObject({ code: "DEVICE_ASSIGNMENT_MISMATCH" });
    await expect(
      service.getCoreHoleSnapshot(drillerContext, "HOLE-B"),
    ).rejects.toMatchObject({ code: "DEVICE_ASSIGNMENT_MISMATCH" });
    await expect(
      service.listCoreChanges(drillerContext, {
        holeRef: "HOLE-B",
      }),
    ).rejects.toMatchObject({ code: "DEVICE_ASSIGNMENT_MISMATCH" });
    await expect(
      service.recordCoreRestore(drillerContext, {
        phase: "PREPARE",
        restoreId: "70000000-0000-4000-8000-000000000001",
        reason: "Cross assignment restore must fail closed.",
        holeRefs: ["HOLE-B"],
        snapshotCursor: "0",
        dryRunRecordCount: 1,
      }),
    ).rejects.toMatchObject({ code: "DEVICE_ASSIGNMENT_MISMATCH" });

    const adminContext: PilotRequestContext = {
      principal: admin.principal,
      device: await service.resolveDevice(
        admin.principal,
        registration.token,
      ),
    };
    await expect(
      service.getCoreHoleSnapshot(adminContext, "HOLE-B"),
    ).resolves.toMatchObject({ hole: { localId: "HOLE-B" } });
    expect(repository.audits).toContainEqual(
      expect.objectContaining({
        action: "DEVICE_ASSIGNMENT_OVERRIDE",
        targetType: "CORE_SNAPSHOT_READ",
      }),
    );
  });

  it("rejects privileged setup journal operations from a Driller", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(ORG_A, "PROJECT-1", "RIG-100", "DDH-100");
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Shared rig tablet",
      projectRef: "PROJECT-1",
      rigRef: "RIG-100",
    });
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    const device = await service.resolveDevice(
      driller.principal,
      registration.token,
    );
    const lease = await service.acquireLease(
      { principal: driller.principal, device },
      {
        resourceType: "HOLE",
        resourceRef: "DDH-100",
        holeRef: "DDH-100",
        ttlSeconds: 300,
      },
    );
    const payload = {
      repository: "components",
      method: "assignInitial",
      arguments: [{ holeId: "DDH-100" }],
      clientMutationId: "assign-1",
    };
    await expect(
      service.recordOperation(
        { principal: driller.principal, device },
        {
          operationId: "30000000-0000-4000-8000-000000000010",
          schemaVersion: 1,
          organisationId: ORG_A,
          deviceId: device!.id,
          operatorId: DRILLER,
          operationType: "components.assignInitial.v1",
          projectRef: null,
          rigRef: "RIG-100",
          holeRef: "DDH-100",
          shiftRef: null,
          expectedVersion: null,
          revisionRef: "components:DDH-100",
          clientTime: "2026-07-28T11:59:00.000Z",
          payloadHash: createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("hex"),
          payload,
          leaseEvidence: {
            state: "PRIMARY_WRITER",
            leaseId: lease.id,
            leaseVersion: lease.version,
            lastVerifiedAt: "2026-07-28T11:59:00.000Z",
            graceExpiresAt: null,
          },
        },
      ),
    ).rejects.toBeInstanceOf(PilotAuthorizationError);
    await expect(
      service.recordOperation(
        { principal: driller.principal, device },
        {
          operationId: "30000000-0000-4000-8000-000000000011",
          schemaVersion: 1,
          organisationId: ORG_A,
          deviceId: device!.id,
          operatorId: DRILLER,
          operationType: "runs.saveCompletedRun.v1",
          projectRef: null,
          rigRef: null,
          holeRef: "DDH-100",
          shiftRef: null,
          expectedVersion: null,
          revisionRef: "components:DDH-100",
          clientTime: "2026-07-28T11:59:00.000Z",
          payloadHash: createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("hex"),
          payload,
          leaseEvidence: {
            state: "PRIMARY_WRITER",
            leaseId: lease.id,
            leaseVersion: lease.version,
            lastVerifiedAt: "2026-07-28T11:59:00.000Z",
            graceExpiresAt: null,
          },
        },
      ),
    ).rejects.toMatchObject({ code: "OPERATION_TYPE_MISMATCH" });
  });

  it("leases and creates a missing assigned hole only with a client plan reference", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(
      ORG_A,
      "PROJECT-PLAN",
      "RIG-PLAN",
      "EXISTING-HOLE",
    );
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Client plan tablet",
      projectRef: "PROJECT-PLAN",
      rigRef: "RIG-PLAN",
    });
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    const device = await service.resolveDevice(
      driller.principal,
      registration.token,
    );
    const context = { principal: driller.principal, device };
    const lease = await service.acquireLease(context, {
      resourceType: "HOLE",
      resourceRef: "PLAN-HOLE",
      projectRef: "PROJECT-PLAN",
      holeRef: "PLAN-HOLE",
      ttlSeconds: 300,
    });
    const hole = {
      localId: "PLAN-HOLE",
      serverId: null,
      syncStatus: "queued",
      createdAt: "2026-07-28T11:59:00.000Z",
      updatedAt: "2026-07-28T11:59:00.000Z",
      deviceId: device!.id,
      version: 1,
      projectId: "PROJECT-PLAN",
      rigId: "RIG-PLAN",
      name: "PLAN-HOLE",
      holeSize: "HQ",
      plannedDepth: 1_000,
      currentDepth: 0,
      status: "DRAFT",
    } as const;
    const operation = (
      operationId: string,
      result: typeof hole & { readonly planReference?: string },
    ): SyncOperationEnvelope => {
      const payload = {
        repository: "completion",
        method: "createHole",
        arguments: [{ holeId: "PLAN-HOLE" }],
        clientMutationId: operationId,
        result,
      };
      return {
        operationId,
        schemaVersion: 1,
        organisationId: ORG_A,
        deviceId: device!.id,
        operatorId: DRILLER,
        operationType: "completion.createHole.v1",
        projectRef: "PROJECT-PLAN",
        rigRef: "RIG-PLAN",
        holeRef: "PLAN-HOLE",
        shiftRef: null,
        expectedVersion: null,
        revisionRef: "completion:PLAN-HOLE",
        clientTime: "2026-07-28T11:59:00.000Z",
        payloadHash: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        payload,
        leaseEvidence: {
          state: "PRIMARY_WRITER",
          leaseId: lease.id,
          leaseVersion: lease.version,
          lastVerifiedAt: "2026-07-28T11:59:00.000Z",
          graceExpiresAt: null,
        },
      };
    };

    await expect(
      service.recordOperation(
        context,
        operation("30000000-0000-4000-8000-000000000014", hole),
      ),
    ).rejects.toMatchObject({ code: "CLIENT_PLAN_REFERENCE_REQUIRED" });
    await expect(
      service.recordOperation(
        context,
        operation("30000000-0000-4000-8000-000000000015", {
          ...hole,
          planReference: "CLIENT-WI-041",
        }),
      ),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });
  });

  it("allows one initial BHA on an assigned Draft hole and blocks later changes", async () => {
    const { repository, service } = setup();
    repository.seedCoreScope(
      ORG_A,
      "PROJECT-DRAFT",
      "RIG-DRAFT",
      "DDH-DRAFT",
      "DRAFT",
    );
    const admin = await signIn(service, "alpha-drilling", "admin@alpha.test");
    const registration = await service.registerDevice(admin.principal, {
      displayName: "Assigned draft tablet",
      projectRef: "PROJECT-DRAFT",
      rigRef: "RIG-DRAFT",
    });
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    const device = await service.resolveDevice(
      driller.principal,
      registration.token,
    );
    const context = { principal: driller.principal, device };
    const lease = await service.acquireLease(context, {
      resourceType: "HOLE",
      resourceRef: "DDH-DRAFT",
      holeRef: "DDH-DRAFT",
      ttlSeconds: 300,
    });
    const result = {
      localId: "bha-initial",
      holeId: "DDH-DRAFT",
      effectiveAt: "2026-07-28T11:59:00.000Z",
      effectiveDepthDm: 0,
      bottomHoleAssemblyLengthDm: 60,
      constantStickUpDm: 10,
      baseRodStringLengthDm: 50,
      reason: "Initial drilling setup",
      recordedByUserId: DRILLER,
      recordedByNameSnapshot: "Drew Driller",
    };
    const operation = (operationId: string): SyncOperationEnvelope => {
      const payload = {
        repository: "bha-setups",
        method: "save",
        arguments: [result],
        clientMutationId: operationId,
        result,
      };
      return {
        operationId,
        schemaVersion: 1,
        organisationId: ORG_A,
        deviceId: device!.id,
        operatorId: DRILLER,
        operationType: "bha-setups.save.v1",
        projectRef: "PROJECT-DRAFT",
        rigRef: "RIG-DRAFT",
        holeRef: "DDH-DRAFT",
        shiftRef: null,
        expectedVersion: null,
        revisionRef: "bha-setups:bha-initial",
        clientTime: "2026-07-28T11:59:00.000Z",
        payloadHash: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        payload,
        leaseEvidence: {
          state: "PRIMARY_WRITER",
          leaseId: lease.id,
          leaseVersion: lease.version,
          lastVerifiedAt: "2026-07-28T11:59:00.000Z",
          graceExpiresAt: null,
        },
      };
    };

    await expect(
      service.recordOperation(
        context,
        operation("30000000-0000-4000-8000-000000000012"),
      ),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });
    await expect(
      service.recordOperation(
        context,
        operation("30000000-0000-4000-8000-000000000013"),
      ),
    ).rejects.toMatchObject({
      code: "INITIAL_BHA_ALREADY_RECORDED",
    });
  });

  it("prevents a Driller from provisioning accounts", async () => {
    const { service } = setup();
    const driller = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    await expect(
      service.provisionUser(driller.principal, {
        email: "new@alpha.test",
        displayName: "New User",
        role: "DRILLER",
        temporaryPassword: "temporary-password",
      }),
    ).rejects.toBeInstanceOf(PilotAuthorizationError);
  });

  it("changes a signed-in password and revokes every prior session", async () => {
    const { service } = setup();
    const login = await signIn(
      service,
      "alpha-drilling",
      "driller@alpha.test",
    );
    await service.changePassword(login.principal, {
      currentPassword: "safe-test-password",
      newPassword: "new-safe-test-password",
    });
    expect(await service.resolvePrincipal(login.token)).toBeNull();
    await expect(
      service.login(
        {
          organisation: "alpha-drilling",
          email: "driller@alpha.test",
          password: "safe-test-password",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PilotAuthenticationError);
    await expect(
      service.login(
        {
          organisation: "alpha-drilling",
          email: "driller@alpha.test",
          password: "new-safe-test-password",
        },
        {},
      ),
    ).resolves.toMatchObject({
      principal: { userId: DRILLER },
    });
  });

  it("rolls back privileged state when the mandatory audit write fails", async () => {
    const { repository, service } = setup();
    const admin = await signIn(
      service,
      "alpha-drilling",
      "admin@alpha.test",
    );
    repository.failNextAudit();
    await expect(
      service.registerDevice(admin.principal, {
        displayName: "Should roll back",
        siteName: null,
        projectRef: null,
        rigRef: null,
      }),
    ).rejects.toThrow(/mandatory audit failure/i);
    await expect(repository.listDevices(ORG_A)).resolves.toEqual([]);
    expect(repository.audits).toEqual([]);
  });
});
