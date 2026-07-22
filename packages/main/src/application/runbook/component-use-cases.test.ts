import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import { LocalAuditRepository } from "@/infrastructure/audit";
import { LocalComponentRepository } from "@/infrastructure/components";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import { targetLockStage3Seed } from "@/infrastructure/seed";
import {
  assignInitialComponent,
  correctComponent,
  ComponentChangeValidationError,
  assessComponentChangeDepth,
  changeBit,
  changeReamer,
} from "./component-use-cases";

class MemoryStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();
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

const completedRuns = [
  {
    localId: "run-148",
    startDepth: decimetres(4_110),
    holeDepth: decimetres(4_139),
    drilledLength: decimetres(29),
    recoveredLength: decimetres(28),
    recoveryPercentage: 96.6,
    status: "completed" as const,
  },
];

function services() {
  const storage = new MemoryStorage();
  const components = new LocalComponentRepository(
    storage,
    targetLockStage3Seed.organisation.localId,
    targetLockStage3Seed.components,
    targetLockStage3Seed.componentAssignments,
  );
  return {
    components,
    componentAssignments: components,
    audits: new LocalAuditRepository(storage),
  };
}

const input = {
  operationId: "change-bit-use-case",
  holeId: "DDH041",
  outgoingAssignmentId: "assignment-bit-002193-ddh041",
  incomingComponentId: "component-bit-003007",
  changeDepthDm: decimetres(4_130),
  removalReason: "WORN" as const,
  shiftId: "shift-day",
  userId: "user-hoffman",
  userNameSnapshot: "M. Hoffman",
  occurredAt: "2026-07-21T08:00:00.000Z",
  currentCompletedDepthDm: decimetres(6_984),
  completedRuns,
};

describe("component use cases", () => {
  it("identifies exact boundaries separately from within-run changes", () => {
    expect(
      assessComponentChangeDepth(
        decimetres(4_110),
        decimetres(4_000),
        decimetres(4_139),
        completedRuns,
      ).boundaryRun,
    ).toBeUndefined();
    expect(
      assessComponentChangeDepth(
        decimetres(4_126),
        decimetres(4_000),
        decimetres(4_139),
        completedRuns,
      ).boundaryRun?.localId,
    ).toBe("run-148");
  });

  it("rejects changes before assignment start or beyond completed depth", () => {
    expect(
      assessComponentChangeDepth(
        decimetres(3_999),
        decimetres(4_000),
        decimetres(4_139),
        completedRuns,
      ),
    ).toMatchObject({
      valid: false,
      reason: "Change depth cannot precede the outgoing assignment start.",
    });
    expect(
      assessComponentChangeDepth(
        decimetres(4_140),
        decimetres(4_000),
        decimetres(4_139),
        completedRuns,
      ),
    ).toMatchObject({
      valid: false,
      reason: "Change depth cannot exceed the current completed hole depth.",
    });
  });

  it("requires explicit confirmation and a comment inside a completed run", async () => {
    const app = services();
    await expect(changeBit(input, app)).rejects.toBeInstanceOf(
      ComponentChangeValidationError,
    );
    await expect(
      changeBit({ ...input, confirmWithinRun: true }, app),
    ).rejects.toMatchObject({
      code: "WITHIN_RUN_CONFIRMATION_REQUIRED",
    });
  });

  it("commits a confirmed exact-depth bit change and audit idempotently", async () => {
    const app = services();
    const confirmed = {
      ...input,
      confirmWithinRun: true,
      removalComment: "Changed during Run 148 after wear was confirmed.",
    };
    await expect(changeBit(confirmed, app)).resolves.toMatchObject({
      outgoingAssignment: { endDepthDm: 4_130 },
      incomingAssignment: { startDepthDm: 4_130 },
    });
    await expect(changeBit(confirmed, app)).resolves.toMatchObject({
      status: "already-changed",
    });
    const audits = await app.audits.listByHole("DDH041");
    expect(
      audits.filter(({ action }) => action === "bit_changed"),
    ).toHaveLength(1);
  });

  it("assigns an initial component and audits the operation", async () => {
    const app = services();
    await expect(
      assignInitialComponent(
        {
          operationId: "assign-initial-bit",
          assignmentId: "assignment-ddh099-bit",
          componentId: "component-bit-003007",
          componentType: "BIT",
          holeId: "DDH099",
          startDepthDm: decimetres(0),
          shiftId: "shift-day",
          userId: "user-hoffman",
          userNameSnapshot: "M. Hoffman",
          occurredAt: "2026-07-21T08:10:00.000Z",
        },
        app,
      ),
    ).resolves.toMatchObject({
      componentId: "component-bit-003007",
      holeId: "DDH099",
      status: "ACTIVE",
    });
    await expect(app.audits.listByHole("DDH099")).resolves.toMatchObject([
      { action: "component_assigned" },
    ]);
  });

  it("changes a reamer at an exact boundary and writes a reamer audit", async () => {
    const app = services();
    await expect(
      changeReamer(
        {
          operationId: "change-reamer-use-case",
          holeId: "DDH041",
          outgoingAssignmentId: "assignment-reamer-000912-ddh041",
          incomingComponentId: "component-reamer-001104",
          changeDepthDm: decimetres(6_984),
          removalReason: "INSPECTION",
          shiftId: "shift-day",
          userId: "user-hoffman",
          userNameSnapshot: "M. Hoffman",
          occurredAt: "2026-07-21T08:20:00.000Z",
          currentCompletedDepthDm: decimetres(6_984),
          completedRuns,
        },
        app,
      ),
    ).resolves.toMatchObject({
      outgoingAssignment: { endDepthDm: 6_984 },
      incomingAssignment: { startDepthDm: 6_984 },
    });
    await expect(app.audits.listByHole("DDH041")).resolves.toMatchObject([
      { action: "reamer_changed" },
    ]);
  });

  it("corrects a registry record with an immutable general audit", async () => {
    const app = services();
    await expect(
      correctComponent(
        {
          operationId: "correct-registry-record",
          componentId: "component-bit-003007",
          expectedVersion: 1,
          manufacturer: "Boart Longyear Verified",
          reason: "Checked against supplier record",
          auditHoleId: "DDH041",
          userId: "user-hoffman",
          userNameSnapshot: "M. Hoffman",
          occurredAt: "2026-07-21T08:30:00.000Z",
        },
        app,
      ),
    ).resolves.toMatchObject({
      manufacturer: "Boart Longyear Verified",
    });
    await expect(app.audits.listByHole("DDH041")).resolves.toMatchObject([
      {
        action: "component_registry_corrected",
        metadata: { reason: "Checked against supplier record" },
      },
    ]);
  });
});
