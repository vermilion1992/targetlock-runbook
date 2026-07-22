import { describe, expect, it } from "vitest";

import { calculateHoleDepth, isSharedRun } from "@/domain";
import {
  ddh041Stage2CurrentState,
  ddh041Stage2RodEvents,
  ddh041Stage2Runs,
  ddh041Stage2Shifts,
  ddh041Stage2UnfinishedDraft,
} from "./target-lock-stage2";

describe("TargetLock Stage 2 seed", () => {
  it("contains the requested Day/Night history and shared run 233", () => {
    expect(ddh041Stage2Shifts).toHaveLength(2);
    expect(ddh041Stage2Shifts[0]).toMatchObject({
      shiftType: "DAY",
      shiftDate: "2026-07-21",
      primaryDrillerNameSnapshot: "M. Hoffman",
      startingDepthDm: 6_268,
      endingDepthDm: 6_615,
      startingRunNumber: 221,
      endingRunNumber: 232,
      handoverRunNumber: 233,
    });
    expect(ddh041Stage2Shifts[1]).toMatchObject({
      shiftType: "NIGHT",
      primaryDrillerNameSnapshot: "J. Smith",
      startingRunNumber: 233,
      endingRunNumber: 245,
    });
    const shared = ddh041Stage2Runs.find(({ runNumber }) => runNumber === 233);
    expect(shared && isSharedRun(shared)).toBe(true);
    expect(shared).toMatchObject({
      startedByNameSnapshot: "M. Hoffman",
      completedByNameSnapshot: "J. Smith",
    });
  });

  it("keeps run, rod number, and R/S continuity in integer decimetres", () => {
    expect(ddh041Stage2Runs.map(({ runNumber }) => runNumber)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 221),
    );
    for (const [index, run] of ddh041Stage2Runs.entries()) {
      expect(run.holeDepth).toBe(
        calculateHoleDepth(run.rodStringLength, run.measuredStickUp),
      );
      if (index > 0) {
        expect(run.previousCompletedDepth).toBe(
          ddh041Stage2Runs[index - 1]?.holeDepth,
        );
      }
    }
    // Night-only Stage 2 additions continue from Stage 1 rod 112 with 6.0 m rods.
    expect(new Set(ddh041Stage2RodEvents.map(({ rodLength }) => rodLength))).toEqual(
      new Set([60]),
    );
    expect(ddh041Stage2RodEvents[0]?.rodNumberAfterEvent).toBe(113);
    expect(ddh041Stage2RodEvents.at(-1)?.rodNumberAfterEvent).toBe(118);
    expect(ddh041Stage2CurrentState).toMatchObject({
      rodNumber: 118,
      currentRodString: 6_985,
      measuredStickUp: 1,
      currentHoleDepth: 6_984,
    });
  });

  it("includes an unfinished shift-owned draft for recovery coverage", () => {
    expect(ddh041Stage2UnfinishedDraft).toMatchObject({
      localId: "run-ddh041-246",
      startedByNameSnapshot: "J. Smith",
      context: { runNumber: 246, rodNumber: 118, currentRodStringDm: 6_985 },
      stickUpMetresInput: "",
    });
  });
});
