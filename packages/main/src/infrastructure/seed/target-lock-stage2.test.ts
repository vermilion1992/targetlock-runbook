import { describe, expect, it } from "vitest";

import { calculateHoleDepth } from "@/domain";
import {
  DDH041_DEMO_CURRENT_DEPTH_M,
} from "./target-lock-ddh041-midhole";
import {
  ddh041Stage2CurrentState,
  ddh041Stage2Runs,
  ddh041Stage2Shifts,
  ddh041Stage2UnfinishedDraft,
} from "./target-lock-stage2";

describe("TargetLock Stage 2 seed", () => {
  it("exposes the mid-hole shift history with an open day shift", () => {
    const closed = ddh041Stage2Shifts.filter(({ status }) => status === "CLOSED");
    const open = ddh041Stage2Shifts.find(({ status }) => status === "OPEN");

    expect(closed.length).toBeGreaterThanOrEqual(20);
    expect(open?.shiftType).toBe("DAY");
    expect(open?.startingDepthDm).toBe(6_270);
    expect(new Set(ddh041Stage2Shifts.map(({ shiftType }) => shiftType))).toEqual(
      new Set(["DAY", "NIGHT"]),
    );
  });

  it("keeps run continuity and current depth at ~630 m", () => {
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
    expect(ddh041Stage2CurrentState).toMatchObject({
      currentHoleDepth: DDH041_DEMO_CURRENT_DEPTH_M * 10,
      bottomHoleAssemblyLength: 43,
      constantStickUp: 18,
      baseRodStringLength: 25,
    });
    expect(ddh041Stage2Runs.at(-1)?.status).toBe("in_progress");
  });

  it("includes an unfinished shift-owned draft for recovery coverage", () => {
    expect(ddh041Stage2UnfinishedDraft).toMatchObject({
      startedByNameSnapshot: expect.any(String),
      context: {
        previousCompletedDepthDm: 6_270,
        currentRodStringDm: Number(ddh041Stage2CurrentState.currentRodString),
      },
      stickUpMetresInput: "",
    });
  });
});
