import { describe, expect, it } from "vitest";

import { LocalAuditRepository } from "@/infrastructure/audit";
import {
  appendSavedRunSnapshot,
  withDefaultRunCorrectionFields,
  type SavedRunSnapshot,
} from "./run-drafts";
import { LocalRunCorrectionRepository } from "./run-correction-repository";
import type { LocalStorageAdapter } from "./storage";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function snapshot(overrides: Partial<SavedRunSnapshot> = {}): SavedRunSnapshot {
  return withDefaultRunCorrectionFields({
    localId: "run-local-1",
    startedAt: "2026-07-24T01:00:00.000Z",
    completedAt: "2026-07-24T01:10:00.000Z",
    startedShiftId: "shift-1",
    completedShiftId: "shift-1",
    startedByUserId: "user-1",
    startedByNameSnapshot: "M. Hoffman",
    completedByUserId: "user-1",
    completedByNameSnapshot: "M. Hoffman",
    holeId: "DDH041",
    syncStatus: "local-only",
    runNumber: 148,
    rodNumber: 54,
    rodStringDm: 4129,
    measuredStickUpDm: 5,
    previousCompletedDepthDm: 4096,
    holeDepthDm: 4124,
    drilledLengthDm: 28,
    recoveredLengthDm: 27,
    recoveryPercentage: 96.4,
    rodEvents: [
      {
        localId: "rod-1",
        action: "add",
        rodLengthDm: 30,
        sequence: 1,
        affectedRodNumber: 54,
        rodNumberAfterEvent: 54,
        occurredAt: "2026-07-24T01:05:00.000Z",
      },
    ],
    conditionTagIds: [],
    comment: "",
    activeBitAssignmentId: null,
    activeReamerAssignmentId: null,
    activeBitSerialNumberSnapshot: null,
    activeReamerSerialNumberSnapshot: null,
    casingSummarySnapshot: null,
    ...overrides,
  });
}

describe("run correction repository", () => {
  it("rejects materializing a seed run into another hole", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalRunCorrectionRepository(storage, []);

    await expect(
      repository.materializeSeedRun("DDH042", snapshot({ holeId: "DDH041" })),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "The run belongs to another hole.",
    });
    await expect(repository.getEnvelope("DDH042")).resolves.toBeNull();
  });

  it("applies stick-up correction idempotently and preserves original", async () => {
    const storage = new MemoryStorage();
    const audits = new LocalAuditRepository(storage, []);
    const repository = new LocalRunCorrectionRepository(storage, [], undefined, audits);
    const first = snapshot();
    const second = snapshot({
      localId: "run-local-2",
      runNumber: 149,
      rodNumber: 55,
      rodStringDm: 4159,
      previousCompletedDepthDm: 4124,
      holeDepthDm: 4154,
      drilledLengthDm: 30,
      recoveredLengthDm: 30,
      recoveryPercentage: 100,
      rodEvents: [
        {
          localId: "rod-2",
          action: "add",
          rodLengthDm: 30,
          sequence: 1,
          affectedRodNumber: 55,
          rodNumberAfterEvent: 55,
          occurredAt: "2026-07-24T01:20:00.000Z",
        },
      ],
    });
    expect(appendSavedRunSnapshot(storage, "DDH041", first).ok).toBe(true);
    expect(appendSavedRunSnapshot(storage, "DDH041", second).ok).toBe(true);

    const input = {
      operationId: "op-correct-1",
      correctionId: "correction-1",
      holeId: "DDH041",
      runId: "run-local-1",
      expectedVersion: 1,
      correctionType: "MEASURED_STICK_UP" as const,
      reason: "Incorrect value entered",
      measuredStickUpDm: 3,
      correctedAt: "2026-07-24T02:00:00.000Z",
      correctedByUserId: "user-1",
      correctedByNameSnapshot: "M. Hoffman",
      reportIds: ["report-1"],
      acknowledgeWarnings: true,
    };

    const result = await repository.apply(input);
    expect(result.alreadyApplied).toBe(false);
    expect(result.impact.correctedRun.holeDepthDm).toBe(4126);
    const target = result.snapshots.find((item) => item.localId === "run-local-1");
    expect(target?.originalSnapshot?.measuredStickUpDm).toBe(5);
    expect(target?.measuredStickUpDm).toBe(3);
    expect(target?.version).toBe(2);
    expect(target?.status).toBe("corrected");

    const replay = await repository.apply(input);
    expect(replay.alreadyApplied).toBe(true);
    const listed = await repository.listByRun("DDH041", "run-local-1");
    expect(listed).toHaveLength(result.corrections.length);

    const auditEntries = await audits.listByHole("DDH041");
    expect(
      auditEntries.filter((entry) => entry.action === "run_corrected"),
    ).toHaveLength(1);
  });

  it("voids a run and recovers interrupted operations", async () => {
    const storage = new MemoryStorage();
    const audits = new LocalAuditRepository(storage, []);
    const repository = new LocalRunCorrectionRepository(storage, [], undefined, audits);
    expect(appendSavedRunSnapshot(storage, "DDH041", snapshot()).ok).toBe(true);

    const voided = await repository.voidRun({
      operationId: "op-void-1",
      correctionId: "void-1",
      holeId: "DDH041",
      runId: "run-local-1",
      expectedVersion: 1,
      voidReason: "ACCIDENTAL_DUPLICATE",
      rodEventResolution: "VOID_WITH_RUN",
      voidedAt: "2026-07-24T03:00:00.000Z",
      voidedByUserId: "user-1",
      voidedByNameSnapshot: "M. Hoffman",
      acknowledgeWarnings: true,
    });
    expect(voided.impact.correctedRun.status).toBe("void");
    const target = voided.snapshots.find((item) => item.localId === "run-local-1");
    expect(target?.status).toBe("void");
    expect(target?.voidReason).toBe("ACCIDENTAL_DUPLICATE");

    const envelope = await repository.getEnvelope("DDH041");
    expect(envelope).not.toBeNull();
    storage.setItem(
      `targetlock:prototype:v5:hole:${encodeURIComponent("DDH041")}:saved-runs`,
      JSON.stringify({
        ...envelope!,
        operations: [
          ...envelope!.operations,
          {
            operationId: "op-interrupted",
            kind: "CORRECT_RUN",
            correctionType: "COMMENT",
            runId: "run-local-1",
            inputJson: "{}",
            stage: "CORRECTION_SAVED",
            affectedRunIds: ["run-local-1"],
            correctionIds: [],
            createdAt: "2026-07-24T04:00:00.000Z",
            updatedAt: "2026-07-24T04:00:00.000Z",
            completedAt: null,
            failureReason: null,
          },
        ],
      }),
    );
    const recovered = await repository.recoverInterrupted("DDH041");
    expect(recovered).toBe(1);
    const after = await repository.listOperations("DDH041");
    expect(after.some((item) => item.stage === "FAILED")).toBe(true);
  });
});
