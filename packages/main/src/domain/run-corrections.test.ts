import { describe, expect, it } from "vitest";

import {
  previewRunCorrection,
  previewVoidRun,
  type EffectiveRunProjection,
} from "./run-corrections";

function run(partial: Partial<EffectiveRunProjection> & { localId: string; runNumber: number }): EffectiveRunProjection {
  return {
    holeId: "DDH041",
    rodNumber: 10,
    rodStringDm: 1000,
    measuredStickUpDm: 5,
    previousCompletedDepthDm: 970,
    holeDepthDm: 995,
    drilledLengthDm: 25,
    recoveredLengthDm: 24,
    recoveryPercentage: 96,
    comment: "",
    status: "completed",
    version: 1,
    rodEvents: [
      {
        localId: `${partial.localId}-rod-1`,
        action: "add",
        rodLengthDm: 30,
        affectedRodNumber: 10,
        rodNumberAfterEvent: 10,
        voided: false,
      },
    ],
    activeBitSerialNumberSnapshot: null,
    activeReamerSerialNumberSnapshot: null,
    ...partial,
  };
}

describe("run correction projection", () => {
  it("corrects measured stick-up and following drilled length", () => {
    const runs = [
      run({
        localId: "run-148",
        runNumber: 148,
        rodStringDm: 4129,
        measuredStickUpDm: 5,
        previousCompletedDepthDm: 4096,
        holeDepthDm: 4124,
        drilledLengthDm: 28,
        recoveredLengthDm: 27,
        recoveryPercentage: 96.4,
      }),
      run({
        localId: "run-149",
        runNumber: 149,
        rodStringDm: 4159,
        measuredStickUpDm: 5,
        previousCompletedDepthDm: 4124,
        holeDepthDm: 4154,
        drilledLengthDm: 30,
        recoveredLengthDm: 30,
        recoveryPercentage: 100,
      }),
    ];

    const impact = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-148",
      correctionType: "MEASURED_STICK_UP",
      reason: "Incorrect value entered",
      measuredStickUpDm: 3,
      runs,
    });

    expect(impact.blockers).toHaveLength(0);
    expect(impact.correctedRun.measuredStickUpDm).toBe(3);
    expect(impact.correctedRun.holeDepthDm).toBe(4126);
    expect(impact.correctedRun.drilledLengthDm).toBe(30);
    const following = impact.projectedRuns.find((item) => item.localId === "run-149");
    expect(following?.previousCompletedDepthDm).toBe(4126);
    expect(following?.holeDepthDm).toBe(4154);
    expect(following?.drilledLengthDm).toBe(28);
    expect(runs[0]?.measuredStickUpDm).toBe(5);
  });

  it("corrects recovered length without changing depth", () => {
    const runs = [
      run({
        localId: "run-148",
        runNumber: 148,
        drilledLengthDm: 30,
        recoveredLengthDm: 27,
        recoveryPercentage: 90,
        holeDepthDm: 4124,
      }),
    ];
    const impact = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-148",
      correctionType: "RECOVERED_LENGTH",
      reason: "Core measured incorrectly",
      recoveredLengthDm: 29,
      runs,
    });
    expect(impact.blockers).toHaveLength(0);
    expect(impact.correctedRun.recoveredLengthDm).toBe(29);
    expect(impact.correctedRun.recoveryPercentage).toBeCloseTo(96.7, 1);
    expect(impact.correctedRun.holeDepthDm).toBe(4124);
  });

  it("corrects 6.0 m rod to 3.0 m and keeps one physical rod", () => {
    const runs = [
      run({
        localId: "run-148",
        runNumber: 148,
        rodNumber: 54,
        rodStringDm: 4159,
        measuredStickUpDm: 5,
        previousCompletedDepthDm: 4096,
        holeDepthDm: 4154,
        drilledLengthDm: 58,
        rodEvents: [
          {
            localId: "rod-54",
            action: "add",
            rodLengthDm: 60,
            affectedRodNumber: 54,
            rodNumberAfterEvent: 54,
            voided: false,
          },
        ],
      }),
    ];
    const impact = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-148",
      correctionType: "ROD_EVENT",
      reason: "Wrong rod length",
      rodEvent: {
        rodEventId: "rod-54",
        action: "add",
        rodLengthDm: 30,
        affectedRodNumber: 54,
      },
      runs,
    });
    expect(impact.blockers).toHaveLength(0);
    expect(impact.correctedRun.rodEvents).toHaveLength(1);
    expect(impact.correctedRun.rodStringDm).toBe(4129);
    expect(impact.correctedRun.holeDepthDm).toBe(4124);
    expect(impact.correctedFinalRodNumber).toBe(impact.previousFinalRodNumber);
  });

  it("applies multiple corrections via ordered projections", () => {
    const first = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-1",
      correctionType: "MEASURED_STICK_UP",
      reason: "first",
      measuredStickUpDm: 4,
      runs: [
        run({
          localId: "run-1",
          runNumber: 1,
          rodStringDm: 100,
          measuredStickUpDm: 5,
          previousCompletedDepthDm: 70,
          holeDepthDm: 95,
          drilledLengthDm: 25,
        }),
      ],
    });
    const second = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-1",
      correctionType: "COMMENT",
      reason: "second",
      comment: "Updated note",
      runs: first.projectedRuns,
    });
    expect(second.correctedRun.measuredStickUpDm).toBe(4);
    expect(second.correctedRun.comment).toBe("Updated note");
    expect(second.correctedRun.status).toBe("corrected");
  });

  it("blocks negative depth and warns recovery above 100%", () => {
    const negative = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-1",
      correctionType: "MEASURED_STICK_UP",
      reason: "bad",
      measuredStickUpDm: 200,
      runs: [
        run({
          localId: "run-1",
          runNumber: 1,
          rodStringDm: 100,
          measuredStickUpDm: 5,
          previousCompletedDepthDm: 0,
          holeDepthDm: 95,
          drilledLengthDm: 95,
        }),
      ],
    });
    expect(negative.blockers.some((item) => item.code === "NEGATIVE_HOLE_DEPTH")).toBe(
      true,
    );

    const recovery = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-1",
      correctionType: "RECOVERED_LENGTH",
      reason: "gain",
      recoveredLengthDm: 40,
      runs: [
        run({
          localId: "run-1",
          runNumber: 1,
          drilledLengthDm: 30,
          recoveredLengthDm: 27,
          recoveryPercentage: 90,
        }),
      ],
    });
    expect(
      recovery.warnings.some((item) => item.code === "RECOVERY_ABOVE_100"),
    ).toBe(true);
  });

  it("voids a duplicate and excludes it from final rod state", () => {
    const runs = [
      run({ localId: "run-147", runNumber: 147, holeDepthDm: 4100, previousCompletedDepthDm: 4070, drilledLengthDm: 30, rodStringDm: 4105, measuredStickUpDm: 5 }),
      run({ localId: "run-148", runNumber: 148, holeDepthDm: 4130, previousCompletedDepthDm: 4100, drilledLengthDm: 30, rodStringDm: 4135, measuredStickUpDm: 5 }),
    ];
    const impact = previewVoidRun({
      holeId: "DDH041",
      runId: "run-148",
      reason: "ACCIDENTAL_DUPLICATE",
      rodEventResolution: "VOID_WITH_RUN",
      runs,
    });
    expect(impact.blockers).toHaveLength(0);
    expect(impact.correctedRun.status).toBe("void");
    expect(impact.projectedRuns.filter((item) => item.status !== "void")).toHaveLength(1);
  });

  it("blocks void on locked hole and unsafe cancel resolution", () => {
    const locked = previewVoidRun({
      holeId: "DDH041",
      runId: "run-1",
      reason: "TEST_ENTRY",
      rodEventResolution: "VOID_WITH_RUN",
      holeLocked: true,
      runs: [run({ localId: "run-1", runNumber: 1 })],
    });
    expect(locked.blockers.some((item) => item.code === "LOCKED_HOLE")).toBe(true);

    const cancel = previewVoidRun({
      holeId: "DDH041",
      runId: "run-1",
      reason: "TEST_ENTRY",
      rodEventResolution: "CANCEL",
      runs: [run({ localId: "run-1", runNumber: 1 })],
    });
    expect(
      cancel.blockers.some((item) => item.code === "VOID_UNSAFE_ROD_EVENT"),
    ).toBe(true);
  });

  it("warns when survey exceeds corrected depth", () => {
    const impact = previewRunCorrection({
      holeId: "DDH041",
      runId: "run-1",
      correctionType: "MEASURED_STICK_UP",
      reason: "shallower",
      measuredStickUpDm: 10,
      surveyDepthsDm: [100],
      runs: [
        run({
          localId: "run-1",
          runNumber: 1,
          rodStringDm: 100,
          measuredStickUpDm: 5,
          previousCompletedDepthDm: 0,
          holeDepthDm: 95,
          drilledLengthDm: 95,
        }),
      ],
    });
    expect(
      impact.warnings.some((item) => item.code === "SURVEY_BEYOND_DEPTH"),
    ).toBe(true);
  });
});
