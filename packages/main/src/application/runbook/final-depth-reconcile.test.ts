import { describe, expect, it } from "vitest";

import {
  calculateCurrentRodString,
  calculateHoleDepth,
  calculateRodNumber,
  evaluateHoleCompletion,
} from "@/domain";
import { targetLockStage5Seed } from "@/infrastructure/seed";

import { mergeCompletionRuns } from "./hole-completion-use-cases";

describe("final depth reconciliation against Stage 5 seed", () => {
  it("projects rod state that matches the deepest completed seed run", () => {
    const seed = targetLockStage5Seed;
    const completedRuns = mergeCompletionRuns(
      seed.runs.filter(({ status }) => status !== "in_progress"),
      [],
      seed,
    );
    const finalRun = [...completedRuns].sort(
      (left, right) => left.runNumber - right.runNumber,
    ).at(-1);
    expect(finalRun).toBeDefined();

    const rodEvents = [...seed.rodEvents].sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.localId.localeCompare(right.localId),
    );
    const configuration = [...seed.rodStringConfigurations].at(-1);
    expect(configuration).toBeDefined();

    const eventInputs = rodEvents.map(({ action, rodLength }) => ({
      action,
      rodLength,
    }));
    const projectedRodString = calculateCurrentRodString(
      configuration!.baseRodStringLength,
      eventInputs,
    );
    const projectedRodNumber = calculateRodNumber(eventInputs);
    const projectedDepth = calculateHoleDepth(
      projectedRodString,
      finalRun!.measuredStickUp,
    );

    expect(projectedRodString).toBe(finalRun!.rodStringLength);
    expect(projectedRodNumber).toBe(finalRun!.rodNumber);
    expect(projectedDepth).toBe(finalRun!.holeDepth);
  });

  it("evaluateHoleCompletion reports FINAL_DEPTH_RECONCILED for seed alone", () => {
    const seed = targetLockStage5Seed;
    const completedRuns = mergeCompletionRuns(
      seed.runs.filter(({ status }) => status !== "in_progress"),
      [],
      seed,
    );
    const evaluation = evaluateHoleCompletion({
      holeId: "DDH041",
      runs: completedRuns,
      rodConfiguration: [...seed.rodStringConfigurations].at(-1),
      rodEvents: seed.rodEvents,
      shifts: seed.shifts,
      casingStrings: seed.casingStrings,
      componentAssignments: seed.componentAssignments.filter(
        ({ holeId }) => holeId === "DDH041",
      ),
      surveys: seed.surveys.filter(({ holeId }) => holeId === "DDH041"),
      trays: seed.trays.filter(({ holeId }) => holeId === "DDH041"),
      componentOutcomes: [],
      pendingOperations: { rodEvents: 0, media: 0, corrections: 0 },
      completionReason: "CLIENT_STOPPED",
      finalSurveyResolution: { status: "UNAVAILABLE", reason: "test" },
      warningAcknowledgements: [],
    });

    const check = evaluation.checks.find(
      ({ code }) => code === "FINAL_DEPTH_RECONCILED",
    );
    expect(check?.status).toBe("PASS");
  });
});
