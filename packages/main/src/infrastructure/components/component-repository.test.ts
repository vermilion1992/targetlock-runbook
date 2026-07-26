import { describe, expect, it } from "vitest";

import {
  decimetres,
  type Component,
  type ComponentAssignment,
} from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  ComponentRepositoryError,
  LocalComponentRepository,
  type ResolveAtHoleCompletionInput,
} from "./component-repository";

class MemoryStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();
  setCalls = 0;
  failOnSetCall?: number;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1;
    if (this.failOnSetCall === this.setCalls) {
      throw new Error("write failed");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const metadata = {
  serverId: null,
  syncStatus: "local-only" as const,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  deviceId: "test-device",
  version: 1,
};

function component(
  localId: string,
  serialNumber: string,
  status: Component["status"] = "AVAILABLE",
  type: Component["type"] = "BIT",
): Component {
  return {
    ...metadata,
    localId,
    organisationId: "organisation-briggs",
    type,
    serialNumber,
    normalizedSerialNumber: serialNumber.toUpperCase(),
    size: "HQ",
    status,
    createdByUserId: "user-1",
    createdByNameSnapshot: "M. Hoffman",
  };
}

function assignment(
  localId: string,
  componentId: string,
  holeId: string,
  type: ComponentAssignment["componentType"] = "BIT",
): ComponentAssignment {
  return {
    ...metadata,
    localId,
    componentId,
    holeId,
    componentType: type,
    startDepthDm: decimetres(0),
    installedAt: "2026-07-21T00:00:00.000Z",
    installedByUserId: "user-1",
    installedByNameSnapshot: "M. Hoffman",
    status: "ACTIVE",
  };
}

function repository(
  storage = new MemoryStorage(),
  components: readonly Component[] = [
    component("bit-out", "BIT-HQ-001842", "ACTIVE"),
    component("bit-in", "BIT-HQ-002193"),
    component("reamer-in", "REA-HQ-000912", "AVAILABLE", "REAMER"),
  ],
  assignments: readonly ComponentAssignment[] = [
    assignment("assignment-out", "bit-out", "DDH041"),
  ],
): LocalComponentRepository {
  return new LocalComponentRepository(
    storage,
    "organisation-briggs",
    components,
    assignments,
  );
}

const user = {
  userId: "user-1",
  userNameSnapshot: "M. Hoffman",
  occurredAt: "2026-07-21T01:00:00.000Z",
};

function completionInput(
  outcome: ResolveAtHoleCompletionInput["outcome"],
  operationId = `complete-${outcome.toLocaleLowerCase()}`,
): ResolveAtHoleCompletionInput {
  return {
    operationId,
    holeId: "DDH041",
    assignmentId: "assignment-out",
    componentId: "bit-out",
    componentType: "BIT",
    expectedVersion: 1,
    finalDepthDm: decimetres(6_615),
    outcome,
    targetHoleId:
      outcome === "CARRIED_FORWARD" ? "DDH042" : undefined,
    comment: "Resolved during hole completion",
    shiftId: "shift-final",
    ...user,
  };
}

describe("LocalComponentRepository", () => {
  it("creates registry records and detects duplicate serials by type", async () => {
    const repo = repository(new MemoryStorage(), [], []);
    await repo.create({
      id: "bit-1",
      organisationId: "organisation-briggs",
      type: "BIT",
      serialNumber: " bit-hq-1 ",
      size: "HQ",
      ...user,
    });

    await expect(
      repo.create({
        id: "bit-2",
        organisationId: "organisation-briggs",
        type: "BIT",
        serialNumber: "BIT-HQ-1",
        size: "HQ",
        ...user,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_SERIAL" });

    await expect(
      repo.create({
        id: "reamer-1",
        organisationId: "organisation-briggs",
        type: "REAMER",
        serialNumber: "BIT-HQ-1",
        size: "HQ",
        ...user,
      }),
    ).resolves.toMatchObject({ type: "REAMER" });

    await repo.create({
      id: "bit-3",
      organisationId: "organisation-briggs",
      type: "BIT",
      serialNumber: "BIT-HQ-3",
      size: "HQ",
      ...user,
    });
    await expect(
      repo.update({
        operationId: "duplicate-update",
        componentId: "bit-3",
        expectedVersion: 1,
        serialNumber: " BIT-HQ-1 ",
        reason: "Serial verification",
        ...user,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_SERIAL" });
  });

  it("assigns one component type per hole and blocks cross-hole reuse", async () => {
    const available = component("bit-available", "BIT-HQ-3");
    const repo = repository(new MemoryStorage(), [available], []);
    const initialInput = {
      operationId: "assign-1",
      assignmentId: "assignment-1",
      componentId: available.localId,
      componentType: "BIT",
      holeId: "DDH041",
      startDepthDm: decimetres(0),
      ...user,
    } as const;
    await expect(repo.assignInitial(initialInput)).resolves.toMatchObject({
      localId: "assignment-1",
    });
    await expect(repo.assignInitial(initialInput)).resolves.toMatchObject({
      localId: "assignment-1",
    });
    await expect(repo.listByHole("DDH041")).resolves.toHaveLength(1);

    await expect(
      repo.assignInitial({
        operationId: "assign-2",
        assignmentId: "assignment-2",
        componentId: available.localId,
        componentType: "BIT",
        holeId: "DDH038",
        startDepthDm: decimetres(0),
        ...user,
      }),
    ).rejects.toMatchObject({ code: "COMPONENT_ALREADY_ACTIVE" });
  });

  it("allows one bit and one reamer but rejects a second active assignment of either type", async () => {
    const repo = repository(
      new MemoryStorage(),
      [
        component("bit-1", "BIT-1"),
        component("bit-2", "BIT-2"),
        component("reamer-1", "REAMER-1", "AVAILABLE", "REAMER"),
        component("reamer-2", "REAMER-2", "AVAILABLE", "REAMER"),
      ],
      [],
    );
    await repo.assignInitial({
      operationId: "assign-bit-1",
      assignmentId: "assignment-bit-1",
      componentId: "bit-1",
      componentType: "BIT",
      holeId: "DDH041",
      startDepthDm: decimetres(0),
      ...user,
    });
    await repo.assignInitial({
      operationId: "assign-reamer-1",
      assignmentId: "assignment-reamer-1",
      componentId: "reamer-1",
      componentType: "REAMER",
      holeId: "DDH041",
      startDepthDm: decimetres(0),
      ...user,
    });

    await expect(
      repo.assignInitial({
        operationId: "assign-bit-2",
        assignmentId: "assignment-bit-2",
        componentId: "bit-2",
        componentType: "BIT",
        holeId: "DDH041",
        startDepthDm: decimetres(10),
        ...user,
      }),
    ).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENT_EXISTS" });
    await expect(
      repo.assignInitial({
        operationId: "assign-reamer-2",
        assignmentId: "assignment-reamer-2",
        componentId: "reamer-2",
        componentType: "REAMER",
        holeId: "DDH041",
        startDepthDm: decimetres(10),
        ...user,
      }),
    ).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENT_EXISTS" });
  });

  it("records an audited registry status transition", async () => {
    const repo = repository(
      new MemoryStorage(),
      [component("bit-inspection", "BIT-INSPECTION", "REMOVED")],
      [],
    );
    await expect(
      repo.update({
        operationId: "status-inspection",
        componentId: "bit-inspection",
        expectedVersion: 1,
        status: "UNDER_INSPECTION",
        reason: "Post-run inspection requested",
        ...user,
      }),
    ).resolves.toMatchObject({
      status: "UNDER_INSPECTION",
      version: 2,
    });
    await expect(repo.listCorrections("bit-inspection")).resolves.toMatchObject([
      {
        operationId: "status-inspection",
        fieldName: "status",
        previousValue: "REMOVED",
        correctedValue: "UNDER_INSPECTION",
      },
    ]);
  });

  it("changes a bit at one exact continuous boundary idempotently", async () => {
    const repo = repository();
    const input = {
      operationId: "change-bit-1",
      holeId: "DDH041",
      componentType: "BIT" as const,
      outgoingAssignmentId: "assignment-out",
      incomingComponentId: "bit-in",
      changeDepthDm: decimetres(4126),
      removalReason: "WORN" as const,
      removalComment: "Normal wear",
      shiftId: "shift-1",
      ...user,
    };

    const first = await repo.changeComponent(input);
    const second = await repo.changeComponent(input);

    expect(first.outgoingAssignment.endDepthDm).toBe(4126);
    expect(first.incomingAssignment.startDepthDm).toBe(4126);
    expect(first.status).toBe("changed");
    expect(second.status).toBe("already-changed");
    expect(await repo.getActive("DDH041", "BIT")).toMatchObject({
      componentId: "bit-in",
    });
    expect(await repo.listByHole("DDH041")).toHaveLength(2);
  });

  it("recovers an interrupted component change", async () => {
    const storage = new MemoryStorage();
    const recoveredOperations: string[] = [];
    const repo = new LocalComponentRepository(
      storage,
      "organisation-briggs",
      [
        component("bit-out", "BIT-HQ-001842", "ACTIVE"),
        component("bit-in", "BIT-HQ-002193"),
      ],
      [assignment("assignment-out", "bit-out", "DDH041")],
      async (recoveredInput) => {
        recoveredOperations.push(recoveredInput.operationId);
      },
    );
    storage.failOnSetCall = 2;

    await expect(
      repo.changeComponent({
        operationId: "change-recover",
        holeId: "DDH041",
        componentType: "BIT",
        outgoingAssignmentId: "assignment-out",
        incomingComponentId: "bit-in",
        changeDepthDm: decimetres(4126),
        removalReason: "INSPECTION",
        shiftId: "shift-1",
        ...user,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });

    storage.failOnSetCall = undefined;
    await expect(repo.recoverInterruptedChange()).resolves.toMatchObject({
      status: "recovered",
    });
    expect(await repo.listByHole("DDH041")).toHaveLength(2);
    expect(recoveredOperations).toEqual(["change-recover"]);
  });

  it.each([
    ["SERVICEABLE", "SERVICEABLE", "HOLE_COMPLETED"],
    ["UNDER_INSPECTION", "UNDER_INSPECTION", "HOLE_COMPLETED"],
    ["RETIRED", "RETIRED", "HOLE_COMPLETED"],
    ["LOST_DOWNHOLE", "LOST_DOWNHOLE", "LOST_DOWNHOLE"],
    ["CARRIED_FORWARD", "SERVICEABLE", "HOLE_COMPLETED"],
  ] as const)(
    "resolves a final assignment as %s without creating an incoming assignment",
    async (outcome, componentStatus, removalReason) => {
      const repo = repository();
      const input = completionInput(outcome);

      const first = await repo.resolveAtHoleCompletion(input);
      const repeated = await repo.resolveAtHoleCompletion(input);

      expect(first).toMatchObject({
        status: "resolved",
        assignment: {
          localId: "assignment-out",
          status: "CLOSED",
          endDepthDm: 6_615,
          removedAt: user.occurredAt,
          removalReason,
          version: 2,
        },
        component: {
          localId: "bit-out",
          status: componentStatus,
          version: 2,
        },
      });
      expect(repeated).toMatchObject({
        status: "already-resolved",
        assignment: {
          endDepthDm: 6_615,
          removedAt: user.occurredAt,
          version: 2,
        },
      });
      expect(await repo.listByHole("DDH041")).toHaveLength(1);
      expect(await repo.getActive("DDH041", "BIT")).toBeNull();
    },
  );

  it("recovers a prepared completion resolution and reports it without mutation", async () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    storage.failOnSetCall = 2;

    await expect(
      repo.resolveAtHoleCompletion(
        completionInput("UNDER_INSPECTION", "complete-recover"),
      ),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    await expect(repo.hasPendingChangeOperation("DDH041")).resolves.toBe(true);
    await expect(repo.hasPendingChangeOperation("DDH042")).resolves.toBe(false);

    storage.failOnSetCall = undefined;
    await expect(
      repo.recoverInterruptedCompletionResolution(),
    ).resolves.toMatchObject({
      status: "recovered",
      assignment: {
        status: "CLOSED",
        endDepthDm: 6_615,
        version: 2,
      },
      component: { status: "UNDER_INSPECTION", version: 2 },
    });
    await expect(repo.hasPendingChangeOperation("DDH041")).resolves.toBe(false);
    expect(await repo.listByHole("DDH041")).toHaveLength(1);
  });

  it("requires a comment for Other and marks lost components", async () => {
    const repo = repository();
    await expect(
      repo.changeComponent({
        operationId: "change-other",
        holeId: "DDH041",
        componentType: "BIT",
        outgoingAssignmentId: "assignment-out",
        incomingComponentId: "bit-in",
        changeDepthDm: decimetres(4126),
        removalReason: "OTHER",
        shiftId: "shift-1",
        ...user,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ASSIGNMENT" });

    const lostRepo = repository();
    await lostRepo.changeComponent({
      operationId: "change-lost",
      holeId: "DDH041",
      componentType: "BIT",
      outgoingAssignmentId: "assignment-out",
      incomingComponentId: "bit-in",
      changeDepthDm: decimetres(4126),
      removalReason: "LOST_DOWNHOLE",
      shiftId: "shift-1",
      ...user,
    });
    await expect(lostRepo.getById("bit-out")).resolves.toMatchObject({
      status: "LOST_DOWNHOLE",
    });
  });

  it("audits component corrections and protects assignment overlap", async () => {
    const closed: ComponentAssignment = {
      ...assignment("assignment-old", "bit-out", "DDH041"),
      endDepthDm: decimetres(100),
      removedAt: "2026-07-21T00:30:00.000Z",
      status: "CLOSED",
    };
    const active = {
      ...assignment("assignment-new", "bit-in", "DDH041"),
      startDepthDm: decimetres(100),
    };
    const repo = repository(
      new MemoryStorage(),
      [
        component("bit-out", "BIT-OUT", "REMOVED"),
        component("bit-in", "BIT-IN", "ACTIVE"),
      ],
      [closed, active],
    );

    const updated = await repo.update({
      operationId: "correct-component",
      componentId: "bit-out",
      expectedVersion: 1,
      manufacturer: "Boart Longyear",
      reason: "Registry verification",
      ...user,
    });
    expect(updated.manufacturer).toBe("Boart Longyear");
    expect(await repo.listCorrections("bit-out")).toHaveLength(1);
    await expect(
      repo.getAssignmentById("assignment-old", "DDH042"),
    ).resolves.toBeNull();

    await expect(
      repo.correctAssignment({
        operationId: "correct-assignment",
        holeId: "DDH041",
        assignmentId: "assignment-old",
        expectedVersion: 1,
        endDepthDm: decimetres(110),
        reason: "Entry mistake",
        ...user,
      }),
    ).rejects.toBeInstanceOf(ComponentRepositoryError);

    await expect(
      repo.correctAssignment({
        operationId: "correct-assignment-valid",
        holeId: "DDH041",
        assignmentId: "assignment-old",
        expectedVersion: 1,
        endDepthDm: decimetres(90),
        reason: "Verified against field sheet",
        ...user,
      }),
    ).resolves.toMatchObject({
      endDepthDm: 90,
      version: 2,
    });
    await expect(
      repo.listCorrections("assignment-old"),
    ).resolves.toMatchObject([
      {
        operationId: "correct-assignment-valid",
        fieldName: "endDepthDm",
        previousValue: 100,
        correctedValue: 90,
      },
    ]);
  });
});
