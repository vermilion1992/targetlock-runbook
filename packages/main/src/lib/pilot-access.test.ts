import { describe, expect, it } from "vitest";

import {
  credentialsMatch,
  isPilotAccessConfigured,
  isPilotAccessPublicPath,
  parseBasicAuthorizationHeader,
  readPilotAccessConfig,
} from "./pilot-access";

describe("pilot access gate", () => {
  it("is disabled unless PILOT_ACCESS_ENABLED is true", () => {
    expect(readPilotAccessConfig({}).enabled).toBe(false);
    expect(
      readPilotAccessConfig({ PILOT_ACCESS_ENABLED: "false" }).enabled,
    ).toBe(false);
    expect(
      readPilotAccessConfig({ PILOT_ACCESS_ENABLED: "true" }).enabled,
    ).toBe(true);
  });

  it("requires username and password when enabled", () => {
    expect(
      isPilotAccessConfigured({
        enabled: true,
        username: "",
        password: "x",
      }),
    ).toBe(false);
    expect(
      isPilotAccessConfigured({
        enabled: true,
        username: "pilot",
        password: "secret",
      }),
    ).toBe(true);
  });

  it("keeps health and Next static assets public", () => {
    expect(isPilotAccessPublicPath("/api/health")).toBe(true);
    expect(isPilotAccessPublicPath("/_next/static/chunk.js")).toBe(true);
    expect(isPilotAccessPublicPath("/_next/image")).toBe(true);
    expect(isPilotAccessPublicPath("/favicon.ico")).toBe(true);
    expect(isPilotAccessPublicPath("/holes/DDH041/current")).toBe(false);
    expect(isPilotAccessPublicPath("/api/code")).toBe(false);
  });

  it("parses basic authorization without logging credentials", () => {
    const header = `Basic ${btoa("pilot:field-pass")}`;
    expect(parseBasicAuthorizationHeader(header)).toEqual({
      username: "pilot",
      password: "field-pass",
    });
    expect(parseBasicAuthorizationHeader("Bearer abc")).toBeNull();
    expect(parseBasicAuthorizationHeader(null)).toBeNull();
  });

  it("accepts matching credentials and rejects mismatches", () => {
    const config = {
      enabled: true,
      username: "pilot",
      password: "field-pass",
    };

    expect(
      credentialsMatch({ username: "pilot", password: "field-pass" }, config),
    ).toBe(true);
    expect(
      credentialsMatch({ username: "pilot", password: "wrong" }, config),
    ).toBe(false);
    expect(credentialsMatch(null, config)).toBe(false);
  });
});
