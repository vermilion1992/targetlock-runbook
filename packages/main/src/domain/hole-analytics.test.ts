import { describe, expect, it } from "vitest";

import {
  calculateHoleAnalytics,
  LONG_RUN_LENGTH_DM,
  MIXED_NORTH_REFERENCE_WARNING,
  SHORT_RUN_LENGTH_DM,
  type CalculateHoleAnalyticsInput,
} from "./hole-analytics";
import { metresToDecimetres } from "./measurements";
import type {
  CasingEvent,
  CasingString,
  Component,
  ComponentAssignment,
  RunbookShift,
  Survey,
  Tray,
} from "./models";
import type { ShiftAnalyticsRun } from "./shift-analytics";

function makeShift(
  overrides: Partial<RunbookShift> & Pick<RunbookShift, "localId">,
): RunbookShift {
  const { localId, ...rest } = overrides;
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    rigId: "rig-1",
    shiftType: "DAY",
    shiftDate: "2026-07-20",
    primaryDrillerId: "user-1",
    primaryDrillerNameSnapshot: "J. Smith",
    crewMembers: [],
    startedAt: "2026-07-20T08:00:00.000Z",
    closedAt: "2026-07-20T20:00:00.000Z",
    startingDepthDm: metresToDecimetres(650),
    endingDepthDm: metresToDecimetres(680),
    startingRodNumber: 70,
    endingRodNumber: 80,
    startingRodStringDm: metresToDecimetres(650),
    endingRodStringDm: metresToDecimetres(680),
    startingRunNumber: 240,
    endingRunNumber: 245,
    status: "CLOSED",
    handoverAcceptedAt: "2026-07-20T20:05:00.000Z",
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
    holeDepthDm: metresToDecimetres(653),
    previousCompletedDepthDm: metresToDecimetres(650),
    status: "completed",
    rodEvents: [
      {
        localId: `rod-${overrides.localId}`,
        action: "add",
        rodLengthDm: 30,
        affectedRodNumber: 71,
        rodNumberAfterEvent: 71,
        voided: false,
      },
    ],
    startedAt: "2026-07-20T09:00:00.000Z",
    completedAt: "2026-07-20T09:30:00.000Z",
    ...overrides,
  };
}

