import { describe, expect, it } from "vitest";

import {
  PilotConfigurationError,
  readPilotEnvironment,
} from "./environment";

describe("pilot environment", () => {
  it("defaults to demo only outside production", () => {
    expect(readPilotEnvironment({ NODE_ENV: "test" })).toEqual({
      mode: "demo",
      nodeEnv: "test",
    });
  });

  it("fails closed when production mode is not explicit", () => {
    expect(() => readPilotEnvironment({ NODE_ENV: "production" })).toThrow(
      PilotConfigurationError,
    );
  });

  it("rejects insecure or incomplete pilot configuration", () => {
    expect(() =>
      readPilotEnvironment({
        NODE_ENV: "production",
        TARGETLOCK_MODE: "pilot",
        DATABASE_URL: "postgres://db",
        PILOT_SESSION_SECRET: "short",
        APP_ORIGIN: "http://pilot.example.test",
      }),
    ).toThrow(/PILOT_SESSION_SECRET.*HTTPS/);
  });

  it("accepts complete Railway-compatible pilot configuration", () => {
    const result = readPilotEnvironment({
      NODE_ENV: "production",
      TARGETLOCK_MODE: "pilot",
      DATABASE_URL: "postgresql://user:pass@db.internal:5432/targetlock",
      PILOT_SESSION_SECRET: "a".repeat(48),
      APP_ORIGIN: "https://pilot.example.test",
      PILOT_SESSION_TTL_SECONDS: "3600",
    });

    expect(result).toMatchObject({
      mode: "pilot",
      sessionTtlSeconds: 3600,
    });
  });
});
