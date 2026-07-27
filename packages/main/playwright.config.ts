import { defineConfig, devices } from "@playwright/test";

const e2eOperatorSession = {
  cookies: [],
  origins: [
    {
      origin: "http://127.0.0.1:3100",
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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    storageState: e2eOperatorSession,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/holes/DDH041/current",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
