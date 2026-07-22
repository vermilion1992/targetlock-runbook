import { describe, expect, it } from "vitest";

import {
  decimetres,
  type CasingEvent,
  type CasingString,
} from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalCasingRepository,
  type AdvanceCasingInput,
  type InstallCasingInput,
} from "./casing-repository";

const HOLE = "DDH041";
const OTHER_HOLE = "DDH042";
const CASING_KEY =
  "targetlock:prototype:v1:hole:DDH041:casing";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("unavailable");
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

const actor = {
  recordedByUserId: "user-hoffman",
  recordedByNameSnapshot: "M. Hoffman",
};

function installInput(
  overrides: Partial<InstallCasingInput> = {},
): InstallCasingInput {
  return {
    operationId: "operation-install-pq",
    casingStringId: "casing-pq",
    holeId: HOLE,
    casingSize: "PQ",
    startDepthDm: decimetres(0),
    endDepthDm: decimetres(60),
    currentHoleDepthDm: decimetres(100),
    recordedAt: "2026-07-20T00:00:00.000Z",
    comment: "Initial conductor casing",
    ...actor,
    ...overrides,
  };
}

function advanceInput(
  overrides: Partial<AdvanceCasingInput> = {},
): AdvanceCasingInput {
  return {
    operationId: "operation-advance-pq",
    casingStringId: "casing-pq",
    holeId: HOLE,
    newEndDepthDm: decimetres(180),
    currentHoleDepthDm: decimetres(200),
    recordedAt: "2026-07-21T00:00:00.000Z",
    expectedVersion: 1,
    ...actor,
    ...overrides,
  };
}

async function installedRepository(storage = new MemoryStorage()) {
  const repository = new LocalCasingRepository(storage);
  const casing = await repository.install(installInput());
  return { casing, repository, storage };
}

function seedMetadata(localId: string, timestamp: string) {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: "seed-device",
    version: 1,
  };
}

