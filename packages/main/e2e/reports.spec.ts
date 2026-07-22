import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(async () => {
    window.localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("targetlock-runbook-reports-v1");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByText("DDH041").first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      { message: `${context} should not overflow horizontally` },
    )
    .toBe(true);
}

async function openReports(page: Page, holeId = "DDH041") {
  await page.goto(`/holes/${holeId}/reports`);
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
}

async function selectOnlyFormat(page: Page, format: "PDF" | "XLSX" | "CSV") {
  for (const candidate of ["PDF", "XLSX", "CSV"] as const) {
    const checkbox = page.getByRole("checkbox", { name: candidate });
    const checked = await checkbox.isChecked();
    if ((candidate === format) !== checked) {
      await checkbox.click();
    }
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("1. generate and download Full-Hole PDF", async ({ page }) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Full-Hole Runbook" }).check();
  await selectOnlyFormat(page, "PDF");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Full-Hole Runbook PDF Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: /Download PDF/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/Full_Runbook_v001_.*\.pdf$/i);
});

test("2. generate Excel and confirm Version 2 after regeneration", async ({
  page,
}) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Full-Hole Runbook" }).check();
  await selectOnlyFormat(page, "XLSX");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Full-Hole Runbook XLSX Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Full-Hole Runbook XLSX Version 2 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/XLSX · Version 2/i).first()).toBeVisible();
});

test("3-8. current-shift, survey, tray, share, email, persistence, csv", async ({
  page,
}) => {
  await openReports(page);

  await page.getByRole("radio", { name: "Current-Shift Runbook" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Current-Shift Runbook PDF Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });

  await page.getByRole("radio", { name: "Survey History" }).check();
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Survey History PDF Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });

  await page.getByRole("radio", { name: "Tray Register" }).check();
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Tray Register PDF Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });

  await page.getByRole("button", { name: /Share PDF/i }).first().click();
  await expect(
    page.getByRole("status").filter({
      hasText:
        /shared from this device|downloaded instead|Share cancelled|Not delivered by TargetLock/i,
    }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Prepare Email" }).first().click();
  await expect(page.getByRole("heading", { name: "Prepare Email" })).toBeVisible();
  await page.getByRole("textbox", { name: "To" }).fill("supervisor@briggs.example");
  await page.getByRole("button", { name: "Share to email app" }).click();
  await expect(page.getByText(/Email draft prepared/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Not sent or delivered/i)).toBeVisible();

  await page.goto("/holes/DDH041/reports");
  await expect(
    page.getByRole("heading", { name: "Generated Reports" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Survey History" })
      .first(),
  ).toBeVisible();
  await page.goto("/holes/DDH041/reports/history");
  await expect(page.getByRole("heading", { name: "Report Activity" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Survey History" }).first(),
  ).toBeVisible();

  await openReports(page);
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "CSV");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Hole Summary CSV Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: /Download CSV/i }).first()).toBeVisible();
});

test("9-10. completed locked hole can generate reports without unlocking", async ({
  page,
}) => {
  await page.goto("/holes/DDH038/complete");
  await expect(page.getByText("Hole locked").first()).toBeVisible({
    timeout: 15_000,
  });

  await openReports(page, "DDH038");
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/generated locally/i)).toBeVisible({
    timeout: 45_000,
  });

  await page.goto("/holes/DDH038/complete");
  await expect(page.getByText("Hole locked").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Reopen hole" })).toBeVisible();
});

test("responsive Report Centre widths and themes", async ({ page }) => {
  await openReports(page);
  for (const width of [360, 390, 430, 768, 1024]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
      await expect(
        page.getByRole("heading", { name: "Reports", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(
        page,
        `reports at ${width}px ${colorScheme}`,
      );
    }
  }
});
