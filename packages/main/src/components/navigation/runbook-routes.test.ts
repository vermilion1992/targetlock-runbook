import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOLE_ID,
  holeIdFromPathname,
  runbookRoutes,
} from "./runbook-routes";

describe("runbook routes", () => {
  it("extracts a hole identity from a scoped route", () => {
    expect(holeIdFromPathname("/holes/DDH-050/current")).toBe("DDH-050");
  });

  it("never treats global hole actions as current-hole identities", () => {
    expect(holeIdFromPathname("/holes/new")).toBe(DEFAULT_HOLE_ID);
    expect(holeIdFromPathname("/holes/completed")).toBe(DEFAULT_HOLE_ID);
    expect(runbookRoutes.currentHole("completed")).toBe(
      `/holes/${DEFAULT_HOLE_ID}/current`,
    );
  });

  it("keeps component registry routes in their originating hole context", () => {
    expect(runbookRoutes.componentRegistry("DDH 050")).toBe(
      "/components?holeId=DDH%20050",
    );
    expect(
      runbookRoutes.componentDetail("component-bit-01", "DDH-050"),
    ).toBe("/components/component-bit-01?holeId=DDH-050");
  });
});
