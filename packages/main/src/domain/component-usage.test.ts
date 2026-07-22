import { describe, expect, it } from "vitest";

import {
  calculateComponentUsage,
  decimetres,
  type ComponentAssignment,
  type UsageRun,
} from ".";

const baseMetadata = {
  serverId: null,
  syncStatus: "local-only" as const,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  deviceId: "test-device",
  version: 1,
};

function assignment(
  startDepthDm: number,
  endDepthDm?: number,
): ComponentAssignment {
  return {
    ...baseMetadata,
    localId: "assignment-1",
    componentId: "bit-1",
    holeId: "DDH041",
    componentType: "BIT",
    startDepthDm: decimetres(startDepthDm),
    endDepthDm:
      endDepthDm === undefined ? undefined : decimetres(endDepthDm),
    installedAt: "2026-07-21T00:00:00.000Z",
    installedByUserId: "user-1",
    installedByNameSnapshot: "M. Hoffman",
    status: endDepthDm === undefined ? "ACTIVE" : "CLOSED",
  };
}

function run(
  id: string,
  startDepthDm: number,
  endDepthDm: number,
  recoveredLengthDm = endDepthDm - startDepthDm,
): UsageRun {
  const drilledLength = endDepthDm - startDepthDm;
  return {
    localId: id,
    startDepth: decimetres(startDepthDm),
    holeDepth: decimetres(endDepthDm),
    drilledLength: decimetres(drilledLength),
    recoveredLength: decimetres(recoveredLengthDm),
    recoveryPercentage:
      Math.round((recoveredLengthDm / drilledLength) * 1_000) / 10,
    status: "completed",
  };
}

describe("calculateComponentUsage", () => {
  it("calculates exact metres and recovery for complete runs", () => {
    const result = calculateComponentUsage(assignment(1000, 1060), [
      run("run-a", 1000, 1030, 29),
      run("run-b", 1030, 1060, 30),
    ]);

    expect(result.drilledMetresDm).toBe(60);
    expect(result.runsTouched).toBe(2);
    expect(result.fullyCoveredRuns).toBe(2);
    expect(result.partiallyCoveredRuns).toBe(0);
    expect(result.averageRecoveryPercentTenths).toBe(983);
    expect(result.recoveryEstimateStatus).toBe("EXACT_RUN_SET");
  });

  it("counts exact overlap and labels a boundary run estimate", () => {
    const result = calculateComponentUsage(assignment(1010, 1050), [
      run("run-a", 980, 1010),
      run("run-b", 1010, 1040, 29),
      run("run-c", 1040, 1070, 27),
    ]);

    expect(result.drilledMetresDm).toBe(40);
    expect(result.runsTouched).toBe(2);
    expect(result.fullyCoveredRuns).toBe(1);
    expect(result.partiallyCoveredRuns).toBe(1);
    expect(result.recoveryEstimateStatus).toBe("RUN_LEVEL_ESTIMATE");
  });

  it("does not count unrecorded depth gaps", () => {
    const result = calculateComponentUsage(assignment(1000, 1100), [
      run("run-a", 1000, 1030),
      run("run-b", 1070, 1100),
    ]);

    expect(result.drilledMetresDm).toBe(60);
    expect(result.runsTouched).toBe(2);
  });

  it("uses the deepest completed run as an active assignment boundary", () => {
    const result = calculateComponentUsage(assignment(1030), [
      run("run-a", 1000, 1030),
      run("run-b", 1030, 1060),
    ]);

    expect(result.endDepthDm).toBe(1060);
    expect(result.drilledMetresDm).toBe(30);
  });

  it("rejects overlapping completed runs to prevent double counting", () => {
    expect(() =>
      calculateComponentUsage(assignment(1000, 1070), [
        run("run-a", 1000, 1040),
        run("run-b", 1030, 1070),
      ]),
    ).toThrow(/overlap/);
  });
});
