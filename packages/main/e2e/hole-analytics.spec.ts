import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  resetPilotBrowserState,
  selectOnlyFormat,
  startDayShift,
} from "./helpers/pilot";

test.setTimeout(300_000);

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

async function completeLocalRun(
  page: Page,
  runNumber: number,
  options: {
    readonly rod: "3.0" | "6.0";
    readonly stickUp: string;
    readonly recovered: string;
  },
) {
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(
    page.getByRole("heading", { name: `Record run ${runNumber}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Add ${options.rod} m` }).click();
  await page
    .getByRole("textbox", { name: "Measured stick-up" })
    .fill(options.stickUp);
  await page
    .getByRole("textbox", { name: "Core recovered" })
    .fill(options.recovered);
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);
  return page.url();
}

async function openStatistics(page: Page) {
  await page.goto("/holes/DDH041/statistics");
  await expect(page.getByTestId("hole-analytics-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("hole-analytics-production")).toBeVisible({
    timeout: 30_000,
  });
}

test("Workflow 1 — Hole Analytics", async ({ page }) => {
  await openStatistics(page);
  await expect(page.getByTestId("hole-analytics-production")).toBeVisible();
  await expect(page.getByTestId("hole-analytics-shifts")).toBeVisible();
  await expect(page.getByTestId("hole-analytics-components")).toBeVisible();
  await expect(page.getByTestId("hole-analytics-barrels")).toBeVisible();
  await expect(page.getByTestId("hole-analytics-surveys")).toBeVisible();
  await expect(page.getByText("Weighted core recovery").first()).toBeVisible();
  await expect(page.getByTestId("hole-analytics-casing")).toHaveCount(0);
  await expect(page.getByTestId("hole-analytics-completeness")).toHaveCount(0);
  await expect(page.getByTestId("hole-analytics-trays")).toHaveCount(0);
  await expect(page.getByTestId("hole-analytics-trajectory")).toHaveCount(0);

  const runStatistics = page.getByTestId("hole-analytics-production");
  await runStatistics.scrollIntoViewIfNeeded();
  await expect(runStatistics.getByText("Total drilled")).toBeVisible();
  await expect(runStatistics.getByText("Weighted core recovery")).toBeVisible();
  const metresBefore = (
    await runStatistics
      .getByText("Total drilled")
      .locator("..")
      .locator("dd")
      .first()
      .textContent()
  )?.trim();
  await page.reload();
  await expect(page.getByTestId("hole-analytics-production")).toBeVisible({
    timeout: 30_000,
  });
  if (metresBefore) {
    await expect(
      page
        .getByTestId("hole-analytics-production")
        .getByText("Total drilled")
        .locator("..")
        .getByText(metresBefore, { exact: true }),
    ).toBeVisible();
  }
});

