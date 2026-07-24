import { defineConfig, devices } from "@playwright/test";

/**
 * Temporary config for live Railway acceptance of curved TargetLock.
 * Do not use for local CI — webServer is intentionally omitted.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: "https://targetlock-runbook-production.up.railway.app",
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
