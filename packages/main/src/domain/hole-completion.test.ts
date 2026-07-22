import { describe, expect, it } from "vitest";

import {
  HOLE_COMPLETION_REASON_LABELS,
  HOLE_COMPLETION_TRANSACTION_STAGES,
  HOLE_STATUS_LABELS,
  type CasingString,
  type ComponentAssignment,
  type HoleCompletionCheckCode,
  type HoleCompletionWarningAcknowledgement,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type SyncMetadata,
  type Tray,
} from "./models";
import { decimetres } from "./measurements";
import {
  assertHoleUnlocked,
  evaluateHoleCompletion,
  HoleLockedError,
  isHoleLockedError,
  normalizeHoleStatus,
  parseHoleStatus,
  type EvaluateHoleCompletionInput,
} from "./hole-completion";
import {
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
} from "./measurements";

function metadata(localId: string): SyncMetadata {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: "2026-07-21T10:00:00.000Z",
    updatedAt: "2026-07-21T10:00:00.000Z",
    deviceId: "test-device",
    version: 1,
  };
}

function run(
  localId: string,
  runNumber: number,
  startDepthDm: number,
  endDepthDm: number,
  rodNumber: number,
  status: Run["status"] = "completed",
): Run {
  const drilledLengthDm = endDepthDm - startDepthDm;
  return {
    ...metadata(localId),
    holeId: "hole-1",
    startedShiftId: "shift-closed",
    completedShiftId: "shift-closed",
    runNumber,
    rodNumber,
    startedAt: "2026-07-21T10:00:00.000Z",
    startedByUserId: "user-1",
    startedByNameSnapshot: "Alex Driller",
    completedAt:
      status === "in_progress" ? null : "2026-07-21T11:00:00.000Z",
    completedByUserId: status === "in_progress" ? null : "user-1",
    completedByNameSnapshot: status === "in_progress" ? null : "Alex Driller",
    rodEventIds: [`rod-event-${runNumber}`],
    rodAddedLength:
      runNumber === 1 ? THREE_METRE_ROD_LENGTH : SIX_METRE_ROD_LENGTH,
    previousCompletedDepth: decimetres(startDepthDm),
    startDepth: decimetres(startDepthDm),
    measuredStickUp: decimetres(10),
    rodStringLength: decimetres(endDepthDm + 10),
    holeDepth: decimetres(endDepthDm),
    drilledLength: decimetres(Math.max(0, drilledLengthDm)),
    recoveredLength: decimetres(Math.max(0, drilledLengthDm)),
    recoveryPercentage: drilledLengthDm > 0 ? 100 : 0,
    conditionTagIds: [],
    conditionTagLabelsSnapshot: [],
    comment: null,
    correctionIds: [],
    activeBitSerialNumberSnapshot: "BIT-1",
    activeReamerSerialNumberSnapshot: null,
    activeBitAssignmentId: "assignment-bit",
    activeReamerAssignmentId: null,
    casingSummarySnapshot: "HQ to 2.0 m",
    status,
    holeNameSnapshot: "DDH001",
    rigNameSnapshot: "Rig 1",
  };
}

function rodConfiguration(): RodStringConfiguration {
  return {
    ...metadata("rod-config-1"),
    holeId: "hole-1",
    effectiveAt: "2026-07-21T09:00:00.000Z",
    bottomHoleAssemblyLength: decimetres(30),
    constantStickUp: decimetres(10),
    baseRodStringLength: decimetres(20),
    reason: "Initial assembly",
  };
}

function rodEvent(
  localId: string,
  sequence: number,
  rodLength: RodAddition["rodLength"],
  rodNumberAfterEvent: number,
): RodAddition {
  return {
    ...metadata(localId),
    holeId: "hole-1",
    runId: `run-${sequence}`,
    shiftId: "shift-closed",
    sequence,
    action: "add",
    rodLength,
    affectedRodNumber: rodNumberAfterEvent,
    rodNumberAfterEvent,
    occurredAt: `2026-07-21T10:0${sequence}:00.000Z`,
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Alex Driller",
  };
}

function shift(
  localId: string,
  status: RunbookShift["status"],
): RunbookShift {
  return {
    ...metadata(localId),
    holeId: "hole-1",
    rigId: "rig-1",
    shiftType: "DAY",
    shiftDate: "2026-07-21",
    primaryDrillerId: "user-1",
    primaryDrillerNameSnapshot: "Alex Driller",
    crewMembers: [],
    startedAt: "2026-07-21T06:00:00.000Z",
    startingDepthDm: decimetres(0),
    startingRodNumber: 0,
    startingRodStringDm: decimetres(20),
    startingRunNumber: 1,
    status,
  };
}

