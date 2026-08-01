import { describe, expect, it } from "vitest";

import {
  RUNBOOK_SHIFT_MOBILE_TABLE_HEADERS,
  RUNBOOK_SHIFT_TABLE_HEADERS,
} from "./runbook-preview";

describe("Runbook closed-Shift table headers", () => {
  it("uses the authoritative measurement columns", () => {
    expect(RUNBOOK_SHIFT_TABLE_HEADERS).toEqual([
      "Run",
      "Shift",
      "Rod string",
      "Stick up",
      "Hole depth",
      "Drilled",
      "Recovered",
      "Recovery",
      "Bit",
    ]);
    expect(RUNBOOK_SHIFT_TABLE_HEADERS).not.toContain("End depth");
    expect(RUNBOOK_SHIFT_TABLE_HEADERS).not.toContain("Bit / reamer");
  });

  it("uses compact phone columns without recovery or bit", () => {
    expect(RUNBOOK_SHIFT_MOBILE_TABLE_HEADERS.map((h) => h.label)).toEqual([
      "Run",
      "R/S",
      "S/U",
      "HD",
      "D",
      "R",
    ]);
  });
});
