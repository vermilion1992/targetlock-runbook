import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pilot-shadow-smoke.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL:
      process.env.PILOT_E2E_BASE_URL?.trim() ?? "http://127.0.0.1:3000",
    storageState: { cookies: [], origins: [] },
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
