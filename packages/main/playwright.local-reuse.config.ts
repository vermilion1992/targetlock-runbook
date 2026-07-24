import { defineConfig, devices } from "@playwright/test";

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
    baseURL: process.env.PW_BASE_URL ?? "http://127.0.0.1:3000",
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
