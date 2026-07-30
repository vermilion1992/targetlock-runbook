import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresPilotRepository } from "./postgres-repository";
import { databaseSslOptions } from "./database";
import type { JsonValue, SyncOperationEnvelope } from "./types";
import { planCoreOperation } from "./core-materialization";

const configured = Boolean(process.env.TEST_DATABASE_URL?.trim());
const pool = configured
  ? new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      ssl: databaseSslOptions(),
    })
  : null;
const organisations = [randomUUID(), randomUUID()] as const;
const users = [randomUUID(), randomUUID()] as const;
const devices = [randomUUID(), randomUUID()] as const;
const correctingSupervisor = randomUUID();

function envelope(
  organisationId: string,
  operatorId: string,
  deviceId: string,
  operationId: string,
): SyncOperationEnvelope {
  const payload = {
    repository: "runs",
    method: "saveCompletedRun",
    arguments: [{ holeId: "INTEGRATION-HOLE" }],
    clientMutationId: operationId,
    result: { status: "completed" },
  };
  return {
    operationId,
    schemaVersion: 1,
    organisationId,
    deviceId,
    operatorId,
    operationType: "runs.saveCompletedRun.v1",
    projectRef: null,
    rigRef: null,
    holeRef: null,
    shiftRef: null,
    expectedVersion: 0,
    revisionRef: "runs:INTEGRATION-HOLE",
    clientTime: "2026-07-29T00:00:00.000Z",
    payloadHash: createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex"),
    payload,
    leaseEvidence: null,
  };
}

function coreEnvelope(
  organisationId: string,
  operatorId: string,
  deviceId: string,
  input: {
    readonly operationId: string;
    readonly repository: string;
    readonly method: string;
    readonly arguments: readonly JsonValue[];
    readonly result: JsonValue;
    readonly revisionRef: string;
    readonly projectRef: string | null;
    readonly rigRef: string | null;
    readonly holeRef: string | null;
    readonly leaseId?: string;
  },
): SyncOperationEnvelope {
  const payload = {
    repository: input.repository,
    method: input.method,
    arguments: [...input.arguments],
    clientMutationId: input.operationId,
    result: input.result,
  };
  return {
    operationId: input.operationId,
    schemaVersion: 1,
    organisationId,
    deviceId,
    operatorId,
    operationType: `${input.repository}.${input.method}.v1`,
    projectRef: input.projectRef,
    rigRef: input.rigRef,
    holeRef: input.holeRef,
    shiftRef: null,
    expectedVersion: 0,
    revisionRef: input.revisionRef,
    clientTime: "2026-07-29T00:00:00.000Z",
    payloadHash: createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex"),
    payload,
    leaseEvidence: input.leaseId
      ? {
          state: "PRIMARY_WRITER",
          leaseId: input.leaseId,
          leaseVersion: 1,
          lastVerifiedAt: "2026-07-29T00:00:00.000Z",
          graceExpiresAt: null,
        }
      : null,
  };
}

function operationInput(envelope: SyncOperationEnvelope, receivedAt: string) {
  return {
    envelope,
    envelopeHash: createHash("sha256")
      .update(JSON.stringify(envelope))
      .digest("hex"),
    receivedAt,
    corePlan: planCoreOperation(envelope),
  };
}

