import { defineConfig, devices } from "@playwright/test";

const requiredEnvironment = [
  "PILOT_E2E_BASE_URL",
  "PILOT_E2E_ORGANISATION",
  "PILOT_E2E_ADMIN_EMAIL",
  "PILOT_E2E_ADMIN_PASSWORD",
] as const;
const missing = requiredEnvironment.filter(
  (name) => !process.env[name]?.trim(),
);
if (missing.length > 0) {
  throw new Error(
    `Pilot acceptance requires: ${missing.join(", ")}.`,
  );
}
const baseURL = process.env.PILOT_E2E_BASE_URL!.trim();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pilot-shadow-smoke.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
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
