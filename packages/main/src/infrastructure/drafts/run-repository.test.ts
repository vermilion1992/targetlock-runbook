import { describe, expect, it } from "vitest";

import {
  nextRunContextFromSavedRuns,
  runDraftKey,
  savedRunsKey,
  type RunDraftContext,
  type RunDraftPayload,
  type SavedRunSnapshot,
} from "./run-drafts";
import { LocalRunRepository } from "./run-repository";
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

const holeId = "DDH041";
const startedAt = "2026-03-20T18:30:00.000Z";
const completedAt = "2026-03-20T21:30:00.000Z";

const fallbackContext: RunDraftContext = {
  runNumber: 220,
  rodNumber: 112,
  currentRodStringDm: 6_625,
  previousCompletedDepthDm: 6_586,
};

const draft: RunDraftPayload = {
  localId: "local-run-220",
  startedAt,
  startedShiftId: "shift-day",
  startedByUserId: "user-hoffman",
  startedByNameSnapshot: "M. Hoffman",
  context: fallbackContext,
  pendingRodEvents: [
    {
      localId: "local-rod-113",
      action: "add",
      rodLengthDm: 30,
    },
  ],
  stickUpMetresInput: "1.0",
  recoveredMetresInput: "2.8",
  conditionTagIds: ["run-tag-competent"],
  comment: "Competent core.",
  activeBitAssignmentId: "assignment-bit-active",
  activeReamerAssignmentId: "assignment-reamer-active",
  activeBitSerialNumberSnapshot: "BIT-HQ-002193",
  activeReamerSerialNumberSnapshot: "REA-HQ-000912",
  casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
};

const savedRun: SavedRunSnapshot = {
  localId: draft.localId,
  startedAt,
  completedAt,
  startedShiftId: "shift-day",
  completedShiftId: "shift-night",
  startedByUserId: "user-hoffman",
  startedByNameSnapshot: "M. Hoffman",
  completedByUserId: "user-smith",
  completedByNameSnapshot: "J. Smith",
  holeId,
  syncStatus: "local-only",
  runNumber: 220,
  rodNumber: 113,
  rodStringDm: 6_655,
  measuredStickUpDm: 40,
  previousCompletedDepthDm: 6_586,
  holeDepthDm: 6_615,
  drilledLengthDm: 29,
  recoveredLengthDm: 28,
  recoveryPercentage: 96.6,
  rodEvents: [
    {
      localId: "local-rod-113",
      sequence: 1,
      action: "add",
      rodLengthDm: 30,
      affectedRodNumber: 113,
      rodNumberAfterEvent: 113,
      occurredAt: completedAt,
    },
  ],
  conditionTagIds: ["run-tag-competent"],
  comment: "Competent core.",
  activeBitAssignmentId: "assignment-bit-active",
  activeReamerAssignmentId: "assignment-reamer-active",
  activeBitSerialNumberSnapshot: "BIT-HQ-002193",
  activeReamerSerialNumberSnapshot: "REA-HQ-000912",
  casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
};

