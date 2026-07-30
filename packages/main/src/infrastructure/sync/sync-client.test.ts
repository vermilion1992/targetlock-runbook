import { afterEach, describe, expect, it, vi } from "vitest";

import { configurePilotBrowserRuntime } from "./pilot-runtime";
import { getBrowserPilotLeaseCoordinator } from "./lease-client";
import { MemoryOutboxRepository } from "./browser-outbox-repository";
import {
  BrowserSyncCoordinator,
  operationIdForLocalMutation,
  PilotClientAuthorizationError,
  preparePilotMutation,
} from "./sync-client";
import { MemoryUnjournaledFailureEvidenceStore } from "./unjournaled-failure-evidence";

const scope = {
  organisationId: "10000000-0000-4000-8000-000000000001",
  deviceId: "20000000-0000-4000-8000-000000000001",
  repository: "runs",
  method: "saveCompletedRun",
};

const lease = {
  id: "40000000-0000-4000-8000-000000000001",
  primaryDeviceId: scope.deviceId,
  resourceRef: "hole-from-plan",
  status: "ACTIVE" as const,
  heartbeatAt: "2026-07-28T12:00:00.000Z",
  expiresAt: "2026-07-28T12:05:00.000Z",
  offlineGraceIssuedAt: "2026-07-28T12:00:00.000Z",
  offlineGraceExpiresAt: "2026-07-28T12:30:00.000Z",
  completionGraceExpiresAt: "2026-07-29T00:00:00.000Z",
  version: 1,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  getBrowserPilotLeaseCoordinator().deactivate();
  configurePilotBrowserRuntime(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("domain operation identity", () => {
  it("maps a local idempotency key to a stable versioned UUID", async () => {
    const first = await operationIdForLocalMutation(scope, "complete-run-17");
    const duplicate = await operationIdForLocalMutation(
      scope,
      "complete-run-17",
    );
    const different = await operationIdForLocalMutation(
      scope,
      "complete-run-18",
    );

    expect(first).toBe(duplicate);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(different).not.toBe(first);
  });

  it("uses a fresh UUID when the local mutation has no idempotency key", async () => {
    const first = await operationIdForLocalMutation(scope, null);
    const second = await operationIdForLocalMutation(scope, null);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("blocks direct completion mutations for a Driller before local commit", async () => {
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Driller",
      role: "DRILLER",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });

    await expect(
      preparePilotMutation("completion", "beginReview", [
        { holeId: "hole-1", operationId: "review-1" },
      ]),
    ).rejects.toBeInstanceOf(PilotClientAuthorizationError);
  });

  it("allows assigned Draft-hole creation for a Driller before local commit", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ state: "AVAILABLE", lease: null }),
        )
        .mockResolvedValueOnce(jsonResponse({ lease })),
    );
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Driller",
      role: "DRILLER",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });

    await expect(
      preparePilotMutation("completion", "createHole", [
        {
          operationId: "create-hole-from-plan",
          holeId: "hole-from-plan",
          projectId: "project-1",
          rigId: "rig-1",
          planReference: "CLIENT-WI-041",
        },
      ]),
    ).resolves.toMatchObject({
      enabled: true,
      projectRef: "project-1",
      rigRef: "rig-1",
      holeRef: "hole-from-plan",
      leaseEvidence: {
        state: "PRIMARY_WRITER",
        leaseId: lease.id,
      },
    });
  });

  it("reports initialization rejection as unavailable instead of caught up", async () => {
    class UnavailableRepository extends MemoryOutboxRepository {
      override async resetSending(): Promise<void> {
        throw new Error("IndexedDB initialization failed.");
      }
    }
    const coordinator = new BrowserSyncCoordinator(
      new UnavailableRepository(),
    );
    await expect(coordinator.initialize()).rejects.toThrow(
      /initialization failed/i,
    );
    expect(coordinator.getSnapshot()).toMatchObject({
      availability: "unavailable",
      incomplete: 1,
      storageErrors: 1,
      unsynced: 1,
    });
  });

  it("counts an oversized post-commit payload as actionable unsynced work", async () => {
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const coordinator = new BrowserSyncCoordinator(
      new MemoryOutboxRepository(),
      new MemoryUnjournaledFailureEvidenceStore(),
    );
    await coordinator.enqueueMutation(
      {
        enabled: true,
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [{ holeId: "hole-1", value: "x".repeat(270_000) }],
        clientTime: "2026-07-29T00:00:00.000Z",
        projectRef: null,
        rigRef: null,
        holeRef: "hole-1",
        shiftRef: null,
        expectedVersion: null,
        leaseEvidence: null,
      },
      null,
    );
    expect(coordinator.getSnapshot()).toMatchObject({
      availability: "ready",
      failed: 1,
      incomplete: 1,
      storageErrors: 1,
      unsynced: 1,
      warning: expect.stringMatching(/256 KiB/i),
    });
  });

  it("persists post-commit enqueue failure evidence and reloads it as blocking unsynced work", async () => {
    class FailedEnqueueRepository extends MemoryOutboxRepository {
      override enqueue(
        envelope: Parameters<MemoryOutboxRepository["enqueue"]>[0],
      ): ReturnType<MemoryOutboxRepository["enqueue"]> {
        void envelope;
        return Promise.reject(new Error("IndexedDB enqueue failed."));
      }
    }
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const evidence = new MemoryUnjournaledFailureEvidenceStore();
    const first = new BrowserSyncCoordinator(
      new FailedEnqueueRepository(),
      evidence,
    );
    await first.enqueueMutation(
      {
        enabled: true,
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [{ holeId: "hole-1", localId: "run-1" }],
        clientTime: "2026-07-29T00:00:00.000Z",
        projectRef: "project-1",
        rigRef: "rig-1",
        holeRef: "hole-1",
        shiftRef: "shift-1",
        expectedVersion: 1,
        leaseEvidence: null,
      },
      { localId: "run-1" },
    );
    expect(first.getSnapshot()).toMatchObject({
      incomplete: 1,
      unsynced: 1,
    });
    expect(
      evidence.list({
        organisationId: scope.organisationId,
        deviceId: scope.deviceId,
        operatorId: "30000000-0000-4000-8000-000000000001",
      }),
    ).toHaveLength(1);

    const reloaded = new BrowserSyncCoordinator(
      new MemoryOutboxRepository(),
      evidence,
    );
    await reloaded.initialize();
    expect(reloaded.getSnapshot()).toMatchObject({
      incomplete: 1,
      unsynced: 1,
    });
  });

  it("serializes complete authoritative arrays beyond 200 items without truncation", async () => {
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const repository = new MemoryOutboxRepository();
    const coordinator = new BrowserSyncCoordinator(
      repository,
      new MemoryUnjournaledFailureEvidenceStore(),
    );
    const snapshots = Array.from({ length: 250 }, (_, index) => ({
      localId: `run-${index + 1}`,
      runNumber: index + 1,
    }));
    await coordinator.enqueueMutation(
      {
        enabled: true,
        repository: "run-corrections",
        method: "apply",
        arguments: [{ holeId: "hole-1", operationId: "correction-1" }],
        clientTime: "2026-07-29T00:00:00.000Z",
        projectRef: "project-1",
        rigRef: "rig-1",
        holeRef: "hole-1",
        shiftRef: null,
        expectedVersion: 1,
        leaseEvidence: null,
      },
      {
        snapshots,
        corrections: [],
        operation: {
          operationId: "correction-1",
          runId: "run-1",
          correctionType: "BULK_REVIEW",
          updatedAt: "2026-07-29T00:00:00.000Z",
        },
      },
    );
    const queued = await repository.listAll();
    expect(
      (
        queued[0]!.envelope.payload.result as {
          readonly snapshots: readonly unknown[];
        }
      ).snapshots,
    ).toHaveLength(250);
  });

  it("classifies deterministic 4xx responses as terminal instead of scheduling retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "DEVICE_ASSIGNMENT_MISMATCH",
              message: "The device is outside this hole assignment.",
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const repository = new MemoryOutboxRepository();
    await repository.enqueue({
      operationId: "50000000-0000-4000-8000-000000000099",
      schemaVersion: 1,
      organisationId: scope.organisationId,
      deviceId: scope.deviceId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operationType: "runs.saveCompletedRun.v1",
      projectRef: "project-1",
      rigRef: "rig-1",
      holeRef: "hole-1",
      shiftRef: null,
      expectedVersion: 1,
      revisionRef: "runs:run-1",
      clientTime: "2026-07-29T00:00:00.000Z",
      payloadHash: "a".repeat(64),
      payload: {
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [{ holeId: "hole-1" }],
        clientMutationId: "run-1",
      },
      leaseEvidence: null,
    });
    const coordinator = new BrowserSyncCoordinator(
      repository,
      new MemoryUnjournaledFailureEvidenceStore(),
    );
    await coordinator.initialize();
    await coordinator.flush();
    expect(await repository.listAll()).toMatchObject([
      {
        state: "rejected",
        reasonCode: "DEVICE_ASSIGNMENT_MISMATCH",
      },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("automatically retries failed operations after bounded backoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    vi.stubGlobal("navigator", { onLine: true });
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: scope.organisationId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operatorName: "Pilot Operator",
      role: "SUPERVISOR",
      device: {
        id: scope.deviceId,
        projectRef: "project-1",
        rigRef: "rig-1",
      },
      sessionExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const repository = new MemoryOutboxRepository();
    await repository.enqueue({
      operationId: "50000000-0000-4000-8000-000000000001",
      schemaVersion: 1,
      organisationId: scope.organisationId,
      deviceId: scope.deviceId,
      operatorId: "30000000-0000-4000-8000-000000000001",
      operationType: "runs.saveCompletedRun.v1",
      projectRef: "project-1",
      rigRef: "rig-1",
      holeRef: null,
      shiftRef: null,
      expectedVersion: null,
      revisionRef: "runs:hole-1",
      clientTime: "2026-07-29T00:00:00.000Z",
      payloadHash: "a".repeat(64),
      payload: {
        repository: "runs",
        method: "saveCompletedRun",
        arguments: [{ holeId: "hole-1" }],
        clientMutationId: "run-1",
      },
      leaseEvidence: null,
    });
    const coordinator = new BrowserSyncCoordinator(repository);
    await coordinator.initialize();
    await coordinator.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(2_001);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
