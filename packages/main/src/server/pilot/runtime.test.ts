import { describe, expect, it } from "vitest";

import { createGuestToken, shouldBypassPilotAuthForGuest } from "./guest";
import {
  getCookieNames,
  PILOT_GUEST_COOKIE,
  pilotCookieLifecycle,
} from "./runtime";
import type { SecurePilotEnvironment } from "./environment";

const productionEnv: SecurePilotEnvironment = {
  mode: "pilot",
  nodeEnv: "production",
  databaseUrl: "postgresql://db/targetlock",
  sessionSecret: "a".repeat(48),
  appOrigin: "https://pilot.example.test",
  sessionTtlSeconds: 3600,
};

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

describe("pilot guest cookie naming", () => {
  it("uses the Host-prefixed guest cookie in production", () => {
    expect(getCookieNames(productionEnv).guest).toBe(PILOT_GUEST_COOKIE);
  });

  it("keeps pilot mode auth-required without a valid guest cookie", () => {
    expect(
      shouldBypassPilotAuthForGuest(productionEnv, null, {
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(false);
  });

  it("allows demo page access with a valid guest cookie when flagged", () => {
    const token = createGuestToken(productionEnv.sessionSecret);
    expect(
      shouldBypassPilotAuthForGuest(productionEnv, token, {
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(true);
  });
});
