import { describe, expect, it } from "vitest";

import { deriveDrillingReadiness } from "./drilling-readiness";

describe("deriveDrillingReadiness", () => {
  it("blocks a new draft hole until both initial measurements exist", () => {
    expect(
      deriveDrillingReadiness({ holeStatus: "DRAFT", bhaSetup: null }),
    ).toEqual({
      ready: false,
      source: "blocked",
      blockers: [
        {
          code: "FULL_BHA_LENGTH_REQUIRED",
          message: "Full BHA length has not been recorded.",
        },
        {
          code: "CONSTANT_STICK_UP_REQUIRED",
          message: "Constant stick-up has not been recorded.",
        },
      ],
    });
  });

  it("accepts a valid BHA and zero constant stick-up", () => {
    expect(
      deriveDrillingReadiness({
        holeStatus: "DRAFT",
        bhaSetup: {
          bottomHoleAssemblyLengthDm: 43,
          constantStickUpDm: 0,
        },
      }),
    ).toMatchObject({ ready: true, source: "configured", blockers: [] });
  });

  it("reports invalid values and CSU greater than BHA specifically", () => {
    expect(
      deriveDrillingReadiness({
        holeStatus: "DRAFT",
        bhaSetup: {
          bottomHoleAssemblyLengthDm: 43,
          constantStickUpDm: 44,
        },
      }).blockers,
    ).toContainEqual({
      code: "CONSTANT_STICK_UP_EXCEEDS_BHA",
      message: "Constant stick-up cannot exceed full BHA length.",
    });
  });

  it("keeps an existing ACTIVE hole ready when legacy history has no setup", () => {
    expect(
      deriveDrillingReadiness({ holeStatus: "ACTIVE", bhaSetup: null }),
    ).toEqual({ ready: true, source: "legacy-active", blockers: [] });
  });

  it("does not grandfather an invalid setup on an ACTIVE hole", () => {
    expect(
      deriveDrillingReadiness({
        holeStatus: "ACTIVE",
        bhaSetup: {
          bottomHoleAssemblyLengthDm: 0,
          constantStickUpDm: -1,
        },
      }),
    ).toMatchObject({
      ready: false,
      source: "blocked",
      blockers: [
        { code: "FULL_BHA_LENGTH_INVALID" },
        { code: "CONSTANT_STICK_UP_INVALID" },
      ],
    });
  });

  it("blocks drilling while the hole lifecycle is not operational", () => {
    for (const holeStatus of [
      "SUSPENDED",
      "COMPLETION_REVIEW",
      "COMPLETED",
      "ABANDONED",
      "ARCHIVED",
    ] as const) {
      expect(
        deriveDrillingReadiness({
          holeStatus,
          bhaSetup: {
            bottomHoleAssemblyLengthDm: 60,
            constantStickUpDm: 10,
          },
        }),
      ).toMatchObject({
        ready: false,
        blockers: [{ code: "HOLE_STATUS_NOT_OPERATIONAL" }],
      });
    }
  });
});
