import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { resetPilotBrowserState } from "./helpers/pilot";

test.setTimeout(300_000);

const SHOT_DIR = path.join(
  process.cwd(),
  "test-results",
  "ddh041-acceptance-gate",
);

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
  mkdirSync(SHOT_DIR, { recursive: true });
});

async function capturePrimaryView(page: Page, prefix: string) {
  await expect(page.getByTestId("trajectory-r3f-viewer")).toBeVisible();
  await expect(page.getByTestId("trajectory-r3f-legend")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOT_DIR, `${prefix}-3d.png`),
    fullPage: true,
  });
}

async function ensureSurveyInterval(page: Page, metres = "30.0") {
  await page.goto("/holes/DDH041/survey-settings");
  await expect(page.getByTestId("survey-settings-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("survey-interval-input").fill(metres);
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByTestId("survey-settings-message")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("survey-settings-message")).toContainText(
    new RegExp(`${metres.replace(".", "\\.")}\\s*m`, "i"),
  );
}

test("DDH041 seeded mid-hole — KPIs, banners, and 3D capture", async ({
  page,
}) => {
  await ensureSurveyInterval(page, "30.0");

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 60_000,
  });

  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText(/REVIEW/i);
  await expect(
    page.getByTestId("trajectory-metric-required-azimuth"),
  ).toBeVisible();
  await expect(page.getByTestId("target-md-review-banner")).toHaveCount(0);
  await expect(page.getByTestId("advanced-path-review-banner")).toHaveCount(0);
  await expect(
    page.getByTestId("steering-envelope-review-banner"),
  ).toHaveCount(0);
  await expect(page.getByTestId("review-curvature-banner")).toHaveCount(0);
  await expect(page.getByTestId("trajectory-more-details-toggle")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("trajectory-edit-target")).toHaveCount(0);
  await expect(page.getByTestId("trajectory-target-status")).toBeVisible();

  await capturePrimaryView(page, "seeded-midhole");
});

test("DDH041 field cockpit omits technical canvas and header actions", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-r3f-viewer")).toBeVisible();
  await expect(page.getByTestId("trajectory-toggle-plan-section")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("trajectory-export-image")).toHaveCount(0);
  await expect(page.getByText(/Compatibility view/i)).toHaveCount(0);
  await expect(page.getByText(/Next-Survey guidance/i)).toHaveCount(0);
});
