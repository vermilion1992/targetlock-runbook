import { describe, expect, it } from "vitest";

import {
  createGuestToken,
  isBetaGuestAllowed,
  shouldBypassPilotAuthForGuest,
  verifyGuestToken,
} from "./guest";
import type { SecurePilotEnvironment } from "./environment";

const secret = "a".repeat(48);

const pilotEnv: SecurePilotEnvironment = {
  mode: "pilot",
  nodeEnv: "production",
  databaseUrl: "postgresql://db/targetlock",
  sessionSecret: secret,
  appOrigin: "https://pilot.example.test",
  sessionTtlSeconds: 3600,
};

describe("beta guest gate", () => {
  it("allows guest outside production without the flag", () => {
    expect(isBetaGuestAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isBetaGuestAllowed({ NODE_ENV: "test" })).toBe(true);
  });

  it("requires ALLOW_BETA_GUEST in production", () => {
    expect(isBetaGuestAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(
      isBetaGuestAllowed({
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(true);
    expect(
      isBetaGuestAllowed({
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "false",
      }),
    ).toBe(false);
  });
});

describe("guest cookie token", () => {
  it("creates a verifiable short-lived token", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    const token = createGuestToken(secret, now, 3_600);
    expect(verifyGuestToken(token, secret, now)).toBe(true);
    expect(verifyGuestToken(token, secret, now + 3_599_000)).toBe(true);
    expect(verifyGuestToken(token, secret, now + 3_600_000)).toBe(false);
  });

  it("rejects forged or truncated tokens", () => {
    const token = createGuestToken(secret);
    expect(verifyGuestToken(null, secret)).toBe(false);
    expect(verifyGuestToken("", secret)).toBe(false);
    expect(verifyGuestToken("not-a-token", secret)).toBe(false);
    expect(verifyGuestToken(`${token}x`, secret)).toBe(false);
    expect(verifyGuestToken(token, "b".repeat(48))).toBe(false);
  });
});

describe("pilot auth guest bypass", () => {
  it("bypasses only with flag and valid cookie", () => {
    const token = createGuestToken(secret);
    expect(
      shouldBypassPilotAuthForGuest(pilotEnv, token, {
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(true);
    expect(
      shouldBypassPilotAuthForGuest(pilotEnv, token, {
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      shouldBypassPilotAuthForGuest(pilotEnv, null, {
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(false);
  });

  it("still requires auth in production pilot without guest", () => {
    expect(
      shouldBypassPilotAuthForGuest(pilotEnv, "garbage", {
        NODE_ENV: "production",
        ALLOW_BETA_GUEST: "true",
      }),
    ).toBe(false);
  });
});
