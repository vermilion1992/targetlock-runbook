import { describe, expect, it } from "vitest";

import { resolveSignInDestination } from "./resolve-sign-in-destination";

describe("resolveSignInDestination", () => {
  it("preserves safe TargetLock deep links", () => {
    expect(
      resolveSignInDestination(
        "/holes/DDH041/runs/new?returnTo=%2Fholes%2FDDH041%2Fcurrent",
      ),
    ).toBe(
      "/holes/DDH041/runs/new?returnTo=%2Fholes%2FDDH041%2Fcurrent",
    );
    expect(
      resolveSignInDestination("/projects/project-briggs/holes/new"),
    ).toBe("/projects/project-briggs/holes/new");
    expect(
      resolveSignInDestination("/components/component-bit-002193"),
    ).toBe("/components/component-bit-002193");
  });

  it("falls back for external, inherited, malformed, or repeated values", () => {
    for (const value of [
      "https://example.com",
      "//example.com/projects",
      "/\\example.com/projects",
      "/components/react-tables/sorting",
      "/auth/auth1/login",
      ["/holes/DDH041/current"],
      undefined,
    ]) {
      expect(resolveSignInDestination(value)).toBe("/start");
    }
  });
});