describe("local casing repository", () => {
  it("installs casing with a versioned projection and immutable event", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalCasingRepository(storage);

    const casing = await repository.install(installInput());

    expect(casing).toMatchObject({
      localId: "casing-pq",
      holeId: HOLE,
      casingSize: "PQ",
      startDepthDm: 0,
      currentEndDepthDm: 60,
      status: "ACTIVE",
      serverId: null,
      syncStatus: "local-only",
      version: 1,
    });
    await expect(repository.getById("casing-pq", HOLE)).resolves.toEqual(
      casing,
    );
    await expect(repository.listEvents(HOLE, "casing-pq")).resolves.toEqual([
      expect.objectContaining({
        eventType: "INSTALL",
        newEndDepthDm: 60,
        newStatus: "ACTIVE",
        operationId: "operation-install-pq",
        syncStatus: "local-only",
      }),
    ]);

    const stored = JSON.parse(storage.values.get(CASING_KEY)!) as {
      version: number;
      holeId: string;
      revision: number;
      casingStrings: unknown[];
      events: unknown[];
      operations: unknown[];
    };
    expect(stored).toMatchObject({
      version: 1,
      holeId: HOLE,
      revision: 1,
    });
    expect(stored.casingStrings).toHaveLength(1);
    expect(stored.events).toHaveLength(1);
    expect(stored.operations).toHaveLength(1);
  });

  it("advances and shortens casing while preserving every event", async () => {
    const { repository } = await installedRepository();
    await repository.advance(advanceInput());
    const shortened = await repository.shorten({
      operationId: "operation-shorten-pq",
      casingStringId: "casing-pq",
      holeId: HOLE,
      newEndDepthDm: decimetres(175),
      currentHoleDepthDm: decimetres(200),
      reason: "Physical casing was withdrawn",
      recordedAt: "2026-07-21T01:00:00.000Z",
      expectedVersion: 2,
      ...actor,
    });

    expect(shortened).toMatchObject({
      currentEndDepthDm: 175,
      version: 3,
    });
    expect(
      (await repository.listEvents(HOLE, "casing-pq")).map(
        ({ eventType, previousEndDepthDm, newEndDepthDm }) => ({
          eventType,
          previousEndDepthDm,
          newEndDepthDm,
        }),
      ),
    ).toEqual([
      {
        eventType: "INSTALL",
        previousEndDepthDm: undefined,
        newEndDepthDm: 60,
      },
      {
        eventType: "ADVANCE",
        previousEndDepthDm: 60,
        newEndDepthDm: 180,
      },
      {
        eventType: "SHORTEN",
        previousEndDepthDm: 180,
        newEndDepthDm: 175,
      },
    ]);
  });

  it("records corrections without replacing original depth events", async () => {
    const { repository } = await installedRepository();
    await repository.advance(advanceInput());
    const before = await repository.listEvents(HOLE, "casing-pq");

    const corrected = await repository.correct({
      operationId: "operation-correct-pq",
      casingStringId: "casing-pq",
      holeId: HOLE,
      newEndDepthDm: decimetres(175),
      currentHoleDepthDm: decimetres(200),
      reason: "Entry mistake",
      recordedAt: "2026-07-21T02:00:00.000Z",
      expectedVersion: 2,
      ...actor,
    });
    const after = await repository.listEvents(HOLE, "casing-pq");

    expect(corrected.currentEndDepthDm).toBe(175);
    expect(after.slice(0, 2)).toEqual(before);
    expect(after[2]).toMatchObject({
      eventType: "CORRECT",
      previousEndDepthDm: 180,
      newEndDepthDm: 175,
      reason: "Entry mistake",
    });
  });

  it("supports nested strings and isolates every hole", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalCasingRepository(storage);
    await repository.install(installInput());
    await repository.install(
      installInput({
        operationId: "operation-install-hq",
        casingStringId: "casing-hq",
        casingSize: "HQ",
        endDepthDm: decimetres(90),
        recordedAt: "2026-07-20T01:00:00.000Z",
      }),
    );
    await repository.install(
      installInput({
        operationId: "operation-install-other",
        casingStringId: "casing-other",
        holeId: OTHER_HOLE,
        endDepthDm: decimetres(40),
      }),
    );

    await expect(repository.listByHole(HOLE)).resolves.toEqual([
      expect.objectContaining({ localId: "casing-pq", holeId: HOLE }),
      expect.objectContaining({ localId: "casing-hq", holeId: HOLE }),
    ]);
    await expect(repository.listByHole(OTHER_HOLE)).resolves.toEqual([
      expect.objectContaining({
        localId: "casing-other",
        holeId: OTHER_HOLE,
      }),
    ]);
    await expect(
      repository.getById("casing-other", HOLE),
    ).resolves.toBeNull();
    await expect(repository.listEvents(HOLE)).resolves.toHaveLength(2);
    await expect(repository.listEvents(OTHER_HOLE)).resolves.toHaveLength(1);
  });

  it("requires confirmation and a reason above current hole depth", async () => {
    const repository = new LocalCasingRepository(new MemoryStorage());
    const aboveDepth = installInput({
      endDepthDm: decimetres(120),
      currentHoleDepthDm: decimetres(100),
    });

    await expect(repository.install(aboveDepth)).rejects.toMatchObject({
      code: "DEPTH_CONFIRMATION_REQUIRED",
    });
    await expect(
      repository.install({ ...aboveDepth, aboveDepthConfirmed: true }),
    ).rejects.toMatchObject({ code: "DEPTH_CONFIRMATION_REQUIRED" });

    const installed = await repository.install({
      ...aboveDepth,
      aboveDepthConfirmed: true,
      aboveDepthReason: "Measured casing extends beyond completed run depth",
    });
    expect(installed.currentEndDepthDm).toBe(120);
    await expect(repository.listEvents(HOLE)).resolves.toEqual([
      expect.objectContaining({
        reason: "Measured casing extends beyond completed run depth",
      }),
    ]);
  });

  it("validates install, advance, shorten, and correction depths", async () => {
    const repository = new LocalCasingRepository(new MemoryStorage());
    await expect(
      repository.install(
        installInput({
          startDepthDm: decimetres(70),
          endDepthDm: decimetres(60),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_DEPTH" });
    await expect(
      repository.install(
        installInput({
          startDepthDm: -1 as ReturnType<typeof decimetres>,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_DEPTH" });

    await repository.install(installInput());
    await expect(
      repository.advance(
        advanceInput({ newEndDepthDm: decimetres(60) }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_DEPTH" });
    await expect(
      repository.shorten({
        ...advanceInput({
          operationId: "operation-invalid-shorten",
          newEndDepthDm: decimetres(70),
        }),
        reason: "No physical shortening",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DEPTH" });
    await expect(
      repository.correct({
        operationId: "operation-invalid-correction",
        casingStringId: "casing-pq",
        holeId: HOLE,
        newEndDepthDm: decimetres(60),
        currentHoleDepthDm: decimetres(100),
        reason: "No change",
        recordedAt: "2026-07-21T02:00:00.000Z",
        ...actor,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("makes matching operation IDs idempotent and rejects conflicts", async () => {
    const repository = new LocalCasingRepository(new MemoryStorage());
    const first = await repository.install(installInput());
    const repeated = await repository.install(installInput());
    expect(repeated).toEqual(first);
    await expect(repository.listEvents(HOLE)).resolves.toHaveLength(1);

    await expect(
      repository.install(
        installInput({ casingSize: "HQ" }),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const advance = advanceInput();
    const advanced = await repository.advance(advance);
    const repeatedAdvance = await repository.advance(advance);
    expect(repeatedAdvance).toEqual(advanced);
    await expect(repository.listEvents(HOLE)).resolves.toHaveLength(2);
    await expect(
      repository.advance({
        ...advance,
        newEndDepthDm: decimetres(190),
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("tracks lifecycle status with immutable status events", async () => {
    const { repository } = await installedRepository();
    const completed = await repository.setStatus({
      operationId: "operation-complete",
      casingStringId: "casing-pq",
      holeId: HOLE,
      newStatus: "COMPLETED",
      reason: "Casing programme complete",
      recordedAt: "2026-07-21T03:00:00.000Z",
      expectedVersion: 1,
      ...actor,
    });
    expect(completed).toMatchObject({ status: "COMPLETED", version: 2 });
    await expect(
      repository.advance(
        advanceInput({
          operationId: "operation-after-complete",
          expectedVersion: 2,
          recordedAt: "2026-07-21T04:00:00.000Z",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });

    const removed = await repository.remove({
      operationId: "operation-remove",
      casingStringId: "casing-pq",
      holeId: HOLE,
      reason: "Casing recovered",
      recordedAt: "2026-07-21T05:00:00.000Z",
      expectedVersion: 2,
      ...actor,
    });
    expect(removed).toMatchObject({ status: "REMOVED", version: 3 });
    expect(
      (await repository.listEvents(HOLE)).map(({ eventType }) => eventType),
    ).toEqual(["INSTALL", "STATUS_CHANGE", "REMOVE"]);

    const restored = await repository.correct({
      operationId: "operation-restore-status",
      casingStringId: "casing-pq",
      holeId: HOLE,
      newStatus: "ACTIVE",
      currentHoleDepthDm: decimetres(100),
      reason: "Removal status was selected in error",
      recordedAt: "2026-07-21T06:00:00.000Z",
      expectedVersion: 3,
      ...actor,
    });
    expect(restored.status).toBe("ACTIVE");
  });

  it("rejects stale projections and back-dated events", async () => {
    const { repository } = await installedRepository();
    await expect(
      repository.advance(advanceInput({ expectedVersion: 99 })),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(
      repository.advance(
        advanceInput({
          recordedAt: "2026-07-19T00:00:00.000Z",
        }),
      ),
    ).rejects.toMatchObject({ code: "OUT_OF_ORDER_EVENT" });
  });

  it("hydrates deterministic hole-scoped seeds without eagerly writing", async () => {
    const installedAt = "2026-07-19T00:00:00.000Z";
    const seededCasing: CasingString = {
      ...seedMetadata("seed-casing", installedAt),
      holeId: HOLE,
      casingSize: "PQ",
      startDepthDm: decimetres(0),
      currentEndDepthDm: decimetres(60),
      status: "ACTIVE",
      installedAt,
      installedByUserId: "seed-user",
      installedByNameSnapshot: "Seed User",
    };
    const seededEvent: CasingEvent = {
      ...seedMetadata("seed-event", installedAt),
      holeId: HOLE,
      casingStringId: "seed-casing",
      eventType: "INSTALL",
      newEndDepthDm: decimetres(60),
      newStatus: "ACTIVE",
      recordedByUserId: "seed-user",
      recordedByNameSnapshot: "Seed User",
      recordedAt: installedAt,
      operationId: "seed-operation",
    };
    const otherCasing: CasingString = {
      ...seededCasing,
      localId: "other-seed-casing",
      holeId: OTHER_HOLE,
    };
    const storage = new MemoryStorage();
    const repository = new LocalCasingRepository(
      storage,
      [seededCasing, otherCasing],
      [seededEvent],
    );

    await expect(repository.listByHole(HOLE)).resolves.toEqual([seededCasing]);
    await expect(repository.listByHole(OTHER_HOLE)).resolves.toEqual([
      otherCasing,
    ]);
    expect(storage.values.size).toBe(0);

    await repository.advance(
      advanceInput({
        operationId: "advance-seed",
        casingStringId: "seed-casing",
        newEndDepthDm: decimetres(80),
        currentHoleDepthDm: decimetres(100),
        expectedVersion: 1,
      }),
    );
    expect(storage.values.has(CASING_KEY)).toBe(true);
  });

  it("fails closed for malformed, cross-hole, and divergent projections", async () => {
    const invalidJson = new MemoryStorage();
    invalidJson.values.set(CASING_KEY, "{invalid");
    await expect(
      new LocalCasingRepository(invalidJson).listByHole(HOLE),
    ).rejects.toMatchObject({ code: "CORRUPTED_STORAGE" });

    const wrongHole = new MemoryStorage();
    wrongHole.values.set(
      CASING_KEY,
      JSON.stringify({
        version: 1,
        holeId: OTHER_HOLE,
        revision: 0,
        updatedAt: "2026-07-20T00:00:00.000Z",
        casingStrings: [],
        events: [],
        operations: [],
      }),
    );
    await expect(
      new LocalCasingRepository(wrongHole).listByHole(HOLE),
    ).rejects.toMatchObject({ code: "CORRUPTED_STORAGE" });

    const { repository, storage } = await installedRepository();
    const stored = JSON.parse(storage.values.get(CASING_KEY)!) as {
      casingStrings: Array<{ currentEndDepthDm: number }>;
    };
    stored.casingStrings[0]!.currentEndDepthDm = 999;
    storage.values.set(CASING_KEY, JSON.stringify(stored));
    await expect(repository.listByHole(HOLE)).rejects.toMatchObject({
      code: "CORRUPTED_STORAGE",
    });
  });

  it("reports unavailable storage on reads and writes", async () => {
    await expect(
      new LocalCasingRepository(new UnavailableStorage()).listByHole(HOLE),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });

    const storage = new MemoryStorage();
    storage.failWrites = true;
    await expect(
      new LocalCasingRepository(storage).install(installInput()),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    expect(storage.values.size).toBe(0);
  });
});
