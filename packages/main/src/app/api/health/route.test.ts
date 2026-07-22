import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("health API", () => {
  it("returns HTTP 200 with a small JSON payload", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      status: "ok",
      application: "targetlock-runbook",
    });
  });
});
