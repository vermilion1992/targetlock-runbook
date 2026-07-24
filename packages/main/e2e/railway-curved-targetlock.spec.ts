import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { resetPilotBrowserState, selectOnlyFormat } from "./helpers/pilot";

test.setTimeout(300_000);

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

async function createHoleWithoutCollar(
  page: Page,
  holeId: string,
  options?: { withTarget?: boolean },
) {
  await page.goto("/holes/new");
  await expect(page.getByTestId("new-hole-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("new-hole-id").fill(holeId);
  await page.getByLabel("Collar dip (°)").fill("-60.0");
  await page.getByLabel("Collar azimuth (°)").fill("128.0");

  if (options?.withTarget) {
    await page.getByTestId("new-hole-target-md").fill("650.0");
    await page.getByLabel("Target Easting (m)").fill("382575.0");
    await page.getByLabel("Target Northing (m)").fill("6543246.0");
    await page.getByLabel("Target RL (m)").fill("-105.0");
    await page.getByLabel("Custom target dip and azimuth").check();
    await page.getByLabel("Target dip (°)").fill("-74.0");
    await page.getByLabel("Target azimuth (°)").fill("145.0");
  }

  await page.getByTestId("new-hole-submit").click();
  await expect(page).toHaveURL(new RegExp(`/holes/${holeId}/trajectory`), {
    timeout: 30_000,
  });
}

test("Railway A — health and key routes load", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const body = (await health.json()) as {
    status: string;
    application: string;
  };
  expect(body.status).toBe("ok");
  expect(body.application).toBe("targetlock-runbook");

  for (const path of [
    "/holes/new",
    "/holes/DDH041/trajectory",
    "/holes/DDH041/survey-settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Application error");
  }
  await expect(page.getByTestId("survey-settings-form")).toBeVisible({
    timeout: 30_000,
  });
});

test("Railway B — new hole with custom target attitude", async ({ page }) => {
  const holeId = `RLV${Date.now().toString().slice(-6)}`;
  await page.goto("/holes/new");
  await expect(page.getByTestId("new-hole-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("new-hole-id").fill(holeId);
  await page.getByLabel("Collar dip (°)").fill("-60.0");
  await page.getByLabel("Collar azimuth (°)").fill("128.0");
  await page.getByLabel("Easting (m)").first().fill("382400.0");
  await page.getByLabel("Northing (m)").first().fill("6543100.0");
  await page.getByLabel("RL (m)").first().fill("120.0");
  await page.getByTestId("new-hole-target-md").fill("650.0");
  await page.getByLabel("Target Easting (m)").fill("382575.0");
  await page.getByLabel("Target Northing (m)").fill("6543246.0");
  await page.getByLabel("Target RL (m)").fill("-105.0");
  await page.getByLabel("Custom target dip and azimuth").check();
  await page.getByLabel("Target dip (°)").fill("-74.0");
  await page.getByLabel("Target azimuth (°)").fill("145.0");
  await page.getByTestId("new-hole-submit").click();
  await expect(page).toHaveURL(new RegExp(`/holes/${holeId}/trajectory`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await expect(page.getByTestId("trajectory-edit-target")).toHaveText(
    /Edit Target/i,
  );
  await expect(page.getByTestId("collar-guidance-banner")).toBeVisible();
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "CUSTOM",
  );
  await expect(page.getByTestId("current-trajectory-tracking")).toContainText(
    /At .+ MD/i,
  );
});

test("Railway C — empty collar state then activate with coordinates", async ({
  page,
}) => {
  const holeId = `RLC${Date.now().toString().slice(-6)}`;
  await createHoleWithoutCollar(page, holeId, { withTarget: true });
  await expect(page.getByTestId("trajectory-collar-empty-state")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Collar coordinates required")).toBeVisible();
  await expect(page.getByTestId("trajectory-edit-target")).toHaveText(
    /Edit Target/i,
  );

  await page.getByRole("button", { name: "Add collar coordinates" }).click();
  await expect(page.getByTestId("collar-coordinates-dialog")).toBeVisible();
  await page.getByLabel("Easting (m)").fill("382400.0");
  await page.getByLabel("Northing (m)").fill("6543100.0");
  await page.getByLabel("RL (m)").fill("120.0");
  await page.getByRole("button", { name: /Save coordinates/i }).click();
  await expect(page.getByTestId("collar-coordinates-dialog")).toHaveCount(0);

  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-collar-empty-state")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "CUSTOM",
  );
});

test("Railway D — DDH041 KPIs, residual, radius, views, projection", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-edit-target")).toBeVisible();
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByLabel("Target diameter (m)").fill("6.0");
  await page.getByTestId("target-md-input").fill("650.0");
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);

  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  const dipMetric = page.getByTestId("trajectory-metric-required-dip");
  await expect(dipMetric).toContainText(/At .+ MD/i);
  await expect(
    page.getByTestId("trajectory-metric-projected-miss"),
  ).toBeVisible();
  await expect(page.getByTestId("trajectory-metric-target")).toContainText(
    "Straight spatial distance",
  );

  await expect(page.getByTestId("trajectory-target-status")).toContainText(
    /Projected to (intersect|miss) target/i,
  );
  await expect(page.getByTestId("trajectory-target-status")).toContainText(
    "radius 3.0 m",
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "6.0 m / 3.0 m",
  );
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "Endpoint residual",
  );
  await expect(
    page.getByText(/geometric minimum-curvature path/i).first(),
  ).toBeVisible();

  await page.getByTestId("trajectory-view-plan").click();
  await expect(page.getByTestId("trajectory-plan-view")).toBeVisible();
  await page.getByTestId("trajectory-view-vertical_section").click();
  await expect(page.getByTestId("trajectory-vertical-section")).toBeVisible();
  await page.getByTestId("trajectory-view-view_3d").click();
  await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible();
});

test("Railway E — refresh preserves hole, target, attitude, interval", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/survey-settings");
  await expect(page.getByTestId("survey-settings-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("survey-interval-input").fill("30.0");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByTestId("survey-settings-message")).toContainText(
    /30\.0 m/i,
  );

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-edit-target")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByTestId("target-md-input").fill("650.0");
  await page.getByLabel("Target diameter (m)").fill("6.0");
  await page.getByLabel("Custom target dip and azimuth").check();
  await page.getByLabel("Target dip (°)").fill("-74.0");
  await page.getByLabel("Target azimuth (°)").fill("145.0");
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-field-details")).toContainText(
    "CUSTOM",
  );
  await expect(page.getByText(/Target MD 650\.0 m/i)).toBeVisible();

  await page.goto("/holes/DDH041/survey-settings");
  await expect(page.getByTestId("survey-interval-input")).toHaveValue("30.0");
});

