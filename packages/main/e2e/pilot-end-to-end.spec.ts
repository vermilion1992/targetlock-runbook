import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  resetPilotBrowserState,
  selectOnlyFormat,
  selectOptionMatching,
  startDayShift,
  uploadTrayPhoto,
} from "./helpers/pilot";

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

test("TargetLock Runbook V1 complete local pilot workflow", async ({
  page,
}) => {
  // 1. Open active test hole
  await page.goto("/holes/DDH041/current");
  await expect(
    page.getByRole("heading", { name: "DDH041 overview" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No active shift" })).toBeVisible();

  // 2. Start Day Shift
  await startDayShift(page);

  // 3. Complete a Run with a 3.0 m rod
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(page.getByRole("heading", { name: "Record run 246" })).toBeVisible();
  await page.getByRole("button", { name: "Add 3.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.1");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("3.0");
  await page.getByRole("textbox", { name: "Core recovered" }).press("Tab");
  const completeRunButton = page.getByRole("button", { name: "Complete run" });
  await expect(completeRunButton).toBeEnabled();
  await completeRunButton.click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);
  await expect(
    page.getByRole("heading", { name: "Run 246", exact: true }),
  ).toBeVisible();

  // 4. Complete a Run with a 6.0 m rod
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(
    page.getByRole("heading", { name: "Record run 247", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add 6.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.1");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("6.0");
  await page.getByRole("textbox", { name: "Core recovered" }).press("Tab");
  await expect(completeRunButton).toBeEnabled();
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);
  await expect(
    page.getByRole("heading", { name: "Run 247", exact: true }),
  ).toBeVisible();

  // 5. Start another Run (for shared handover)
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(
    page.getByRole("heading", { name: "Record run 248", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Draft saved locally/)).toBeVisible();
  await page.getByRole("link", { name: "Back to Overview" }).click();

  // 6. Close and hand over to Night Shift
  await page.getByRole("link", { name: "Close shift" }).click();
  await expect(page.getByText("Run 248 is in progress")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Handover note" })
    .fill("PilotLock pilot handover with shared run 248.");
  await page.getByRole("button", { name: "Close and hand over" }).click();
  await expect(
    page.getByRole("heading", { name: "DAY SHIFT HANDOVER" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Shift" }).selectOption("NIGHT");
  await page
    .getByRole("combobox", { name: "Incoming driller" })
    .selectOption({ label: "J. Smith" });
  await page.getByRole("button", { name: "Accept handover" }).click();
  await expect(
    page.getByText("Handover accepted. The incoming shift now owns new work."),
  ).toBeVisible();

  // 7. Complete the same shared Run
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(
    page.getByRole("heading", { name: "Record run 248", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add 3.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.0");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("3.0");
  await page.getByRole("textbox", { name: "Core recovered" }).press("Tab");
  await expect(completeRunButton).toBeEnabled();
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);
  await expect(page.getByText("Shared between shifts")).toBeVisible();

  // 8. Advance casing
  await page.goto("/holes/DDH041/casing");
  await page.getByRole("textbox", { name: "New end depth" }).fill("19.0");
  await page.getByRole("button", { name: "Save advance" }).click();
  await expect(page.getByText("Casing advanced.")).toBeVisible();

  // 9. Change bit
  await page.goto("/holes/DDH041/components/bit/change");
  await selectOptionMatching(page, "Incoming component", /BIT-HQ-003007/);
  await page.getByRole("button", { name: "Save Bit change" }).click();
  await expect(page.getByText("Bit change saved at the recorded depth.")).toBeVisible();

  // 10. Change reamer
  await page.goto("/holes/DDH041/components/reamer/change");
  await selectOptionMatching(page, "Incoming component", /REA-HQ-001104/);
  await page.getByRole("button", { name: "Save Reamer change" }).click();
  await expect(
    page.getByText("Reamer change saved at the recorded depth."),
  ).toBeVisible();

  // 11. Add Survey
  await page.goto("/holes/DDH041/surveys/new");
  await page.getByRole("textbox", { name: "Survey depth" }).fill("450.0");
  await page.getByRole("textbox", { name: "Dip" }).fill("-62.4");
  await page.getByRole("textbox", { name: "Azimuth" }).fill("130.1");
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(page.getByText("Survey saved locally.")).toBeVisible();

  // 12. Photograph Tray
  await page.goto("/holes/DDH041/trays/new");
  await uploadTrayPhoto(page);
  await page.getByRole("button", { name: "SAVE TRAY" }).click();
  await expect(
    page.getByText("Tray photograph verified and saved locally."),
  ).toBeVisible();

  // 13. Review Runbook and Timeline
  await page.goto("/holes/DDH041/runbook");
  await expect(page.getByRole("link", { name: "248", exact: true })).toBeVisible();
  await expect(page.getByText("Shared", { exact: true }).last()).toBeVisible();
  await page.goto("/holes/DDH041/timeline");
  await expect(
    page.getByRole("link", { name: /Run 248 completed/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /casing advanced/i }).first(),
  ).toBeVisible();

  // 14. Close final Shift
  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "Close shift" }).click();
  await page.getByRole("button", { name: "Close as final shift" }).click();
  await expect(
    page.getByText("Final shift closed. Continue with final hole review when ready."),
  ).toBeVisible({ timeout: 15_000 });

  // 15. Complete and lock Hole
  await page.goto("/holes/DDH041/complete");
  await expect(
    page.getByRole("heading", { name: "Final hole review" }),
  ).toBeVisible();
  await expect(page.getByText("Blocking checks")).toBeVisible();

  const componentRegion = page.getByRole("region", {
    name: "Active component outcomes",
  });
  await expect(componentRegion).toBeVisible();
  const outcomeBoxes = componentRegion.getByRole("combobox", { name: "Outcome" });
  const outcomeCount = await outcomeBoxes.count();
  expect(outcomeCount).toBeGreaterThan(0);
  for (let index = 0; index < outcomeCount; index += 1) {
    await outcomeBoxes.nth(index).selectOption("SERVICEABLE");
    await componentRegion
      .getByRole("button", { name: "Save component outcome" })
      .nth(index)
      .click();
    await expect(
      componentRegion.getByRole("button", { name: "Save component outcome" }).nth(index),
    ).toBeEnabled({ timeout: 15_000 });
  }

  const surveyRegion = page.getByRole("region", { name: "Final survey" });
  const surveyBox = surveyRegion.getByRole("combobox", { name: "Recorded survey" });
  const deepestSurveyValue = await surveyBox.locator("option").nth(1).getAttribute("value");
  expect(deepestSurveyValue).toBeTruthy();
  await surveyBox.selectOption(deepestSurveyValue!);
  await expect(surveyBox).not.toHaveValue("", { timeout: 15_000 });

  await page.getByRole("button", { name: "Confirm final partial tray" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm final partial tray" }),
  ).toBeEnabled({ timeout: 15_000 });

  const reasonRegion = page.getByRole("region", { name: "Completion reason" });
  await reasonRegion.getByRole("combobox", { name: "Reason" }).selectOption("CLIENT_STOPPED");
  await reasonRegion
    .getByRole("textbox", { name: /Comment/ })
    .fill("TargetLock local pilot completion.");
  await reasonRegion.getByRole("button", { name: "Save reason" }).click();
  await expect(reasonRegion.getByRole("button", { name: "Save reason" })).toBeEnabled({
    timeout: 15_000,
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await page.getByText("Ready to lock").isVisible().catch(() => false)) {
      break;
    }
    const ackButton = page.getByRole("button", { name: /^Acknowledge / }).first();
    if ((await ackButton.count()) === 0) {
      break;
    }
    const ackPanel = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Acknowledge / }) })
      .first();
    await ackPanel.getByRole("textbox").fill("Acknowledged for TargetLock pilot.");
    await ackPanel.getByRole("button", { name: /^Acknowledge / }).click();
    await expect(page.getByRole("button", { name: /^Acknowledge / }).first()).toBeEnabled({
      timeout: 15_000,
    }).catch(() => undefined);
  }

  if (!(await page.getByText("Ready to lock").isVisible().catch(() => false))) {
    const blockers = await page
      .getByRole("region", { name: "Blocking checks" })
      .innerText();
    throw new Error(`Hole remained blocked after review steps:\n${blockers}`);
  }

  await expect(page.getByText("No blocking checks remain.")).toBeVisible();

  await page
    .getByRole("checkbox", {
      name: /I confirm this hole should be completed and locked now/i,
    })
    .check();
  await expect(
    page.getByRole("button", { name: "Complete and lock hole" }),
  ).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Complete and lock hole" }).click();
  await expect(
    page.getByText("Hole completed and locked. Drilling mutations are blocked."),
  ).toBeVisible({ timeout: 30_000 });

  // 16. Confirm mutation routes are blocked
  await page.goto("/holes/DDH041/shifts/start");
  await expect(
    page.getByRole("region", { name: "Hole is not available for shift start" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("Hole status completed does not allow drilling operations."),
  ).toBeVisible();
  await page.goto("/holes/DDH041/current");
  await expect(page.getByText(/locked|Completed/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "RECORD NEXT RUN" })).toHaveCount(0);

  // 17. Generate Full-Hole PDF
  await page.goto("/holes/DDH041/reports");
  await page.getByRole("radio", { name: "Full-Hole Runbook" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Full-Hole Runbook PDF Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });

  // 18. Generate Excel
  await selectOnlyFormat(page, "XLSX");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(
    page.getByText(/Full-Hole Runbook XLSX Version 1 generated locally/i),
  ).toBeVisible({ timeout: 45_000 });

  // 19. Download report
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download PDF/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/Full_Runbook_v001_.*\.pdf$/i);

  // 20–21. Reopen Hole and confirm original completion retained
  await page.goto("/holes/DDH041/reopen");
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Pilot reopen after report generation.");
  await page.getByRole("button", { name: "Reopen hole" }).click();
  await expect(
    page.getByText("Hole reopened to Active", { exact: false }),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto("/holes/DDH041/complete");
  await expect(page.getByText(/previous completion|completion history|COMPLETED/i).first()).toBeVisible();

  // 22. Refresh and verify persistence
  await page.goto("/holes/DDH041/runbook");
  await page.reload();
  await expect(page.getByRole("link", { name: "248", exact: true })).toBeVisible();
  await page.goto("/holes/DDH041/timeline");
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Run 248 completed/i }),
  ).toBeVisible();
  await page.goto("/holes/DDH041/trays");
  await page.reload();
  await expect(page.getByRole("link", { name: /Tray 112/ })).toBeVisible();
  await page.goto("/holes/DDH041/reports/history");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Report activity|Report history/i }),
  ).toBeVisible();
  await expect(page.getByText(/XLSX · Version 1/i).first()).toBeAttached();
  await expect(page.getByText(/PDF · Version 1/i).first()).toBeAttached();

  // Responsive smoke on key pilot surfaces
  for (const width of [360, 390, 430, 768, 1024] as const) {
    await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/holes/DDH041/current");
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalOverflow(
        page,
        `current @ ${width} ${colorScheme}`,
      );
    }
  }
});
