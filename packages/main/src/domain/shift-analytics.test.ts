import { describe, expect, it } from "vitest";

import { decimetres, metresToDecimetres } from "./measurements";
import type { RunbookShift } from "./models";
import {
  buildShiftHandoverItems,
  calculateShiftAnalytics,
  toCloseAnalyticsSnapshot,
  type ShiftAnalyticsCorrection,
  type ShiftAnalyticsRun,
} from "./shift-analytics";

function makeShift(
  overrides: Partial<RunbookShift> & Pick<RunbookShift, "localId">,
): RunbookShift {
  const { localId, ...rest } = overrides;
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-07-21T08:00:00.000Z",
    updatedAt: "2026-07-21T08:00:00.000Z",
    deviceId: "test",
    version: 1,
    holeId: "hole-1",
    rigId: "rig-1",
    shiftType: "NIGHT",
    shiftDate: "2026-07-21",
    primaryDrillerId: "user-1",
    primaryDrillerNameSnapshot: "J. Smith",
    crewMembers: [],
    startedAt: "2026-07-21T08:00:00.000Z",
    startingDepthDm: metresToDecimetres(661.5),
    startingRodNumber: 76,
    startingRodStringDm: metresToDecimetres(661.5),
    startingRunNumber: 240,
    status: "OPEN",
    ...rest,
  };
}

function makeRun(
  overrides: Partial<ShiftAnalyticsRun> &
    Pick<
      ShiftAnalyticsRun,
      "localId" | "runNumber" | "startedShiftId" | "completedShiftId"
    >,
): ShiftAnalyticsRun {
  return {
    drilledLengthDm: 30,
    recoveredLengthDm: 29,
    holeDepthDm: metresToDecimetres(664.5),
    previousCompletedDepthDm: metresToDecimetres(661.5),
    status: "completed",
    rodEvents: [
      {
        localId: `rod-${overrides.localId}`,
        action: "add",
        rodLengthDm: 30,
        affectedRodNumber: 77,
        rodNumberAfterEvent: 77,
        voided: false,
      },
    ],
    startedAt: "2026-07-21T09:00:00.000Z",
    completedAt: "2026-07-21T09:30:00.000Z",
    ...overrides,
  };
}

