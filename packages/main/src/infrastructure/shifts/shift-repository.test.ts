import { describe, expect, it } from "vitest";

import { decimetres } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalShiftRepository,
  type AcceptHandoverInput,
  type CloseFinalShiftInput,
  type StartShiftInput,
} from "./shift-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  failNextShiftWrite = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextShiftWrite && key.endsWith(":shifts")) {
      this.failNextShiftWrite = false;
      throw new Error("interrupted");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class UnavailableStorage implements LocalStorageAdapter {
  getItem(): string | null {
    throw new Error("unavailable");
  }
  setItem(): void {
    throw new Error("unavailable");
  }
  removeItem(): void {
    throw new Error("unavailable");
  }
}

const day: StartShiftInput = {
  id: "shift-day",
  holeId: "DDH041",
  rigId: "rig-10",
  shiftType: "DAY",
  shiftDate: "2026-07-21",
  primaryDrillerId: "user-hoffman",
  primaryDrillerNameSnapshot: "M. Hoffman",
  crewMembers: [
    { userId: "user-hoffman", name: "M. Hoffman", role: "Primary driller" },
  ],
  startedAt: "2026-07-21T06:00:00.000Z",
  startingState: {
    depthDm: decimetres(6_268),
    rodNumber: 106,
    rodStringDm: decimetres(6_295),
    measuredStickUpDm: decimetres(27),
    runNumber: 221,
  },
};

const acceptance: AcceptHandoverInput = {
  operationId: "handover-operation-1",
  holeId: "DDH041",
  outgoingShiftId: "shift-day",
  expectedVersion: 2,
  incomingShiftId: "shift-night",
  incomingShiftType: "NIGHT",
  incomingShiftDate: "2026-07-21",
  incomingDrillerId: "user-smith",
  incomingDrillerNameSnapshot: "J. Smith",
  incomingCrewMembers: [
    { userId: "user-smith", name: "J. Smith", role: "Primary driller" },
  ],
  acceptedAt: "2026-07-21T18:02:00.000Z",
};

const finalClose: CloseFinalShiftInput = {
  operationId: "final-shift-close-1",
  holeId: "DDH041",
  shiftId: "shift-day",
  expectedVersion: 1,
  closedAt: "2026-07-21T18:00:00.000Z",
  endingState: {
    depthDm: decimetres(6_615),
    rodNumber: 112,
    rodStringDm: decimetres(6_625),
    measuredStickUpDm: decimetres(10),
    runNumber: 232,
  },
};

async function pendingRepository(storage = new MemoryStorage()) {
  const repository = new LocalShiftRepository(storage);
  const started = await repository.startShift(day);
  const pending = await repository.closeForHandover({
    holeId: day.holeId,
    shiftId: started.localId,
    expectedVersion: started.version,
    closedAt: "2026-07-21T18:00:00.000Z",
    endingState: {
      depthDm: decimetres(6_615),
      rodNumber: 112,
      rodStringDm: decimetres(6_625),
      measuredStickUpDm: decimetres(10),
      runNumber: 232,
    },
    handoverNote: "Core slightly broken near run end.",
    handoverRunId: "run-233",
    handoverRunNumber: 233,
  });
  return { repository, storage, pending };
}

