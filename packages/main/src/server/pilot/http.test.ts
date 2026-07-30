import { describe, expect, it } from "vitest";

import type { SecurePilotEnvironment } from "./environment";
import { assertSameOrigin, PilotCsrfError } from "./http";

const environment: SecurePilotEnvironment = {
  mode: "pilot",
  nodeEnv: "production",
  databaseUrl: "postgresql://db/targetlock",
  sessionSecret: "s".repeat(48),
  appOrigin: "https://pilot.example.test",
  sessionTtlSeconds: 3600,
};

describe("pilot CSRF boundary", () => {
  it("accepts only the configured exact origin", () => {
    const request = new Request("https://pilot.example.test/api/pilot/action", {
      method: "POST",
      headers: { Origin: "https://pilot.example.test" },
    });
    expect(() => assertSameOrigin(request, environment)).not.toThrow();
  });

  it("rejects missing and cross-origin mutations", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://pilot.example.test/api/pilot/action", {
          method: "POST",
        }),
        environment,
      ),
    ).toThrow(PilotCsrfError);
    expect(() =>
      assertSameOrigin(
        new Request("https://pilot.example.test/api/pilot/action", {
          method: "POST",
          headers: { Origin: "https://attacker.example" },
        }),
        environment,
      ),
    ).toThrow(PilotCsrfError);
  });
});
