import { describe, expect, it } from "vitest";

import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  destinationLabelForPath,
  isSafeInternalReturnPath,
  resolveSafeReturnPath,
} from "@/components/navigation/resolve-safe-return-path";

const holeId = "DDH041";
const more = runbookRoutes.more(holeId);
const trajectory = runbookRoutes.trajectory(holeId);

describe("isSafeInternalReturnPath", () => {
  it("accepts same-hole absolute paths", () => {
    expect(isSafeInternalReturnPath(trajectory, holeId)).toBe(true);
    expect(isSafeInternalReturnPath(`${trajectory}?x=1`, holeId)).toBe(true);
  });

  it("rejects external, protocol-relative, and scheme URLs", () => {
    expect(isSafeInternalReturnPath("https://evil.example/x", holeId)).toBe(
      false,
    );
    expect(isSafeInternalReturnPath("//evil.example/x", holeId)).toBe(false);
    expect(isSafeInternalReturnPath("javascript:alert(1)", holeId)).toBe(
      false,
    );
  });

  it("rejects relative paths and traversal", () => {
    expect(isSafeInternalReturnPath("holes/DDH041/more", holeId)).toBe(false);
    expect(isSafeInternalReturnPath("/holes/DDH041/../etc", holeId)).toBe(
      false,
    );
  });

  it("rejects cross-hole paths", () => {
    expect(isSafeInternalReturnPath("/holes/OTHER/trajectory", holeId)).toBe(
      false,
    );
  });

  it("allows non-hole-scoped internal paths", () => {
    expect(isSafeInternalReturnPath("/holes/new", holeId)).toBe(true);
    expect(isSafeInternalReturnPath("/components", holeId)).toBe(true);
  });
});

describe("resolveSafeReturnPath", () => {
  it("uses canonical fallback when returnTo is missing", () => {
    expect(
      resolveSafeReturnPath({
        requestedReturnTo: undefined,
        canonicalFallback: more,
        currentHoleId: holeId,
      }),
    ).toEqual({ href: more, label: "More" });
  });

  it("uses canonical fallback when returnTo is invalid", () => {
    expect(
      resolveSafeReturnPath({
        requestedReturnTo: "https://evil.example",
        canonicalFallback: more,
        currentHoleId: holeId,
      }),
    ).toEqual({ href: more, label: "More" });
  });

  it("uses canonical fallback for cross-hole returnTo", () => {
    expect(
      resolveSafeReturnPath({
        requestedReturnTo: "/holes/OTHER/trajectory",
        canonicalFallback: more,
        currentHoleId: holeId,
      }),
    ).toEqual({ href: more, label: "More" });
  });

  it("accepts a safe same-hole returnTo with destination label", () => {
    expect(
      resolveSafeReturnPath({
        requestedReturnTo: trajectory,
        canonicalFallback: more,
        currentHoleId: holeId,
      }),
    ).toEqual({ href: trajectory, label: "Trajectory" });
  });
});

describe("destinationLabelForPath", () => {
  it("labels primary and secondary destinations", () => {
    expect(destinationLabelForPath(more, holeId)).toBe("More");
    expect(destinationLabelForPath(trajectory, holeId)).toBe("Trajectory");
    expect(destinationLabelForPath(runbookRoutes.reports(holeId), holeId)).toBe(
      "Reports",
    );
  });
});

describe("runbookRoutes.surveySettings returnTo", () => {
  it("omits query when returnTo is absent", () => {
    expect(runbookRoutes.surveySettings(holeId)).toBe(
      `/holes/${holeId}/survey-settings`,
    );
  });

  it("appends encoded returnTo when provided", () => {
    expect(
      runbookRoutes.surveySettings(holeId, { returnTo: trajectory }),
    ).toBe(
      `/holes/${holeId}/survey-settings?returnTo=${encodeURIComponent(trajectory)}`,
    );
  });
});