function casing(status: CasingString["status"] = "COMPLETED"): CasingString {
  return {
    ...metadata("casing-1"),
    holeId: "hole-1",
    casingSize: "HQ",
    startDepthDm: decimetres(0),
    currentEndDepthDm: decimetres(20),
    status,
    installedAt: "2026-07-21T06:00:00.000Z",
    installedByUserId: "user-1",
    installedByNameSnapshot: "Alex Driller",
  };
}

function assignment(): ComponentAssignment {
  return {
    ...metadata("assignment-bit"),
    componentId: "component-bit",
    holeId: "hole-1",
    componentType: "BIT",
    startDepthDm: decimetres(0),
    installedAt: "2026-07-21T06:00:00.000Z",
    installedByUserId: "user-1",
    installedByNameSnapshot: "Alex Driller",
    status: "ACTIVE",
  };
}

function survey(): Survey {
  return {
    ...metadata("survey-final"),
    holeId: "hole-1",
    depthDm: decimetres(100),
    dipTenths: -600,
    azimuthTenths: 420,
    northReference: "TRUE",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Alex Driller",
    recordedAt: "2026-07-21T12:00:00.000Z",
  };
}

function tray(isFinalPartial = false): Tray {
  return {
    ...metadata("tray-final"),
    holeId: "hole-1",
    trayNumber: 1,
    startDepthDm: decimetres(0),
    endDepthDm: decimetres(100),
    isFinalPartial,
    primaryPhotoId: "photo-1",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "Alex Driller",
    recordedAt: "2026-07-21T12:00:00.000Z",
  };
}

function validInput(): EvaluateHoleCompletionInput {
  return {
    holeId: "hole-1",
    runs: [
      run("run-1", 1, 0, 40, 1),
      run("run-2", 2, 40, 100, 2),
    ],
    rodConfiguration: rodConfiguration(),
    rodEvents: [
      rodEvent("rod-event-1", 1, THREE_METRE_ROD_LENGTH, 1),
      rodEvent("rod-event-2", 2, SIX_METRE_ROD_LENGTH, 2),
    ],
    shifts: [],
    casingStrings: [casing()],
    componentAssignments: [assignment()],
    componentOutcomes: [
      {
        assignmentId: "assignment-bit",
        componentId: "component-bit",
        componentType: "BIT",
        outcome: "SERVICEABLE",
      },
    ],
    surveys: [survey()],
    finalSurveyResolution: {
      status: "RECORDED",
      surveyId: "survey-final",
    },
    trays: [tray()],
    pendingOperations: {
      rodEvents: 0,
      media: 0,
      corrections: 0,
    },
    completionReason: "PLANNED_DEPTH_REACHED",
    completionComment: "Reached the approved final depth.",
  };
}

function acknowledgement(
  checkCode: HoleCompletionCheckCode,
): HoleCompletionWarningAcknowledgement {
  return {
    checkCode,
    reason: "Reviewed and accepted by the supervisor.",
    acknowledgedAt: "2026-07-21T13:00:00.000Z",
    acknowledgedByUserId: "supervisor-1",
    acknowledgedByNameSnapshot: "Sam Supervisor",
  };
}

function failedCodes(input: EvaluateHoleCompletionInput): readonly string[] {
  return evaluateHoleCompletion(input).checks
    .filter(({ status }) => status === "FAIL")
    .map(({ code }) => code);
}

describe("hole status normalization", () => {
  it.each([
    ["planned", "DRAFT"],
    ["drilling", "ACTIVE"],
    ["suspended", "SUSPENDED"],
    ["completed", "COMPLETED"],
    ["DRAFT", "DRAFT"],
    ["ACTIVE", "ACTIVE"],
    ["SUSPENDED", "SUSPENDED"],
    ["COMPLETION_REVIEW", "COMPLETION_REVIEW"],
    ["COMPLETED", "COMPLETED"],
    ["ABANDONED", "ABANDONED"],
    ["ARCHIVED", "ARCHIVED"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeHoleStatus(input)).toBe(expected);
  });

  it("rejects unknown values conservatively", () => {
    expect(parseHoleStatus("active")).toBeUndefined();
    expect(parseHoleStatus(" completed ")).toBeUndefined();
    expect(parseHoleStatus(null)).toBeUndefined();
  });

  it("provides stable display labels", () => {
    expect(HOLE_STATUS_LABELS.COMPLETION_REVIEW).toBe("Completion review");
    expect(HOLE_COMPLETION_REASON_LABELS.HOLE_ABANDONED).toBe("Hole abandoned");
  });
});