function makeSurvey(
  overrides: Partial<Survey> & Pick<Survey, "localId" | "depthDm">,
): Survey {
  return {
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    dipTenths: -600,
    azimuthTenths: 450,
    northReference: "MAGNETIC",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "J. Smith",
    recordedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

function makeTray(
  overrides: Partial<Tray> & Pick<Tray, "localId" | "trayNumber">,
): Tray {
  return {
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-07-20T11:00:00.000Z",
    updatedAt: "2026-07-20T11:00:00.000Z",
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    primaryPhotoId: "photo-1",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "J. Smith",
    recordedAt: "2026-07-20T11:00:00.000Z",
    isFinalPartial: false,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<CalculateHoleAnalyticsInput> = {},
): CalculateHoleAnalyticsInput {
  const day = makeShift({
    localId: "shift-day",
    shiftType: "DAY",
    startingDepthDm: metresToDecimetres(650),
    endingDepthDm: metresToDecimetres(680),
  });
  const night = makeShift({
    localId: "shift-night",
    shiftType: "NIGHT",
    shiftDate: "2026-07-20",
    startedAt: "2026-07-20T20:00:00.000Z",
    closedAt: "2026-07-21T08:00:00.000Z",
    startingDepthDm: metresToDecimetres(680),
    endingDepthDm: metresToDecimetres(710),
    startingRodNumber: 80,
    endingRodNumber: 90,
    primaryDrillerId: "user-2",
    primaryDrillerNameSnapshot: "A. Jones",
  });

  const runs = [
    makeRun({
      localId: "r1",
      runNumber: 241,
      startedShiftId: "shift-day",
      completedShiftId: "shift-day",
      drilledLengthDm: 30,
      recoveredLengthDm: 29,
      previousCompletedDepthDm: metresToDecimetres(650),
      holeDepthDm: metresToDecimetres(653),
    }),
    makeRun({
      localId: "r2",
      runNumber: 242,
      startedShiftId: "shift-day",
      completedShiftId: "shift-day",
      drilledLengthDm: 30,
      recoveredLengthDm: 31,
      previousCompletedDepthDm: metresToDecimetres(653),
      holeDepthDm: metresToDecimetres(656),
      rodEvents: [
        {
          localId: "rod-r2",
          action: "add",
          rodLengthDm: 60,
          affectedRodNumber: 72,
          rodNumberAfterEvent: 72,
          voided: false,
        },
      ],
    }),
    makeRun({
      localId: "r3",
      runNumber: 243,
      startedShiftId: "shift-day",
      completedShiftId: "shift-night",
      drilledLengthDm: 30,
      recoveredLengthDm: 30,
      previousCompletedDepthDm: metresToDecimetres(680),
      holeDepthDm: metresToDecimetres(683),
    }),
  ];

  return {
    holeId: "DDH041",
    calculatedAt: "2026-07-21T12:00:00.000Z",
    startingDepthDm: metresToDecimetres(650),
    plannedDepthDm: metresToDecimetres(700),
    currentOrFinalDepthDm: metresToDecimetres(710),
    runs,
    shifts: [day, night],
    surveys: [
      makeSurvey({
        localId: "s1",
        depthDm: metresToDecimetres(650),
        toolNameSnapshot: "Reflex EZ-Gyro",
      }),
      makeSurvey({
        localId: "s2",
        depthDm: metresToDecimetres(680),
        recordedAt: "2026-07-20T18:00:00.000Z",
        toolNameSnapshot: "Reflex EZ-Gyro",
      }),
    ],
    trays: [
      makeTray({
        localId: "t1",
        trayNumber: 1,
        startDepthDm: metresToDecimetres(650),
        endDepthDm: metresToDecimetres(656),
      }),
      makeTray({
        localId: "t2",
        trayNumber: 2,
        startDepthDm: metresToDecimetres(656),
        endDepthDm: metresToDecimetres(683),
      }),
    ],
    casingStrings: [],
    casingEvents: [],
    components: [],
    componentAssignments: [],
    corrections: [],
    ...overrides,
  };
}

describe("calculateHoleAnalytics — production", () => {
  it("calculates drilled, recovered, weighted recovery, loss and gain", () => {
    const analytics = calculateHoleAnalytics(baseInput());
    expect(analytics.production.totalCompletedRuns).toBe(3);
    expect(analytics.production.totalDrilledDm).toBe(90);
    expect(analytics.production.totalRecoveredDm).toBe(90);
    expect(analytics.production.weightedRecoveryTenths).toBe(1000);
    expect(analytics.production.totalCoreLossDm).toBe(1);
    expect(analytics.production.totalCoreGainDm).toBe(1);
    expect(analytics.production.averageRunLengthDm).toBe(30);
    expect(analytics.production.medianRunLengthDm).toBe(30);
  });

  it("excludes voided Runs from production and tracks void count", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        runs: [
          ...baseInput().runs,
          makeRun({
            localId: "voided",
            runNumber: 244,
            startedShiftId: "shift-night",
            completedShiftId: "shift-night",
            status: "void",
            drilledLengthDm: 30,
            recoveredLengthDm: 30,
          }),
        ],
      }),
    );
    expect(analytics.production.totalVoidedRuns).toBe(1);
    expect(analytics.production.totalCompletedRuns).toBe(3);
    expect(analytics.production.totalDrilledDm).toBe(90);
  });

  it("includes corrected Runs and counts them", () => {
    const runs = baseInput().runs.map((run, index) =>
      index === 0 ? { ...run, status: "corrected" as const } : run,
    );
    const analytics = calculateHoleAnalytics(baseInput({ runs }));
    expect(analytics.production.totalCorrectedRuns).toBe(1);
    expect(analytics.production.totalCompletedRuns).toBe(3);
  });
});

describe("calculateHoleAnalytics — shifts", () => {
  it("credits shared Runs to completing Shift only and aggregates Day/Night", () => {
    const analytics = calculateHoleAnalytics(baseInput());
    expect(analytics.shifts.sharedRuns).toBe(1);
    expect(analytics.shifts.totalDayShifts).toBe(1);
    expect(analytics.shifts.totalNightShifts).toBe(1);
    expect(analytics.shifts.completedShifts).toBe(2);
    expect(analytics.shifts.handovers).toBe(2);

    const night = analytics.shifts.perShift.find(
      (shift) => shift.shiftId === "shift-night",
    );
    expect(night?.sharedRunCount).toBe(1);
    expect(night?.completedRunCount).toBe(1);
  });

  it("handles missing elapsed times without inventing gross metres/hour", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        shifts: [
          makeShift({
            localId: "shift-day",
            startedAt: "not-a-date",
            closedAt: "also-bad",
            status: "CLOSED",
          }),
        ],
      }),
    );
    expect(
      analytics.shifts.grossMetresPerElapsedShiftHourTenths,
    ).toBeUndefined();
  });
});

