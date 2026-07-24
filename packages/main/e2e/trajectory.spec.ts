import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  resetPilotBrowserState,
  selectOnlyFormat,
} from "./helpers/pilot";

test.setTimeout(300_000);

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

test("Workflow 1 — Trajectory cockpit and next-survey KPIs", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-cockpit")).toBeVisible();
  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await expect(page.getByTestId("trajectory-metric-required-dip")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-metric-required-azimuth"),
  ).toBeVisible();
  await expect(
    page.getByTestId("trajectory-metric-projected-miss"),
  ).toBeVisible();
  await expect(page.getByTestId("trajectory-metric-target")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
});

test("Workflow 2 — Plan and setup routes redirect", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory/plan");
  await expect(page).toHaveURL(/\/holes\/DDH041\/trajectory$/);
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/holes/DDH041/trajectory/setup");
  await expect(page).toHaveURL(/\/holes\/DDH041\/survey-settings$/);
  await expect(page.getByTestId("survey-settings-form")).toBeVisible({
    timeout: 30_000,
  });
});

test("Workflow 3 — Three views and field details", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-view-plan").click();
  await expect(page.getByTestId("trajectory-plan-view")).toBeVisible();
  await page.getByTestId("trajectory-view-vertical_section").click();
  await expect(page.getByTestId("trajectory-vertical-section")).toBeVisible();
  await page.getByTestId("trajectory-view-view_3d").click();
  await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible();
  await expect(page.getByTestId("trajectory-field-details")).toBeVisible();
  await expect(
    page.getByText(/Geometric minimum-curvature guidance/i).first(),
  ).toBeVisible();
});

test("Workflow 4 — Edit target with entry direction", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-edit-target")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-edit-target").click();
  await expect(page.getByTestId("set-target-dialog")).toBeVisible();
  await page.getByTestId("target-md-input").fill("650.0");
  await page.getByTestId("specify-entry-direction").check();
  await page.getByTestId("entry-dip-input").fill("-74.0");
  await page.getByTestId("entry-azimuth-input").fill("145.0");
  await page.getByRole("button", { name: "Save target" }).click();
  await expect(page.getByTestId("set-target-dialog")).toHaveCount(0);
  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
});

test("Workflow 5 — Survey settings interval persistence", async ({ page }) => {
  await page.goto("/holes/DDH041/survey-settings");
  await expect(page.getByTestId("survey-settings-form")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("survey-interval-input").fill("30.0");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByTestId("survey-settings-message")).toContainText(
    /30\.0 m/i,
  );

  await page.reload();
  await expect(page.getByTestId("survey-interval-input")).toHaveValue("30.0");

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-metric-required-dip")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByTestId("trajectory-metric-required-dip"),
  ).not.toContainText("Survey interval required");
});

test("Workflow 6 — Duplicate Survey selection", async ({ page }) => {
  await page.goto("/holes/DDH041/surveys/new");
  await page.getByRole("textbox", { name: "Survey depth" }).fill("425.0");
  await page.getByRole("textbox", { name: "Dip" }).fill("-62.0");
  await page.getByRole("textbox", { name: "Azimuth" }).fill("140.0");
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "already exists at this depth" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "SAVE ANYWAY" }).click();
  await page.goto("/holes/DDH041/trajectory/surveys");
  await expect(page.getByTestId("trajectory-survey-selection")).toBeVisible();
  await expect(page.getByTestId("duplicate-depth-4250")).toBeVisible();
  await page
    .getByTestId("duplicate-depth-4250")
    .getByRole("button", { name: "Use selected reading" })
    .click();
  await expect(page.getByText(/Survey History is unchanged/i)).toBeVisible();
});

test("Workflow 7 — New Hole with target entry direction", async ({ page }) => {
  const holeId = `E2E${Date.now().toString().slice(-6)}`;
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
  await page.getByTestId("new-hole-specify-entry-direction").check();
  await page.getByTestId("new-hole-entry-dip").fill("-74.0");
  await page.getByTestId("new-hole-entry-azimuth").fill("145.0");
  await page.getByTestId("new-hole-submit").click();
  await expect(page).toHaveURL(new RegExp(`/holes/${holeId}/trajectory`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
});

test("Workflow 8 — Reports include trajectory summary", async ({ page }) => {
  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });

  const aged = await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((item) =>
      item.includes(":reports"),
    );
    if (!key) return false;
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const envelope = JSON.parse(raw) as {
      snapshots: Array<{
        sourceVersions: Array<{
          entityType: string;
          entityId: string;
          version: number;
        }>;
      }>;
    };
    const snapshot = envelope.snapshots[0];
    if (!snapshot) return false;
    snapshot.sourceVersions = snapshot.sourceVersions.map((item) =>
      item.entityType === "plannedTrajectory" ||
      item.entityType === "survey" ||
      item.entityType === "run" ||
      item.entityType === "target"
        ? { ...item, version: Math.max(0, item.version - 1) }
        : item,
    );
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  });
  expect(aged).toBe(true);

  await page.goto("/holes/DDH041/reports");
  await expect(page.getByText(/Report out of date/i).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("Workflow 9 — Responsive and theme", async ({ page }) => {
  for (const width of [360, 390, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/holes/DDH041/trajectory");
    await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
      timeout: 30_000,
    });
    await expectNoHorizontalOverflow(page, `trajectory ${width}px`);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
});

test("Current Hole shows trajectory section", async ({ page }) => {
  await page.goto("/holes/DDH041/current");
  await expect(page.getByTestId("trajectory-tracking-card")).toBeVisible({
    timeout: 30_000,
  });
});
