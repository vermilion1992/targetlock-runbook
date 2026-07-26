import { expect, test } from "@playwright/test";

import { resetPilotBrowserState } from "./helpers/pilot";

test("warns a stale tab when another tab changes runbook storage", async ({
  page,
  context,
}) => {
  await resetPilotBrowserState(page);
  await page.goto("/components/new?holeId=DDH041");
  const otherPage = await context.newPage();
  await otherPage.goto("/components/new?holeId=DDH041");
  await otherPage.evaluate(() => {
    (
      window as typeof window & { __targetLockStorageEventSeen?: boolean }
    ).__targetLockStorageEventSeen = false;
    window.addEventListener(
      "storage",
      () => {
        (
          window as typeof window & {
            __targetLockStorageEventSeen?: boolean;
          }
        ).__targetLockStorageEventSeen = true;
      },
      { once: true },
    );
  });

  await page.evaluate(() => {
    window.localStorage.setItem(
      "targetlock:prototype:v5:hole:DDH041:saved-runs",
      JSON.stringify({
        version: 5,
        holeId: "DDH041",
        syncStatus: "local-only",
        updatedAt: new Date().toISOString(),
        revision: 1,
        snapshots: [],
        corrections: [],
        operations: [],
        rodEventOverrides: [],
      }),
    );
  });

  await expect
    .poll(() =>
      otherPage.evaluate(
        () =>
          (
            window as typeof window & {
              __targetLockStorageEventSeen?: boolean;
            }
          ).__targetLockStorageEventSeen,
      ),
    )
    .toBe(true);
  await expect(
    otherPage.getByText("Another tab updated local runbook data."),
  ).toBeVisible();
  await expect(
    otherPage.getByRole("button", { name: "Reload this view" }),
  ).toBeVisible();
});