describe("calculateHoleAnalytics — rods", () => {
  it("counts 3.0 m and 6.0 m adds, removals, and final rod number", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        runs: [
          makeRun({
            localId: "r1",
            runNumber: 1,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            previousCompletedDepthDm: metresToDecimetres(650),
            holeDepthDm: metresToDecimetres(653),
            rodEvents: [
              {
                localId: "a3",
                action: "add",
                rodLengthDm: 30,
                affectedRodNumber: 71,
                rodNumberAfterEvent: 71,
                voided: false,
              },
              {
                localId: "a6",
                action: "add",
                rodLengthDm: 60,
                affectedRodNumber: 72,
                rodNumberAfterEvent: 72,
                voided: false,
              },
              {
                localId: "rm",
                action: "remove",
                rodLengthDm: 30,
                affectedRodNumber: 72,
                rodNumberAfterEvent: 71,
                voided: false,
              },
              {
                localId: "void-rod",
                action: "add",
                rodLengthDm: 30,
                affectedRodNumber: 72,
                rodNumberAfterEvent: 72,
                voided: true,
              },
            ],
          }),
        ],
      }),
    );
    expect(analytics.rods.rodsAdded3m).toBe(1);
    expect(analytics.rods.rodsAdded6m).toBe(1);
    expect(analytics.rods.rodsRemoved).toBe(1);
    expect(analytics.rods.netPhysicalRodChange).toBe(1);
    expect(analytics.rods.voidedRodEvents).toBe(1);
    expect(analytics.rods.finalOrCurrentRodNumber).toBe(90);
  });
});

describe("calculateHoleAnalytics — components", () => {
  it("calculates assignment metres, partial Runs, and observed recovery disclosure", () => {
    const component: Component = {
      localId: "bit-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T08:00:00.000Z",
      deviceId: "test",
      version: 1,
      organisationId: "org",
      type: "BIT",
      serialNumber: "BIT-100",
      normalizedSerialNumber: "BIT-100",
      size: "N",
      manufacturer: "Boart",
      model: "Alpha",
      status: "REMOVED",
      createdByUserId: "user-1",
      createdByNameSnapshot: "J. Smith",
    };
    const assignment: ComponentAssignment = {
      localId: "assign-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T08:00:00.000Z",
      deviceId: "test",
      version: 1,
      componentId: "bit-1",
      holeId: "DDH041",
      componentType: "BIT",
      startDepthDm: metresToDecimetres(650),
      endDepthDm: metresToDecimetres(654.5),
      installedAt: "2026-07-20T08:00:00.000Z",
      removedAt: "2026-07-20T12:00:00.000Z",
      installedByUserId: "user-1",
      installedByNameSnapshot: "J. Smith",
      removalReason: "WORN",
      status: "CLOSED",
    };

    const analytics = calculateHoleAnalytics(
      baseInput({
        components: [component],
        componentAssignments: [assignment],
        runs: [
          makeRun({
            localId: "r1",
            runNumber: 241,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            drilledLengthDm: 30,
            recoveredLengthDm: 30,
            previousCompletedDepthDm: metresToDecimetres(650),
            holeDepthDm: metresToDecimetres(653),
          }),
          makeRun({
            localId: "r2",
            runNumber: 242,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            drilledLengthDm: 30,
            recoveredLengthDm: 27,
            previousCompletedDepthDm: metresToDecimetres(653),
            holeDepthDm: metresToDecimetres(656),
          }),
        ],
      }),
    );

    expect(analytics.components.bitsUsed).toBe(1);
    expect(analytics.components.assignments[0]?.partialBoundaryRuns).toBeGreaterThan(
      0,
    );
    expect(analytics.components.assignments[0]?.recoveryEstimateStatus).toBe(
      "RUN_LEVEL_ESTIMATE",
    );
    expect(analytics.components.removalReasonsByCount[0]?.reason).toBe("WORN");
  });
});

