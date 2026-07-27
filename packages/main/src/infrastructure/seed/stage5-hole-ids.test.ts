import { describe, expect, it } from "vitest";

import { isRoutableHoleId } from "./stage5-hole-ids";

describe("isRoutableHoleId", () => {
  it("accepts seeded and syntactically valid user-created identities", () => {
    expect(isRoutableHoleId("DDH041")).toBe(true);
    expect(isRoutableHoleId("DDH-050_A")).toBe(true);
  });

  it("rejects invalid and reserved static route segments", () => {
    expect(isRoutableHoleId("new")).toBe(false);
    expect(isRoutableHoleId("COMPLETED")).toBe(false);
    expect(isRoutableHoleId("bad hole")).toBe(false);
    expect(isRoutableHoleId("")).toBe(false);
  });
});