describe("local shift repository", () => {
  it("starts Day and Night shifts with hole-state snapshots", async () => {
    const dayRepository = new LocalShiftRepository(new MemoryStorage());
    await expect(dayRepository.startShift(day)).resolves.toMatchObject({
      shiftType: "DAY",
      status: "OPEN",
      startingDepthDm: 6_268,
      startingRunNumber: 221,
    });

    const nightRepository = new LocalShiftRepository(new MemoryStorage());
    await expect(
      nightRepository.startShift({
        ...day,
        id: "shift-night-only",
        shiftType: "NIGHT",
      }),
    ).resolves.toMatchObject({ shiftType: "NIGHT", status: "OPEN" });
  });

  it("rejects a second active shift at repository level", async () => {
    const repository = new LocalShiftRepository(new MemoryStorage());
    await repository.startShift(day);
    await expect(
      repository.startShift({ ...day, id: "shift-second", shiftType: "NIGHT" }),
    ).rejects.toMatchObject({
      code: "ACTIVE_SHIFT_EXISTS",
    });
  });

  it("closes an open shift for handover and preserves unfinished work", async () => {
    const { pending } = await pendingRepository();
    expect(pending).toMatchObject({
      status: "HANDOVER_PENDING",
      endingDepthDm: 6_615,
      endingRodNumber: 112,
      handoverRunId: "run-233",
      handoverRunNumber: 233,
      version: 2,
    });
  });

  it("closes the final shift directly and idempotently without an incoming shift", async () => {
    const repository = new LocalShiftRepository(new MemoryStorage());
    await repository.startShift(day);

    const first = await repository.closeFinalShift(finalClose);
    const repeated = await repository.closeFinalShift(finalClose);

    expect(first).toMatchObject({
      status: "closed",
      shift: {
        localId: "shift-day",
        status: "CLOSED",
        closedAt: finalClose.closedAt,
        updatedAt: finalClose.closedAt,
        endingDepthDm: 6_615,
        endingRodNumber: 112,
        version: 2,
      },
    });
    expect(repeated).toMatchObject({
      status: "already-closed",
      shift: {
        closedAt: finalClose.closedAt,
        updatedAt: finalClose.closedAt,
        version: 2,
      },
    });
    expect(await repository.listByHole(day.holeId)).toHaveLength(1);
    await expect(
      repository.closeFinalShift({
        ...finalClose,
        closedAt: "2026-07-21T18:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
  });

  it("accepts a handover atomically and inherits the exact state", async () => {
    const { repository } = await pendingRepository();
    const result = await repository.acceptHandover(acceptance);
    expect(result.outgoingShift).toMatchObject({
      status: "CLOSED",
      handoverAcceptedBy: "user-smith",
    });
    expect(result.incomingShift).toMatchObject({
      status: "OPEN",
      startingDepthDm: 6_615,
      startingRodNumber: 112,
      startingRodStringDm: 6_625,
      startingMeasuredStickUpDm: 10,
      startingRunNumber: 233,
      handoverRunId: "run-233",
    });
  });

  it("makes repeated acceptance with the same operation ID idempotent", async () => {
    const { repository } = await pendingRepository();
    const first = await repository.acceptHandover(acceptance);
    const second = await repository.acceptHandover(acceptance);
    expect(first.incomingShift.localId).toBe("shift-night");
    expect(second.status).toBe("already-accepted");
    expect(
      (await repository.listByHole("DDH041")).filter(
        ({ localId }) => localId === "shift-night",
      ),
    ).toHaveLength(1);
  });

  it("recovers a browser interruption after preparing acceptance", async () => {
    const { repository, storage } = await pendingRepository();
    storage.failNextShiftWrite = true;
    await expect(repository.acceptHandover(acceptance)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    const recoveredRepository = new LocalShiftRepository(storage);
    await expect(
      recoveredRepository.recoverInterruptedAcceptance("DDH041"),
    ).resolves.toMatchObject({
      status: "recovered",
      incomingShift: { localId: "shift-night", status: "OPEN" },
    });
  });

  it("reports a prepared handover operation without recovering it", async () => {
    const { repository, storage } = await pendingRepository();
    storage.failNextShiftWrite = true;
    await expect(repository.acceptHandover(acceptance)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    await expect(
      repository.hasPendingHandoverOperation(day.holeId),
    ).resolves.toBe(true);
    const persisted = JSON.parse(
      storage.values.get(
        "targetlock:prototype:v1:hole:DDH041:shifts",
      )!,
    ) as { shifts: Array<{ status: string }> };
    expect(persisted.shifts).toEqual([
      expect.objectContaining({ status: "HANDOVER_PENDING" }),
    ]);
  });

  it("lists only the requested hole and prevents cross-hole contamination", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalShiftRepository(storage);
    await repository.startShift(day);
    await repository.startShift({
      ...day,
      id: "shift-other",
      holeId: "DDH042",
    });
    expect(await repository.listByHole("DDH041")).toHaveLength(1);
    expect(await repository.listByHole("DDH042")).toEqual([
      expect.objectContaining({ localId: "shift-other", holeId: "DDH042" }),
    ]);
  });

  it("rejects stale close and acceptance versions", async () => {
    const { repository } = await pendingRepository();
    await expect(
      repository.acceptHandover({ ...acceptance, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });

  it("reports corrupted and unavailable shift storage", async () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(
      "targetlock:prototype:v1:hole:DDH041:shifts",
      "{invalid",
    );
    await expect(
      new LocalShiftRepository(corrupt).listByHole("DDH041"),
    ).rejects.toMatchObject({ code: "CORRUPTED_STORAGE" });
    await expect(
      new LocalShiftRepository(new UnavailableStorage()).listByHole("DDH041"),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });
});
