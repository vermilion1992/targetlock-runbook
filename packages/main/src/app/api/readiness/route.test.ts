import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("readiness API", () => {
  it("reports that the database is not required in explicit demo mode", async () => {
    vi.stubEnv("TARGETLOCK_MODE", "demo");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      mode: "demo",
      checks: { configuration: "ok", database: "not-required" },
    });
  });

  it("fails safely without exposing missing production configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TARGETLOCK_MODE", "");
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      checks: { configuration: "invalid", database: "unknown" },
    });
  });
});