describe("local run repository", () => {
  it("round-trips a hole-scoped draft with integer-decimetre rod events", () => {
    const storage = new MemoryStorage();
    const repository = new LocalRunRepository(storage);

    expect(repository.writeDraft(holeId, draft, completedAt)).toEqual({
      ok: true,
    });
    expect(repository.readDraft(holeId)).toEqual({
      status: "valid",
      envelope: {
        version: 4,
        holeId,
        syncStatus: "local-only",
        savedAt: completedAt,
        payload: draft,
      },
    });
    expect(repository.readDraft("DDH042")).toEqual({ status: "empty" });
    expect(storage.values.has(runDraftKey(holeId))).toBe(true);
  });

  it("persists completed runs across repository instances", () => {
    const storage = new MemoryStorage();
    const firstRepository = new LocalRunRepository(storage);

    expect(firstRepository.saveCompletedRun(holeId, savedRun)).toEqual({
      ok: true,
      status: "saved",
    });

    const reopenedRepository = new LocalRunRepository(storage);
    expect(reopenedRepository.readCompletedRuns(holeId)).toEqual({
      status: "valid",
      snapshots: [savedRun],
    });
    expect(storage.values.has(savedRunsKey(holeId))).toBe(true);
  });

  it("makes an identical retry idempotent and rejects conflicting duplicates", () => {
    const repository = new LocalRunRepository(new MemoryStorage());

    expect(repository.saveCompletedRun(holeId, savedRun)).toMatchObject({
      ok: true,
      status: "saved",
    });
    expect(repository.saveCompletedRun(holeId, savedRun)).toEqual({
      ok: true,
      status: "already-saved",
    });
    expect(
      repository.saveCompletedRun(holeId, {
        ...savedRun,
        localId: "another-local-id",
      }),
    ).toEqual({
      ok: false,
      reason: "Run 220 is already saved locally.",
    });
    expect(
      repository.saveCompletedRun(holeId, {
        ...savedRun,
        recoveredLengthDm: 29,
      }),
    ).toEqual({
      ok: false,
      reason:
        "The local run identifier is already used by different saved data.",
    });
  });

  it("prepares the next run from the latest completed snapshot", () => {
    expect(nextRunContextFromSavedRuns([savedRun], fallbackContext)).toEqual({
      runNumber: 221,
      rodNumber: 113,
      currentRodStringDm: 6_655,
      previousCompletedDepthDm: 6_615,
    });
    expect(nextRunContextFromSavedRuns([], fallbackContext)).toBe(
      fallbackContext,
    );
  });

  it("reports unavailable storage without losing in-memory input", () => {
    const repository = new LocalRunRepository(new UnavailableStorage());

    expect(repository.readDraft(holeId)).toEqual({
      status: "invalid",
      reason: "Browser storage is unavailable.",
    });
    expect(repository.writeDraft(holeId, draft)).toEqual({
      ok: false,
      reason: "This browser could not save the draft.",
    });
    expect(repository.saveCompletedRun(holeId, savedRun)).toEqual({
      ok: false,
      reason: "Browser storage is unavailable.",
    });
  });

  it("migrates version 1 draft and completed-run records on read", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "targetlock:prototype:v1:hole:DDH041:run-draft",
      JSON.stringify({
        version: 1,
        holeId,
        syncStatus: "local-only",
        savedAt: startedAt,
        payload: {
          context: {
            runNumber: 220,
            rodNumber: 112,
            currentRodStringDecimetres: 6_625,
            previousCompletedDepthDecimetres: 6_586,
          },
          pendingRodEvents: [
            { action: "add", rodLengthDecimetres: 60 },
          ],
          stickUpMetres: "1.0",
          recoveredMetres: "2.8",
          conditionTagIds: [],
          comment: "",
        },
      }),
    );
    storage.setItem(
      "targetlock:prototype:v1:hole:DDH041:saved-runs",
      JSON.stringify({
        version: 1,
        holeId,
        syncStatus: "local-only",
        updatedAt: completedAt,
        snapshots: [
          {
            localId: "legacy-run-219",
            savedAt: completedAt,
            holeId,
            syncStatus: "local-only",
            runNumber: 219,
            rodNumber: 112,
            rodStringDecimetres: 6_625,
            measuredStickUpDecimetres: 40,
            previousCompletedDepthDecimetres: 6_556,
            holeDepthDecimetres: 6_585,
            drilledLengthDecimetres: 29,
            recoveredLengthDecimetres: 28,
            recoveryPercentage: 96.6,
            pendingRodEvents: [
              { action: "add", rodLengthDecimetres: 60 },
            ],
            conditionTagIds: [],
            comment: "",
          },
        ],
      }),
    );

    const repository = new LocalRunRepository(storage);
    const migratedDraft = repository.readDraft(holeId);
    const migratedRuns = repository.readCompletedRuns(holeId);

    expect(migratedDraft).toMatchObject({
      status: "valid",
      envelope: {
        version: 4,
        payload: {
          context: {
            currentRodStringDm: 6_625,
            previousCompletedDepthDm: 6_586,
          },
          pendingRodEvents: [{ action: "add", rodLengthDm: 60 }],
        },
      },
    });
    expect(migratedRuns).toMatchObject({
      status: "valid",
      snapshots: [
        {
          runNumber: 219,
          rodStringDm: 6_625,
          rodEvents: [
            {
              action: "add",
              rodLengthDm: 60,
              affectedRodNumber: 112,
              rodNumberAfterEvent: 112,
            },
          ],
        },
      ],
    });
  });

  it("migrates version 2 records with explicit legacy ownership", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "targetlock:prototype:v2:hole:DDH041:run-draft",
      JSON.stringify({
        version: 2,
        holeId,
        syncStatus: "local-only",
        savedAt: startedAt,
        payload: {
          localId: draft.localId,
          startedAt,
          context: draft.context,
          pendingRodEvents: draft.pendingRodEvents,
          stickUpMetresInput: draft.stickUpMetresInput,
          recoveredMetresInput: draft.recoveredMetresInput,
          conditionTagIds: draft.conditionTagIds,
          comment: draft.comment,
        },
      }),
    );
    storage.setItem(
      "targetlock:prototype:v2:hole:DDH041:saved-runs",
      JSON.stringify({
        version: 2,
        holeId,
        syncStatus: "local-only",
        updatedAt: completedAt,
        snapshots: [
          {
            localId: savedRun.localId,
            startedAt: savedRun.startedAt,
            completedAt: savedRun.completedAt,
            holeId,
            syncStatus: "local-only",
            runNumber: savedRun.runNumber,
            rodNumber: savedRun.rodNumber,
            rodStringDm: savedRun.rodStringDm,
            measuredStickUpDm: savedRun.measuredStickUpDm,
            previousCompletedDepthDm: savedRun.previousCompletedDepthDm,
            holeDepthDm: savedRun.holeDepthDm,
            drilledLengthDm: savedRun.drilledLengthDm,
            recoveredLengthDm: savedRun.recoveredLengthDm,
            recoveryPercentage: savedRun.recoveryPercentage,
            rodEvents: savedRun.rodEvents,
            conditionTagIds: savedRun.conditionTagIds,
            comment: savedRun.comment,
          },
        ],
      }),
    );

    const repository = new LocalRunRepository(storage);
    expect(repository.readDraft(holeId)).toMatchObject({
      status: "valid",
      envelope: {
        version: 4,
        payload: {
          startedShiftId: "legacy-unassigned-shift",
          startedByNameSnapshot: "Legacy local operator",
        },
      },
    });
    expect(repository.readCompletedRuns(holeId)).toMatchObject({
      status: "valid",
      snapshots: [
        {
          startedShiftId: "legacy-unassigned-shift",
          completedShiftId: "legacy-unassigned-shift",
          completedByNameSnapshot: "Legacy local operator",
        },
      ],
    });
  });

  it("migrates version 3 ownership while leaving ambiguous component references null", () => {
    const storage = new MemoryStorage();
    const {
      activeBitAssignmentId: _draftBitAssignment,
      activeReamerAssignmentId: _draftReamerAssignment,
      activeBitSerialNumberSnapshot: _draftBitSerial,
      activeReamerSerialNumberSnapshot: _draftReamerSerial,
      casingSummarySnapshot: _draftCasing,
      ...version3Draft
    } = draft;
    const {
      activeBitAssignmentId: _runBitAssignment,
      activeReamerAssignmentId: _runReamerAssignment,
      activeBitSerialNumberSnapshot: _runBitSerial,
      activeReamerSerialNumberSnapshot: _runReamerSerial,
      casingSummarySnapshot: _runCasing,
      ...version3Run
    } = savedRun;
    void [
      _draftBitAssignment,
      _draftReamerAssignment,
      _draftBitSerial,
      _draftReamerSerial,
      _draftCasing,
      _runBitAssignment,
      _runReamerAssignment,
      _runBitSerial,
      _runReamerSerial,
      _runCasing,
    ];
    storage.setItem(
      "targetlock:prototype:v3:hole:DDH041:run-draft",
      JSON.stringify({
        version: 3,
        holeId,
        syncStatus: "local-only",
        savedAt: startedAt,
        payload: version3Draft,
      }),
    );
    storage.setItem(
      "targetlock:prototype:v3:hole:DDH041:saved-runs",
      JSON.stringify({
        version: 3,
        holeId,
        syncStatus: "local-only",
        updatedAt: completedAt,
        snapshots: [version3Run],
      }),
    );

    const repository = new LocalRunRepository(storage);
    expect(repository.readDraft(holeId)).toMatchObject({
      status: "valid",
      envelope: {
        version: 4,
        payload: {
          activeBitAssignmentId: null,
          activeReamerAssignmentId: null,
          activeBitSerialNumberSnapshot: null,
          activeReamerSerialNumberSnapshot: null,
          casingSummarySnapshot: null,
        },
      },
    });
    expect(repository.readCompletedRuns(holeId)).toMatchObject({
      status: "valid",
      snapshots: [
        {
          localId: savedRun.localId,
          activeBitAssignmentId: null,
          activeReamerAssignmentId: null,
          activeBitSerialNumberSnapshot: null,
          activeReamerSerialNumberSnapshot: null,
          casingSummarySnapshot: null,
        },
      ],
    });
  });

  it("retains legacy serial snapshots and resolves only unambiguous assignments", () => {
    const storage = new MemoryStorage();
    const {
      activeBitAssignmentId: _draftBitAssignment,
      activeReamerAssignmentId: _draftReamerAssignment,
      casingSummarySnapshot: _draftCasing,
      ...legacyDraft
    } = draft;
    const {
      activeBitAssignmentId: _runBitAssignment,
      activeReamerAssignmentId: _runReamerAssignment,
      casingSummarySnapshot: _runCasing,
      ...legacyRun
    } = savedRun;
    void [
      _draftBitAssignment,
      _draftReamerAssignment,
      _draftCasing,
      _runBitAssignment,
      _runReamerAssignment,
      _runCasing,
    ];
    storage.setItem(
      "targetlock:prototype:v3:hole:DDH041:run-draft",
      JSON.stringify({
        version: 3,
        holeId,
        syncStatus: "local-only",
        savedAt: startedAt,
        payload: {
          ...legacyDraft,
          activeBitSerialNumberSnapshot: "BIT-LEGACY",
          activeReamerSerialNumberSnapshot: "REAMER-AMBIGUOUS",
        },
      }),
    );
    storage.setItem(
      "targetlock:prototype:v3:hole:DDH041:saved-runs",
      JSON.stringify({
        version: 3,
        holeId,
        syncStatus: "local-only",
        updatedAt: completedAt,
        snapshots: [
          {
            ...legacyRun,
            activeBitSerialNumberSnapshot: "BIT-LEGACY",
            activeReamerSerialNumberSnapshot: "REAMER-AMBIGUOUS",
          },
        ],
      }),
    );
    const repository = new LocalRunRepository(storage, [
      {
        assignmentId: "assignment-bit-legacy",
        componentType: "BIT",
        serialNumber: "bit-legacy",
        holeId,
        startDepthDm: 0,
      },
      {
        assignmentId: "assignment-reamer-a",
        componentType: "REAMER",
        serialNumber: "REAMER-AMBIGUOUS",
        holeId,
        startDepthDm: 0,
      },
      {
        assignmentId: "assignment-reamer-b",
        componentType: "REAMER",
        serialNumber: "REAMER-AMBIGUOUS",
        holeId,
        startDepthDm: 0,
      },
      {
        assignmentId: "assignment-other-hole",
        componentType: "BIT",
        serialNumber: "BIT-LEGACY",
        holeId: "DDH099",
        startDepthDm: 0,
      },
    ]);

    expect(repository.readDraft(holeId)).toMatchObject({
      status: "valid",
      envelope: {
        payload: {
          activeBitAssignmentId: "assignment-bit-legacy",
          activeReamerAssignmentId: null,
          activeBitSerialNumberSnapshot: "BIT-LEGACY",
          activeReamerSerialNumberSnapshot: "REAMER-AMBIGUOUS",
        },
      },
    });
    expect(repository.readCompletedRuns(holeId)).toMatchObject({
      status: "valid",
      snapshots: [
        {
          activeBitAssignmentId: "assignment-bit-legacy",
          activeReamerAssignmentId: null,
          activeBitSerialNumberSnapshot: "BIT-LEGACY",
          activeReamerSerialNumberSnapshot: "REAMER-AMBIGUOUS",
        },
      ],
    });
  });
});
