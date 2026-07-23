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

test("Workflow 1 — Straight plan versus actual", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory/plan");
  await expect(page.getByTestId("trajectory-plan-form")).toBeVisible();
  await page.getByLabel("Straight directional plan").check();
  await page.getByRole("textbox", { name: "Plan name" }).fill("E2E straight plan");
  await page.getByRole("textbox", { name: "Collar dip (°)" }).fill("-60.0");
  await page.getByRole("textbox", { name: "Collar azimuth (°)" }).fill("128.0");
  await page.getByRole("textbox", { name: "Endpoint MD (m)" }).fill("650.0");
  await page.getByRole("button", { name: "Save and activate" }).click();
  await expect(page.getByTestId("trajectory-plan-message")).toContainText(
    "Activated",
  );

  await page.goto("/holes/DDH041/trajectory/setup");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByTestId("trajectory-setup-message")).toContainText(
    "saved",
  );

  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await expect(page.getByTestId("trajectory-plan-view")).toBeVisible();
  await expect(page.getByTestId("current-trajectory-tracking")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
});

test("Workflow 2 — Curved plan", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("active-plan-name")).toContainText(
    "Demo curved plan (relative)",
  );
  await expect(page.getByTestId("trajectory-plan-view")).toBeVisible();
  await expect(page.getByTestId("trajectory-vertical-section")).toBeVisible();
  await expect(page.getByText("Planned stations").first()).toBeVisible();
  await expect(
    page.getByText("equal-scale Easting / Northing"),
  ).toBeVisible();
  await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible();
  await expect(page.getByTestId("trajectory-graphics-disclaimer")).toContainText(
    /not certified anti-collision/i,
  );
});

test("Workflow 2b — Interactive 3D graphics controls", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("trajectory-view-view_3d").click();
  await expect(page.getByTestId("trajectory-canvas")).toBeVisible();
  await page.getByTestId("trajectory-vertical-scale-toggle").click();
  await expect(page.getByTestId("trajectory-vertical-scale-toggle")).toContainText(
    /Exaggerated/i,
  );
  await page.getByTestId("trajectory-camera-reset").click();
  await page.getByTestId("trajectory-view-plan").click();
  await page.getByTestId("trajectory-view-vertical_section").click();
  await expect(page.getByTestId("trajectory-inspection-callout")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-current-tracking-callout"),
  ).toBeVisible();
});

test("Workflow 3 — Actual tracking", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  const tracking = page.getByTestId("current-trajectory-tracking");
  await expect(tracking).toBeVisible({
    timeout: 30_000,
  });
  await expect(tracking.getByText("Horizontal deviation")).toBeVisible();
  await expect(tracking.getByText("3D deviation")).toBeVisible();
  await expect(page.getByTestId("trajectory-tracking-table")).toBeVisible();
  await expect(
    page.getByTestId("trajectory-current-tracking-callout"),
  ).toBeVisible();
});

test("Workflow 4 and 5 — Target and plan reach check", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-target-status")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Target status" }),
  ).toBeVisible();
  await expect(
    page.getByText(/endpoint distance to target/i).first(),
  ).toBeVisible();
  await expect(page.getByTestId("trajectory-warnings")).toBeVisible();
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
  await page.goto("/holes/DDH041/surveys");
  await expect(page.getByText("425.0 m").first()).toBeVisible();
});

test("Workflow 7 — Mixed north references block mine-grid", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory/setup");
  await page.getByLabel("Mine grid").check();
  await page.getByRole("textbox", { name: "Collar Easting (m)" }).fill("482315.4");
  await page.getByRole("textbox", { name: "Collar Northing (m)" }).fill("7514882.2");
  await page.getByRole("textbox", { name: "Collar RL (m)" }).fill("487.3");
  await page
    .getByRole("combobox", { name: "Reference", exact: true })
    .selectOption("NOT_SPECIFIED");
  await page
    .getByRole("combobox", { name: "Calculation north reference" })
    .selectOption("GRID");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByTestId("trajectory-setup-message")).toContainText(
    "saved",
  );
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await expect(
    page.getByText(/blocked|unspecified north references|Grid North/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("Workflow 8 — Near vertical warning path", async ({ page }) => {
  await page.goto("/holes/DDH041/trajectory/plan");
  await page.getByLabel("Curved station plan").check();
  await page
    .getByRole("textbox", { name: "Plan name" })
    .fill("E2E near-vertical demo");
  const mdInputs = page.locator('input[aria-label^="Station"][aria-label$="MD"]');
  const dipInputs = page.locator(
    'input[aria-label^="Station"][aria-label$="dip"]',
  );
  const azInputs = page.locator(
    'input[aria-label^="Station"][aria-label$="azimuth"]',
  );
  await mdInputs.nth(0).fill("0.0");
  await dipInputs.nth(0).fill("-89.0");
  await azInputs.nth(0).fill("10.0");
  await mdInputs.nth(1).fill("50.0");
  await dipInputs.nth(1).fill("-89.5");
  await azInputs.nth(1).fill("200.0");
  await mdInputs.nth(2).fill("100.0");
  await dipInputs.nth(2).fill("-89.2");
  await azInputs.nth(2).fill("20.0");
  await page.getByRole("button", { name: "Save and activate" }).click();
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-warnings")).toContainText(
    /Near-vertical/i,
    { timeout: 30_000 },
  );
});

test("Workflow 9 — Reports include trajectory summary", async ({ page }) => {
  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });

  // Age trajectory-related fingerprint entries so currency detects a change.
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
      item.entityType === "run"
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
  await expect(
    page
      .getByText(/Historical report \/ Generated before the latest Hole changes/i)
      .first(),
  ).toBeVisible();
});

test("Workflow 10 — Responsive and theme", async ({ page }) => {
  for (const width of [360, 390, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/holes/DDH041/trajectory");
    await expect(page.getByTestId("trajectory-dashboard")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("trajectory-graphics-viewer")).toBeVisible();
    if (width < 768) {
      await expect(page.getByTestId("trajectory-mobile-fallback")).toBeVisible();
    }
    await expectNoHorizontalOverflow(page, `trajectory ${width}px`);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/holes/DDH041/trajectory");
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
});

test("Current Hole and analytics show trajectory sections", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/current");
  await expect(page.getByTestId("trajectory-tracking-card")).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/holes/DDH041/statistics");
  await expect(page.getByTestId("hole-analytics-trajectory")).toBeVisible({
    timeout: 30_000,
  });
});