test("Railway F — impossible target MD is blocked", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-edit-target")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();

  // Target MD shallower than latest Survey MD is geometrically impossible.
  await page.getByTestId("target-md-input").fill("50.0");
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);

  const unreachable = page.getByTestId("target-unreachable-banner");
  await expect(unreachable).toBeVisible({ timeout: 30_000 });
  await expect(unreachable).toContainText(/cannot be reached at the entered MD/i);
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText(/At .+ MD/i);
  await expect(page.getByTestId("trajectory-metric-target")).not.toContainText(
    /Remaining MD\s*-/,
  );
  await expect(page.locator("main")).not.toContainText(/Remaining MD\s*-/);
});

test("Railway G — PDF and Excel downloads are valid files", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });

  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download PDF/i }).first().click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).toBeTruthy();
  const pdfBytes = readFileSync(pdfPath!);
  expect(pdfBytes.subarray(0, 4).toString("ascii")).toBe("%PDF");

  await selectOnlyFormat(page, "XLSX");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });
  const xlsxDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Download (Excel|XLSX)/i })
    .first()
    .click();
  const xlsxDownload = await xlsxDownloadPromise;
  expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/i);
  const xlsxPath = await xlsxDownload.path();
  expect(xlsxPath).toBeTruthy();
  const xlsxBytes = readFileSync(xlsxPath!);
  // ZIP/OOXML magic
  expect(xlsxBytes[0]).toBe(0x50);
  expect(xlsxBytes[1]).toBe(0x4b);
});