describe.skipIf(!configured)("Postgres pilot operation journal", () => {
  beforeAll(async () => {
    for (const index of [0, 1] as const) {
      await pool!.query(
        `INSERT INTO pilot_organisations (id, slug, name)
         VALUES ($1, $2, $3)`,
        [
          organisations[index],
          `integration-${organisations[index]}`,
          `Integration ${index}`,
        ],
      );
      await pool!.query(
        `INSERT INTO pilot_users (id, email, display_name, password_hash)
         VALUES ($1, $2, $3, 'integration-not-a-login')`,
        [
          users[index],
          `integration-${users[index]}@example.test`,
          `Integration user ${index}`,
        ],
      );
      await pool!.query(
        `INSERT INTO pilot_memberships (organisation_id, user_id, role)
         VALUES ($1, $2, 'COMPANY_ADMIN')`,
        [organisations[index], users[index]],
      );
      await pool!.query(
        `INSERT INTO pilot_devices (
           id, organisation_id, display_name, token_hash, registered_by_user_id
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          devices[index],
          organisations[index],
          `Integration device ${index}`,
          `integration-token-${devices[index]}`,
          users[index],
        ],
      );
    }
    await pool!.query(
      `INSERT INTO pilot_users (id, email, display_name, password_hash)
       VALUES ($1, $2, 'Correcting supervisor', 'integration-not-a-login')`,
      [
        correctingSupervisor,
        `integration-${correctingSupervisor}@example.test`,
      ],
    );
    await pool!.query(
      `INSERT INTO pilot_memberships (organisation_id, user_id, role)
       VALUES ($1, $2, 'SUPERVISOR')`,
      [organisations[0], correctingSupervisor],
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        "DELETE FROM pilot_organisations WHERE id = ANY($1::uuid[])",
        [organisations],
      );
      await pool.query(
        "DELETE FROM pilot_users WHERE id = ANY($1::uuid[])",
        [[...users, correctingSupervisor]],
      );
      await pool.end();
    }
    await globalThis.__targetLockPilotPool?.end();
    globalThis.__targetLockPilotPool = undefined;
  });

  it("keeps replays stable, rejects stale versions, and scopes operation IDs by organisation", async () => {
    const repository = new PostgresPilotRepository();
    const operationId = randomUUID();
    const firstEnvelope = envelope(
      organisations[0],
      users[0],
      devices[0],
      operationId,
    );
    const input = {
      envelope: firstEnvelope,
      envelopeHash: createHash("sha256")
        .update(JSON.stringify(firstEnvelope))
        .digest("hex"),
      receivedAt: "2026-07-29T00:00:01.000Z",
      corePlan: null,
    };
    const first = await repository.recordOperation(input);
    await expect(repository.recordOperation(input)).resolves.toEqual(first);
    expect(first.status).toBe("ACCEPTED");

    const staleEnvelope = {
      ...firstEnvelope,
      operationId: randomUUID(),
    };
    await expect(
      repository.recordOperation({
        envelope: staleEnvelope,
        envelopeHash: createHash("sha256")
          .update(JSON.stringify(staleEnvelope))
          .digest("hex"),
        receivedAt: "2026-07-29T00:00:02.000Z",
        corePlan: null,
      }),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      reasonCode: "EXPECTED_VERSION_STALE",
    });

    const isolatedEnvelope = envelope(
      organisations[1],
      users[1],
      devices[1],
      operationId,
    );
    await expect(
      repository.recordOperation({
        envelope: isolatedEnvelope,
        envelopeHash: createHash("sha256")
          .update(JSON.stringify(isolatedEnvelope))
          .digest("hex"),
        receivedAt: "2026-07-29T00:00:03.000Z",
        corePlan: null,
      }),
    ).resolves.toMatchObject({
      organisationId: organisations[1],
      status: "ACCEPTED",
    });
  });

  it("materializes Project to Run state, serves snapshots and cursors, and rejects duplicate run numbers atomically", async () => {
    const repository = new PostgresPilotRepository();
    const project = {
      localId: "integration-project-core",
      serverId: null,
      syncStatus: "queued",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      deviceId: devices[0],
      version: 1,
      organisationId: organisations[0],
      code: `CORE-${organisations[0].slice(0, 6)}`,
      name: "Core Integration Project",
      clientName: "Integration Client",
      location: "Western Australia",
      status: "active",
    };
    const rig = {
      localId: "integration-rig-core",
      serverId: null,
      syncStatus: "queued",
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deviceId: devices[0],
      version: 1,
      organisationId: organisations[0],
      projectId: project.localId,
      name: "Integration Rig",
      serialNumber: `INT-${organisations[0].slice(0, 8)}`,
      model: "Integration model",
      status: "operating",
    };
    const projectEnvelope = coreEnvelope(
      organisations[0],
      users[0],
      devices[0],
      {
        operationId: randomUUID(),
        repository: "projects",
        method: "createProjectWithInitialRig",
        arguments: [{ projectId: project.localId }],
        result: { project, rig },
        revisionRef: `projects:${project.localId}`,
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: null,
      },
    );
    const projectReceipt = await repository.recordOperation(
      operationInput(projectEnvelope, "2026-07-29T00:00:01.000Z"),
    );
    expect(projectReceipt).toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
      aggregateType: "PROJECT_DIRECTORY",
    });

    const hole = {
      localId: "INTEGRATION-CORE-HOLE",
      serverId: null,
      syncStatus: "queued",
      createdAt: "2026-07-29T00:00:02.000Z",
      updatedAt: "2026-07-29T00:00:02.000Z",
      deviceId: devices[0],
      version: 1,
      projectId: project.localId,
      rigId: rig.localId,
      name: "INTEGRATION-CORE-HOLE",
      holeSize: "HQ",
      plannedDepth: 5_000,
      currentDepth: 0,
      status: "ACTIVE",
    };
    const leaseId = randomUUID();
    await pool!.query(
      `INSERT INTO pilot_work_leases (
         id, organisation_id, resource_type, resource_ref, project_ref,
         hole_ref, primary_device_id, operator_user_id, acquired_at,
         heartbeat_at, expires_at
       ) VALUES ($1, $2, 'HOLE', $3, $4, $3, $5, $6, $7, $7, $8)`,
      [
        leaseId,
        organisations[0],
        hole.localId,
        project.localId,
        devices[0],
        users[0],
        "2026-07-28T23:00:00.000Z",
        "2026-07-30T00:00:00.000Z",
      ],
    );
    const holeEnvelope = coreEnvelope(
      organisations[0],
      users[0],
      devices[0],
      {
        operationId: randomUUID(),
        repository: "completion",
        method: "createHole",
        arguments: [{ holeId: hole.localId }],
        result: hole,
        revisionRef: `completion:${hole.localId}`,
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: hole.localId,
        leaseId,
      },
    );
    const missingLeaseEnvelope = {
      ...holeEnvelope,
      operationId: randomUUID(),
      leaseEvidence: null,
    };
    await expect(
      repository.recordOperation(
        operationInput(
          missingLeaseEnvelope,
          "2026-07-29T00:00:02.500Z",
        ),
      ),
    ).resolves.toMatchObject({
      status: "REJECTED",
      materializationStatus: "NOT_APPLIED",
      reasonCode: "LEASE_EVIDENCE_REQUIRED",
    });
    expect(
      await repository.getCoreHoleSnapshot(
        organisations[0],
        hole.localId,
        "2026-07-29T00:00:02.600Z",
      ),
    ).toBeNull();
    await expect(
      repository.recordOperation(
        operationInput(holeEnvelope, "2026-07-29T00:00:03.000Z"),
      ),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });

    const bha = {
      localId: "integration-bha-1",
      holeId: hole.localId,
      effectiveAt: "2026-07-29T00:05:00.000Z",
      effectiveDepthDm: 0,
      bottomHoleAssemblyLengthDm: 45,
      constantStickUpDm: 20,
      baseRodStringLengthDm: 25,
      reason: "Initial integration BHA",
      recordedByUserId: users[0],
      recordedByNameSnapshot: "Integration user 0",
    };
    const shift = {
      localId: "integration-shift-1",
      serverId: null,
      syncStatus: "queued",
      createdAt: "2026-07-29T00:10:00.000Z",
      updatedAt: "2026-07-29T00:10:00.000Z",
      deviceId: devices[0],
      version: 1,
      holeId: hole.localId,
      rigId: rig.localId,
      shiftType: "DAY",
      shiftDate: "2026-07-29",
      primaryDrillerId: users[0],
      primaryDrillerNameSnapshot: "Integration user 0",
      startedAt: "2026-07-29T00:10:00.000Z",
      startingDepthDm: 0,
      startingRodNumber: 0,
      startingRodStringDm: 25,
      startingRunNumber: 1,
      status: "OPEN",
    };
    const run = {
      localId: "integration-run-1",
      startedAt: "2026-07-29T00:20:00.000Z",
      completedAt: "2026-07-29T00:40:00.000Z",
      startedShiftId: shift.localId,
      completedShiftId: shift.localId,
      startedByUserId: users[0],
      startedByNameSnapshot: "Integration user 0",
      completedByUserId: users[0],
      completedByNameSnapshot: "Integration user 0",
      holeId: hole.localId,
      runNumber: 1,
      rodNumber: 1,
      rodStringDm: 55,
      measuredStickUpDm: 5,
      previousCompletedDepthDm: 0,
      holeDepthDm: 50,
      drilledLengthDm: 50,
      recoveredLengthDm: 48,
      recoveryPercentage: 96,
      rodEvents: [
        {
          localId: "integration-rod-event-1",
          action: "add",
          rodLengthDm: 30,
          sequence: 1,
          affectedRodNumber: 1,
          rodNumberAfterEvent: 1,
          occurredAt: "2026-07-29T00:20:00.000Z",
        },
      ],
      version: 1,
      status: "completed",
    };
    const coreOperations = [
      {
        repository: "bha-setups",
        method: "save",
        localId: bha.localId,
        result: bha,
      },
      {
        repository: "shifts",
        method: "startShift",
        localId: shift.localId,
        result: shift,
      },
      {
        repository: "runs",
        method: "saveCompletedRun",
        localId: run.localId,
        result: run,
      },
    ] as const;
    for (const [index, operation] of coreOperations.entries()) {
      let operationEnvelope = coreEnvelope(
        organisations[0],
        users[0],
        devices[0],
        {
          operationId: randomUUID(),
          repository: operation.repository,
          method: operation.method,
          arguments:
            operation.repository === "runs"
              ? [
                  { holeId: hole.localId, localId: operation.localId },
                  operation.result,
                ]
              : [{ holeId: hole.localId, localId: operation.localId }],
          result: operation.result,
          revisionRef: `${operation.repository}:${operation.localId}`,
          projectRef: project.localId,
          rigRef: rig.localId,
          holeRef: hole.localId,
          leaseId,
        },
      );
      if (operation.repository === "bha-setups") {
        operationEnvelope = {
          ...operationEnvelope,
          leaseEvidence: {
            state: "OFFLINE_GRACE",
            leaseId,
            leaseVersion: 1,
            lastVerifiedAt: "2026-07-29T00:00:00.000Z",
            graceExpiresAt: "2026-07-29T00:30:00.000Z",
          },
        };
      }
      await expect(
        repository.recordOperation(
          operationInput(
            operationEnvelope,
            `2026-07-29T00:00:0${4 + index}.000Z`,
          ),
        ),
      ).resolves.toMatchObject({
        status: "ACCEPTED",
        materializationStatus: "MATERIALIZED",
        ...(operation.repository === "bha-setups"
          ? { reasonCode: "OFFLINE_GRACE_RECORDED" }
          : {}),
      });
    }

    const snapshot = await repository.getCoreHoleSnapshot(
      organisations[0],
      hole.localId,
      "2026-07-29T01:00:00.000Z",
    );
    expect(snapshot).toMatchObject({
      source: "AUTHORITATIVE_SERVER",
      hole: { localId: hole.localId },
    });
    expect(snapshot?.bhaSetups).toHaveLength(1);
    expect(snapshot?.shifts).toHaveLength(1);
    expect(snapshot?.runs).toHaveLength(1);
    expect(snapshot?.rodEvents).toHaveLength(1);

    const duplicateRunEnvelope = coreEnvelope(
      organisations[0],
      users[0],
      devices[0],
      {
        operationId: randomUUID(),
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [
          { holeId: hole.localId, localId: "integration-run-duplicate" },
          { ...run, localId: "integration-run-duplicate" },
        ],
        result: { ...run, localId: "integration-run-duplicate" },
        revisionRef: "runs:integration-run-duplicate",
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: hole.localId,
        leaseId,
      },
    );
    await expect(
      repository.recordOperation(
        operationInput(
          duplicateRunEnvelope,
          "2026-07-29T00:00:09.000Z",
        ),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      materializationStatus: "CONFLICT",
      reasonCode: "DUPLICATE_RUN_NUMBER",
    });
    expect(
      await pool!.query(
        `SELECT count(*)::int AS count FROM pilot_core_runs
         WHERE organisation_id = $1 AND hole_id = (
           SELECT id FROM pilot_holes
           WHERE organisation_id = $1 AND external_ref = $2
         )`,
        [organisations[0], hole.localId],
      ),
    ).toMatchObject({ rows: [{ count: 1 }] });

    const correctedRun = {
      ...run,
      recoveredLengthDm: 50,
      recoveryPercentage: 100,
      version: 2,
      status: "corrected",
    };
    const correctionEnvelope = coreEnvelope(
      organisations[0],
      correctingSupervisor,
      devices[0],
      {
        operationId: randomUUID(),
        repository: "run-corrections",
        method: "apply",
        arguments: [
          {
            holeId: hole.localId,
            operationId: "integration-correction-operation-1",
          },
        ],
        result: {
          snapshots: [correctedRun],
          corrections: [
            {
              id: "integration-correction-1",
              holeId: hole.localId,
              runId: run.localId,
              correctionType: "RECOVERED_LENGTH",
              reason:
                "Correcting supervisor verified the original driller measurement.",
              correctedAt: "2026-07-29T01:10:00.000Z",
              correctedByUserId: correctingSupervisor,
              correctedByNameSnapshot: "Correcting supervisor",
              operationId: "integration-correction-operation-1",
              version: 2,
            },
          ],
          operation: {
            operationId: "integration-correction-operation-1",
            runId: run.localId,
            correctionType: "RECOVERED_LENGTH",
            updatedAt: "2026-07-29T01:10:00.000Z",
          },
        },
        revisionRef: "run-corrections:integration-correction-operation-1",
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: hole.localId,
        leaseId,
      },
    );
    await expect(
      repository.recordOperation(
        operationInput(
          correctionEnvelope,
          "2026-07-29T01:10:01.000Z",
        ),
      ),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });
    const actorRows = await pool!.query(
      `SELECT
         r.actor_user_id::text AS run_actor,
         re.actor_user_id::text AS rod_actor,
         c.actor_user_id::text AS correction_actor,
         re.version AS rod_version
       FROM pilot_core_runs r
       JOIN pilot_core_rod_events re
         ON re.organisation_id = r.organisation_id
        AND re.run_id = r.id
       JOIN pilot_core_run_corrections c
         ON c.organisation_id = r.organisation_id
        AND c.run_id = r.id
       WHERE r.organisation_id = $1 AND r.local_id = $2`,
      [organisations[0], run.localId],
    );
    expect(actorRows.rows).toEqual([
      {
        run_actor: users[0],
        rod_actor: users[0],
        correction_actor: correctingSupervisor,
        rod_version: 2,
      },
    ]);
    const voidedRun = {
      ...correctedRun,
      version: 3,
      status: "void",
    };
    const voidEnvelope = coreEnvelope(
      organisations[0],
      correctingSupervisor,
      devices[0],
      {
        operationId: randomUUID(),
        repository: "run-corrections",
        method: "voidRun",
        arguments: [
          {
            holeId: hole.localId,
            operationId: "integration-void-operation-1",
          },
        ],
        result: {
          snapshots: [voidedRun],
          corrections: [
            {
              id: "integration-void-1",
              holeId: hole.localId,
              runId: run.localId,
              correctionType: "VOID",
              reason:
                "Correcting supervisor confirmed this run belongs to another hole.",
              correctedAt: "2026-07-29T01:20:00.000Z",
              correctedByUserId: correctingSupervisor,
              correctedByNameSnapshot: "Correcting supervisor",
              operationId: "integration-void-operation-1",
              version: 3,
            },
          ],
          operation: {
            operationId: "integration-void-operation-1",
            runId: run.localId,
            correctionType: "VOID",
            updatedAt: "2026-07-29T01:20:00.000Z",
          },
        },
        revisionRef: "run-corrections:integration-void-operation-1",
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: hole.localId,
        leaseId,
      },
    );
    await expect(
      repository.recordOperation(
        operationInput(voidEnvelope, "2026-07-29T01:20:01.000Z"),
      ),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });
    expect(
      await pool!.query(
        `SELECT
           r.lifecycle_status,
           r.actor_user_id::text AS run_actor,
           re.actor_user_id::text AS rod_actor,
           re.version AS rod_version,
           count(c.id)::int AS correction_count
         FROM pilot_core_runs r
         JOIN pilot_core_rod_events re
           ON re.organisation_id = r.organisation_id
          AND re.run_id = r.id
         JOIN pilot_core_run_corrections c
           ON c.organisation_id = r.organisation_id
          AND c.run_id = r.id
         WHERE r.organisation_id = $1 AND r.local_id = $2
         GROUP BY r.lifecycle_status, r.actor_user_id, re.actor_user_id, re.version`,
        [organisations[0], run.localId],
      ),
    ).toMatchObject({
      rows: [
        {
          lifecycle_status: "void",
          run_actor: users[0],
          rod_actor: users[0],
          rod_version: 3,
          correction_count: 2,
        },
      ],
    });

    await pool!.query(
      `WITH scope AS (
         SELECT
           p.id AS project_id,
           r.id AS rig_id
         FROM pilot_projects p
         JOIN pilot_rigs r
           ON r.organisation_id = p.organisation_id
          AND r.project_id = p.id
         WHERE p.organisation_id = $1
           AND p.external_ref = $2
           AND r.external_ref = $3
       ), inserted_hole AS (
         INSERT INTO pilot_holes (
           organisation_id, project_id, rig_id, external_ref, display_name,
           version, status
         )
         SELECT $1, project_id, rig_id, $4, 'Relational mismatch hole', 1, 'ACTIVE'
         FROM scope
         RETURNING id, rig_id
       )
       INSERT INTO pilot_core_shifts (
         organisation_id, hole_id, rig_id, local_id, version, shift_type,
         shift_date, lifecycle_status, started_at, closed_at,
         starting_depth_dm, ending_depth_dm, primary_driller_id,
         primary_driller_name_snapshot, client_updated_at, applied_at,
         actor_user_id, actor_device_id, authoritative_state
       )
       SELECT
         $1, id, rig_id, $5, 1, 'NIGHT', '2026-07-28', 'CLOSED',
         '2026-07-28T12:00:00.000Z', '2026-07-28T23:00:00.000Z',
         0, 0, $6, 'Integration user 0', '2026-07-28T23:00:00.000Z',
         '2026-07-28T23:00:00.000Z', $6, $7,
         jsonb_build_object('localId', $5, 'holeId', $4, 'status', 'CLOSED')
       FROM inserted_hole`,
      [
        organisations[0],
        project.localId,
        rig.localId,
        "INTEGRATION-OTHER-HOLE",
        "integration-other-hole-shift",
        users[0],
        devices[0],
      ],
    );
    const inconsistentRun = {
      ...run,
      localId: "integration-relationally-invalid-run",
      startedShiftId: "integration-other-hole-shift",
      completedShiftId: "integration-other-hole-shift",
      runNumber: 2,
      version: 1,
      status: "completed",
    };
    const inconsistentEnvelope = coreEnvelope(
      organisations[0],
      users[0],
      devices[0],
      {
        operationId: randomUUID(),
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [
          { holeId: hole.localId, localId: inconsistentRun.localId },
          inconsistentRun,
        ],
        result: inconsistentRun,
        revisionRef: `runs:${inconsistentRun.localId}`,
        projectRef: project.localId,
        rigRef: rig.localId,
        holeRef: hole.localId,
        leaseId,
      },
    );
    await expect(
      repository.recordOperation(
        operationInput(inconsistentEnvelope, "2026-07-29T01:30:00.000Z"),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      materializationStatus: "CONFLICT",
      reasonCode: "RUN_SHIFT_CONTEXT_MISMATCH",
    });

    const changes = await repository.listCoreChanges(organisations[0], {
      cursor: "0",
      limit: 100,
      holeRef: hole.localId,
    });
    expect(changes.changes.map((change) => change.entityKinds).flat()).toEqual(
      expect.arrayContaining(["HOLE", "BHA_SETUP", "SHIFT", "RUN", "ROD_EVENT"]),
    );
    expect(Number(changes.nextCursor)).toBeGreaterThan(0);

    await pool!.query(
      `UPDATE pilot_core_shifts
       SET lifecycle_status = 'CLOSED',
           authoritative_state = authoritative_state || '{"status":"CLOSED"}'::jsonb
       WHERE organisation_id = $1
         AND hole_id = (
           SELECT id FROM pilot_holes
           WHERE organisation_id = $1 AND external_ref = $2
         )`,
      [organisations[0], hole.localId],
    );
    const competingShifts = [
      {
        ...shift,
        localId: "integration-shift-day-2",
        shiftType: "DAY",
        shiftDate: "2026-07-30",
        startedAt: "2026-07-30T00:10:00.000Z",
        updatedAt: "2026-07-30T00:10:00.000Z",
      },
      {
        ...shift,
        localId: "integration-shift-night-2",
        shiftType: "NIGHT",
        shiftDate: "2026-07-31",
        startedAt: "2026-07-31T12:10:00.000Z",
        updatedAt: "2026-07-31T12:10:00.000Z",
      },
    ] as const;
    const competingReceipts = await Promise.all(
      competingShifts.map((candidate, index) => {
        const candidateEnvelope = coreEnvelope(
          organisations[0],
          users[0],
          devices[0],
          {
            operationId: randomUUID(),
            repository: "shifts",
            method: "startShift",
            arguments: [
              { holeId: hole.localId, localId: candidate.localId },
            ],
            result: candidate,
            revisionRef: `shifts:${candidate.localId}`,
            projectRef: project.localId,
            rigRef: rig.localId,
            holeRef: hole.localId,
            leaseId,
          },
        );
        return repository.recordOperation(
          operationInput(
            candidateEnvelope,
            `2026-07-29T00:01:0${index}.000Z`,
          ),
        );
      }),
    );
    expect(
      competingReceipts.map((receipt) => receipt.status).sort(),
    ).toEqual(["ACCEPTED", "CONFLICT"]);
    expect(competingReceipts).toContainEqual(
      expect.objectContaining({
        status: "CONFLICT",
        materializationStatus: "CONFLICT",
        reasonCode: "ACTIVE_SHIFT_EXISTS",
      }),
    );
    expect(
      await pool!.query(
        `SELECT count(*)::int AS count FROM pilot_core_shifts
         WHERE organisation_id = $1
           AND hole_id = (
             SELECT id FROM pilot_holes
             WHERE organisation_id = $1 AND external_ref = $2
           )
           AND lifecycle_status IN ('OPEN', 'HANDOVER_PENDING')`,
        [organisations[0], hole.localId],
      ),
    ).toMatchObject({ rows: [{ count: 1 }] });

    expect(
      await repository.getCoreHoleSnapshot(
        organisations[1],
        hole.localId,
        "2026-07-29T01:00:00.000Z",
      ),
    ).toBeNull();
  });
});
