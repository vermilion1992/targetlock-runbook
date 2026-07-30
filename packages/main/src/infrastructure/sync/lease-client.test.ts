import { afterEach, describe, expect, it, vi } from "vitest";

import { configurePilotBrowserRuntime } from "./pilot-runtime";
import { PilotLeaseCoordinator } from "./lease-client";

const lease = {
  id: "10000000-0000-4000-8000-000000000001",
  primaryDeviceId: "20000000-0000-4000-8000-000000000001",
  resourceRef: "hole-1",
  status: "ACTIVE" as const,
  heartbeatAt: "2026-07-28T12:00:00.000Z",
  expiresAt: "2026-07-28T12:05:00.000Z",
  offlineGraceIssuedAt: "2026-07-28T12:00:00.000Z",
  offlineGraceExpiresAt: "2026-07-28T12:30:00.000Z",
  completionGraceExpiresAt: "2026-07-29T00:00:00.000Z",
  version: 3,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installBrowserState(): void {
  const values = new Map<string, string>();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  configurePilotBrowserRuntime({
    mode: "pilot",
    organisationId: "30000000-0000-4000-8000-000000000001",
    operatorId: "40000000-0000-4000-8000-000000000001",
    operatorName: "Pilot Driller",
    role: "DRILLER",
    device: {
      id: lease.primaryDeviceId,
      projectRef: "project-1",
      rigRef: "rig-1",
    },
    sessionExpiresAt: "2026-07-29T12:00:00.000Z",
  });
}

afterEach(() => {
  configurePilotBrowserRuntime(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PilotLeaseCoordinator", () => {
  it("uses bounded offline grace when the network fails despite an online hint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    installBrowserState();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ state: "AVAILABLE", lease: null }))
      .mockResolvedValueOnce(jsonResponse({ state: "OWNED_BY_THIS_DEVICE", lease }))
      .mockRejectedValueOnce(new TypeError("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const coordinator = new PilotLeaseCoordinator();

    await coordinator.activateHole("hole-1", "project-1");
    expect(coordinator.getSnapshot().kind).toBe("PRIMARY_WRITER");
    await coordinator.activateHole("hole-1", "project-1");

    const state = coordinator.getSnapshot();
    expect(state.kind).toBe("OFFLINE_GRACE");
    if (state.kind === "OFFLINE_GRACE") {
      expect(state.graceExpiresAt).toBe("2026-07-28T12:30:00.000Z");
    }
    await expect(
      coordinator.ensureWritable("hole-1", "recordRun", "project-1"),
    ).resolves.toMatchObject({
      state: "OFFLINE_GRACE",
      leaseId: lease.id,
    });
    coordinator.deactivate();
  });

  it("preserves the longer completion grace for an already-authorised close", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    installBrowserState();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ state: "AVAILABLE", lease: null }))
        .mockResolvedValueOnce(
          jsonResponse({ state: "OWNED_BY_THIS_DEVICE", lease }),
        )
        .mockRejectedValueOnce(new TypeError("network unavailable")),
    );
    const coordinator = new PilotLeaseCoordinator();

    await coordinator.activateHole("hole-1", "project-1");
    vi.setSystemTime(new Date("2026-07-28T13:00:00.000Z"));
    await coordinator.activateHole("hole-1", "project-1", "completeHole");

    const state = coordinator.getSnapshot();
    expect(state.kind).toBe("OFFLINE_GRACE");
    if (state.kind === "OFFLINE_GRACE") {
      expect(state.graceExpiresAt).toBe("2026-07-29T00:00:00.000Z");
    }
    coordinator.deactivate();
  });
});