describe("hole lock contract", () => {
  it("throws a typed HOLE_LOCKED error for canonical and legacy locks", () => {
    for (const status of ["COMPLETED", "ABANDONED", "ARCHIVED", "completed"] as const) {
      try {
        assertHoleUnlocked("hole-1", status, "completion-1");
        throw new Error("Expected the hole to be locked.");
      } catch (error) {
        expect(isHoleLockedError(error)).toBe(true);
        expect(error).toBeInstanceOf(HoleLockedError);
        expect((error as HoleLockedError).code).toBe("HOLE_LOCKED");
        expect((error as HoleLockedError).completionRecordId).toBe(
          "completion-1",
        );
      }
    }
  });

  it.each(["DRAFT", "ACTIVE", "SUSPENDED", "COMPLETION_REVIEW"] as const)(
    "allows mutable status %s",
    (status) => {
      expect(() => assertHoleUnlocked("hole-1", status)).not.toThrow();
    },
  );

  it("keeps completion transaction stages ordered and recoverable", () => {
    expect(HOLE_COMPLETION_TRANSACTION_STAGES).toEqual([
      "REVIEW_CREATED",
      "SNAPSHOT_PERSISTED",
      "COMPONENTS_CLOSED",
      "HOLE_LOCKED",
      "TIMELINE_APPENDED",
      "AUDIT_APPENDED",
      "COMPLETED",
    ]);
  });
});

