import { beforeEach, describe, expect, it } from "vitest";

import { PilotRateLimitError } from "./http";
import {
  consumeRateLimit,
  resetRateLimitsForTests,
} from "./rate-limit";

describe("pilot rate limit", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("blocks repeated login attempts for the configured window", () => {
    consumeRateLimit("login:device:user", {
      limit: 2,
      windowMs: 60_000,
      now: 1_000,
    });
    consumeRateLimit("login:device:user", {
      limit: 2,
      windowMs: 60_000,
      now: 2_000,
    });
    expect(() =>
      consumeRateLimit("login:device:user", {
        limit: 2,
        windowMs: 60_000,
        now: 3_000,
      }),
    ).toThrow(PilotRateLimitError);
  });
});
