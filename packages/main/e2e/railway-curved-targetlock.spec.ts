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
    await page.locator("summary").filter({ hasText: "Optional setup" }).click();
    await page.getByTestId("new-hole-target-md").fill("650.0");
    await page.getByLabel("Target Easting (m)").fill("382575.0");
    await page.getByLabel("Target Northing (m)").fill("6543246.0");
    await page.getByLabel("Target RL (m)").fill("-105.0");
    await page.getByTestId("new-hole-specify-entry-direction").check();
    await page.getByTestId("new-hole-entry-dip").fill("-74.0");
    await page.getByTestId("new-hole-entry-azimuth").fill("145.0");
  }

  await page.getByTestId("new-hole-submit").click();
  await expect(page).toHaveURL(new RegExp(`/holes/${holeId}/current`), {
    timeout: 30_000,
  });
  await page.goto(`/holes/${holeId}/trajectory`);
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

test("Railway B — new hole with specified target entry direction", async ({
  page,
}) => {
  const holeId = `RLV${Date.now().toString().slice(-6)}`;
  await page.goto("/holes/new");
  await expect(page.getByTestId("new-hole-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.locator("summary").filter({ hasText: "Optional setup" }).click();
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
  await expect(
    page.getByTestId("new-hole-advanced-target-options"),
  ).toBeVisible();
  await page.getByTestId("new-hole-specify-entry-direction").check();
  await page.getByTestId("new-hole-entry-dip").fill("-74.0");
  await page.getByTestId("new-hole-entry-azimuth").fill("145.0");
  await page.getByTestId("new-hole-submit").click();
  await expect(page).toHaveURL(new RegExp(`/holes/${holeId}/current`), {
    timeout: 30_000,
  });
  await page.goto(`/holes/${holeId}/trajectory`);
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await expect(page.getByTestId("trajectory-edit-target")).toHaveCount(0);
  await expect(page.getByTestId("collar-guidance-banner")).toBeVisible();
  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await expect(
    page.getByText(/Target MD 650\.0 m/i),
  ).toBeVisible();
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
  await expect(page.getByTestId("trajectory-edit-target")).toHaveCount(0);

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
  await expect(page.getByTestId("trajectory-target-status")).toBeVisible();
});

test("Railway D — DDH041 seeded KPIs, status chip, and 3D viewer", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });

  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText(/REVIEW/i);
  await expect(
    page.getByTestId("trajectory-metric-projected-miss"),
  ).toHaveCount(0);
  await expect(page.getByTestId("trajectory-metric-target")).toHaveCount(0);
  await expect(page.getByTestId("trajectory-target-status")).toContainText(
    /On target|Near miss|Projected miss/i,
  );
  await expect(page.getByTestId("trajectory-target-status")).not.toContainText(
    /radius/i,
  );
  await expect(page.getByTestId("trajectory-more-details-toggle")).toHaveCount(
    0,
  );
  await expect(page.getByText(/Next-Survey guidance/i)).toHaveCount(0);
  await expect(page.getByTestId("trajectory-r3f-viewer")).toBeVisible();
  await expect(page.getByTestId("trajectory-r3f-legend")).toBeVisible();
  await expect(page.getByTestId("trajectory-toggle-plan-section")).toHaveCount(
    0,
  );
});

test("Railway E — refresh preserves hole, target MD, and survey interval", async ({
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
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/Latest Survey .+ · Target MD 800\.0 m/i),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/Latest Survey .+ · Target MD 800\.0 m/i),
  ).toBeVisible();
  await expect(page.getByTestId("trajectory-target-status")).toBeVisible();

  await page.goto("/holes/DDH041/survey-settings");
  await expect(page.getByTestId("survey-interval-input")).toHaveValue("30.0");
});

test("Railway F — seeded demo stays reachable (no unreachable banner)", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("target-unreachable-banner")).toHaveCount(0);
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText(/REVIEW/i);
  await expect(page.getByTestId("trajectory-metric-target")).toHaveCount(0);
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
