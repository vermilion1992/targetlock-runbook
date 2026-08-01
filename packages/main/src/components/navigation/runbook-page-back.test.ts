import { describe, expect, it } from "vitest";

import {
  backAriaLabel,
  backVisibleLabel,
  namedBackTarget,
} from "@/components/navigation/runbook-page-back";

describe("runbook page back labels", () => {
  it("builds accessible names", () => {
    expect(backAriaLabel({ label: "More" })).toBe("Back to More");
    expect(backAriaLabel({ label: "More", ariaLabel: "Return to tools" })).toBe(
      "Return to tools",
    );
  });

  it("uses the parent name for visible labels", () => {
    expect(backVisibleLabel("More")).toEqual({
      short: "More",
      long: "More",
    });
    expect(backVisibleLabel("Cancel")).toEqual({
      short: "Cancel",
      long: "Cancel",
    });
  });

  it("namedBackTarget defaults aria-label", () => {
    expect(namedBackTarget("/holes/DDH041/more", "More")).toMatchObject({
      href: "/holes/DDH041/more",
      label: "More",
      ariaLabel: "Back to More",
    });
  });
});
