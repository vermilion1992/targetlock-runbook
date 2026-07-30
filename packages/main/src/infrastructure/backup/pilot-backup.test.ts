import { describe, expect, it } from "vitest";

import {
  localStorageRecordBelongsToPilotContext,
  validatePilotBackupDryRun,
} from "./pilot-backup";

const organisationId = "20000000-0000-4000-8000-000000000001";
const otherOrganisationId = "20000000-0000-4000-8000-000000000002";
const operatorId = "40000000-0000-4000-8000-000000000001";

async function checksum(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("pilot backup organisation isolation", () => {
  it("includes only explicitly scoped organisation, operator, and hole records", () => {
    const context = { organisationId, operatorId };
    const holes = new Set(["CUSTOMER-HOLE-1"]);
    expect(
      localStorageRecordBelongsToPilotContext(
        `targetlock:prototype:v2:organisation:${organisationId}:completion`,
        context,
        holes,
      ),
    ).toBe(true);
    expect(
      localStorageRecordBelongsToPilotContext(
        `targetlock:prototype:v1:hole:CUSTOMER-HOLE-1:runs`,
        context,
        holes,
      ),
    ).toBe(true);
    expect(
      localStorageRecordBelongsToPilotContext(
        "targetlock:prototype:v1:hole:DDH041:runs",
        context,
        holes,
      ),
    ).toBe(false);
    expect(
      localStorageRecordBelongsToPilotContext(
        `targetlock:prototype:v2:organisation:${otherOrganisationId}:completion`,
        context,
        holes,
      ),
    ).toBe(false);
  });

  it("rejects a checksummed mixed-organisation import dry-run", async () => {
    const body = {
      format: "targetlock-shadow-pilot-backup",
      version: 2,
      exportedAt: "2026-07-29T00:00:00.000Z",
      organisationId,
      operatorId,
      appSchemaVersion: "stage-7c-v1",
      completeness: "METADATA_AND_MEDIA_MANIFEST_ONLY",
      blobPayloadsIncluded: false,
      localStorage: [],
      outbox: [
        {
          operationId: "10000000-0000-4000-8000-000000000001",
          envelope: {
            operationId: "10000000-0000-4000-8000-000000000001",
            schemaVersion: 1,
            organisationId: otherOrganisationId,
            deviceId: "30000000-0000-4000-8000-000000000001",
            operatorId,
            operationType: "runs.saveCompletedRun.v1",
            projectRef: null,
            rigRef: null,
            holeRef: "CUSTOMER-HOLE-1",
            shiftRef: null,
            expectedVersion: null,
            revisionRef: "runs:CUSTOMER-HOLE-1",
            clientTime: "2026-07-29T00:00:00.000Z",
            payloadHash: "a".repeat(64),
            payload: {
              repository: "runs",
              method: "saveCompletedRun",
              arguments: [{ holeId: "CUSTOMER-HOLE-1" }],
              clientMutationId: "mutation-1",
            },
            leaseEvidence: null,
          },
          state: "pending",
          attempts: 0,
          createdAt: "2026-07-29T00:00:00.000Z",
          updatedAt: "2026-07-29T00:00:00.000Z",
          nextAttemptAt: "2026-07-29T00:00:00.000Z",
          serverReceiptTime: null,
          reasonCode: null,
          lastError: null,
        },
      ],
      mediaManifest: [],
      serverRecovery: {
        cursor: null,
        aggregates: {},
      },
    } as const;
    const json = JSON.stringify({
      ...body,
      checksumSha256: await checksum(JSON.stringify(body)),
    });
    const file = {
      size: new TextEncoder().encode(json).byteLength,
      text: async () => json,
    } as File;

    await expect(
      validatePilotBackupDryRun(file, organisationId),
    ).resolves.toMatchObject({
      valid: false,
      organisationMatches: true,
      message: expect.stringMatching(/mixed-organisation/i),
    });
  });
});
