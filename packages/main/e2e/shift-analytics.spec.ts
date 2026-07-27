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

async function openCloseShift(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "Close shift" }).click();
  await expect(page.getByTestId("shift-close-analytics")).toBeVisible();
}

test("Workflow 1 — Shift close summary", async ({ page }) => {
  await startDayShift(page);
  await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "2.9",
  });
  await completeLocalRun(page, 247, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "3.0",
  });

  await openCloseShift(page);
  const analytics = page.getByTestId("shift-close-analytics");
  await expect(analytics.getByText("SHIFT BREAKDOWN")).toBeVisible();
  await expect(analytics.getByText("Metres completed")).toBeVisible();
  await expect(analytics.getByText("Runs completed")).toBeVisible();
  await expect(analytics.getByText("Average Run")).toBeVisible();
  await expect(analytics.getByText("Median Run")).toBeVisible();
  await expect(analytics.getByText("Weighted recovery")).toBeVisible();
  await expect(analytics.getByText("ROD ACTIVITY")).toBeVisible();
  await expect(analytics.getByText("3.0 m rods added")).toBeVisible();
  await expect(analytics.getByText("SHIFT RECORDS")).toBeVisible();

  await page.getByRole("button", { name: "Close and hand over" }).click();
  await expect(
    page.getByRole("heading", { name: /DAY SHIFT HANDOVER/i }),
  ).toBeVisible();
  await expect(page.getByText("Completed work")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Completed work")).toBeVisible();
  await expect(page.getByText("Metres completed")).toBeVisible();
});

test("Workflow 2 — Shared Run credited to completing Shift", async ({
  page,
}) => {
  await startDayShift(page);
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(page.getByRole("heading", { name: "Record run 246" })).toBeVisible();
  await page.getByRole("button", { name: "Add 3.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.1");
  await page.getByRole("link", { name: "Back to Overview" }).click();

  await page.getByRole("link", { name: "Close shift" }).click();
  await page.getByRole("button", { name: "Close and hand over" }).click();
  await page.getByRole("combobox", { name: "Shift" }).selectOption("NIGHT");
  await page
    .getByRole("combobox", { name: "Incoming driller" })
    .selectOption({ label: "J. Smith" });
  await page.getByRole("button", { name: "Accept handover" }).click();
  await expect(page.getByText(/Handover accepted/i)).toBeVisible();

  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.0");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("3.0");
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page.getByText("Shared between shifts")).toBeVisible();

  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: /VIEW SHIFT/i }).click();
  await expect(page.getByTestId("shift-detail")).toBeVisible();
  await expect(
    page.getByLabel("Overview").getByText("Shared Runs"),
  ).toBeVisible();
  await expect(page.getByText("Shared run").first()).toBeVisible();
  await expect(
    page.getByLabel("Overview").getByText("Runs completed"),
  ).toBeVisible();
});

test("Workflow 3 — Correction amendment preserves close snapshot", async ({
  page,
}) => {
  await startDayShift(page);
  const runUrl = await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.5",
    recovered: "2.9",
  });

  await openCloseShift(page);
  await page.getByRole("button", { name: "Close and hand over" }).click();
  await page.getByRole("combobox", { name: "Shift" }).selectOption("NIGHT");
  await page
    .getByRole("combobox", { name: "Incoming driller" })
    .selectOption({ label: "J. Smith" });
  await page.getByRole("button", { name: "Accept handover" }).click();
  await expect(page.getByText(/Handover accepted/i)).toBeVisible();

  await page.goto(runUrl);
  await page.getByRole("link", { name: "Correct run" }).click();
  await page.getByRole("button", { name: "Measured stick-up" }).click();
  await page.getByRole("textbox", { name: /Correct stick-up/i }).fill("0.3");
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Post-close stick-up correction");
  const warningAck = page.getByLabel("Continue despite warnings");
  if (await warningAck.isVisible().catch(() => false)) {
    await warningAck.check();
  }
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("heading", { name: "Run 246", exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/holes/DDH041/shifts");
  const dayCard = page
    .getByTestId("shift-history-card")
    .filter({ hasText: "Day Shift" })
    .first();
  await dayCard.getByRole("link", { name: "View shift detail" }).click();
  await expect(page.getByText("SHIFT ANALYTICS AMENDED")).toBeVisible();
  await expect(page.getByText("Original metres")).toBeVisible();
  await expect(page.getByText("Current calculated metres")).toBeVisible();
  await expect(page.getByText("View original close snapshot")).toBeVisible();
});