describe("calculateShiftAnalytics — production", () => {
  it("calculates starting/ending depth and metres completed", () => {
    const shift = makeShift({
      localId: "shift-night",
      startingDepthDm: metresToDecimetres(661.5),
      endingDepthDm: metresToDecimetres(697.4),
      status: "CLOSED",
      closedAt: "2026-07-21T20:00:00.000Z",
    });
    const runs = [
      makeRun({
        localId: "r1",
        runNumber: 241,
        startedShiftId: "shift-night",
        completedShiftId: "shift-night",
        drilledLengthDm: 30,
        holeDepthDm: metresToDecimetres(664.5),
      }),
      makeRun({
        localId: "r2",
        runNumber: 242,
        startedShiftId: "shift-night",
        completedShiftId: "shift-night",
        drilledLengthDm: 29,
        holeDepthDm: metresToDecimetres(697.4),
        recoveredLengthDm: 28,
      }),
    ];

    const analytics = calculateShiftAnalytics({
      shift,
      runs,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });

    expect(analytics.startingDepthDm).toBe(6615);
    expect(analytics.endingDepthDm).toBe(6974);
    expect(analytics.metresCompletedDm).toBe(359);
    expect(analytics.completedRunCount).toBe(2);
  });

  it("credits shared Runs to the completing Shift only", () => {
    const night = makeShift({ localId: "shift-night" });
    const day = makeShift({
      localId: "shift-day",
      shiftType: "DAY",
      startingDepthDm: metresToDecimetres(650),
    });
    const shared = makeRun({
      localId: "shared",
      runNumber: 248,
      startedShiftId: "shift-day",
      completedShiftId: "shift-night",
      drilledLengthDm: 30,
      recoveredLengthDm: 30,
      holeDepthDm: metresToDecimetres(664.5),
    });

    const nightAnalytics = calculateShiftAnalytics({
      shift: night,
      runs: [shared],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(664.5),
    });
    const dayAnalytics = calculateShiftAnalytics({
      shift: day,
      runs: [shared],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });

    expect(nightAnalytics.completedRunCount).toBe(1);
    expect(nightAnalytics.sharedRunCount).toBe(1);
    expect(nightAnalytics.totalDrilledDm).toBe(30);
    expect(dayAnalytics.completedRunCount).toBe(0);
    expect(dayAnalytics.sharedRunCount).toBe(0);
    expect(dayAnalytics.totalDrilledDm).toBe(0);
  });

  it("open Shift metres use live ending depth even with zero completed Runs", () => {
    // Demo asymmetry: in-progress seed depth can sit ahead of shift start
    // (e.g. 627 m start → 630 m live) so metres > 0 while runs remain 0.
    const open = makeShift({
      localId: "shift-open",
      status: "OPEN",
      startingDepthDm: metresToDecimetres(627),
    });
    const analytics = calculateShiftAnalytics({
      shift: open,
      runs: [
        makeRun({
          localId: "open-run",
          runNumber: 1,
          startedShiftId: "shift-open",
          completedShiftId: null,
          status: "in_progress",
          drilledLengthDm: 30,
          holeDepthDm: metresToDecimetres(630),
          previousCompletedDepthDm: metresToDecimetres(627),
          completedAt: null,
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(630),
    });

    expect(analytics.metresCompletedDm).toBe(metresToDecimetres(3));
    expect(analytics.completedRunCount).toBe(0);
    expect(analytics.endingDepthDm).toBe(metresToDecimetres(630));
  });

  it("excludes voided Runs and includes corrected Runs", () => {
    const shift = makeShift({ localId: "shift-1" });
    const runs: ShiftAnalyticsRun[] = [
      makeRun({
        localId: "voided",
        runNumber: 1,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        status: "void",
        drilledLengthDm: 30,
      }),
      makeRun({
        localId: "corrected",
        runNumber: 2,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        status: "corrected",
        drilledLengthDm: 28,
        recoveredLengthDm: 28,
      }),
    ];

    const analytics = calculateShiftAnalytics({
      shift,
      runs,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(664.3),
    });

    expect(analytics.voidedRunCount).toBe(1);
    expect(analytics.completedRunCount).toBe(1);
    expect(analytics.correctedRunCount).toBe(1);
    expect(analytics.totalDrilledDm).toBe(28);
  });

  it("calculates average, median (odd/even), shortest and longest Run lengths", () => {
    const shift = makeShift({ localId: "shift-1" });
    const oddRuns = [20, 30, 40].map((length, index) =>
      makeRun({
        localId: `odd-${index}`,
        runNumber: index + 1,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        drilledLengthDm: length,
        recoveredLengthDm: length,
        rodEvents: [],
      }),
    );
    const odd = calculateShiftAnalytics({
      shift,
      runs: oddRuns,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(670),
    });
    expect(odd.averageRunLengthDm).toBe(30);
    expect(odd.medianRunLengthDm).toBe(30);
    expect(odd.shortestRunLengthDm).toBe(20);
    expect(odd.longestRunLengthDm).toBe(40);

    const evenRuns = [20, 30, 40, 50].map((length, index) =>
      makeRun({
        localId: `even-${index}`,
        runNumber: index + 1,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        drilledLengthDm: length,
        recoveredLengthDm: length,
        rodEvents: [],
      }),
    );
    const even = calculateShiftAnalytics({
      shift,
      runs: evenRuns,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(680),
    });
    expect(even.medianRunLengthDm).toBe(35);
  });
});

describe("calculateShiftAnalytics — recovery", () => {
  it("uses weighted recovery and sums loss/gain", () => {
    const shift = makeShift({ localId: "shift-1" });
    const runs = [
      makeRun({
        localId: "a",
        runNumber: 1,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        drilledLengthDm: 30,
        recoveredLengthDm: 28,
        rodEvents: [],
      }),
      makeRun({
        localId: "b",
        runNumber: 2,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        drilledLengthDm: 30,
        recoveredLengthDm: 32,
        rodEvents: [],
      }),
    ];
    const analytics = calculateShiftAnalytics({
      shift,
      runs,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(667.5),
    });

    expect(analytics.totalRecoveredDm).toBe(60);
    expect(analytics.totalDrilledDm).toBe(60);
    expect(analytics.weightedRecoveryTenths).toBe(1_000);
    expect(analytics.totalCoreLossDm).toBe(2);
    expect(analytics.totalCoreGainDm).toBe(2);
  });

  it("supports recovery above 100% and undefined when drilled is zero", () => {
    const shift = makeShift({ localId: "shift-1" });
    const above = calculateShiftAnalytics({
      shift,
      runs: [
        makeRun({
          localId: "gain",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          drilledLengthDm: 30,
          recoveredLengthDm: 33,
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(664.5),
    });
    expect(above.weightedRecoveryTenths).toBe(1_100);
    expect(above.totalCoreGainDm).toBe(3);

    const empty = calculateShiftAnalytics({
      shift,
      runs: [],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });
    expect(empty.weightedRecoveryTenths).toBeUndefined();
    expect(empty.averageRunLengthDm).toBeUndefined();
    expect(empty.medianRunLengthDm).toBeUndefined();
  });
});

describe("calculateShiftAnalytics — rod activity", () => {
  it("counts 3 m / 6 m adds, removals, and ignores voided events", () => {
    const shift = makeShift({
      localId: "shift-1",
      startingRodNumber: 76,
      endingRodNumber: 87,
      startingRodStringDm: metresToDecimetres(626.5),
      endingRodStringDm: metresToDecimetres(662.5),
      status: "CLOSED",
      closedAt: "2026-07-21T20:00:00.000Z",
      endingDepthDm: metresToDecimetres(661.5),
    });
    const runs = [
      makeRun({
        localId: "r1",
        runNumber: 1,
        startedShiftId: "shift-1",
        completedShiftId: "shift-1",
        rodEvents: [
          {
            localId: "e1",
            action: "add",
            rodLengthDm: 30,
            affectedRodNumber: 77,
            rodNumberAfterEvent: 77,
            voided: false,
          },
          {
            localId: "e2",
            action: "add",
            rodLengthDm: 60,
            affectedRodNumber: 78,
            rodNumberAfterEvent: 78,
            voided: false,
          },
          {
            localId: "e3",
            action: "remove",
            rodLengthDm: 30,
            affectedRodNumber: 78,
            rodNumberAfterEvent: 77,
            voided: false,
          },
          {
            localId: "e4",
            action: "add",
            rodLengthDm: 30,
            affectedRodNumber: 79,
            rodNumberAfterEvent: 79,
            voided: true,
          },
        ],
      }),
    ];

    const analytics = calculateShiftAnalytics({
      shift,
      runs,
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });

    expect(analytics.rodsAdded3m).toBe(1);
    expect(analytics.rodsAdded6m).toBe(1);
    expect(analytics.rodsRemoved).toBe(1);
    expect(analytics.netPhysicalRodChange).toBe(1);
    expect(analytics.startingRodNumber).toBe(76);
    expect(analytics.endingRodNumber).toBe(87);
    expect(analytics.startingRodStringDm).toBe(6265);
    expect(analytics.endingRodStringDm).toBe(6625);
  });
});

describe("calculateShiftAnalytics — operational records", () => {
  it("counts surveys, trays, casing, bit/reamer changes, corrections and voids", () => {
    const shift = makeShift({ localId: "shift-1" });
    const corrections: ShiftAnalyticsCorrection[] = [
      {
        id: "c1",
        runId: "r1",
        correctionType: "RECOVERED_LENGTH",
        createdAt: "2026-07-21T12:00:00.000Z",
        shiftId: "shift-1",
      },
      {
        id: "c2",
        runId: "r2",
        correctionType: "VOID",
        createdAt: "2026-07-21T13:00:00.000Z",
        shiftId: "shift-1",
      },
    ];
    const analytics = calculateShiftAnalytics({
      shift,
      runs: [
        makeRun({
          localId: "r1",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          status: "corrected",
          rodEvents: [],
        }),
        makeRun({
          localId: "r2",
          runNumber: 2,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          status: "void",
          rodEvents: [],
        }),
      ],
      surveys: [
        {
          localId: "s1",
          serverId: null,
          syncStatus: "local-only",
          createdAt: "2026-07-21T10:00:00.000Z",
          updatedAt: "2026-07-21T10:00:00.000Z",
          deviceId: "test",
          version: 1,
          holeId: "hole-1",
          shiftId: "shift-1",
          depthDm: decimetres(6_600),
          dipTenths: -600,
          azimuthTenths: 1_800,
          northReference: "TRUE",
          recordedByUserId: "u1",
          recordedByNameSnapshot: "J. Smith",
          recordedAt: "2026-07-21T10:00:00.000Z",
        },
      ],
      trays: [
        {
          localId: "t1",
          serverId: null,
          syncStatus: "local-only",
          createdAt: "2026-07-21T11:00:00.000Z",
          updatedAt: "2026-07-21T11:00:00.000Z",
          deviceId: "test",
          version: 1,
          holeId: "hole-1",
          shiftId: "shift-1",
          trayNumber: 45,
          isFinalPartial: false,
          primaryPhotoId: "photo-1",
          recordedByUserId: "u1",
          recordedByNameSnapshot: "J. Smith",
          recordedAt: "2026-07-21T11:00:00.000Z",
        },
      ],
      casingEvents: [
        {
          localId: "ce1",
          serverId: null,
          syncStatus: "local-only",
          createdAt: "2026-07-21T11:30:00.000Z",
          updatedAt: "2026-07-21T11:30:00.000Z",
          deviceId: "test",
          version: 1,
          holeId: "hole-1",
          casingStringId: "cs1",
          shiftId: "shift-1",
          eventType: "ADVANCE",
          newEndDepthDm: decimetres(100),
          recordedByUserId: "u1",
          recordedByNameSnapshot: "J. Smith",
          recordedAt: "2026-07-21T11:30:00.000Z",
          operationId: "op-1",
        },
      ],
      componentAssignments: [
        {
          localId: "a1",
          serverId: null,
          syncStatus: "local-only",
          createdAt: "2026-07-21T09:00:00.000Z",
          updatedAt: "2026-07-21T09:00:00.000Z",
          deviceId: "test",
          version: 1,
          componentId: "bit-1",
          holeId: "hole-1",
          componentType: "BIT",
          startDepthDm: decimetres(6_000),
          installedShiftId: "shift-1",
          installedAt: "2026-07-21T09:00:00.000Z",
          installedByUserId: "u1",
          installedByNameSnapshot: "J. Smith",
          status: "ACTIVE",
        },
        {
          localId: "a2",
          serverId: null,
          syncStatus: "local-only",
          createdAt: "2026-07-21T09:00:00.000Z",
          updatedAt: "2026-07-21T09:00:00.000Z",
          deviceId: "test",
          version: 1,
          componentId: "reamer-1",
          holeId: "hole-1",
          componentType: "REAMER",
          startDepthDm: decimetres(6_000),
          installedShiftId: "other",
          installedAt: "2026-07-20T09:00:00.000Z",
          installedByUserId: "u1",
          installedByNameSnapshot: "J. Smith",
          status: "ACTIVE",
        },
      ],
      corrections,
      liveEndingDepthDm: metresToDecimetres(664.5),
    });

    expect(analytics.surveyCount).toBe(1);
    expect(analytics.trayCount).toBe(1);
    expect(analytics.casingEventCount).toBe(1);
    expect(analytics.bitChangeCount).toBe(1);
    expect(analytics.reamerChangeCount).toBe(0);
    expect(analytics.runCorrectionCount).toBe(1);
    expect(analytics.voidedRunCount).toBe(1);
  });
});

describe("calculateShiftAnalytics — time", () => {
  it("calculates elapsed duration and gross metres per hour", () => {
    const shift = makeShift({
      localId: "shift-1",
      startedAt: "2026-07-21T08:00:00.000Z",
      closedAt: "2026-07-21T20:00:00.000Z",
      status: "CLOSED",
      startingDepthDm: metresToDecimetres(661.5),
      endingDepthDm: metresToDecimetres(697.5),
    });
    const analytics = calculateShiftAnalytics({
      shift,
      runs: [
        makeRun({
          localId: "r1",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          startedAt: "2026-07-21T09:00:00.000Z",
          completedAt: "2026-07-21T09:40:00.000Z",
          drilledLengthDm: 30,
          rodEvents: [],
        }),
        makeRun({
          localId: "r2",
          runNumber: 2,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          startedAt: "2026-07-21T10:00:00.000Z",
          completedAt: "2026-07-21T10:20:00.000Z",
          drilledLengthDm: 30,
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });

    expect(analytics.elapsedMinutes).toBe(720);
    expect(analytics.grossMetresPerElapsedHourTenths).toBe(30); // 36.0 m / 12 h = 3.0 → 30 tenths
    expect(analytics.averageRecordedRunCycleMinutes).toBe(30);
    expect(analytics.medianRecordedRunCycleMinutes).toBe(30);
  });

  it("returns undefined time metrics when timestamps are missing", () => {
    const shift = makeShift({
      localId: "shift-1",
      startedAt: "2026-07-21T08:00:00.000Z",
      status: "CLOSED",
      // no closedAt
    });
    const analytics = calculateShiftAnalytics({
      shift,
      runs: [
        makeRun({
          localId: "r1",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          startedAt: undefined,
          completedAt: undefined,
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
      liveEndingDepthDm: metresToDecimetres(664.5),
    });
    expect(analytics.elapsedMinutes).toBeUndefined();
    expect(analytics.grossMetresPerElapsedHourTenths).toBeUndefined();
    expect(analytics.averageRecordedRunCycleMinutes).toBeUndefined();
  });

  it("excludes incomplete Runs from cycle-time metrics", () => {
    const shift = makeShift({
      localId: "shift-1",
      startedAt: "2026-07-21T08:00:00.000Z",
      closedAt: "2026-07-21T20:00:00.000Z",
      status: "CLOSED",
      endingDepthDm: metresToDecimetres(664.5),
    });
    const analytics = calculateShiftAnalytics({
      shift,
      runs: [
        makeRun({
          localId: "complete",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          startedAt: "2026-07-21T09:00:00.000Z",
          completedAt: "2026-07-21T09:30:00.000Z",
          rodEvents: [],
        }),
        makeRun({
          localId: "incomplete",
          runNumber: 2,
          startedShiftId: "shift-1",
          completedShiftId: null,
          status: "in_progress",
          startedAt: "2026-07-21T10:00:00.000Z",
          completedAt: null,
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });
    expect(analytics.completedRunCount).toBe(1);
    expect(analytics.averageRecordedRunCycleMinutes).toBe(30);
  });
});

describe("calculateShiftAnalytics — amendments", () => {
  it("retains the original close snapshot and marks amended analytics", () => {
    const base = calculateShiftAnalytics({
      shift: makeShift({
        localId: "shift-1",
        startingDepthDm: metresToDecimetres(661.5),
        endingDepthDm: metresToDecimetres(696.0),
        status: "CLOSED",
        closedAt: "2026-07-21T20:00:00.000Z",
      }),
      runs: [
        makeRun({
          localId: "r1",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          drilledLengthDm: 345,
          recoveredLengthDm: 340,
          holeDepthDm: metresToDecimetres(696.0),
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [],
    });
    const snapshot = toCloseAnalyticsSnapshot(
      base,
      "2026-07-21T20:00:00.000Z",
    );

    const amended = calculateShiftAnalytics({
      shift: makeShift({
        localId: "shift-1",
        startingDepthDm: metresToDecimetres(661.5),
        endingDepthDm: metresToDecimetres(696.0),
        status: "CLOSED",
        closedAt: "2026-07-21T20:00:00.000Z",
        closeAnalyticsSnapshot: snapshot,
      }),
      runs: [
        makeRun({
          localId: "r1",
          runNumber: 1,
          startedShiftId: "shift-1",
          completedShiftId: "shift-1",
          status: "corrected",
          drilledLengthDm: 347,
          recoveredLengthDm: 345,
          holeDepthDm: metresToDecimetres(696.2),
          rodEvents: [],
        }),
      ],
      surveys: [],
      trays: [],
      casingEvents: [],
      componentAssignments: [],
      corrections: [
        {
          id: "corr-1",
          runId: "r1",
          correctionType: "MEASURED_STICK_UP",
          createdAt: "2026-07-21T21:00:00.000Z",
          shiftId: "shift-1",
        },
      ],
      liveEndingDepthDm: metresToDecimetres(696.2),
    });

    expect(amended.closeSnapshot).toEqual(snapshot);
    expect(amended.analyticsAmended).toBe(true);
    expect(amended.amendmentSummary?.originalMetresCompletedDm).toBe(
      snapshot.metresCompletedDm,
    );
    expect(amended.amendmentSummary?.responsibleCorrectionIds).toContain(
      "corr-1",
    );
  });
});

describe("buildShiftHandoverItems", () => {
  it("emits only real unresolved items", () => {
    expect(buildShiftHandoverItems({})).toEqual([]);
    const items = buildShiftHandoverItems({
      unfinishedRunNumber: 248,
      surveyIntervalReminder: {
        status: "DUE_IN",
        distanceDm: decimetres(85),
      },
      inProgressTrayNumber: 45,
      activeBitSerial: "BIT-HQ-002193",
      includeActiveComponentHandoverItems: true,
    });
    expect(items.map((item) => item.code)).toEqual([
      "UNFINISHED_RUN",
      "SURVEY_INTERVAL",
      "TRAY_IN_PROGRESS",
      "ACTIVE_BIT",
    ]);
    expect(items[0]?.message).toContain("Run 248");
  });
});