describe("calculateHoleAnalytics — surveys", () => {
  it("calculates spacing, duplicates, mixed references, and latest distance", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        surveys: [
          makeSurvey({
            localId: "s1",
            depthDm: metresToDecimetres(650),
            northReference: "MAGNETIC",
          }),
          makeSurvey({
            localId: "s2",
            depthDm: metresToDecimetres(680),
            northReference: "TRUE",
            recordedAt: "2026-07-20T18:00:00.000Z",
          }),
          makeSurvey({
            localId: "s3",
            depthDm: metresToDecimetres(680),
            northReference: "TRUE",
            recordedAt: "2026-07-20T19:00:00.000Z",
          }),
        ],
        correctedSurveyIds: new Set(["s2"]),
      }),
    );
    expect(analytics.surveys.totalSurveys).toBe(3);
    expect(analytics.surveys.duplicateDepthSurveyCount).toBe(1);
    expect(analytics.surveys.correctedSurveyCount).toBe(1);
    expect(analytics.surveys.mixedNorthReferences).toBe(true);
    expect(analytics.surveys.mixedNorthReferenceWarning).toBe(
      MIXED_NORTH_REFERENCE_WARNING,
    );
    expect(analytics.surveys.distanceFromFinalDepthToLatestDm).toBe(300);
    expect(analytics.surveys.medianSurveySpacingDm).toBe(300);
  });
});

describe("calculateHoleAnalytics — trays", () => {
  it("calculates coverage, gaps, overlaps, and uncovered interval", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        trays: [
          makeTray({
            localId: "t1",
            trayNumber: 1,
            startDepthDm: metresToDecimetres(650),
            endDepthDm: metresToDecimetres(656),
          }),
          makeTray({
            localId: "t2",
            trayNumber: 1,
            startDepthDm: metresToDecimetres(660),
            endDepthDm: metresToDecimetres(670),
            isFinalPartial: true,
          }),
          makeTray({
            localId: "t3",
            trayNumber: 3,
            startDepthDm: metresToDecimetres(665),
            endDepthDm: metresToDecimetres(675),
          }),
        ],
        photographReplacements: 2,
      }),
    );
    expect(analytics.trays.totalTrays).toBe(3);
    expect(analytics.trays.duplicateNumberConflicts).toBe(1);
    expect(analytics.trays.coverageGaps).toBeGreaterThan(0);
    expect(analytics.trays.depthOverlaps).toBeGreaterThan(0);
    expect(analytics.trays.finalPartialTrays).toBe(1);
    expect(analytics.trays.photographReplacements).toBe(2);
    expect(analytics.trays.uncoveredIntervalToHoleDepthDm).toBe(350);
  });
});

describe("calculateHoleAnalytics — completeness", () => {
  it("marks a clean Hole Complete without a combined score", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        runs: [
          makeRun({
            localId: "r1",
            runNumber: 241,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            previousCompletedDepthDm: metresToDecimetres(650),
            holeDepthDm: metresToDecimetres(653),
          }),
          makeRun({
            localId: "r2",
            runNumber: 242,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            previousCompletedDepthDm: metresToDecimetres(653),
            holeDepthDm: metresToDecimetres(656),
          }),
        ],
        surveys: [],
        trays: [],
        components: [],
        componentAssignments: [],
        casingStrings: [],
      }),
    );
    const runs = analytics.completeness.categories.find(
      (item) => item.category === "Runs",
    );
    expect(runs?.status).toBe("Complete");
    expect(
      (analytics.completeness as { score?: unknown }).score,
    ).toBeUndefined();
  });

  it("marks voided Runs as Review recommended", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        runs: [
          makeRun({
            localId: "r1",
            runNumber: 241,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
          }),
          makeRun({
            localId: "voided",
            runNumber: 242,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            status: "void",
          }),
        ],
      }),
    );
    expect(
      analytics.completeness.categories.find((item) => item.category === "Runs")
        ?.status,
    ).toBe("Review recommended");
  });

  it("marks Surveys Not applicable when none exist", () => {
    const analytics = calculateHoleAnalytics(baseInput({ surveys: [] }));
    expect(
      analytics.completeness.categories.find(
        (item) => item.category === "Surveys",
      )?.status,
    ).toBe("Not applicable");
  });
});

