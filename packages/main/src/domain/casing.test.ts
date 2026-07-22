import { describe, expect, it } from "vitest";

import {
  casingEventTypeForDepthChange,
  decimetres,
  formatCasingSummary,
  projectCasingEvents,
  validateCasingRange,
  type CasingEvent,
  type CasingString,
} from ".";

const baseMetadata = {
  serverId: null,
  syncStatus: "local-only" as const,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  deviceId: "test-device",
  version: 1,
};

function casing(overrides: Partial<CasingString> = {}): CasingString {
  return {
    ...baseMetadata,
    localId: "casing-pq",
    holeId: "DDH041",
    casingSize: "PQ",
    startDepthDm: decimetres(0),
    currentEndDepthDm: decimetres(180),
    status: "ACTIVE",
    installedAt: "2026-07-20T00:00:00.000Z",
    installedByUserId: "user-1",
    installedByNameSnapshot: "M. Hoffman",
    ...overrides,
  };
}

function event(overrides: Partial<CasingEvent> = {}): CasingEvent {
  return {
    ...baseMetadata,
    localId: "event-install",
    holeId: "DDH041",
    casingStringId: "casing-pq",
    eventType: "INSTALL",
    newEndDepthDm: decimetres(60),
    newStatus: "ACTIVE",
    recordedByUserId: "user-1",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-20T00:00:00.000Z",
    operationId: "operation-install",
    ...overrides,
  };
}

describe("casing domain", () => {
  it("validates casing ranges and warns above completed hole depth", () => {
    expect(
      validateCasingRange(decimetres(0), decimetres(60), decimetres(100)),
    ).toEqual({ ok: true, requiresDepthConfirmation: false });
    expect(
      validateCasingRange(decimetres(0), decimetres(120), decimetres(100)),
    ).toMatchObject({ ok: true, requiresDepthConfirmation: true });
    expect(
      validateCasingRange(decimetres(70), decimetres(60), decimetres(100)),
    ).toMatchObject({ ok: false });
  });

  it("distinguishes physical advancement from shortening", () => {
    expect(casingEventTypeForDepthChange(decimetres(60), decimetres(180))).toBe(
      "ADVANCE",
    );
    expect(casingEventTypeForDepthChange(decimetres(180), decimetres(175))).toBe(
      "SHORTEN",
    );
    expect(() =>
      casingEventTypeForDepthChange(decimetres(180), decimetres(180)),
    ).toThrow();
  });

  it("replays immutable install, advance and correction events", () => {
    const events = [
      event(),
      event({
        localId: "event-advance",
        eventType: "ADVANCE",
        previousEndDepthDm: decimetres(60),
        newEndDepthDm: decimetres(180),
        recordedAt: "2026-07-21T00:00:00.000Z",
        operationId: "operation-advance",
      }),
      event({
        localId: "event-correct",
        eventType: "CORRECT",
        previousEndDepthDm: decimetres(180),
        newEndDepthDm: decimetres(175),
        reason: "Entry mistake",
        recordedAt: "2026-07-21T01:00:00.000Z",
        operationId: "operation-correct",
      }),
    ];

    expect(projectCasingEvents(casing(), events)).toEqual({
      endDepthDm: decimetres(175),
      status: "ACTIVE",
    });
    expect(events[1]!.newEndDepthDm).toBe(180);
  });

  it("formats all current nested casing strings", () => {
    expect(
      formatCasingSummary([
        casing(),
        casing({
          localId: "casing-hq",
          casingSize: "HQ",
          currentEndDepthDm: decimetres(420),
        }),
      ]),
    ).toBe("PQ to 18.0 m; HQ to 42.0 m");
  });
});
