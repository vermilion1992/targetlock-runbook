import { expect, test } from "@playwright/test";

import { resetPilotBrowserState } from "./helpers/pilot";

const FOREIGN_HOLE = "DDH042";
const DDH041_RUN_ID = "run-ddh041-233";
const foreignSavedRunsKey =
  `targetlock:prototype:v5:hole:${encodeURIComponent(FOREIGN_HOLE)}:saved-runs`;

test.beforeEach(async ({ page }) => {
  await resetPilotBrowserState(page);
});

test("does not display or materialize a DDH041 run under another hole", async ({
  page,
}) => {
  await page.goto(`/holes/${FOREIGN_HOLE}/runs/${DDH041_RUN_ID}`);
  await expect(
    page.getByText("Record not available for this hole"),
  ).toBeVisible();

  for (const action of ["correct", "void"]) {
    await page.goto(
      `/holes/${FOREIGN_HOLE}/runs/${DDH041_RUN_ID}/${action}`,
    );
    await expect(
      page.getByText("Record not available for this hole"),
    ).toBeVisible();
  }

  await expect
    .poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), foreignSavedRunsKey),
    )
    .toBeNull();
});

test("does not merge DDH041 seed runs into another hole runbook", async ({
  page,
}) => {
  await page.goto(`/holes/${FOREIGN_HOLE}/runbook`);
  await expect(
    page.getByRole("heading", { name: `${FOREIGN_HOLE} runbook` }),
  ).toBeVisible();
  await expect(page.getByText("0 runs", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Run 233/ })).toHaveCount(0);
});

test("keeps secondary-hole context across casing and global component routes", async ({
  page,
}) => {
  await page.goto(`/holes/${FOREIGN_HOLE}/casing`);
  await expect(
    page.getByRole("heading", { name: "Casing history" }),
  ).toBeVisible();

  await page.goto(`/components/new?holeId=${FOREIGN_HOLE}`);
  await expect(page.getByLabel(`Current hole ${FOREIGN_HOLE}`)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add Bit serial" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("href", `/holes/${FOREIGN_HOLE}/current`);
});
