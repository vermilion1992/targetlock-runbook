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

async function captureViews(page: Page, prefix: string) {
  // Default cockpit surface is the R3F 3D viewer.
  await expect(page.getByTestId("trajectory-r3f-viewer")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOT_DIR, `${prefix}-3d.png`),
    fullPage: true,
  });

  await page.getByTestId("trajectory-toggle-plan-section").click();
  await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible();

  await page.getByTestId("trajectory-view-plan").click();
  await expect(page.getByTestId("trajectory-plan-view")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(SHOT_DIR, `${prefix}-plan.png`),
    fullPage: true,
  });

  await page.getByTestId("trajectory-view-vertical_section").click();
  await expect(page.getByTestId("trajectory-vertical-section")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(SHOT_DIR, `${prefix}-section.png`),
    fullPage: true,
  });
}

async function saveAutoSmoothTarget(page: Page) {
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByTestId("target-md-input").fill("650.0");
  await page.getByLabel("Target diameter (m)").fill("10.0");
  const specify = page.getByTestId("specify-entry-direction");
  if (await specify.isChecked()) {
    await specify.uncheck();
  }
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);
}

async function saveMatchEntryTarget(page: Page) {
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByTestId("target-md-input").fill("650.0");
  await page.getByLabel("Target diameter (m)").fill("10.0");
  await page.getByTestId("specify-entry-direction").check();
  await page.getByTestId("entry-dip-input").fill("-74.0");
  await page.getByTestId("entry-azimuth-input").fill("145.0");
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);
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

test("DDH041 AUTO_SMOOTH — KPIs, banners, and view captures", async ({
  page,
}) => {
  await ensureSurveyInterval(page, "30.0");

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 60_000,
  });
  await saveAutoSmoothTarget(page);

  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).toContainText(/At .+ MD/i);
  await expect(
    page.getByTestId("trajectory-metric-required-azimuth"),
  ).toBeVisible();
  await expect(page.getByTestId("target-md-review-banner")).toHaveCount(0);
  await expect(page.getByTestId("advanced-path-review-banner")).toHaveCount(0);

  await page.getByTestId("trajectory-more-details-toggle").click();
  await expect(page.getByTestId("target-entry-mode")).toContainText(
    /Automatic smoothest path/i,
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    /Target MD/,
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "650.0 m",
  );

  await captureViews(page, "auto-smooth");
});

test("DDH041 MATCH_ENTRY -74/145 — advanced review and constraint retained", async ({
  page,
}) => {
  await ensureSurveyInterval(page, "30.0");

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 60_000,
  });
  await saveMatchEntryTarget(page);

  await page.reload();
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-more-details-toggle").click();
  await expect(page.getByTestId("target-entry-mode")).toContainText("Specified");
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    /Target MD/,
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "650.0 m",
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "10.0 m",
  );

  const advancedBanner = page.getByTestId("advanced-path-review-banner");
  if ((await advancedBanner.count()) > 0) {
    await expect(advancedBanner).toBeVisible();
    await expect(advancedBanner).toContainText(/complex path/i);
    // Next-Survey guidance is suppressed when the path is unsuitable.
    await expect(
      page.getByTestId("trajectory-metric-required-dip"),
    ).not.toContainText(/At .+ MD/i);
  }

  // Target must remain visible even when advanced review is required.
  await expect(page.getByTestId("trajectory-metric-target")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/Remaining MD\s*-/);

  await captureViews(page, "match-entry");
});

test("DDH041 blocked automatic — unreachable MD preserves target facts", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-edit-target")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByTestId("target-md-input").fill("50.0");
  await page.getByLabel("Target diameter (m)").fill("10.0");
  const specify = page.getByTestId("specify-entry-direction");
  if (await specify.isChecked()) {
    await specify.uncheck();
  }
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);

  const unreachable = page.getByTestId("target-unreachable-banner");
  await expect(unreachable).toBeVisible({ timeout: 30_000 });
  await expect(unreachable).toContainText(/cannot be reached at the entered MD/i);
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText(/At .+ MD/i);
  await expect(page.getByTestId("trajectory-metric-target")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/Remaining MD\s*-/);
  await page.getByTestId("trajectory-more-details-toggle").click();
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    /Target MD/,
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "50.0 m",
  );
  await page.screenshot({
    path: path.join(SHOT_DIR, "blocked-auto-unreachable.png"),
    fullPage: true,
  });
});
