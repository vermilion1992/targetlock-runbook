import { describe, expect, it } from "vitest";

import { maximumOfflineGraceMsForOperationType } from "./lease-policy";

describe("server offline lease policy", () => {
  it("limits ordinary field writes to thirty minutes", () => {
    expect(
      maximumOfflineGraceMsForOperationType("surveys.create.v1"),
    ).toBe(30 * 60 * 1_000);
  });

  it("allows the documented bounded window only for completion and handover", () => {
    expect(
      maximumOfflineGraceMsForOperationType("completion.completeHole.v1"),
    ).toBe(12 * 60 * 60 * 1_000);
    expect(
      maximumOfflineGraceMsForOperationType("shifts.closeForHandover.v1"),
    ).toBe(12 * 60 * 60 * 1_000);
  });
});