describe("calculateHoleAnalytics — chart datasets", () => {
  it("builds all six chart datasets with summaries", () => {
    const analytics = calculateHoleAnalytics(baseInput());
    expect(analytics.charts.metresByShift.points.length).toBe(2);
    expect(analytics.charts.cumulativeDepthByShift.points.at(-1)?.isCompletionPoint).toBe(
      true,
    );
    expect(analytics.charts.recoveryByDepth.points.some((point) => point.recoveryPercentTenths > 1000)).toBe(
      true,
    );
    expect(analytics.charts.runLengthByDepth.points.length).toBe(3);
    expect(analytics.charts.coreLossGainByDepth.points.length).toBe(3);
    expect(analytics.charts.metresByShift.summary.length).toBeGreaterThan(0);
    expect(analytics.charts.componentIntervals.summary.length).toBeGreaterThan(0);
  });

  it("highlights short and long Runs using documented thresholds", () => {
    const analytics = calculateHoleAnalytics(
      baseInput({
        runs: [
          makeRun({
            localId: "short",
            runNumber: 1,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            drilledLengthDm: SHORT_RUN_LENGTH_DM - 1,
            recoveredLengthDm: 10,
            previousCompletedDepthDm: metresToDecimetres(650),
            holeDepthDm: metresToDecimetres(651.4),
          }),
          makeRun({
            localId: "long",
            runNumber: 2,
            startedShiftId: "shift-day",
            completedShiftId: "shift-day",
            drilledLengthDm: LONG_RUN_LENGTH_DM + 10,
            recoveredLengthDm: 70,
            previousCompletedDepthDm: metresToDecimetres(651.4),
            holeDepthDm: metresToDecimetres(658.4),
          }),
        ],
      }),
    );
    expect(analytics.charts.runLengthByDepth.points[0]?.highlight).toBe("short");
    expect(analytics.charts.runLengthByDepth.points[1]?.highlight).toBe("long");
  });
});

describe("calculateHoleAnalytics — casing", () => {
  it("summarises casing timeline and event counts", () => {
    const casing: CasingString = {
      localId: "casing-1",
      serverId: null,
      syncStatus: "local-only",
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T08:00:00.000Z",
      deviceId: "test",
      version: 1,
      holeId: "DDH041",
      casingSize: "HQ",
      startDepthDm: metresToDecimetres(0),
      currentEndDepthDm: metresToDecimetres(100),
      status: "COMPLETED",
      installedAt: "2026-07-19T08:00:00.000Z",
      installedByUserId: "user-1",
      installedByNameSnapshot: "J. Smith",
    };
    const events: CasingEvent[] = [
      {
        localId: "ce1",
        serverId: null,
        syncStatus: "local-only",
        createdAt: "2026-07-19T08:00:00.000Z",
        updatedAt: "2026-07-19T08:00:00.000Z",
        deviceId: "test",
        version: 1,
        holeId: "DDH041",
        casingStringId: "casing-1",
        eventType: "INSTALL",
        newEndDepthDm: metresToDecimetres(50),
        recordedByUserId: "user-1",
        recordedByNameSnapshot: "J. Smith",
        recordedAt: "2026-07-19T08:00:00.000Z",
        operationId: "op-1",
      },
      {
        localId: "ce2",
        serverId: null,
        syncStatus: "local-only",
        createdAt: "2026-07-19T09:00:00.000Z",
        updatedAt: "2026-07-19T09:00:00.000Z",
        deviceId: "test",
        version: 1,
        holeId: "DDH041",
        casingStringId: "casing-1",
        eventType: "ADVANCE",
        previousEndDepthDm: metresToDecimetres(50),
        newEndDepthDm: metresToDecimetres(100),
        recordedByUserId: "user-1",
        recordedByNameSnapshot: "J. Smith",
        recordedAt: "2026-07-19T09:00:00.000Z",
        operationId: "op-2",
      },
    ];
    const analytics = calculateHoleAnalytics(
      baseInput({ casingStrings: [casing], casingEvents: events }),
    );
    expect(analytics.casing.stringCount).toBe(1);
    expect(analytics.casing.installCount).toBe(1);
    expect(analytics.casing.advancementCount).toBe(1);
    expect(analytics.casing.deepestCasingDm).toBe(1000);
  });
});
