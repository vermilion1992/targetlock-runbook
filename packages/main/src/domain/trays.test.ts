import { describe, expect, it } from "vitest";

import {
  calculateTrayStatistics,
  decimetres,
  findTrayRunOverlaps,
  suggestNextTrayNumber,
  suggestTrayValues,
  validateTrayInput,
  type Tray,
  type TrayOverlapRun,
} from ".";

function tray(
  localId: string,
  trayNumber: number,
  startDepthDm?: number,
  endDepthDm?: number,
): Tray {
  const recordedAt = "2026-07-21T10:00:00.000Z";
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: recordedAt,
    updatedAt: recordedAt,
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    trayNumber,
    startDepthDm:
      startDepthDm === undefined ? undefined : decimetres(startDepthDm),
    endDepthDm: endDepthDm === undefined ? undefined : decimetres(endDepthDm),
    isFinalPartial: false,
    primaryPhotoId: `photo-${localId}`,
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt,
  };
}

function run(
  runNumber: number,
  startDepthDm: number,
  endDepthDm: number,
  status: TrayOverlapRun["status"] = "completed",
): TrayOverlapRun {
  return {
    localId: `run-${runNumber}`,
    runNumber,
    startDepthDm: decimetres(startDepthDm),
    endDepthDm: decimetres(endDepthDm),
    status,
  };
}

describe("tray suggestions", () => {
  it("suggests one for the first tray", () => {
    expect(suggestNextTrayNumber([])).toBe(1);
  });

  it("uses the highest positive number and does not fill gaps", () => {
    expect(suggestNextTrayNumber([tray("one", 1), tray("four", 4)])).toBe(5);
    expect(
      suggestNextTrayNumber([tray("one", 1), tray("higher", 18)]),
    ).toBe(19);
  });

  it("inherits the previous end and current completed depth", () => {
    expect(
      suggestTrayValues([tray("one", 1, 100, 160)], decimetres(220)),
    ).toEqual({
      trayNumber: 2,
      startDepthDm: 160,
      endDepthDm: 220,
    });
    expect(suggestTrayValues([], decimetres(220))).toEqual({
      trayNumber: 1,
      startDepthDm: undefined,
      endDepthDm: 220,
    });
  });
});

describe("tray validation", () => {
  it("blocks invalid depths and accepts valid depths", () => {
    expect(
      validateTrayInput({
        trayNumber: 2,
        startDepthDm: 100,
        endDepthDm: 160,
        currentCompletedDepthDm: decimetres(200),
        trays: [tray("one", 1, 40, 100)],
      }),
    ).toEqual({ errors: [], warnings: [] });
    expect(
      validateTrayInput({
        trayNumber: 1,
        startDepthDm: -1,
        endDepthDm: 10,
        currentCompletedDepthDm: decimetres(20),
        trays: [],
      }).errors[0]?.code,
    ).toBe("NEGATIVE_DEPTH");
    expect(
      validateTrayInput({
        trayNumber: 1,
        startDepthDm: 20,
        endDepthDm: 10,
        currentCompletedDepthDm: decimetres(20),
        trays: [],
      }).errors[0]?.code,
    ).toBe("END_BEFORE_START");
  });

  it("warns for gaps, overlaps, beyond-depth and duplicate numbers", () => {
    const previous = tray("one", 1, 40, 100);
    expect(
      validateTrayInput({
        trayNumber: 2,
        startDepthDm: 110,
        endDepthDm: 220,
        currentCompletedDepthDm: decimetres(200),
        trays: [previous],
      }).warnings.map(({ code }) => code),
    ).toEqual(["DEPTH_GAP", "END_BEYOND_COMPLETED"]);
    expect(
      validateTrayInput({
        trayNumber: 1,
        startDepthDm: 90,
        endDepthDm: 100,
        currentCompletedDepthDm: decimetres(200),
        trays: [previous],
      }).warnings.map(({ code }) => code),
    ).toEqual(["DUPLICATE_NUMBER", "NUMBER_SEQUENCE_GAP", "DEPTH_OVERLAP"]);
  });

  it("counts final partial trays", () => {
    const partial = { ...tray("partial", 2, 100, 120), isFinalPartial: true };
    expect(calculateTrayStatistics([partial])).toMatchObject({
      totalTrays: 1,
      finalPartialTrays: 1,
      trayDepthCoverageDm: 20,
    });
  });
});

describe("tray run overlap", () => {
  it("finds several completed runs and a run crossing two trays", () => {
    const runs = [run(47, 3800, 3840), run(48, 3840, 3881), run(49, 3881, 3910)];
    expect(
      findTrayRunOverlaps(tray("18", 18, 3826, 3884), runs).map(
        ({ runNumber }) => runNumber,
      ),
    ).toEqual([47, 48, 49]);
    expect(
      findTrayRunOverlaps(tray("19", 19, 3884, 3943), runs).map(
        ({ runNumber }) => runNumber,
      ),
    ).toEqual([49]);
  });

  it("excludes touching, unfinished, and incomplete ranges", () => {
    expect(
      findTrayRunOverlaps(tray("one", 1, 100, 200), [
        run(1, 50, 100),
        run(2, 100, 150, "in_progress"),
        run(3, 200, 250),
      ]),
    ).toEqual([]);
    expect(findTrayRunOverlaps(tray("missing", 2), [run(1, 0, 100)])).toEqual(
      [],
    );
  });
});
