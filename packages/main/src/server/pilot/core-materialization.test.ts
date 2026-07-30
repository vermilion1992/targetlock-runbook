import { describe, expect, it } from "vitest";

import { PILOT_OPERATION_MANIFEST } from "@/domain/pilot-operation-manifest";
import type { JsonValue, SyncOperationEnvelope } from "./types";
import {
  CoreOperationValidationError,
  isCoreOperationType,
  planCoreOperation,
} from "./core-materialization";
import { InMemoryPilotRepository } from "./testing-memory-repository";

const NOW = "2026-07-29T10:00:00.000Z";

function envelope(
  repository: string,
  method: string,
  result: JsonValue,
  context: Partial<SyncOperationEnvelope> = {},
): SyncOperationEnvelope {
  return {
    operationId: "11111111-1111-4111-8111-111111111111",
    schemaVersion: 1,
    organisationId: "22222222-2222-4222-8222-222222222222",
    deviceId: "33333333-3333-4333-8333-333333333333",
    operatorId: "operator-a",
    operationType: `${repository}.${method}.v1`,
    projectRef: "project-pilot",
    rigRef: "rig-pilot",
    holeRef: "PILOT001",
    shiftRef: null,
    expectedVersion: 0,
    revisionRef: `${repository}:PILOT001`,
    clientTime: NOW,
    payloadHash: "a".repeat(64),
    payload: {
      repository,
      method,
      arguments: [{ holeId: "PILOT001" }],
      clientMutationId: "mutation-a",
      result,
    },
    leaseEvidence: {
      state: "PRIMARY_WRITER",
      leaseId: "44444444-4444-4444-8444-444444444444",
      leaseVersion: 1,
      lastVerifiedAt: NOW,
      graceExpiresAt: null,
    },
    ...context,
  };
}

