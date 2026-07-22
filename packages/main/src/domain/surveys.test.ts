import { describe, expect, it } from "vitest";

import {
  assessSurveyWarnings,
  calculateAverageSurveySpacing,
  calculateCircularAzimuthDifferenceTenths,
  calculateDistanceSinceLatestSurvey,
  calculateLargestSurveyGap,
  calculateSurveyIntervalReminder,
  calculateSurveyStatistics,
  decimetres,
  findLatestSurvey,
  parseAzimuthInput,
  parseDipInput,
  type Survey,
} from ".";

function survey(
  localId: string,
  depthDm: number,
  recordedAt = "2026-07-21T10:00:00.000Z",
): Survey {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only",
    createdAt: recordedAt,
    updatedAt: recordedAt,
    deviceId: "test",
    version: 1,
    holeId: "DDH041",
    depthDm: decimetres(depthDm),
    dipTenths: -614,
    azimuthTenths: 1288,
    northReference: "GRID",
    surveyToolId: "tool-1",
    toolNameSnapshot: "EZ-TRAC",
    toolSerialSnapshot: "EZT-18427",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt,
  };
}

describe("survey measurements", () => {
  it("parses dip boundaries and rejects invalid values", () => {
    expect(parseDipInput("-90.0")).toMatchObject({ ok: true, value: -900 });
    expect(parseDipInput("+90.0")).toMatchObject({ ok: true, value: 900 });
    expect(parseDipInput("-90.1")).toEqual({ ok: false, reason: "range" });
    expect(parseDipInput("abc")).toEqual({ ok: false, reason: "invalid" });
  });

  it("normalises only 360.0 degrees and validates azimuth range", () => {
    expect(parseAzimuthInput("0.0")).toMatchObject({ ok: true, value: 0 });
    expect(parseAzimuthInput("359.9")).toMatchObject({ ok: true, value: 3599 });
    expect(parseAzimuthInput("360.0")).toEqual({
      ok: true,
      value: 0,
      normalized: true,
    });
    expect(parseAzimuthInput("360.1")).toEqual({
      ok: false,
      reason: "range",
    });
    expect(parseAzimuthInput("-1")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("circular azimuth difference", () => {
  it.each([
    [3590, 10, 20],
    [10, 3590, 20],
    [3500, 100, 200],
    [100, 3500, 200],
  ])("compares %s and %s as %s tenths", (left, right, expected) => {
    expect(calculateCircularAzimuthDifferenceTenths(left, right)).toBe(expected);
  });
});

describe("survey statistics", () => {
  it("handles no surveys and one survey", () => {
    expect(findLatestSurvey([])).toBeUndefined();
    expect(calculateAverageSurveySpacing([])).toBeUndefined();
    expect(calculateLargestSurveyGap([survey("one", 1000)])).toBeUndefined();
    expect(calculateSurveyStatistics([], decimetres(1200))).toMatchObject({
      totalSurveys: 0,
      duplicateDepthSurveys: 0,
    });
  });

  it("sorts out-of-order surveys and ignores duplicate depths for spacing", () => {
    const values = [
      survey("third", 1500),
      survey("first", 1000),
      survey("repeat", 1250, "2026-07-21T11:00:00.000Z"),
      survey("second", 1250),
    ];
    expect(findLatestSurvey(values)?.localId).toBe("third");
    expect(calculateAverageSurveySpacing(values)).toBe(250);
    expect(calculateLargestSurveyGap(values)).toBe(250);
    expect(calculateDistanceSinceLatestSurvey(decimetres(1600), values)).toBe(
      100,
    );
    expect(calculateSurveyStatistics(values, decimetres(1600))).toMatchObject({
      firstSurveyDepthDm: 1000,
      latestSurveyDepthDm: 1500,
      duplicateDepthSurveys: 1,
    });
  });

  it("does not return a negative distance for a future-depth survey", () => {
    expect(
      calculateDistanceSinceLatestSurvey(decimetres(1000), [
        survey("future", 1100),
      ]),
    ).toBe(0);
  });

  it("calculates advisory survey interval states", () => {
    const values = [survey("latest", 1000)];
    expect(
      calculateSurveyIntervalReminder(
        decimetres(1100),
        values,
        decimetres(250),
      ),
    ).toEqual({ status: "DUE_IN", distanceDm: 150 });
    expect(
      calculateSurveyIntervalReminder(
        decimetres(1300),
        values,
        decimetres(250),
      ),
    ).toEqual({ status: "EXCEEDED", distanceDm: 50 });
    expect(
      calculateSurveyIntervalReminder(decimetres(1300), values),
    ).toBeUndefined();
  });
});

describe("survey warnings", () => {
  it("uses circular differences and reports duplicate/reference/tool changes", () => {
    const previous = {
      ...survey("previous", 1000),
      azimuthTenths: 3590,
      northReference: "GRID" as const,
    };
    const warnings = assessSurveyWarnings({
      depthDm: decimetres(1000),
      dipTenths: -500,
      azimuthTenths: 10,
      northReference: "TRUE",
      surveyToolId: "tool-2",
      currentCompletedDepthDm: decimetres(900),
      surveys: [previous],
    });
    expect(warnings.map(({ code }) => code)).toEqual([
      "DEPTH_BEYOND_COMPLETED",
      "DUPLICATE_DEPTH",
      "LARGE_DIP_CHANGE",
      "REFERENCE_CHANGED",
      "TOOL_CHANGED",
    ]);
  });
});