test("Workflow 4 — Recovery correction updates recovery not metres", async ({
  page,
}) => {
  await startDayShift(page);
  const runUrl = await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "2.5",
  });
  await page.goto("/holes/DDH041/current");
  const metresBefore = await page
    .getByTestId("current-shift-summary")
    .getByText(/^\d+\.\d+ m$/)
    .first()
    .textContent();

  await page.goto(runUrl);
  await page.getByRole("link", { name: "Correct run" }).click();
  await page.getByRole("button", { name: "Recovered length" }).click();
  await page.getByRole("textbox", { name: /Correct recovered/i }).fill("3.0");
  await page.getByRole("textbox", { name: "Reason" }).fill("Core remeasured");
  const warningAck = page.getByLabel("Continue despite warnings");
  if (await warningAck.isVisible().catch(() => false)) {
    await warningAck.check();
  }
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("heading", { name: "Run 246", exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/holes/DDH041/current");
  const summary = page.getByTestId("current-shift-summary");
  await expect(summary.getByText("Metres completed")).toBeVisible();
  await expect(summary.getByText("Runs completed")).toBeVisible();
  if (metresBefore) {
    await expect(summary.getByText(metresBefore)).toBeVisible();
  }
});

test("Workflow 5 — Current-Shift report includes analytics", async ({
  page,
}) => {
  await startDayShift(page);
  await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "2.9",
  });

  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Current-Shift Runbook" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: /Download PDF|Open PDF/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Current_Shift|Current-Shift|v001/i).first()).toBeVisible();
});

test("Workflow 6 — Empty Shift close shows Not available averages", async ({
  page,
}) => {
  await startDayShift(page);
  await openCloseShift(page);
  const analytics = page.getByTestId("shift-close-analytics");
  await expect(analytics.getByText("Runs completed")).toBeVisible();
  await expect(analytics.getByText("0").first()).toBeVisible();
  await expect(analytics.getByText("Average Run")).toBeVisible();
  await expect(analytics.getByText("Not available").first()).toBeVisible();
  await expect(analytics.getByText("NaN")).toHaveCount(0);
  await expect(analytics.getByText("Infinity")).toHaveCount(0);
});

test("Workflow 7 — Responsive close, handover, detail", async ({ page }) => {
  await startDayShift(page);
  await completeLocalRun(page, 246, {
    rod: "3.0",
    stickUp: "0.1",
    recovered: "2.9",
  });
  await openCloseShift(page);
  const closeUrl = page.url();
  await page.getByRole("button", { name: "Close and hand over" }).click();
  await expect(
    page.getByRole("heading", { name: /DAY SHIFT HANDOVER/i }),
  ).toBeVisible();
  const handoverUrl = page.url();
  await page
    .getByRole("combobox", { name: "Incoming driller" })
    .selectOption({ label: "J. Smith" });
  await page.getByRole("button", { name: "Accept handover" }).click();
  await expect(page.getByText(/Handover accepted/i)).toBeVisible();
  await page.goto("/holes/DDH041/shifts");
  await page
    .getByTestId("shift-history-card")
    .filter({ hasText: /CLOSED|HANDOVER/i })
    .filter({ hasText: "Day Shift" })
    .first()
    .getByRole("link", { name: "View shift detail" })
    .click();
  await expect(page.getByTestId("shift-detail")).toBeVisible({ timeout: 20_000 });
  const detailUrl = page.url();

  const widths = [360, 390, 430, 768, 1024] as const;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(closeUrl);
      await expectNoHorizontalOverflow(page, `close ${width} ${colorScheme}`);
      await page.goto(handoverUrl);
      await expectNoHorizontalOverflow(
        page,
        `handover ${width} ${colorScheme}`,
      );
      await page.goto(detailUrl);
      await expect(page.getByTestId("shift-detail")).toBeVisible({
        timeout: 20_000,
      });
      await expectNoHorizontalOverflow(
        page,
        `detail ${width} ${colorScheme}`,
      );
    }
  }
});
