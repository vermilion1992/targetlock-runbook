import { describe, expect, it } from "vitest";

import {
  calculateHoleDepth,
  calculateCurrentRodString,
} from "../../domain";
import {
  DDH041_DEMO_CURRENT_DEPTH_M,
  DDH041_DEMO_PLANNED_DEPTH_M,
  ddh041MidholeCurrentState,
  ddh041MidholeHole,
  ddh041MidholeHoleConfigurations,
  ddh041MidholeRodEvents,
  ddh041MidholeRodStringConfigurations,
  ddh041MidholeRuns,
  ddh041MidholeShifts,
  ddh041MidholeSurveys,
  ddh041MidholeTrays,
  ddh041MidholePhotos,
} from "./target-lock-ddh041-midhole";

describe("DDH041 mid-hole demo sandbox", () => {
  it("uses ~800 m plan and ~630 m current depth", () => {
    expect(ddh041MidholeHole.plannedDepth).toBe(
      DDH041_DEMO_PLANNED_DEPTH_M * 10,
    );
    expect(ddh041MidholeHole.currentDepth).toBe(
      DDH041_DEMO_CURRENT_DEPTH_M * 10,
    );
    expect(
      ddh041MidholeHoleConfigurations.every(
        ({ plannedDepth }) => plannedDepth === DDH041_DEMO_PLANNED_DEPTH_M * 10,
      ),
    ).toBe(true);
  });

  it("has many closed shifts with 14–32 m advances totaling 627 m", () => {
    const closed = ddh041MidholeShifts.filter(({ status }) => status === "CLOSED");
    expect(closed.length).toBeGreaterThanOrEqual(20);
    const advances = closed.map(
      (shift) =>
        (Number(shift.endingDepthDm) - Number(shift.startingDepthDm)) / 10,
    );
    expect(Math.min(...advances)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...advances)).toBeLessThanOrEqual(32);
    expect(advances.reduce((sum, value) => sum + value, 0)).toBe(627);
    expect(ddh041MidholeShifts.some(({ status }) => status === "OPEN")).toBe(
      true,
    );
  });

  it("keeps run and rod-string continuity through current depth", () => {
    for (const [index, run] of ddh041MidholeRuns.entries()) {
      expect(run.holeDepth).toBe(
        calculateHoleDepth(run.rodStringLength, run.measuredStickUp),
      );
      if (index > 0) {
        expect(run.previousCompletedDepth).toBe(
          ddh041MidholeRuns[index - 1]?.holeDepth,
        );
      }
    }
    const configuration = ddh041MidholeRodStringConfigurations.at(-1)!;
    const projected = calculateCurrentRodString(
      configuration.baseRodStringLength,
      ddh041MidholeRodEvents.map(({ action, rodLength }) => ({
        action,
        rodLength,
      })),
    );
    const openRun = ddh041MidholeRuns.at(-1)!;
    expect(openRun.status).toBe("in_progress");
    expect(projected).toBe(openRun.rodStringLength);
    expect(ddh041MidholeCurrentState.currentHoleDepth).toBe(openRun.holeDepth);
    expect(openRun.holeDepth).toBe(DDH041_DEMO_CURRENT_DEPTH_M * 10);
  });

  it("seeds surveys from collar to current depth", () => {
    expect(ddh041MidholeSurveys[0]?.depthDm).toBe(0);
    expect(ddh041MidholeSurveys.at(-1)?.depthDm).toBe(
      DDH041_DEMO_CURRENT_DEPTH_M * 10,
    );
    expect(ddh041MidholeSurveys.length).toBeGreaterThan(15);
  });

  it("includes trays with bundled photo placeholders", () => {
    const photoIds = new Set(ddh041MidholePhotos.map(({ localId }) => localId));
    expect(ddh041MidholeTrays.length).toBeGreaterThanOrEqual(3);
    expect(
      ddh041MidholeTrays.every(
        ({ primaryPhotoId }) => photoIds.has(primaryPhotoId),
      ),
    ).toBe(true);
    expect(
      ddh041MidholePhotos.filter(({ category }) => category === "TRAY")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });
});