test("Workflow 2 — Corrected Run updates recovery not depth", async ({
  page,
}) => {
  await startDayShift(page);
  const runUrl = await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "2.5",
  });

  await openStatistics(page);
  const depthBefore = await page
    .getByTestId("hole-analytics-production")
    .getByText(/Total drilled/i)
    .locator("..")
    .getByText(/\d+\.\d+ m/)
    .textContent();
  const recoveryBefore = await page
    .getByTestId("hole-analytics-production")
    .getByText(/Weighted core recovery/i)
    .locator("..")
    .getByText(/%/)
    .textContent();

  await page.goto(runUrl);
  await page.getByRole("link", { name: "Correct run" }).click();
  await expect(
    page.getByRole("heading", { name: /Correct Run 246/i }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Recovered length" }).click();
  await page.getByRole("textbox", { name: /Correct recovered/i }).fill("3.0");
  await page.getByRole("textbox", { name: "Reason" }).fill("Core remeasured");
  const warningAck = page.getByLabel("Continue despite warnings");
  if (await warningAck.isVisible().catch(() => false)) {
    await warningAck.check();
  }
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("heading", { name: "Run 246", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  await openStatistics(page);
  if (depthBefore) {
    await expect(
      page.getByTestId("hole-analytics-production").getByText(depthBefore),
    ).toBeVisible();
  }
  if (recoveryBefore) {
    await expect(
      page.getByTestId("hole-analytics-production").getByText(recoveryBefore),
    ).toHaveCount(0);
  }
  await expect(
    page
      .getByTestId("hole-analytics-production")
      .getByText("Weighted core recovery"),
  ).toBeVisible();
});

test("Workflow 3 — Voided Run excluded from production", async ({ page }) => {
  await startDayShift(page);
  const runUrl = await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "3.0",
  });

  await openStatistics(page);
  const completedBefore = await page
    .getByTestId("hole-analytics-production")
    .getByText("Completed Runs")
    .locator("..")
    .locator("dd")
    .first()
    .textContent();

  await page.goto(runUrl);
  await page.getByRole("link", { name: /Void run/i }).click();
  await expect(
    page.getByRole("heading", { name: "Void Run 246", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Accidental duplicate").check();
  await page.getByLabel("Void the rod event with the Run").check();
  const voidWarning = page.getByLabel("Continue despite warnings");
  if (await voidWarning.isVisible().catch(() => false)) {
    await voidWarning.check();
  }
  await page.getByRole("button", { name: /Void run 246|Confirm void/i }).click();
  await expect(page.getByText("VOID", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  await openStatistics(page);
  const voided = page
    .getByTestId("hole-analytics-production")
    .getByText(/[1-9]\d* voided/);
  await expect(voided).toBeVisible();
  if (completedBefore) {
    const completedNow = page
      .getByTestId("hole-analytics-production")
      .getByText("Completed Runs")
      .locator("..");
    await expect(completedNow).not.toContainText(completedBefore);
  }
  await expect(page.getByTestId("hole-analytics-production")).toContainText(
    /voided/i,
  );
});

test("Workflow 4 — Charts render with repository datasets", async ({
  page,
}) => {
  await openStatistics(page);
  await expect(page.getByTestId("chart-run-metres")).toBeVisible();
  await expect(page.getByTestId("chart-shift-metres")).toBeVisible();
  await expect(page.getByTestId("chart-cumulative-depth")).toBeVisible();
  await expect(page.getByTestId("chart-bit-metres")).toBeVisible();
  await expect(page.getByTestId("chart-recovery-by-depth")).toHaveCount(0);
  await expect(page.getByTestId("chart-loss-gain")).toHaveCount(0);
  await expect(
    page.getByTestId("chart-shift-metres").locator(".sr-only"),
  ).not.toBeEmpty();
});

test("Workflow 5 — Completed Hole report analytics", async ({ page }) => {
  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: /Download PDF|Open PDF/i }).first(),
  ).toBeVisible();

  await selectOnlyFormat(page, "XLSX");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: /Download Excel|Open Excel|XLSX/i }).first(),
  ).toBeVisible();
});

test("Workflow 6 — Reopened Hole completion versions stay selectable", async ({
  page,
}) => {
  await page.goto("/holes/DDH038/reopen");
  await expect(page.getByRole("heading", { name: "Reopen DDH038" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Analytics version separation check");
  await page.getByRole("button", { name: "Reopen hole" }).click();
  await expect(page.getByText("Hole reopened to Active", { exact: false })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/holes/DDH038/statistics");
  await expect(page.getByTestId("hole-analytics-dashboard")).toBeVisible({
    timeout: 30_000,
  });
  const selector = page.getByTestId("hole-analytics-version-selector");
  await expect(selector).toBeVisible();
  await expect(selector.getByText("Current active Hole")).toBeVisible();
  await expect(selector.getByText(/Completion Version/i).first()).toBeVisible();
  await selector.getByText(/Completion Version/i).first().click();
  await expect(page.getByText(/Showing completion snapshot/i)).toBeVisible({
    timeout: 20_000,
  });
  await selector.getByText("Current active Hole").click();
  await expect(page.getByTestId("hole-analytics-production")).toBeVisible({
    timeout: 20_000,
  });
});

test("Workflow 7 — Responsive statistics light and dark", async ({ page }) => {
  await openStatistics(page);
  const widths = [360, 390, 430, 768, 1024] as const;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/holes/DDH041/statistics");
      await expect(page.getByTestId("hole-analytics-dashboard")).toBeVisible({
        timeout: 30_000,
      });
      await expectNoHorizontalOverflow(
        page,
        `statistics ${width} ${colorScheme}`,
      );
    }
  }
});
