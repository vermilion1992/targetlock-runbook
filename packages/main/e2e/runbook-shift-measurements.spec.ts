import { expect, test, type Locator } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  resetPilotBrowserState,
} from "./helpers/pilot";

const RUNBOOK_URL = "/holes/DDH041/runbook";
const NIGHT_SHIFT_HEADING = "NIGHT SHIFT — 2026-07-21";
const EXPECTED_HEADERS = [
  "Run",
  "Shift",
  "Rod string",
  "Stick up",
  "Hole depth",
  "Drilled",
  "Recovered",
  "Recovery",
  "Bit",
] as const;

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

async function expectRunMeasurements(
  row: Locator,
  measurements: readonly string[],
) {
  for (const measurement of measurements) {
    await expect(row).toContainText(measurement);
  }
}

test("closed Night Shift uses completed-Run measurements and bit-only columns", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(RUNBOOK_URL);

  const nightSection = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: NIGHT_SHIFT_HEADING,
      exact: true,
    }),
  });
  const table = nightSection.getByTestId("shift-runs-table");
  await expect(table).toBeVisible();

  await expect(table.getByRole("columnheader")).toHaveText(EXPECTED_HEADERS);
  await expect(
    table.getByRole("columnheader", { name: "End depth", exact: true }),
  ).toHaveCount(0);
  await expect(
    table.getByRole("columnheader", { name: "Bit / reamer", exact: true }),
  ).toHaveCount(0);

  const runLinks = table.getByRole("link");
  await expect(runLinks).toHaveCount(13);
  await expect(runLinks).toHaveText(
    Array.from({ length: 13 }, (_, index) => String(233 + index)),
  );

  const run233 = table.locator("tr").filter({
    has: page.getByRole("link", { name: "233", exact: true }),
  });
  const run234 = table.locator("tr").filter({
    has: page.getByRole("link", { name: "234", exact: true }),
  });
  const run235 = table.locator("tr").filter({
    has: page.getByRole("link", { name: "235", exact: true }),
  });

  await expectRunMeasurements(run233, [
    "Shared",
    "662.5 m",
    "0.1 m",
    "662.4 m",
    "0.9 m",
    "100.0%",
    "BIT-HQ-002193",
  ]);
  await expectRunMeasurements(run234, [
    "Night",
    "668.5 m",
    "3.1 m",
    "665.4 m",
    "3.0 m",
    "100.0%",
    "BIT-HQ-002193",
  ]);
  await expectRunMeasurements(run235, [
    "Night",
    "668.5 m",
    "0.1 m",
    "668.4 m",
    "3.0 m",
    "100.0%",
    "BIT-HQ-002193",
  ]);
  await expect(table).not.toContainText("REA-HQ-000912");
  await expect(nightSection).toContainText("Starting 661.5 m");
  await expect(nightSection).toContainText("Ending 698.4 m");

  await page.screenshot({
    path: testInfo.outputPath("runbook-night-shift-desktop.png"),
    fullPage: true,
  });
});

test("closed Shift phone table uses compact columns without page scroll", async ({
  page,
}, testInfo) => {
  for (const width of [360, 390, 430, 768, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(RUNBOOK_URL);

    if (width < 768) {
      const nightDetails = page.locator("details").filter({
        hasText: NIGHT_SHIFT_HEADING,
      });
      if ((await nightDetails.getAttribute("open")) === null) {
        await nightDetails.locator("summary").click();
      }
      const table = nightDetails.getByTestId("shift-runs-table-mobile");
      await expect(table).toBeVisible();
      await expect(table.getByRole("columnheader")).toHaveText([
        "Run",
        "R/S",
        "S/U",
        "HD",
        "D",
        "R",
      ]);
      const run233 = table.locator("tr").filter({
        has: page.getByRole("link", { name: "233", exact: true }),
      });
      await expect(run233).toBeVisible();
      await expectRunMeasurements(run233, [
        "662.5 m",
        "0.1 m",
        "662.4 m",
        "0.9 m",
      ]);
      await expect(table).not.toContainText("BIT-HQ-002193");
      await expect(table).not.toContainText("REA-HQ-000912");
      expect(
        await table.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
        `${width}px compact table must fit without horizontal scroll`,
      ).toBe(true);
      if (width === 390) {
        await page.screenshot({
          path: testInfo.outputPath("runbook-night-shift-phone.png"),
          fullPage: true,
        });
      }
    } else {
      const scrollRegion = page
        .locator("section")
        .filter({
          has: page.getByRole("heading", {
            name: NIGHT_SHIFT_HEADING,
            exact: true,
          }),
        })
        .getByTestId("shift-runs-scroll");
      await expect(scrollRegion.getByTestId("shift-runs-table")).toBeVisible();
      expect(
        await scrollRegion.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
        `${width}px table should scroll within its own region`,
      ).toBe(true);
    }

    await expectNoHorizontalOverflow(page, `Runbook Shift detail at ${width}px`);
  }
});
