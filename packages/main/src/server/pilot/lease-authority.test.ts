import { describe, expect, it } from "vitest";

import { InMemoryPilotRepository } from "./testing-memory-repository";
import type { RecordOperationInput } from "./repository";
import type { SyncOperationEnvelope, WorkLease } from "./types";

const ORGANISATION_ID = "10000000-0000-4000-8000-000000000001";
const DEVICE_A = "20000000-0000-4000-8000-000000000001";
const DEVICE_B = "20000000-0000-4000-8000-000000000002";
const OPERATOR = "30000000-0000-4000-8000-000000000001";
const ACQUIRED_AT = "2026-07-29T00:00:00.000Z";

function input(
  lease: WorkLease,
  sequence: number,
  evidence: SyncOperationEnvelope["leaseEvidence"],
  receivedAt = "2026-07-29T00:10:00.000Z",
): RecordOperationInput {
  return {
    envelope: {
      operationId: `40000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      schemaVersion: 1,
      organisationId: ORGANISATION_ID,
      deviceId: DEVICE_A,
      operatorId: OPERATOR,
      operationType: "surveys.create.v1",
      projectRef: "PROJECT-1",
      rigRef: "RIG-1",
      holeRef: lease.resourceRef,
      shiftRef: null,
      expectedVersion: null,
      revisionRef: `surveys:survey-${sequence}`,
      clientTime: "2099-01-01T00:00:00.000Z",
      payloadHash: "a".repeat(64),
      payload: {
        repository: "surveys",
        method: "create",
        arguments: [{ holeId: lease.resourceRef, localId: `survey-${sequence}` }],
        clientMutationId: `survey-${sequence}`,
      },
      leaseEvidence: evidence,
    },
    envelopeHash: `envelope-${sequence}`,
    receivedAt,
    corePlan: null,
  };
}

describe("server-authoritative lease evidence", () => {
  it("ignores forged client grace timestamps but enforces server lease version, release, takeover and expiry", async () => {
    const repository = new InMemoryPilotRepository();
    repository.seedCoreScope(
      ORGANISATION_ID,
      "PROJECT-1",
      "RIG-1",
      "HOLE-1",
    );
    const acquired = await repository.acquireLease(
      ORGANISATION_ID,
      DEVICE_A,
      OPERATOR,
      {
        resourceType: "HOLE",
        resourceRef: "HOLE-1",
        projectRef: "PROJECT-1",
        holeRef: "HOLE-1",
      },
      "2026-07-29T00:05:00.000Z",
      ACQUIRED_AT,
    );
    const lease = acquired.lease;
    const forgedEvidence = {
      state: "OFFLINE_GRACE" as const,
      leaseId: lease.id,
      leaseVersion: lease.version,
      lastVerifiedAt: "2099-01-01T00:00:00.000Z",
      graceExpiresAt: "2099-01-02T00:00:00.000Z",
    };
    await expect(
      repository.recordOperation(input(lease, 1, forgedEvidence)),
    ).resolves.toMatchObject({
      status: "ACCEPTED",
      reasonCode: "OFFLINE_GRACE_RECORDED",
    });

    await expect(
      repository.recordOperation(
        input(lease, 2, {
          ...forgedEvidence,
          leaseVersion: lease.version + 1,
        }),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      reasonCode: "LEASE_VERSION_STALE",
    });

    const released = await repository.releaseLease(
      ORGANISATION_ID,
      lease.id,
      DEVICE_A,
      "2026-07-29T00:11:00.000Z",
    );
    await expect(
      repository.recordOperation(
        input(lease, 3, {
          ...forgedEvidence,
          leaseVersion: released!.version,
        }),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      reasonCode: "OFFLINE_GRACE_INVALID",
    });

    const reacquired = await repository.acquireLease(
      ORGANISATION_ID,
      DEVICE_A,
      OPERATOR,
      {
        resourceType: "HOLE",
        resourceRef: "HOLE-1",
        projectRef: "PROJECT-1",
        holeRef: "HOLE-1",
      },
      "2026-07-29T00:20:00.000Z",
      "2026-07-29T00:12:00.000Z",
    );
    await repository.takeoverLease(
      ORGANISATION_ID,
      reacquired.lease.id,
      DEVICE_B,
      OPERATOR,
      "Replacement tablet takeover for failed hardware.",
      "2026-07-29T00:25:00.000Z",
      "2026-07-29T00:13:00.000Z",
    );
    await expect(
      repository.recordOperation(
        input(reacquired.lease, 4, {
          ...forgedEvidence,
          leaseId: reacquired.lease.id,
          leaseVersion: reacquired.lease.version,
        }),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      reasonCode: "OFFLINE_GRACE_INVALID",
    });

    const expiryRepository = new InMemoryPilotRepository();
    expiryRepository.seedCoreScope(
      ORGANISATION_ID,
      "PROJECT-1",
      "RIG-1",
      "HOLE-1",
    );
    const expiring = await expiryRepository.acquireLease(
      ORGANISATION_ID,
      DEVICE_A,
      OPERATOR,
      {
        resourceType: "HOLE",
        resourceRef: "HOLE-1",
        projectRef: "PROJECT-1",
        holeRef: "HOLE-1",
      },
      "2026-07-29T00:05:00.000Z",
      ACQUIRED_AT,
    );
    await expect(
      expiryRepository.recordOperation(
        input(
          expiring.lease,
          5,
          {
            ...forgedEvidence,
            leaseId: expiring.lease.id,
            leaseVersion: expiring.lease.version,
          },
          "2026-07-29T00:31:00.001Z",
        ),
      ),
    ).resolves.toMatchObject({
      status: "CONFLICT",
      reasonCode: "OFFLINE_GRACE_INVALID",
    });
  });
});
