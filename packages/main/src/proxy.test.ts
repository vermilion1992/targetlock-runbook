import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

function request(pathname: string, authorization?: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TARGETLOCK_MODE", "demo");
  vi.stubEnv("ALLOW_LOCAL_DEMO_IN_PRODUCTION", "true");
  vi.stubEnv("PILOT_ACCESS_ENABLED", "true");
  vi.stubEnv("PILOT_ACCESS_USERNAME", "pilot");
  vi.stubEnv("PILOT_ACCESS_PASSWORD", "field-pass");
  vi.stubEnv("ENABLE_TEMPLATE_DEMOS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production proxy security policy", () => {
  it("returns 404 for disabled template routes", () => {
    const response = proxy(request("/dashboards/modern"));

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("canonicalizes the bare hole index and rejects reserved subpaths", () => {
    const redirect = proxy(request("/holes"));
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe("http://localhost/projects");

    expect(proxy(request("/holes/completed/current")).status).toBe(404);
    expect(proxy(request("/holes/Completed")).status).toBe(404);
  });

  it("continues to protect TargetLock routes with the pilot gate", () => {
    const response = proxy(request("/holes/DDH041/current"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });

  it("does not let the demo opt-in bypass the pilot gate", () => {
    vi.stubEnv("ENABLE_TEMPLATE_DEMOS", "true");

    expect(proxy(request("/apps/chat-ai")).status).toBe(401);

    const authorization = `Basic ${btoa("pilot:field-pass")}`;
    expect(proxy(request("/apps/chat-ai", authorization)).status).toBe(200);
  });

  it("fails closed when a production runtime mode is missing", () => {
    vi.stubEnv("TARGETLOCK_MODE", "");
    vi.stubEnv("PILOT_ACCESS_ENABLED", "false");

    expect(proxy(request("/start")).status).toBe(503);
    expect(proxy(request("/api/health")).status).toBe(200);
  });

  it("uses account auth rather than the legacy Basic gate in pilot mode", () => {
    vi.stubEnv("TARGETLOCK_MODE", "pilot");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db/targetlock");
    vi.stubEnv("PILOT_SESSION_SECRET", "s".repeat(48));
    vi.stubEnv("APP_ORIGIN", "https://pilot.example.test");

    const response = proxy(request("/sign-in"));
    expect(response.status).toBe(200);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(proxy(request("/api/pilot/session")).status).toBe(200);
    expect(proxy(request("/api/readiness")).status).toBe(200);
  });
});
