import { describe, expect, it } from "vitest";

import { shouldHydrateDemoRunbookData } from "./browser-services";

describe("browser runbook runtime seed policy", () => {
  it("hydrates DDH041 training data only in explicit demo mode", () => {
    expect(shouldHydrateDemoRunbookData("demo")).toBe(true);
    expect(shouldHydrateDemoRunbookData("pilot")).toBe(false);
    expect(shouldHydrateDemoRunbookData("unknown")).toBe(false);
  });
});
