import { describe, expect, it } from "vitest";

import { pilotCookieLifecycle } from "./runtime";

describe("pilot cookie lifecycle", () => {
  it("preserves dedicated device registration on normal operator logout", () => {
    expect(pilotCookieLifecycle("OPERATOR_LOGOUT")).toEqual({
      clearSession: true,
      clearDevice: false,
    });
  });

  it("clears only the device cookie on explicit device removal", () => {
    expect(pilotCookieLifecycle("REMOVE_CURRENT_DEVICE")).toEqual({
      clearSession: false,
      clearDevice: true,
    });
  });

  it("keeps device registration while password change revokes sessions", () => {
    expect(pilotCookieLifecycle("PASSWORD_CHANGED")).toEqual({
      clearSession: true,
      clearDevice: false,
    });
  });
});
