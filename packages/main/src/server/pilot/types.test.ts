import { describe, expect, it } from "vitest";

import { syncOperationEnvelopeSchema } from "./types";

function envelope(payload: Record<string, unknown>) {
  return {
    operationId: "10000000-0000-4000-8000-000000000001",
    schemaVersion: 1,
    organisationId: "20000000-0000-4000-8000-000000000001",
    deviceId: "30000000-0000-4000-8000-000000000001",
    operatorId: "40000000-0000-4000-8000-000000000001",
    operationType: "runs.saveCompletedRun.v1",
    projectRef: "project-1",
    rigRef: "rig-1",
    holeRef: "hole-1",
    shiftRef: "shift-1",
    expectedVersion: 2,
    revisionRef: "runs:run-17",
    clientTime: "2026-07-28T12:00:00.000Z",
    payloadHash: "a".repeat(64),
    payload,
    leaseEvidence: {
      state: "PRIMARY_WRITER",
      leaseId: "50000000-0000-4000-8000-000000000001",
      leaseVersion: 2,
      lastVerifiedAt: "2026-07-28T11:59:00.000Z",
      graceExpiresAt: null,
    },
  };
}

describe("typed pilot domain operation schema", () => {
  it("accepts a versioned operation with actual JSON payload and context", () => {
    expect(
      syncOperationEnvelopeSchema.parse(
        envelope({
          repository: "runs",
      method: "saveCompletedRun",
          arguments: [{ runId: "run-1", recoveredDm: 58 }],
          clientMutationId: "complete-run-1",
        }),
      ),
    ).toMatchObject({
      schemaVersion: 1,
      operationType: "runs.saveCompletedRun.v1",
      holeRef: "hole-1",
    });
  });

  it("rejects unversioned operation names and payloads above 256 KiB", () => {
    expect(
      syncOperationEnvelopeSchema.safeParse({
        ...envelope({
          repository: "runs",
          method: "completeRun",
          arguments: [],
          clientMutationId: null,
        }),
        operationType: "RUN_COMPLETED",
      }).success,
    ).toBe(false);
    expect(
      syncOperationEnvelopeSchema.safeParse(
        envelope({
          repository: "runs",
          method: "completeRun",
          arguments: [{ note: "x".repeat(270_000) }],
          clientMutationId: null,
        }),
      ).success,
    ).toBe(false);
  });
});
