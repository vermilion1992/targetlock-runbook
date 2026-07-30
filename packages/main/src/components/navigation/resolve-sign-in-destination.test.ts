import { describe, expect, it } from "vitest";

import {
  resolveSignInDestination,
  resolveStartHoleDestination,
} from "./resolve-sign-in-destination";

describe("resolveSignInDestination", () => {
  it("routes a safe hole deep link through Start with its path intact", () => {
    expect(
      resolveSignInDestination(
        "/holes/DDH041/runs/new?returnTo=%2Fholes%2FDDH041%2Fcurrent",
      ),
    ).toBe(
      "/start?next=%2Fholes%2FDDH041%2Fruns%2Fnew%3FreturnTo%3D%252Fholes%252FDDH041%252Fcurrent",
    );
  });

  it("preserves safe non-hole TargetLock deep links", () => {
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

describe("resolveStartHoleDestination", () => {
  it("returns a validated hole and exact safe destination", () => {
    expect(
      resolveStartHoleDestination(
        "/holes/DDH041/current?notice=shift-started#summary",
      ),
    ).toEqual({
      holeId: "DDH041",
      href: "/holes/DDH041/current?notice=shift-started#summary",
    });
  });

  it("rejects setup, collection, external, and repeated destinations", () => {
    for (const value of [
      "/holes/new",
      "/holes/completed",
      "/projects/project-briggs",
      "//example.com/holes/DDH041/current",
      ["/holes/DDH041/current"],
      undefined,
    ]) {
      expect(resolveStartHoleDestination(value)).toBeNull();
    }
  });
});
