import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL ?? "http://127.0.0.1:3000";
const operatorSession = {
  cookies: [],
  origins: [
    {
      origin: new URL(baseURL).origin,
      localStorage: [
        {
          name: "targetlock:prototype:v1:operator-session",
          value: JSON.stringify({
            version: 1,
            activeOperatorId: "operator-e2e",
            signedInAt: "2026-07-27T14:00:00.000Z",
            profiles: [
              {
                localId: "operator-e2e",
                displayName: "E2E Operator",
                role: "DRILLER",
                createdAt: "2026-07-27T14:00:00.000Z",
                lastSignedInAt: "2026-07-27T14:00:00.000Z",
              },
            ],
          }),
        },
      ],
    },
  ],
};

/**
 * Reuse an already-running local Next server (default :3000).
 * Used for clean visual acceptance captures without spawning a second webServer.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    storageState: operatorSession,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