describe("completion checklist", () => {
  it("passes a fully reconciled completion input", () => {
    const result = evaluateHoleCompletion(validInput());

    expect(result.finalDepthDm).toBe(100);
    expect(result.finalRunNumber).toBe(2);
    expect(result.blockers).toEqual([]);
    expect(result.advisories).toEqual([]);
    expect(result.unacknowledgedAdvisories).toEqual([]);
    expect(result.canComplete).toBe(true);
    expect(result.checks.every(({ status }) => status === "PASS")).toBe(true);
  });

  it.each<
    [
      string,
      (input: EvaluateHoleCompletionInput) => EvaluateHoleCompletionInput,
      HoleCompletionCheckCode,
    ]
  >([
    [
      "final depth availability",
      (input) => ({ ...input, runs: [] }),
      "FINAL_DEPTH_AVAILABLE",
    ],
    [
      "final depth rod reconciliation",
      (input) => ({
        ...input,
        rodEvents: [
          ...input.rodEvents,
          rodEvent("rod-event-3", 3, THREE_METRE_ROD_LENGTH, 3),
        ],
      }),
      "FINAL_DEPTH_RECONCILED",
    ],
    [
      "unfinished runs",
      (input) => ({
        ...input,
        runs: [...input.runs, run("run-3", 3, 100, 130, 3, "in_progress")],
      }),
      "RUNS_FINISHED",
    ],
    [
      "duplicate run numbers",
      (input) => ({
        ...input,
        runs: [input.runs[0]!, { ...input.runs[1]!, runNumber: 1 }],
      }),
      "RUN_NUMBERS_UNIQUE",
    ],
    [
      "run depth overlaps",
      (input) => ({
        ...input,
        runs: [
          input.runs[0]!,
          {
            ...input.runs[1]!,
            previousCompletedDepth: decimetres(35),
            startDepth: decimetres(35),
            drilledLength: decimetres(65),
          },
        ],
      }),
      "RUN_DEPTH_OVERLAPS",
    ],
    [
      "non-positive runs",
      (input) => ({
        ...input,
        runs: [
          input.runs[0]!,
          {
            ...input.runs[1]!,
            previousCompletedDepth: decimetres(100),
            startDepth: decimetres(100),
            drilledLength: decimetres(0),
          },
        ],
      }),
      "RUN_LENGTHS_POSITIVE",
    ],
    [
      "run drilled-length reconciliation",
      (input) => ({
        ...input,
        runs: [
          input.runs[0]!,
          { ...input.runs[1]!, drilledLength: decimetres(59) },
        ],
      }),
      "RUN_DEPTHS_RECONCILED",
    ],
    [
      "missing rod configuration",
      (input) => ({ ...input, rodConfiguration: undefined }),
      "ROD_CONFIGURATION_VALID",
    ],
    [
      "incomplete rod fields",
      (input) => ({
        ...input,
        runs: [
          input.runs[0]!,
          {
            ...input.runs[1]!,
            measuredStickUp: undefined,
          } as unknown as Run,
        ],
      }),
      "ROD_FIELDS_COMPLETE",
    ],
    [
      "pending rod events",
      (input) => ({
        ...input,
        pendingOperations: { ...input.pendingOperations, rodEvents: 1 },
      }),
      "ROD_EVENTS_SETTLED",
    ],
    [
      "open shifts",
      (input) => ({ ...input, shifts: [shift("shift-open", "OPEN")] }),
      "SHIFTS_CLOSED",
    ],
    [
      "pending handovers",
      (input) => ({
        ...input,
        shifts: [shift("shift-handover", "HANDOVER_PENDING")],
      }),
      "HANDOVERS_RESOLVED",
    ],
    [
      "invalid casing",
      (input) => ({
        ...input,
        casingStrings: [
          { ...casing(), currentEndDepthDm: decimetres(110) },
        ],
      }),
      "CASING_VALID",
    ],
    [
      "unresolved components",
      (input) => ({ ...input, componentOutcomes: [] }),
      "COMPONENTS_RESOLVED",
    ],
    [
      "unselected final survey",
      (input) => ({ ...input, finalSurveyResolution: undefined }),
      "FINAL_SURVEY_RESOLVED",
    ],
    [
      "missing survey-unavailable reason",
      (input) => ({
        ...input,
        finalSurveyResolution: { status: "UNAVAILABLE", reason: " " },
      }),
      "FINAL_SURVEY_RESOLVED",
    ],
    [
      "pending media",
      (input) => ({
        ...input,
        pendingOperations: { ...input.pendingOperations, media: 1 },
      }),
      "MEDIA_SETTLED",
    ],
    [
      "pending corrections",
      (input) => ({
        ...input,
        pendingOperations: { ...input.pendingOperations, corrections: 1 },
      }),
      "CORRECTIONS_SETTLED",
    ],
    [
      "missing completion reason",
      (input) => ({ ...input, completionReason: undefined }),
      "COMPLETION_REASON_PROVIDED",
    ],
    [
      "missing completion comment",
      (input) => ({
        ...input,
        completionReason: "OTHER",
        completionComment: " ",
      }),
      "COMPLETION_COMMENT_PROVIDED",
    ],
  ])("classifies %s as blocking", (_name, mutate, expectedCode) => {
    const result = evaluateHoleCompletion(mutate(validInput()));
    const matching = result.blockers.find(({ code }) => code === expectedCode);

    expect(matching?.classification).toBe("BLOCKING");
    expect(matching?.status).toBe("FAIL");
    expect(result.canComplete).toBe(false);
  });

  it.each<
    [
      string,
      (input: EvaluateHoleCompletionInput) => EvaluateHoleCompletionInput,
      HoleCompletionCheckCode,
    ]
  >([
    [
      "a missing run number",
      (input) => ({
        ...input,
        runs: [input.runs[0]!, { ...input.runs[1]!, runNumber: 3 }],
      }),
      "RUN_SEQUENCE_COMPLETE",
    ],
    [
      "a run depth gap",
      (input) => ({
        ...input,
        runs: [
          input.runs[0]!,
          {
            ...input.runs[1]!,
            previousCompletedDepth: decimetres(45),
            startDepth: decimetres(45),
            drilledLength: decimetres(55),
          },
        ],
      }),
      "RUN_DEPTH_GAPS",
    ],
    [
      "active casing",
      (input) => ({ ...input, casingStrings: [casing("ACTIVE")] }),
      "CASING_REVIEWED",
    ],
    [
      "documented unavailable survey",
      (input) => ({
        ...input,
        finalSurveyResolution: {
          status: "UNAVAILABLE",
          reason: "Tool failed at end of hole.",
        },
      }),
      "FINAL_SURVEY_UNAVAILABLE",
    ],
    [
      "unreconciled trays",
      (input) => ({ ...input, trays: [] }),
      "TRAYS_RECONCILED",
    ],
  ])(
    "requires a reasoned acknowledgement for %s",
    (_name, mutate, expectedCode) => {
      const input = mutate(validInput());
      const unacknowledged = evaluateHoleCompletion(input);

      expect(unacknowledged.blockers).toEqual([]);
      expect(unacknowledged.advisories.map(({ code }) => code)).toContain(
        expectedCode,
      );
      expect(
        unacknowledged.unacknowledgedAdvisories.map(({ code }) => code),
      ).toContain(expectedCode);
      expect(unacknowledged.canComplete).toBe(false);

      const acknowledged = evaluateHoleCompletion({
        ...input,
        warningAcknowledgements: [acknowledgement(expectedCode)],
      });
      expect(acknowledged.unacknowledgedAdvisories).toEqual([]);
      expect(acknowledged.canComplete).toBe(true);
    },
  );

  it("does not accept a blank warning acknowledgement", () => {
    const result = evaluateHoleCompletion({
      ...validInput(),
      casingStrings: [casing("ACTIVE")],
      warningAcknowledgements: [
        { ...acknowledgement("CASING_REVIEWED"), reason: " " },
      ],
    });

    expect(result.unacknowledgedAdvisories.map(({ code }) => code)).toContain(
      "CASING_REVIEWED",
    );
    expect(result.canComplete).toBe(false);
  });

  it("rejects carried-forward components without another target hole", () => {
    const input = validInput();
    const invalid = {
      assignmentId: "assignment-bit",
      componentId: "component-bit",
      componentType: "BIT",
      outcome: "CARRIED_FORWARD",
      targetHoleId: "hole-1",
    } as const;

    expect(
      failedCodes({ ...input, componentOutcomes: [invalid] }),
    ).toContain("COMPONENTS_RESOLVED");
  });
});