describe("authoritative core materialization planning", () => {
  it("has a fail-closed server handler registration for every manifest materializer", () => {
    for (const [repository, methods] of Object.entries(
      PILOT_OPERATION_MANIFEST,
    )) {
      for (const [method, definition] of Object.entries(methods)) {
        if (definition.materializer !== null) {
          expect(
            isCoreOperationType(`${repository}.${method}.v1`),
            `${repository}.${method} is marked authoritative but lacks a handler`,
          ).toBe(true);
        }
      }
    }
  });

  it("normalizes a project and initial rig into one directory aggregate and rolls back mandatory-audit failure", async () => {
    const project = {
      localId: "project-pilot",
      serverId: null,
      syncStatus: "queued",
      createdAt: NOW,
      updatedAt: NOW,
      deviceId: "device-a",
      version: 1,
      organisationId: "22222222-2222-4222-8222-222222222222",
      code: "PILOT-01",
      name: "Pilot Project",
      clientName: "Pilot Client",
      location: "Western Australia",
      status: "active",
    };
    const rig = {
      localId: "rig-pilot",
      serverId: null,
      syncStatus: "queued",
      createdAt: NOW,
      updatedAt: NOW,
      deviceId: "device-a",
      version: 1,
      organisationId: project.organisationId,
      projectId: project.localId,
      name: "Pilot Rig",
      serialNumber: "RIG-001",
      model: "Pilot model",
      status: "operating",
    };

    const projectEnvelope = envelope(
      "projects",
      "createProjectWithInitialRig",
      { project, rig },
      {
        holeRef: null,
        revisionRef: "projects:project-pilot",
      },
    );
    const plan = planCoreOperation(projectEnvelope);

    expect(plan).toMatchObject({
      semantics: "AUTHORITATIVE_CORE",
      aggregateType: "PROJECT_DIRECTORY",
      aggregateRef: "directory",
    });
    expect(plan?.projections.map((projection) => projection.kind)).toEqual([
      "PROJECT",
      "RIG",
    ]);

    const repository = new InMemoryPilotRepository();
    const input = {
      envelope: projectEnvelope,
      envelopeHash: "project-envelope-a",
      receivedAt: NOW,
      corePlan: plan,
    };
    repository.failNextAudit();
    await expect(
      repository.atomic(() => repository.recordOperation(input)),
    ).rejects.toThrow(/audit/i);
    expect(
      (
        await repository.getCoreDirectory(
          projectEnvelope.organisationId,
          { projectRef: null, rigRef: null, includeAvailable: true },
          NOW,
        )
      ).projects,
    ).toHaveLength(0);
    await expect(
      repository.atomic(() => repository.recordOperation(input)),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      materializationStatus: "MATERIALIZED",
    });
  });

  it("retains integer-decimetre run facts and rod events", () => {
    const run = {
      localId: "run-pilot-1",
      startedAt: NOW,
      completedAt: "2026-07-29T11:00:00.000Z",
      startedShiftId: "shift-pilot-1",
      completedShiftId: "shift-pilot-1",
      startedByUserId: "operator-a",
      startedByNameSnapshot: "Pilot Operator",
      completedByUserId: "operator-a",
      completedByNameSnapshot: "Pilot Operator",
      holeId: "PILOT001",
      runNumber: 1,
      rodNumber: 2,
      rodStringDm: 365,
      measuredStickUpDm: 10,
      previousCompletedDepthDm: 300,
      holeDepthDm: 355,
      drilledLengthDm: 55,
      recoveredLengthDm: 54,
      recoveryPercentage: 98.2,
      rodEvents: [
        {
          localId: "rod-event-1",
          action: "add",
          rodLengthDm: 60,
          sequence: 1,
          affectedRodNumber: 2,
          rodNumberAfterEvent: 2,
          occurredAt: NOW,
        },
      ],
      version: 1,
      status: "completed",
    };

    const runEnvelope = envelope("runs", "saveCompletedRun", run);
    const plan = planCoreOperation({
      ...runEnvelope,
      payload: {
        ...runEnvelope.payload,
        arguments: [{ holeId: "PILOT001" }, run],
      },
    });

    expect(plan?.projections.map((projection) => projection.kind)).toEqual([
      "RUN",
      "ROD_EVENT",
    ]);
    expect(plan?.projections[0]?.state.holeDepthDm).toBe(355);
  });

  it("preserves historical run actors and versions corrected rod events under the supervisor audit actor", () => {
    const correctedRun = {
      localId: "run-pilot-1",
      startedAt: NOW,
      completedAt: "2026-07-29T11:00:00.000Z",
      startedShiftId: "shift-pilot-1",
      completedShiftId: "shift-pilot-1",
      startedByUserId: "operator-original",
      startedByNameSnapshot: "Original Driller",
      completedByUserId: "operator-original",
      completedByNameSnapshot: "Original Driller",
      holeId: "PILOT001",
      runNumber: 1,
      rodNumber: 2,
      rodStringDm: 365,
      measuredStickUpDm: 10,
      previousCompletedDepthDm: 300,
      holeDepthDm: 355,
      drilledLengthDm: 55,
      recoveredLengthDm: 55,
      recoveryPercentage: 100,
      rodEvents: [
        {
          localId: "rod-event-1",
          action: "add",
          rodLengthDm: 60,
          sequence: 1,
          affectedRodNumber: 2,
          rodNumberAfterEvent: 2,
          occurredAt: NOW,
        },
      ],
      version: 2,
      status: "corrected",
    };
    const correctingEnvelope = envelope(
      "run-corrections",
      "apply",
      {
        snapshots: [correctedRun],
        corrections: [
          {
            id: "correction-1",
            holeId: "PILOT001",
            runId: correctedRun.localId,
            correctionType: "RECOVERED_LENGTH",
            reason: "Supervisor verified the original driller measurement.",
            correctedAt: "2026-07-29T12:00:00.000Z",
            correctedByUserId: "supervisor-correcting",
            correctedByNameSnapshot: "Correcting Supervisor",
            operationId: "correction-operation-1",
            version: 2,
          },
        ],
        operation: {
          operationId: "correction-operation-1",
          runId: correctedRun.localId,
          correctionType: "RECOVERED_LENGTH",
          updatedAt: "2026-07-29T12:00:00.000Z",
        },
      },
      { operatorId: "supervisor-correcting" },
    );

    const plan = planCoreOperation(correctingEnvelope);
    const run = plan?.projections.find((item) => item.kind === "RUN");
    const rod = plan?.projections.find((item) => item.kind === "ROD_EVENT");
    const correction = plan?.projections.find(
      (item) => item.kind === "RUN_CORRECTION",
    );
    expect(run).toMatchObject({
      version: 2,
      sourceActorUserId: "operator-original",
      actorNameSnapshot: "Original Driller",
    });
    expect(rod).toMatchObject({
      version: 2,
      sourceActorUserId: "operator-original",
    });
    expect(correction).toMatchObject({
      version: 2,
      sourceActorUserId: "supervisor-correcting",
    });

    const voidedRun = {
      ...correctedRun,
      version: 3,
      status: "void" as const,
    };
    const voidEnvelope = envelope(
      "run-corrections",
      "voidRun",
      {
        snapshots: [voidedRun],
        corrections: [
          {
            id: "void-1",
            holeId: "PILOT001",
            runId: voidedRun.localId,
            correctionType: "VOID",
            reason: "Supervisor confirmed this run was entered against the wrong hole.",
            correctedAt: "2026-07-29T13:00:00.000Z",
            correctedByUserId: "supervisor-correcting",
            correctedByNameSnapshot: "Correcting Supervisor",
            operationId: "void-operation-1",
            version: 3,
          },
        ],
        operation: {
          operationId: "void-operation-1",
          runId: voidedRun.localId,
          correctionType: "VOID",
          updatedAt: "2026-07-29T13:00:00.000Z",
        },
      },
      { operatorId: "supervisor-correcting" },
    );
    const voidPlan = planCoreOperation(voidEnvelope);
    expect(
      voidPlan?.projections.find((item) => item.kind === "RUN"),
    ).toMatchObject({
      version: 3,
      sourceActorUserId: "operator-original",
      lifecycleStatus: "void",
    });
    expect(
      voidPlan?.projections.find((item) => item.kind === "ROD_EVENT"),
    ).toMatchObject({
      version: 3,
      sourceActorUserId: "operator-original",
    });
    expect(
      voidPlan?.projections.find((item) => item.kind === "RUN_CORRECTION"),
    ).toMatchObject({
      version: 3,
      sourceActorUserId: "supervisor-correcting",
    });
  });

  it("accepts a complete correction chain beyond 200 runs without authoritative truncation", () => {
    const snapshots = Array.from({ length: 201 }, (_, index) => ({
      localId: `run-${index + 1}`,
      startedAt: NOW,
      completedAt: "2026-07-29T11:00:00.000Z",
      startedShiftId: "shift-pilot-1",
      completedShiftId: "shift-pilot-1",
      startedByUserId: "operator-original",
      startedByNameSnapshot: "Original Driller",
      completedByUserId: "operator-original",
      completedByNameSnapshot: "Original Driller",
      holeId: "PILOT001",
      runNumber: index + 1,
      rodNumber: index + 1,
      rodStringDm: (index + 1) * 55,
      measuredStickUpDm: 0,
      previousCompletedDepthDm: index * 55,
      holeDepthDm: (index + 1) * 55,
      drilledLengthDm: 55,
      recoveredLengthDm: 55,
      recoveryPercentage: 100,
      rodEvents: [],
      version: 2,
      status: "corrected" as const,
    }));
    const correctionEnvelope = envelope(
      "run-corrections",
      "apply",
      {
        snapshots,
        corrections: [
          {
            id: "large-correction-1",
            holeId: "PILOT001",
            runId: "run-1",
            correctionType: "CHAIN_RECONCILIATION",
            reason: "Complete chain was recalculated after field record review.",
            correctedAt: "2026-07-29T12:00:00.000Z",
            correctedByUserId: "supervisor-correcting",
            correctedByNameSnapshot: "Correcting Supervisor",
            operationId: "large-correction-operation-1",
            version: 2,
          },
        ],
        operation: {
          operationId: "large-correction-operation-1",
          runId: "run-1",
          correctionType: "CHAIN_RECONCILIATION",
          updatedAt: "2026-07-29T12:00:00.000Z",
        },
      },
      { operatorId: "supervisor-correcting" },
    );
    const plan = planCoreOperation(correctionEnvelope);
    expect(
      plan?.projections.filter((item) => item.kind === "RUN"),
    ).toHaveLength(201);
  });

  it("rejects invalid BHA arithmetic, run depth arithmetic and actor spoofing", () => {
    const invalidBhaResult = {
      localId: "bha-1",
      holeId: "PILOT001",
      effectiveAt: NOW,
      effectiveDepthDm: 0,
      bottomHoleAssemblyLengthDm: 45,
      constantStickUpDm: 20,
      baseRodStringLengthDm: 99,
      reason: "Invalid arithmetic",
      recordedByUserId: "operator-a",
      recordedByNameSnapshot: "Pilot Operator",
    };
    const invalidBha = envelope("bha-setups", "save", invalidBhaResult);
    expect(() => planCoreOperation(invalidBha)).toThrow(
      CoreOperationValidationError,
    );

    const spoofed = {
      ...invalidBha,
      payload: {
        ...invalidBha.payload,
        result: {
          ...invalidBhaResult,
          baseRodStringLengthDm: 25,
          recordedByUserId: "another-operator",
        },
      },
    };
    expect(() => planCoreOperation(spoofed)).toThrow(/actor/i);

    const badRunSnapshot = {
      localId: "run-invalid",
      startedAt: NOW,
      completedAt: "2026-07-29T11:00:00.000Z",
      startedShiftId: "shift-a",
      completedShiftId: "shift-a",
      startedByUserId: "operator-a",
      startedByNameSnapshot: "Pilot Operator",
      completedByUserId: "operator-a",
      completedByNameSnapshot: "Pilot Operator",
      holeId: "PILOT001",
      runNumber: 1,
      rodNumber: 1,
      rodStringDm: 300,
      measuredStickUpDm: 10,
      previousCompletedDepthDm: 250,
      holeDepthDm: 300,
      drilledLengthDm: 49,
      recoveredLengthDm: 48,
      recoveryPercentage: 98,
      rodEvents: [],
      version: 1,
      status: "completed",
    };
    const badRun = envelope("runs", "saveCompletedRun", badRunSnapshot);
    expect(() =>
      planCoreOperation({
        ...badRun,
        payload: {
          ...badRun.payload,
          arguments: [{ holeId: "PILOT001" }, badRunSnapshot],
        },
      }),
    ).toThrow(/arithmetic/i);
  });
});
